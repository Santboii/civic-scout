// ── Multi-City Data Layers ──────────────────────────────────────────────────
// NOTE(Agent): Refactored from Chicago-only to registry-based. Crime, violation,
// and crash data are now fetched using DataLayerRegistry entries from Supabase,
// just like permits use CityRegistry. The normalizer functions remain unchanged —
// they parse raw Socrata rows into typed objects. Column mapping from the registry
// is applied before normalization so each city's field names resolve correctly.

import type { PermitSeverity } from './permit-classifier'
import { classifyCrime, classifyViolation, classifyCrash } from './data-layer-classifier'
import type { DataLayerRegistry, DataLayerColumnMap } from './data-layer-registry'

// ── Types ───────────────────────────────────────────────────────────────────

export type DataLayerType = 'crimes' | 'violations' | 'crashes'

export interface CrimeIncident {
    readonly layerType: 'crimes'
    id: string
    caseNumber: string
    date: string
    primaryType: string
    description: string
    block: string
    lat: number
    lon: number
    arrest: boolean
    domestic: boolean
    severity: PermitSeverity
    severityReason: string
    communityNote: string
}

export interface BuildingViolation {
    readonly layerType: 'violations'
    id: string
    violationDate: string
    violationCode: string
    violationDescription: string
    violationStatus: string
    inspectionStatus: string
    address: string
    departmentBureau: string
    lat: number
    lon: number
    severity: PermitSeverity
    severityReason: string
    communityNote: string
}

export interface TrafficCrash {
    readonly layerType: 'crashes'
    id: string
    crashDate: string
    crashType: string
    injuriesTotal: number
    injuriesFatal: number
    damage: string
    primContributoryCause: string
    lat: number
    lon: number
    severity: PermitSeverity
    severityReason: string
    communityNote: string
}

export type DataLayerItem = CrimeIncident | BuildingViolation | TrafficCrash

export interface DataLayersResponse {
    crimes?: { data: CrimeIncident[]; source: string }
    violations?: { data: BuildingViolation[]; source: string }
    crashes?: { data: TrafficCrash[]; source: string }
}

// ── Constants ───────────────────────────────────────────────────────────────

const RADIUS_METERS = 8046 // ≈ 5 miles (matches permits)

// ── HTML Escaping ───────────────────────────────────────────────────────────

// NOTE(Agent): Socrata data is rendered in Leaflet popup innerHTML. Without
// escaping, a malicious work_description or crime description could inject
// HTML/JS. This is a defense-in-depth measure.
export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

// ── Column Mapping ──────────────────────────────────────────────────────────

// NOTE(Agent): Applies the registry's column_map to a raw Socrata row.
// If the column_map has { "primary_type": "crime_category" }, then
// row["crime_category"] becomes the value for "primary_type" in the normalized row.
// Identity mappings (where key === value) are the common case for Chicago.
// IMPORTANT: Only mapped fields are passed through. Unmapped Socrata fields are
// dropped to prevent PII leakage into caches and logs.
function applyColumnMap(row: SocrataRow, columnMap: DataLayerColumnMap): SocrataRow {
    const mapped: SocrataRow = {}
    for (const [normalizedKey, socrataKey] of Object.entries(columnMap)) {
        mapped[normalizedKey] = row[socrataKey]
    }
    // NOTE(Agent): latitude/longitude are always needed by normalizers for geo filtering
    // but may not be in every column_map since they're "always present" in Socrata responses.
    if (!('latitude' in mapped) && row.latitude != null) mapped.latitude = row.latitude
    if (!('longitude' in mapped) && row.longitude != null) mapped.longitude = row.longitude
    return mapped
}

// ── Generic Fetcher ─────────────────────────────────────────────────────────

type SocrataRow = Record<string, unknown>

function socrataHeaders(): Record<string, string> {
    return {
        'X-App-Token': process.env.SOCRATA_APP_TOKEN ?? '',
        Accept: 'application/json',
    }
}

