// ── Zoning District Overlay ─────────────────────────────────────────────────
// NOTE(Agent): Fetches zoning district polygons from Chicago's Socrata data
// portal (dataset dj47-wfun — "Boundaries - Zoning Districts (current)").
// Returns GeoJSON FeatureCollection for rendering on the Leaflet map via
// L.geoJSON(). Only fetches polygons within the search radius bounding box.
// Results are cached in Redis for 1 hour since zoning boundaries change
// very infrequently.
//
// IMPORTANT: The original dataset ID 7cve-jgbp is a Map-type view and does
// NOT support SODA API queries. The correct dataset is dj47-wfun.

import { redis } from './redis'
import { getAllDataLayerRegistries, type DataLayerRegistry } from './data-layer-registry'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ZoningFeatureProperties {
    zone_class: string    // e.g. "RS-3", "B3-2", "M1-2", "PD 1234"
    zone_type: string     // Numeric type code (e.g. "1", "5", "7")
    ordinance: string     // Ordinance number
    ordinance_1: string   // Ordinance date
}

export type ZoningCategory =
    | 'residential'
    | 'commercial'
    | 'manufacturing'
    | 'institutional'
    | 'planned-development'
    | 'downtown'
    | 'parks'
    | 'transportation'
    | 'other'

export interface ZoningGeoJSONFeature {
    type: 'Feature'
    properties: ZoningFeatureProperties
    geometry: GeoJSON.Geometry
}

export interface ZoningFeatureCollection {
    type: 'FeatureCollection'
    features: ZoningGeoJSONFeature[]
}

// ── Constants ───────────────────────────────────────────────────────────────

const SOCRATA_DOMAIN = 'data.cityofchicago.org'
const DATASET_ID = 'dj47-wfun'
const RADIUS_METERS = 805 // ≈ 0.5 miles (matches other data layers and Map.tsx circle)
const ZONING_CACHE_TTL = 60 * 60 // 1 hour — zoning rarely changes

// ── Color Mapping ───────────────────────────────────────────────────────────

// NOTE(Agent): Chicago zoning classes follow a predictable prefix pattern.
// RS/RT/RM = residential, B/C = commercial (business), M = manufacturing,
// PD/PMD = planned development, DC/DX/DS = downtown districts.
// Color palette chosen for instant readability and visual harmony with
// the existing map markers.

export const ZONING_COLORS: Record<ZoningCategory, string> = {
    residential:         '#4CAF50', // Green
    commercial:          '#2196F3', // Blue
    manufacturing:       '#9C27B0', // Purple
    institutional:       '#FF9800', // Orange
    'planned-development': '#E91E63', // Pink
    downtown:            '#00BCD4', // Cyan
    parks:               '#8BC34A', // Light green
    transportation:      '#78909C', // Blue-grey
    other:               '#9E9E9E', // Grey
}

export const ZONING_CATEGORY_LABELS: Record<ZoningCategory, string> = {
    residential:         'Residential',
    commercial:          'Commercial',
    manufacturing:       'Manufacturing',
    institutional:       'Institutional',
    'planned-development': 'Planned Dev.',
    downtown:            'Downtown',
    parks:               'Parks / Open',
    transportation:      'Transportation',
    other:               'Other',
}

/**
 * Map a zone_class string (e.g. "RS-3", "B3-2") to a category.
 */
