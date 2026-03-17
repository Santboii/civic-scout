// ── Multi-City Data Layers ──────────────────────────────────────────────────
// NOTE(Agent): Refactored from Chicago-only to registry-based. Crime, violation,
// and crash data are now fetched using DataLayerRegistry entries from Supabase,
// just like permits use CityRegistry. The normalizer functions remain unchanged —
// they parse raw Socrata rows into typed objects. Column mapping from the registry
// is applied before normalization so each city's field names resolve correctly.
//
// ArcGIS data sources (e.g., IDOT statewide crashes) use a separate adapter
// that queries ArcGIS Feature Services via envelope-based spatial queries.
// Dispatch is based on registry.data_source_type.

import type { PermitSeverity } from './permit-classifier'
import { classifyCrime, classifyViolation, classifyCrash, classify311 } from './data-layer-classifier'
import type { DataLayerRegistry, DataLayerColumnMap } from './data-layer-registry'

// ── Types ───────────────────────────────────────────────────────────────────

export type DataLayerType = 'crimes' | 'violations' | 'crashes' | 'service_requests'

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

export interface ServiceRequest {
    readonly layerType: 'service_requests'
    id: string
    srNumber: string
    srType: string
    status: string
    createdDate: string
    address: string
    lat: number
    lon: number
    severity: PermitSeverity
    severityReason: string
    communityNote: string
}

export type DataLayerItem = CrimeIncident | BuildingViolation | TrafficCrash | ServiceRequest

export interface DataLayersResponse {
    crimes?: { data: CrimeIncident[]; source: string }
    violations?: { data: BuildingViolation[]; source: string }
    crashes?: { data: TrafficCrash[]; source: string }
    service_requests?: { data: ServiceRequest[]; source: string }
}

// ── Constants ───────────────────────────────────────────────────────────────

const RADIUS_METERS = 805 // ≈ 0.5 miles (1-mile diameter, matches permits)

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
    limit: number = 500
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

// ── ArcGIS Feature Service Adapter ──────────────────────────────────────────

// NOTE(Agent): ArcGIS Feature Services (used by IDOT, municipal GIS portals)
// return features in a { attributes: {}, geometry: { x, y } } format.
// We translate these into SocrataRow-compatible objects so the existing
// normalizers can process them via column_map. The spatial query uses an
// envelope (bounding box) since IDOT data uses State Plane projection
// (wkid 3436) and distance-based queries can be unreliable across projections.

interface ArcGISDataLayerFeature {
    attributes: Record<string, unknown>
    geometry?: {
        x: number
        y: number
    }
}

interface ArcGISDataLayerResponse {
    features?: ArcGISDataLayerFeature[]
    exceededTransferLimit?: boolean
    error?: { code: number; message: string }
}

/**
 * Fetch data from an ArcGIS Feature Service using envelope-based spatial query.
 * Translates ArcGIS feature attributes into SocrataRow-compatible objects
 * so existing column_map + normalizer pipeline can process them.
 */
