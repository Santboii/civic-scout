// ── Chicago-Specific Data Layers ────────────────────────────────────────────
// NOTE(Agent): Crime Incidents, Building Violations, and Traffic Crashes from
// Chicago's Socrata portal. These are NOT routed through CityRegistry — they
// are hardcoded to data.cityofchicago.org datasets. The API route gates on
// isWithinChicago() so non-Chicago searches return empty arrays.

import type { PermitSeverity } from './permit-classifier'
import { classifyCrime, classifyViolation, classifyCrash } from './data-layer-classifier'

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
const SOCRATA_DOMAIN = 'data.cityofchicago.org'

// Dataset IDs
const CRIMES_DATASET = 'ijzp-q8t2'
const VIOLATIONS_DATASET = '22u3-xenr'
const CRASHES_DATASET = '85ca-t3if'

// NOTE(Agent): Chicago city limits bounding box. Used to gate data layer
// fetching — these datasets are Chicago-only. Values are generous to
// include edge neighborhoods (e.g., O'Hare).
const CHICAGO_BBOX = {
    latMin: 41.64,
    latMax: 42.02,
    lonMin: -87.94,
    lonMax: -87.52,
}

// ── Chicago Bbox Check ──────────────────────────────────────────────────────

export function isWithinChicago(lat: number, lon: number): boolean {
    return (
        lat >= CHICAGO_BBOX.latMin &&
        lat <= CHICAGO_BBOX.latMax &&
        lon >= CHICAGO_BBOX.lonMin &&
        lon <= CHICAGO_BBOX.lonMax
    )
}

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

// ── Fetchers ────────────────────────────────────────────────────────────────

type SocrataRow = Record<string, unknown>

function socrataHeaders(): Record<string, string> {
    return {
        'X-App-Token': process.env.SOCRATA_APP_TOKEN ?? '',
        Accept: 'application/json',
    }
}

/**
 * Fetch crime incidents near a lat/lon from Chicago's Socrata portal.
 * Dataset: ijzp-q8t2 (Crimes - 2001 to Present)
 */
export async function fetchCrimeIncidents(
    lat: number,
    lon: number
): Promise<CrimeIncident[]> {
    try {
        const params = new URLSearchParams({
            $where: `within_circle(location, ${lat}, ${lon}, ${RADIUS_METERS})`,
            $order: 'date DESC',
            $limit: '100',
        })

        const url = `https://${SOCRATA_DOMAIN}/resource/${CRIMES_DATASET}.json?${params}`
        if (process.env.NODE_ENV !== 'production') console.log('[data-layers] Fetching crimes:', url)

        const res = await fetch(url, {
            headers: socrataHeaders(),
            next: { revalidate: 0 },
        })

        if (!res.ok) {
            console.error('[data-layers] Crimes error:', await res.text())
            return []
        }

        const data: SocrataRow[] = await res.json()
        if (process.env.NODE_ENV !== 'production') console.log('[data-layers] Crimes results:', data.length)

        return data
            .map(normalizeCrime)
            .filter((c): c is CrimeIncident => c !== null)
    } catch (err) {
        console.error('[data-layers] Crimes fetch failed:', err)
        return []
    }
}

/**
 * Fetch building violations near a lat/lon from Chicago's Socrata portal.
 * Dataset: 22u3-xenr (Building Violations)
 */
export async function fetchBuildingViolations(
    lat: number,
    lon: number
): Promise<BuildingViolation[]> {
    try {
        const params = new URLSearchParams({
            $where: `within_circle(location, ${lat}, ${lon}, ${RADIUS_METERS})`,
            $order: 'violation_date DESC',
            $limit: '100',
        })

        const url = `https://${SOCRATA_DOMAIN}/resource/${VIOLATIONS_DATASET}.json?${params}`
        if (process.env.NODE_ENV !== 'production') console.log('[data-layers] Fetching violations:', url)

        const res = await fetch(url, {
            headers: socrataHeaders(),
            next: { revalidate: 0 },
        })

        if (!res.ok) {
            console.error('[data-layers] Violations error:', await res.text())
            return []
        }

        const data: SocrataRow[] = await res.json()
        if (process.env.NODE_ENV !== 'production') console.log('[data-layers] Violations results:', data.length)

        return data
            .map(normalizeViolation)
            .filter((v): v is BuildingViolation => v !== null)
    } catch (err) {
        console.error('[data-layers] Violations fetch failed:', err)
        return []
    }
}

/**
 * Fetch traffic crashes near a lat/lon from Chicago's Socrata portal.
 * Dataset: 85ca-t3if (Traffic Crashes)
 */
export async function fetchTrafficCrashes(
    lat: number,
    lon: number
): Promise<TrafficCrash[]> {
    try {
        const params = new URLSearchParams({
            $where: `within_circle(location, ${lat}, ${lon}, ${RADIUS_METERS})`,
            $order: 'crash_date DESC',
            $limit: '100',
        })

        const url = `https://${SOCRATA_DOMAIN}/resource/${CRASHES_DATASET}.json?${params}`
        if (process.env.NODE_ENV !== 'production') console.log('[data-layers] Fetching crashes:', url)

        const res = await fetch(url, {
            headers: socrataHeaders(),
            next: { revalidate: 0 },
        })

        if (!res.ok) {
            console.error('[data-layers] Crashes error:', await res.text())
            return []
        }

        const data: SocrataRow[] = await res.json()
        if (process.env.NODE_ENV !== 'production') console.log('[data-layers] Crashes results:', data.length)

        return data
            .map(normalizeCrash)
            .filter((c): c is TrafficCrash => c !== null)
    } catch (err) {
        console.error('[data-layers] Crashes fetch failed:', err)
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