export function classifyZoneClass(zoneClass: string): ZoningCategory {
    const upper = zoneClass.toUpperCase().trim()

    // Residential: RS, RT, RM (Chicago), R-1..R-6 (counties), E-1/E-2 (estate)
    if (/^R[STM]/.test(upper)) return 'residential'
    if (/^R-?\d/.test(upper)) return 'residential'
    if (/^E-?\d/.test(upper)) return 'residential'

    // NOTE(Agent): County zoning uses A-1/A-2 for agricultural land.
    // This is distinct from residential and maps to 'other' since we don't
    // have a dedicated 'agricultural' category — it's uncommon in urban areas.
    if (/^A-?\d/.test(upper)) return 'other'

    // Commercial/Business: B, C (Chicago), C-1..C-6 (counties)
    if (/^[BC]\d/.test(upper)) return 'commercial'
    if (/^C-?\d/.test(upper)) return 'commercial'

    // Office: O, OR (counties — DuPage)
    if (/^O[R]?\b/.test(upper)) return 'commercial'

    // Manufacturing / Industrial: M (Chicago), I-1..I-3 (counties)
    if (/^M\d/.test(upper)) return 'manufacturing'
    if (/^I-?\d/.test(upper)) return 'manufacturing'

    // Planned Development: PD, PMD
    if (/^P[MD]/.test(upper)) return 'planned-development'

    // Downtown districts: DC, DX, DS, DR
    if (/^D[CXSR]/.test(upper)) return 'downtown'

    // Parks / Open Space: POS
    if (/^POS/.test(upper)) return 'parks'

    // Transportation: T
    if (/^T\d/.test(upper) || upper === 'T') return 'transportation'

    // Municipal (Will County uses MUN for incorporated areas within data)
    if (upper === 'MUN') return 'institutional'

    // Institutional variations
    if (/^I/.test(upper)) return 'institutional'

    return 'other'
}

/**
 * Get the display color for a zoning feature.
 */
export function getZoningColor(zoneClass: string): string {
    return ZONING_COLORS[classifyZoneClass(zoneClass)]
}

/**
 * Get the human-readable label for a zoning feature.
 */
export function getZoningLabel(zoneClass: string): string {
    return ZONING_CATEGORY_LABELS[classifyZoneClass(zoneClass)]
}

// ── Zone Descriptions ──────────────────────────────────────────────────────
// NOTE(Agent): Static lookup of Chicago zone prefixes → human-readable
// descriptions compiled from the Chicago Zoning Ordinance (Title 17).
// Keyed by prefix (e.g. "RS", "B1", "DC"). PD districts are generic since
// each Planned Development has unique requirements set by ordinance.

interface ZoneDescription {
    label: string
    allowedUses: string
}

const ZONE_DESCRIPTIONS: Record<string, ZoneDescription> = {
    // Residential
    RS: {
        label: 'Single-Family Residential',
        allowedUses: 'Detached houses on individual lots; limited two-flats.',
    },
    RT: {
        label: 'Two-Flat / Townhouse',
        allowedUses: 'Detached houses, two-flats, townhouses, and low-density multi-unit buildings.',
    },
    RM: {
        label: 'Multi-Unit Residential',
        allowedUses: 'Multi-unit residential buildings, from mid-rise to high-rise depending on suffix.',
    },
    // Business
    B1: {
        label: 'Neighborhood Shopping',
        allowedUses: 'Small-scale retail and service uses serving the immediate neighborhood.',
    },
    B2: {
        label: 'Neighborhood Mixed-Use',
        allowedUses: 'Neighborhood retail with ground-floor residential permitted by-right.',
    },
    B3: {
        label: 'Community Shopping',
        allowedUses: 'Broad retail district; shopping centers and larger commercial buildings.',
    },
    // Commercial
    C1: {
        label: 'Neighborhood Commercial',
        allowedUses: 'Auto-oriented commercial uses; residential above ground floor.',
    },
    C2: {
        label: 'Motor Vehicle Commercial',
        allowedUses: 'High-intensity commercial: auto shops, warehouses, liquor stores.',
    },
    C3: {
        label: 'Commercial-Manufacturing',
        allowedUses: 'Buffer zone: retail, service, commercial, and manufacturing. No residential.',
    },
    // Manufacturing
    M1: {
        label: 'Limited Manufacturing',
        allowedUses: 'Low-impact manufacturing, business parks, warehousing within enclosed buildings.',
    },
    M2: {
        label: 'Light Industry',
        allowedUses: 'Moderate-impact manufacturing and storage; some outdoor operations.',
    },
    M3: {
        label: 'Heavy Industry',
        allowedUses: 'High-impact manufacturing, extractive and waste-related industrial uses.',
    },
    // Downtown
    DC: {
        label: 'Downtown Core',
        allowedUses: 'High-intensity office towers and institutional uses in the central business district.',
    },
    DX: {
        label: 'Downtown Mixed-Use',
        allowedUses: 'Office, commercial, hospitality, public and institutional uses in downtown.',
    },
    DS: {
        label: 'Downtown Service',
        allowedUses: 'Commercial and limited industrial uses serving the downtown area.',
    },
    DR: {
        label: 'Downtown Residential',
        allowedUses: 'High-density residential buildings within the downtown core.',
    },
    // Planned Development
    PD: {
        label: 'Planned Development',
        allowedUses: 'Custom zoning with site-specific requirements set by individual ordinance.',
    },
    PMD: {
        label: 'Planned Manufacturing',
        allowedUses: 'Protected manufacturing district with custom standards per ordinance.',
    },
    // Parks / Open Space
    POS: {
        label: 'Parks & Open Space',
        allowedUses: 'Public parks, playgrounds, forest preserves, and recreational facilities.',
    },
    // Transportation
    T: {
        label: 'Transportation',
        allowedUses: 'Rail yards, transit facilities, airports, and related infrastructure.',
    },
}

