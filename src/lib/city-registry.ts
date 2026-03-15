import { redis } from './redis'
import { getServiceClient } from './supabase'

// ── Types ───────────────────────────────────────────────────────────────────

export interface BoundingBox {
    latMin: number
    latMax: number
    lonMin: number
    lonMax: number
}

export interface ColumnMap {
    permit_id: string
    permit_type: string
    work_description: string
    reported_cost: string
    issue_date: string
    latitude: string
    longitude: string
    location?: string       // Point-type column name (for within_circle)
    full_address?: string   // Single-column address (for socrata_no_geo)
    street_number?: string
    street_direction?: string
    street_name?: string
    suffix?: string
    permit_status?: string  // Column name for status filtering (e.g., 'permit_status')
}

export interface CityRegistry {
    id: string
    city: string
    state: string | null
    country: string
    domain: string
    dataset_id: string
    column_map: ColumnMap
    permit_type_filter: string | null
    geo_type: 'point' | 'separate' | 'none'
    bbox: BoundingBox | null
    priority: number
    verified: boolean
    enabled: boolean
    data_source_type: 'socrata' | 'arcgis' | 'arcgis_no_geo' | 'socrata_no_geo'
    arcgis_url: string | null
    permit_status_values?: string[]  // Statuses considered "active" (e.g., ['ACTIVE', 'PHASED PERMITTING'])
    // NOTE(Agent): Multi-city expansion fields. enrichment_type replaces hardcoded
    // domain checks in transform-permit.ts. source_url powers frontend "View Source" links.
    enrichment_type: string | null
    source_url: string | null
    last_verified_at: string | null
}

// ── Constants ───────────────────────────────────────────────────────────────

const REGISTRY_CACHE_KEY = 'city_registries:all'
const REGISTRY_CACHE_TTL = 5 * 60 // 5 minutes

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Load all enabled city registries with Redis caching.
 * The full registry is small (~20 rows max for foreseeable future),
 * so caching as a single key is efficient.
 */
export async function getAllRegistries(): Promise<CityRegistry[]> {
    // Try Redis cache first
    const cached = await redis.get<CityRegistry[]>(REGISTRY_CACHE_KEY)
    if (cached) return cached

    // Fetch from Supabase
    const supabase = getServiceClient()
    const { data, error } = await supabase
        .from('city_registries')
        .select('*')
        .eq('enabled', true)
        .order('priority', { ascending: false })

    if (error) {
        console.error('[city-registry] Supabase fetch failed:', error.message)
        return []
    }

    const registries: CityRegistry[] = (data ?? []).map(mapRow)

    // Cache for 5 minutes
    await redis.set(REGISTRY_CACHE_KEY, registries, { ex: REGISTRY_CACHE_TTL })

    return registries
}

/**
 * Find ALL matching city registries for a given lat/lon.
 *
 * NOTE(Agent): Multiple bboxes can overlap (e.g., Cook County Suburbs + Chicago).
 * Returns ALL matches sorted by priority DESC so the permits API can query
 * each source and merge results. This replaced the old single-match approach
 * to support overlapping coverage areas.
 */
export async function findAllCitiesByCoords(
    lat: number,
    lon: number
): Promise<CityRegistry[]> {
    const registries = await getAllRegistries()
    return registries.filter(
        (r) => r.bbox && isWithinBBox(lat, lon, r.bbox)
    )
}

/**
 * Find the best-matching (highest priority) city registry for a given lat/lon.
 * Convenience wrapper — use findAllCitiesByCoords() when multi-source merge is needed.
 */
export async function findCityByCoords(
    lat: number,
    lon: number
): Promise<CityRegistry | null> {
    const matches = await findAllCitiesByCoords(lat, lon)
    return matches[0] ?? null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isWithinBBox(lat: number, lon: number, bbox: BoundingBox): boolean {
    return (
        lat >= bbox.latMin &&
        lat <= bbox.latMax &&
        lon >= bbox.lonMin &&
        lon <= bbox.lonMax
    )
}

// NOTE(Agent): Supabase returns JSONB columns as parsed objects,
// but we enforce our TypeScript interface shape here for safety.
function mapRow(row: Record<string, unknown>): CityRegistry {
    return {
        id: row.id as string,
        city: row.city as string,
        state: (row.state as string) ?? null,
        country: (row.country as string) ?? 'US',
        domain: row.domain as string,
        dataset_id: row.dataset_id as string,
        column_map: row.column_map as ColumnMap,
        permit_type_filter: (row.permit_type_filter as string) ?? null,
        geo_type: (row.geo_type as 'point' | 'separate' | 'none') ?? 'point',
        bbox: (row.bbox as BoundingBox) ?? null,
        priority: (row.priority as number) ?? 0,
        verified: (row.verified as boolean) ?? false,
        enabled: (row.enabled as boolean) ?? true,
        data_source_type: (row.data_source_type as 'socrata' | 'arcgis' | 'arcgis_no_geo' | 'socrata_no_geo') ?? 'socrata',
        arcgis_url: (row.arcgis_url as string) ?? null,
        // NOTE(Agent): permit_status_values is stored as a JSONB array in Supabase.
        // Supabase returns it already parsed. Default to undefined if not set.
        permit_status_values: (row.permit_status_values as string[]) ?? undefined,
        enrichment_type: (row.enrichment_type as string) ?? null,
        source_url: (row.source_url as string) ?? null,
        last_verified_at: (row.last_verified_at as string) ?? null,
    }
}
