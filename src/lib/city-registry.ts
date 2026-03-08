import { redis } from './redis'
import { createServiceClient } from './supabase'

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
    street_number?: string
    street_direction?: string
    street_name?: string
    suffix?: string
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
    geo_type: 'point' | 'separate'
    bbox: BoundingBox | null
    priority: number
    verified: boolean
    enabled: boolean
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
    const supabase = createServiceClient()
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
 * Find the best-matching city registry for a given lat/lon.
 *
 * NOTE(Agent): When multiple bboxes overlap (e.g., a suburb inside a metro
 * area's generous bbox), the registry with the HIGHEST priority wins.
 * More specific/smaller cities should be given higher priority values.
 */
export async function findCityByCoords(
    lat: number,
    lon: number
): Promise<CityRegistry | null> {
    const registries = await getAllRegistries()

    // Registries are already sorted by priority DESC from the query/cache
    for (const registry of registries) {
        if (registry.bbox && isWithinBBox(lat, lon, registry.bbox)) {
            return registry
        }
    }

    return null
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
        geo_type: (row.geo_type as 'point' | 'separate') ?? 'point',
        bbox: (row.bbox as BoundingBox) ?? null,
        priority: (row.priority as number) ?? 0,
        verified: (row.verified as boolean) ?? false,
        enabled: (row.enabled as boolean) ?? true,
    }
}
