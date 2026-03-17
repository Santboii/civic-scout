import { redis } from './redis'
import { getServiceClient } from './supabase'
import type { BoundingBox } from './city-registry'
import type { DataLayerType } from './data-layers'

// ── Types ───────────────────────────────────────────────────────────────────

// NOTE(Agent): Column map for data layers. Keys are the normalized field names
// used by normalizers in data-layers.ts; values are the actual Socrata column
// names for a given city's dataset.
//
// ── Canonical normalized field names per layer type ──────────────────────────
// These are the keys that normalizers expect after column mapping:
//
// crimes:     id, case_number, date, primary_type, description, block,
//             latitude, longitude, arrest, domestic
//
// violations: id, violation_date, violation_code, violation_description,
//             violation_status, inspection_status, address, department_bureau,
//             latitude, longitude
//
// crashes:    crash_record_id, crash_date, crash_type, injuries_total,
//             injuries_fatal, damage, prim_contributory_cause, latitude, longitude
//
// A column_map's KEYS must match the names above. Values are the actual Socrata
// column names in the city's dataset.
export interface DataLayerColumnMap {
    [normalizedField: string]: string
}

export interface DataLayerRegistry {
    id: string
    city: string
    state: string
    domain: string
    layer_type: DataLayerType
    dataset_id: string
    geo_column: string
    geo_type: 'point' | 'separate'
    column_map: DataLayerColumnMap
    order_by: string
    source_url: string | null
    source_label: string | null
    bbox: BoundingBox
    priority: number
    enabled: boolean
    // NOTE(Agent): Added for IDOT statewide crash data integration.
    // Socrata registries use domain+dataset_id; ArcGIS registries use arcgis_url.
    data_source_type: 'socrata' | 'arcgis'
    arcgis_url: string | null
}

// ── Constants ───────────────────────────────────────────────────────────────

const REGISTRY_CACHE_KEY = 'data_layer_registries:all'
const REGISTRY_CACHE_TTL = 5 * 60 // 5 minutes

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Load all enabled data layer registries with Redis caching.
 */
export async function getAllDataLayerRegistries(): Promise<DataLayerRegistry[]> {
    const cached = await redis.get<DataLayerRegistry[]>(REGISTRY_CACHE_KEY)
    if (cached) return cached

    const supabase = getServiceClient()
    const { data, error } = await supabase
        .from('data_layer_registries')
        .select('*')
        .eq('enabled', true)

    if (error) {
        console.error('[data-layer-registry] Supabase fetch failed:', error.message)
        return []
    }

    const registries: DataLayerRegistry[] = (data ?? []).map(mapRow)

    await redis.set(REGISTRY_CACHE_KEY, registries, { ex: REGISTRY_CACHE_TTL })

    return registries
}

/**
 * Find all data layer registries matching a given coordinate.
 * When bboxes overlap, returns only the highest-priority registry per layer_type.
 */
export async function findDataLayersByCoords(
    lat: number,
    lon: number
): Promise<DataLayerRegistry[]> {
    const registries = await getAllDataLayerRegistries()
    const matches = registries.filter(
        (r) => isWithinBBox(lat, lon, r.bbox)
    )

    // NOTE(Agent): Deduplicate by layer_type, keeping highest priority.
    // Prevents duplicate data from overlapping city bboxes.
    const byLayer = new Map<DataLayerType, DataLayerRegistry>()
    for (const match of matches) {
        const existing = byLayer.get(match.layer_type)
        if (!existing || match.priority > existing.priority) {
            byLayer.set(match.layer_type, match)
        }
    }
    return Array.from(byLayer.values())
}

/**
 * Find all matching registries per layer_type at a given coordinate,
 * sorted by priority descending (primary first, fallbacks after).
 * Used by the API route to try fallback sources when the primary returns 0 results.
 *
 * NOTE(Agent): This exists because bbox regions overlap (e.g., Chicago's bbox
 * covers many suburbs, but its Socrata data only contains Chicago city data).
 * When a suburban search matches both Chicago (priority 0) and IDOT (priority -1),
 * the API should try Chicago first, then fall back to IDOT if Chicago returns 0.
 */
export async function findDataLayersWithFallbacks(
    lat: number,
    lon: number
): Promise<Map<DataLayerType, DataLayerRegistry[]>> {
    const registries = await getAllDataLayerRegistries()
    const matches = registries.filter(
        (r) => isWithinBBox(lat, lon, r.bbox)
    )

    const byLayer = new Map<DataLayerType, DataLayerRegistry[]>()
    for (const match of matches) {
        const existing = byLayer.get(match.layer_type) ?? []
        existing.push(match)
        byLayer.set(match.layer_type, existing)
    }

    // Sort each layer's registries by priority descending (highest = primary)
    for (const [, registryList] of byLayer) {
        registryList.sort((a, b) => b.priority - a.priority)
    }

    return byLayer
}

/**
 * Find a registry for a specific layer type at a given coordinate.
 * Returns the first match (there should typically be only one per layer + location).
 */
export async function findDataLayerByType(
    lat: number,
    lon: number,
    layerType: DataLayerType
): Promise<DataLayerRegistry | null> {
    const registries = await findDataLayersByCoords(lat, lon)
    return registries.find((r) => r.layer_type === layerType) ?? null
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

function mapRow(row: Record<string, unknown>): DataLayerRegistry {
    return {
        id: row.id as string,
        city: row.city as string,
        state: row.state as string,
        domain: (row.domain as string) ?? '',
        layer_type: row.layer_type as DataLayerType,
        dataset_id: (row.dataset_id as string) ?? '',
        geo_column: (row.geo_column as string) ?? 'location',
        geo_type: (row.geo_type as 'point' | 'separate') ?? 'point',
        column_map: (row.column_map as DataLayerColumnMap) ?? {},
        order_by: (row.order_by as string) ?? 'date DESC',
        source_url: (row.source_url as string) ?? null,
        source_label: (row.source_label as string) ?? null,
        bbox: row.bbox as BoundingBox,
        priority: (row.priority as number) ?? 0,
        enabled: (row.enabled as boolean) ?? true,
        data_source_type: (row.data_source_type as 'socrata' | 'arcgis') ?? 'socrata',
        arcgis_url: (row.arcgis_url as string) ?? null,
    }
}