/**
 * Generic Socrata fetcher for data layers. Builds URL from registry config.
 * Supports two geo strategies:
 * - 'point': within_circle() on a Socrata Point-type column
 * - 'separate': bounding-box on separate lat/lon number columns
 */
async function fetchFromRegistry(
    lat: number,
    lon: number,
    registry: DataLayerRegistry,
    limit: number = 100
): Promise<SocrataRow[]> {
    // Build the geo filter based on geo_type
    let geoClause: string
    if (registry.geo_type === 'separate') {
        // NOTE(Agent): Bounding-box fallback for datasets with separate lat/lon columns.
        // Mirrors the logic in socrata.ts for permits.
        const latDelta = RADIUS_METERS / 111_000
        const lonDelta = RADIUS_METERS / (111_000 * Math.cos((lat * Math.PI) / 180))
        const latCol = registry.column_map['latitude'] ?? 'latitude'
        const lonCol = registry.column_map['longitude'] ?? 'longitude'
        geoClause = [
            `${latCol} > ${lat - latDelta}`,
            `${latCol} < ${lat + latDelta}`,
            `${lonCol} > ${lon - lonDelta}`,
            `${lonCol} < ${lon + lonDelta}`,
        ].join(' AND ')
    } else {
        geoClause = `within_circle(${registry.geo_column}, ${lat}, ${lon}, ${RADIUS_METERS})`
    }

    const params = new URLSearchParams({
        $where: geoClause,
        $order: registry.order_by,
        $limit: String(limit),
    })

    const url = `https://${registry.domain}/resource/${registry.dataset_id}.json?${params}`
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[data-layers] Fetching ${registry.layer_type} from ${registry.city}:`, url)
    }

    const res = await fetch(url, {
        headers: socrataHeaders(),
        next: { revalidate: 0 },
    })

    if (!res.ok) {
        console.error(`[data-layers] ${registry.layer_type} error (${registry.city}):`, await res.text())
        return []
    }

    const data: SocrataRow[] = await res.json()
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[data-layers] ${registry.layer_type} results (${registry.city}):`, data.length)
    }

    return data
}

// ── Public Fetchers ─────────────────────────────────────────────────────────

/**
 * Fetch crime incidents near a lat/lon using a data layer registry.
 */
export async function fetchCrimeIncidents(
    lat: number,
    lon: number,
    registry: DataLayerRegistry
): Promise<CrimeIncident[]> {
    try {
        const rawRows = await fetchFromRegistry(lat, lon, registry)
        return rawRows
            .map((row) => normalizeCrime(applyColumnMap(row, registry.column_map)))
            .filter((c): c is CrimeIncident => c !== null)
    } catch (err) {
        console.error(`[data-layers] Crimes fetch failed (${registry.city}):`, err)
        return []
    }
}

/**
 * Fetch building violations near a lat/lon using a data layer registry.
 */
export async function fetchBuildingViolations(
    lat: number,
    lon: number,
    registry: DataLayerRegistry
): Promise<BuildingViolation[]> {
    try {
        const rawRows = await fetchFromRegistry(lat, lon, registry)
        return rawRows
            .map((row) => normalizeViolation(applyColumnMap(row, registry.column_map)))
            .filter((v): v is BuildingViolation => v !== null)
    } catch (err) {
        console.error(`[data-layers] Violations fetch failed (${registry.city}):`, err)
        return []
    }
}

/**
 * Fetch traffic crashes near a lat/lon using a data layer registry.
 */
export async function fetchTrafficCrashes(
    lat: number,
    lon: number,
    registry: DataLayerRegistry
): Promise<TrafficCrash[]> {
    try {
        const rawRows = await fetchFromRegistry(lat, lon, registry)
        return rawRows
            .map((row) => normalizeCrash(applyColumnMap(row, registry.column_map)))
            .filter((c): c is TrafficCrash => c !== null)
    } catch (err) {
        console.error(`[data-layers] Crashes fetch failed (${registry.city}):`, err)
        return []
    }
}

// ── Normalizers ─────────────────────────────────────────────────────────────