async function fetchFromArcGISDataLayerRegistry(
    lat: number,
    lon: number,
    registry: DataLayerRegistry,
    limit: number = 500
): Promise<SocrataRow[]> {
    if (!registry.arcgis_url) {
        throw new Error(`[data-layers] No arcgis_url configured for ${registry.city} ${registry.layer_type}`)
    }

    // Build envelope around the search point
    const latDelta = RADIUS_METERS / 111_000
    const lonDelta = RADIUS_METERS / (111_000 * Math.cos((lat * Math.PI) / 180))

    const envelope = JSON.stringify({
        xmin: lon - lonDelta,
        ymin: lat - latDelta,
        xmax: lon + lonDelta,
        ymax: lat + latDelta,
    })

    // Build outFields from column_map values (the ArcGIS field names)
    const outFields = Object.values(registry.column_map).join(',')

    const params = new URLSearchParams({
        where: '1=1',
        geometry: envelope,
        geometryType: 'esriGeometryEnvelope',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields,
        outSR: '4326',
        resultRecordCount: String(limit),
        f: 'json',
    })

    const url = `${registry.arcgis_url}/query?${params}`
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[data-layers] ArcGIS fetch ${registry.layer_type} from ${registry.city}:`, url)
    }

    const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 0 },
    })

    if (!res.ok) {
        const errorText = await res.text()
        console.error(`[data-layers] ArcGIS ${registry.layer_type} error (${registry.city}):`, errorText)
        return []
    }

    const data: ArcGISDataLayerResponse = await res.json()

    if (data.error) {
        console.error(`[data-layers] ArcGIS API error:`, data.error.message)
        return []
    }

    if (!data.features) {
        console.warn(`[data-layers] ArcGIS ${registry.city}: no features array in response`)
        return []
    }

    if (process.env.NODE_ENV !== 'production') {
        console.log(`[data-layers] ArcGIS ${registry.layer_type} results (${registry.city}):`, data.features.length)
    }

    // NOTE(Agent): Translate ArcGIS features into flat SocrataRow objects.
    // Geometry coords are injected as latitude/longitude for normalizer compat.
    // ArcGIS date fields arrive as epoch milliseconds — convert to ISO strings
    // so normalizers and the frontend get consistent date formatting.
    return data.features.map((f) => {
        const row: SocrataRow = {}
        for (const [key, value] of Object.entries(f.attributes)) {
            // Heuristic: large numbers ending in 000 that look like epoch ms
            if (typeof value === 'number' && value > 1_000_000_000_000 && value < 2_000_000_000_000) {
                row[key] = new Date(value).toISOString()
            } else {
                row[key] = value
            }
        }
        if (f.geometry) {
            row.latitude = f.geometry.y
            row.longitude = f.geometry.x
        }
        return row
    })
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
 * Dispatches to ArcGIS adapter for IDOT data, Socrata for Chicago data.
 */
export async function fetchTrafficCrashes(
    lat: number,
    lon: number,
    registry: DataLayerRegistry
): Promise<TrafficCrash[]> {
    try {
        if (registry.data_source_type === 'arcgis') {
            // NOTE(Agent): ArcGIS sources (e.g., IDOT) use a different fetch
            // path but the same column_map → normalizer pipeline.
            const rawRows = await fetchFromArcGISDataLayerRegistry(lat, lon, registry)
            return rawRows
                .map((row) => normalizeCrash(applyColumnMap(row, registry.column_map)))
                .filter((c): c is TrafficCrash => c !== null)
        }
        const rawRows = await fetchFromRegistry(lat, lon, registry)
        return rawRows
            .map((row) => normalizeCrash(applyColumnMap(row, registry.column_map)))
            .filter((c): c is TrafficCrash => c !== null)
    } catch (err) {
        console.error(`[data-layers] Crashes fetch failed (${registry.city}):`, err)
        return []
    }
}

/**
 * Fetch 311 service requests near a lat/lon using a data layer registry.
 */
export async function fetchServiceRequests(
    lat: number,
    lon: number,
    registry: DataLayerRegistry
): Promise<ServiceRequest[]> {
    try {
        const rawRows = await fetchFromRegistry(lat, lon, registry)
        return rawRows
            .map((row) => normalize311(applyColumnMap(row, registry.column_map)))
            .filter((s): s is ServiceRequest => s !== null)
    } catch (err) {
        console.error(`[data-layers] 311 fetch failed (${registry.city}):`, err)
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

    // NOTE(Agent): Socrata crime rows may lack an `id` field. Fall back to
    // case_number, then a lat/lon composite to guarantee unique React keys.
    const crimeId = String(row.id ?? row.case_number ?? `crime-${lat}-${lon}-${row.date ?? Math.random()}`)

    return {
        layerType: 'crimes',
        id: crimeId,
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

    // NOTE(Agent): Socrata violation rows may lack an `id` field. Fall back to
    // a composite of code + address + lat/lon to guarantee unique React keys.
    const violationId = String(row.id ?? `violation-${rawViolationCode}-${lat}-${lon}-${row.violation_date ?? Math.random()}`)

    return {
        layerType: 'violations',
        id: violationId,
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

    // NOTE(Agent): crash_record_id should always exist, but fall back defensively.
    const crashId = String(row.crash_record_id ?? `crash-${lat}-${lon}-${row.crash_date ?? Math.random()}`)

    return {
        layerType: 'crashes',
        id: crashId,
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

// NOTE(Agent): sr_type values that overlap with existing dedicated layers.
// These are filtered out during normalization to prevent the same event from
// appearing in both 311 and the specialized layer (e.g., "Building Violation"
// duplicates the violations layer data from the 22u3-xenr dataset).
const OVERLAPPING_311_TYPES = new Set([
    'building violation',
    'traffic crash',
])

function normalize311(row: SocrataRow): ServiceRequest | null {
    const lat = parseFloat(String(row.latitude ?? '0'))
    const lon = parseFloat(String(row.longitude ?? '0'))
    if (!lat || !lon) return null

    const rawSrType = String(row.sr_type ?? '')

    // Filter out sr_types that duplicate other dedicated layers
    if (OVERLAPPING_311_TYPES.has(rawSrType.toLowerCase())) return null

    const rawStatus = String(row.status ?? '')
    const classification = classify311({
        srType: rawSrType,
        status: rawStatus,
    })

    // NOTE(Agent): sr_number should always exist, but fall back defensively.
    const srId = String(row.sr_number ?? `sr-${lat}-${lon}-${row.created_date ?? Math.random()}`)

    return {
        layerType: 'service_requests',
        id: srId,
        srNumber: escapeHtml(String(row.sr_number ?? '')),
        srType: escapeHtml(rawSrType),
        status: escapeHtml(rawStatus),
        createdDate: String(row.created_date ?? ''),
        address: escapeHtml(String(row.street_address ?? '')),
        lat,
        lon,
        severity: classification.severity,
        severityReason: classification.severityReason,
        communityNote: classification.communityNote,
    }
}