/**
 * Get a human-readable description for a zone class.
 * Tries exact prefix match first, then falls back to category-level description.
 */
export function getZoneDescription(zoneClass: string): ZoneDescription {
    const upper = zoneClass.toUpperCase().trim()

    // NOTE(Agent): Try progressively shorter prefixes.
    // "RS-3" → try "RS-3", then "RS". "B3-2" → try "B3-2", "B3", "B".
    // PD districts often have numbers like "PD 1231" — the "PD" prefix matches.
    for (const prefix of [upper, upper.replace(/[-\s].*$/, ''), upper.replace(/\d.*$/, '')]) {
        const trimmed = prefix.trim()
        if (trimmed && ZONE_DESCRIPTIONS[trimmed]) {
            return ZONE_DESCRIPTIONS[trimmed]
        }
    }

    // Fallback: use the category label
    const category = classifyZoneClass(zoneClass)
    return {
        label: ZONING_CATEGORY_LABELS[category],
        allowedUses: 'Specific regulations defined by the Chicago Zoning Ordinance.',
    }
}

/**
 * Build a URL to Chicago's interactive zoning map viewer centered on coordinates.
 */
export function getChicagoZoningMapUrl(lat: number, lon: number): string {
    // NOTE(Agent): Chicago's GIS zoning map viewer accepts center coordinates
    // and zoom level as URL hash params in the format #/lat/lon/zoom.
    return `https://gisapps.chicago.gov/ZoningMap/#/${lat.toFixed(6)}/${lon.toFixed(6)}/17`
}

// ── ArcGIS MapServer Zoning Fetcher ────────────────────────────────────────

/**
 * Fetch zoning district polygons from an ArcGIS MapServer endpoint.
 * Returns GeoJSON FeatureCollection normalized to our standard format.
 *
 * NOTE(Agent): County zoning endpoints are MapServer (not FeatureServer),
 * but they support `query` and `f=geojson` output. We use envelope-based
 * spatial queries with inSR=4326 since the data uses State Plane projection.
 */