// NOTE(Agent): Each normalizer safely extracts fields from unknown Socrata rows.
// Rows missing lat/lon are dropped (return null). String fields are HTML-escaped
// since they'll be rendered in Leaflet popup innerHTML.

function normalizeCrime(row: SocrataRow): CrimeIncident | null {
    const lat = parseFloat(String(row.latitude ?? '0'))
    const lon = parseFloat(String(row.longitude ?? '0'))
    if (!lat || !lon) return null

    // NOTE(Agent): Classify BEFORE escaping — keyword matching must operate on
    // raw Socrata strings. HTML entities (e.g. &#39;) would break type lookups.
    const rawPrimaryType = String(row.primary_type ?? '')
    const rawDescription = String(row.description ?? '')
    const domestic = row.domestic === true || row.domestic === 'true'
    const classification = classifyCrime({
        primaryType: rawPrimaryType,
        description: rawDescription,
        domestic,
    })

    return {
        layerType: 'crimes',
        id: String(row.id ?? ''),
        caseNumber: String(row.case_number ?? ''),
        date: String(row.date ?? ''),
        primaryType: escapeHtml(rawPrimaryType),
        description: escapeHtml(rawDescription),
        block: escapeHtml(String(row.block ?? '')),
        lat,
        lon,
        arrest: row.arrest === true || row.arrest === 'true',
        domestic,
        severity: classification.severity,
        severityReason: classification.severityReason,
        communityNote: classification.communityNote,
    }
}

function normalizeViolation(row: SocrataRow): BuildingViolation | null {
    const lat = parseFloat(String(row.latitude ?? '0'))
    const lon = parseFloat(String(row.longitude ?? '0'))
    if (!lat || !lon) return null

    // NOTE(Agent): Classify BEFORE escaping — keyword matching on raw strings.
    const rawViolationDescription = String(row.violation_description ?? '')
    const rawViolationStatus = String(row.violation_status ?? '')
    const rawViolationCode = String(row.violation_code ?? '')
    const classification = classifyViolation({
        violationDescription: rawViolationDescription,
        violationStatus: rawViolationStatus,
        violationCode: rawViolationCode,
    })

    return {
        layerType: 'violations',
        id: String(row.id ?? ''),
        violationDate: String(row.violation_date ?? ''),
        violationCode: rawViolationCode,
        violationDescription: escapeHtml(rawViolationDescription),
        violationStatus: escapeHtml(rawViolationStatus),
        inspectionStatus: escapeHtml(String(row.inspection_status ?? '')),
        address: escapeHtml(String(row.address ?? '')),
        departmentBureau: escapeHtml(String(row.department_bureau ?? '')),
        lat,
        lon,
        severity: classification.severity,
        severityReason: classification.severityReason,
        communityNote: classification.communityNote,
    }
}

function normalizeCrash(row: SocrataRow): TrafficCrash | null {
    const lat = parseFloat(String(row.latitude ?? '0'))
    const lon = parseFloat(String(row.longitude ?? '0'))
    if (!lat || !lon) return null

    // NOTE(Agent): Classify BEFORE escaping. Crash classifier primarily uses
    // numeric fields but also checks crashType and cause for community notes.
    const rawCrashType = String(row.crash_type ?? '')
    const rawCause = String(row.prim_contributory_cause ?? '')
    const injuriesTotal = Number(row.injuries_total) || 0
    const injuriesFatal = Number(row.injuries_fatal) || 0
    const classification = classifyCrash({
        injuriesTotal,
        injuriesFatal,
        crashType: rawCrashType,
        primContributoryCause: rawCause,
    })

    return {
        layerType: 'crashes',
        id: String(row.crash_record_id ?? ''),
        crashDate: String(row.crash_date ?? ''),
        crashType: escapeHtml(rawCrashType),
        injuriesTotal,
        injuriesFatal,
        damage: escapeHtml(String(row.damage ?? '')),
        primContributoryCause: escapeHtml(rawCause),
        lat,
        lon,
        severity: classification.severity,
        severityReason: classification.severityReason,
        communityNote: classification.communityNote,
    }
}