async function fetchArcGISZoningDistricts(
    lat: number,
    lon: number,
    registry: DataLayerRegistry
): Promise<ZoningFeatureCollection> {
    const arcgisUrl = registry.arcgis_url
    if (!arcgisUrl) {
        return { type: 'FeatureCollection', features: [] }
    }

    // Build envelope from search radius
    const latDelta = RADIUS_METERS / 111_000
    const lonDelta = RADIUS_METERS / (111_000 * Math.cos((lat * Math.PI) / 180))

    const params = new URLSearchParams({
        where: '1=1',
        geometry: JSON.stringify({
            xmin: lon - lonDelta,
            ymin: lat - latDelta,
            xmax: lon + lonDelta,
            ymax: lat + latDelta,
        }),
        geometryType: 'esriGeometryEnvelope',
        inSR: '4326',
        outSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: '*',
        returnGeometry: 'true',
        f: 'geojson',
        resultRecordCount: '500',
    })

    const url = `${arcgisUrl}/query?${params}`
    if (process.env.NODE_ENV !== 'production') {
        console.log('[zoning] Fetching ArcGIS zoning districts:', url)
    }

    try {
        const res = await fetch(url, {
            headers: { Accept: 'application/json' },
            next: { revalidate: 0 },
        })

        if (!res.ok) {
            console.error('[zoning] ArcGIS error:', await res.text())
            return { type: 'FeatureCollection', features: [] }
        }

        const raw = await res.json() as ZoningFeatureCollection

        // NOTE(Agent): County ArcGIS endpoints use different field names.
        // Use column_map from registry to translate to our standard names.
        const zoneClassField = registry.column_map?.zone_class as string ?? 'zone_class'
        const zoneTypeField = registry.column_map?.zone_type as string ?? 'zone_type'

        const features: ZoningGeoJSONFeature[] = (raw.features ?? [])
            .filter((f: ZoningGeoJSONFeature) => f.geometry != null)
            .map((f: ZoningGeoJSONFeature) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const props = f.properties as Record<string, any>
                return {
                    type: 'Feature' as const,
                    geometry: f.geometry,
                    properties: {
                        zone_class: String(props?.[zoneClassField] ?? '').replace(/\*+$/, ''),
                        zone_type: String(props?.[zoneTypeField] ?? ''),
                        ordinance: String(props?.ordinance ?? props?.LAST_APPROVED_ZONING_CASE_NUM ?? ''),
                        ordinance_1: String(props?.ordinance_1 ?? props?.LAST_APPROVED_ZONING_CASE_DATE ?? ''),
                    },
                }
            })

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[zoning] Got ${features.length} ArcGIS zoning districts`)
        }

        return { type: 'FeatureCollection', features }
    } catch (err) {
        console.error('[zoning] ArcGIS fetch failed:', err)
        return { type: 'FeatureCollection', features: [] }
    }
}

// ── Cache Key ───────────────────────────────────────────────────────────────

function zoningCacheKey(lat: number, lon: number): string {
    // NOTE(Agent): toFixed(3) gives ~111m grid cells. Zoning boundaries are
    // much larger, so nearby searches will share cached responses.
    // v2: cache-busted after radius correction from 1609m → 805m
    return `zoning:v2:${lat.toFixed(3)}:${lon.toFixed(3)}`
}

// ── Fetcher ─────────────────────────────────────────────────────────────────

/**
 * Fetch zoning district polygons near a lat/lon from Chicago's Socrata portal.
 * Returns a GeoJSON FeatureCollection with zone_class/zone_type properties.
 */
/**
 * Fetch zoning districts with fallback across registry sources.
 * Tries all matching registries in priority order (e.g., Chicago Socrata
 * first, then county ArcGIS fallback).
 */
export async function fetchZoningDistrictsWithFallback(
    lat: number,
    lon: number
): Promise<ZoningFeatureCollection> {
    // NOTE(Agent): Directly query registries for 'zoning' layer_type.
    // We can't use findDataLayersWithFallbacks because 'zoning' is not
    // part of DataLayerType (it's polygon data, not point data).
    const allRegistries = await getAllDataLayerRegistries()
    const zoningRegistries = allRegistries
        .filter((r) => {
            if ((r.layer_type as string) !== 'zoning') return false
            if (!r.enabled) return false
            const b = r.bbox
            return lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax
        })
        .sort((a, b) => b.priority - a.priority)

    if (zoningRegistries.length === 0) {
        // No registry-based zoning — fall back to hardcoded Chicago fetch
        return fetchZoningDistricts(lat, lon)
    }

    for (const registry of zoningRegistries) {
        let result: ZoningFeatureCollection

        if (registry.data_source_type === 'arcgis') {
            result = await fetchArcGISZoningDistricts(lat, lon, registry)
        } else {
            result = await fetchZoningDistricts(lat, lon)
        }

        if (result.features.length > 0) {
            return result
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[zoning] 0 results from ${registry.city}, trying fallback...`)
        }
    }

    // All registries returned empty — try Chicago Socrata as final fallback
    return fetchZoningDistricts(lat, lon)
}

/**
 * Fetch zoning district polygons near a lat/lon from Chicago's Socrata portal.
 * Returns a GeoJSON FeatureCollection with zone_class/zone_type properties.
 */
export async function fetchZoningDistricts(
    lat: number,
    lon: number
): Promise<ZoningFeatureCollection> {
    // Check Redis cache first
    const cacheKey = zoningCacheKey(lat, lon)
    try {
        const cached = await redis.get<ZoningFeatureCollection>(cacheKey)
        if (cached) return cached
    } catch {
        // Redis unavailable — fall through to live fetch
    }

    // Build bounding-box for spatial filter
    const latDelta = RADIUS_METERS / 111_000
    const lonDelta = RADIUS_METERS / (111_000 * Math.cos((lat * Math.PI) / 180))

    // NOTE(Agent): Socrata GeoJSON endpoint supports $where with intersects()
    // for spatial queries. We create a bounding-box polygon that matches our
    // search radius and ask for all zoning districts that intersect it.
    const bboxWkt = `POLYGON((${lon - lonDelta} ${lat - latDelta}, ${lon + lonDelta} ${lat - latDelta}, ${lon + lonDelta} ${lat + latDelta}, ${lon - lonDelta} ${lat + latDelta}, ${lon - lonDelta} ${lat - latDelta}))`

    const params = new URLSearchParams({
        $where: `intersects(the_geom, '${bboxWkt}')`,
        $select: 'the_geom, zone_class, zone_type, ordinance, ordinance_1',
        $limit: '500',
    })

    const url = `https://${SOCRATA_DOMAIN}/resource/${DATASET_ID}.geojson?${params}`
    if (process.env.NODE_ENV !== 'production') {
        console.log('[zoning] Fetching zoning districts:', url)
    }

    try {
        const res = await fetch(url, {
            headers: {
                'X-App-Token': process.env.SOCRATA_APP_TOKEN ?? '',
                Accept: 'application/json',
            },
            next: { revalidate: 0 },
        })

        if (!res.ok) {
            console.error('[zoning] Socrata error:', await res.text())
            return { type: 'FeatureCollection', features: [] }
        }

        const raw = await res.json() as ZoningFeatureCollection

        // Normalize: ensure all features have expected properties
        const features: ZoningGeoJSONFeature[] = (raw.features ?? [])
            .filter((f: ZoningGeoJSONFeature) => f.geometry != null)
            .map((f: ZoningGeoJSONFeature) => ({
                type: 'Feature' as const,
                geometry: f.geometry,
                properties: {
                    zone_class: String(f.properties?.zone_class ?? ''),
                    zone_type: String(f.properties?.zone_type ?? ''),
                    ordinance: String(f.properties?.ordinance ?? ''),
                    ordinance_1: String(f.properties?.ordinance_1 ?? ''),
                },
            }))

        const result: ZoningFeatureCollection = {
            type: 'FeatureCollection',
            features,
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[zoning] Got ${features.length} zoning districts`)
        }

        // Cache result
        try {
            await redis.set(cacheKey, result, { ex: ZONING_CACHE_TTL })
        } catch {
            // Cache write failed — result still returned
        }

        return result
    } catch (err) {
        console.error('[zoning] Fetch failed:', err)
        return { type: 'FeatureCollection', features: [] }
    }
}
