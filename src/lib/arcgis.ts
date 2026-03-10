import type { CityRegistry } from './city-registry'
import type { NormalizedRawPermit } from './socrata'
import { batchGeocode } from './census-geocoder'
import { haversineDistance } from './geo-utils'

const DEFAULT_RADIUS_METERS = 8046 // ≈ 5 miles

/**
 * ArcGIS Feature Service response structure.
 * NOTE(Agent): ArcGIS REST API returns features in a nested format
 * with geometry separate from attributes. Dates are epoch milliseconds.
 */
interface ArcGISFeature {
    attributes: Record<string, unknown>
    geometry?: {
        x: number
        y: number
    }
}

interface ArcGISQueryResponse {
    features: ArcGISFeature[]
    exceededTransferLimit?: boolean
}

/**
 * Fetch permits from an ArcGIS Feature Service near a lat/lon.
 *
 * Uses the ArcGIS REST API `query` endpoint with a spatial filter
 * (buffer around point) and returns results normalized to our
 * standard NormalizedRawPermit shape.
 */
export async function fetchPermitsFromArcGIS(
    lat: number,
    lon: number,
    registry: CityRegistry
): Promise<NormalizedRawPermit[]> {
    if (!registry.arcgis_url) {
        throw new Error(`[arcgis] No arcgis_url configured for ${registry.city}`)
    }

    // NOTE(Agent): ArcGIS REST API expects geometry in Web Mercator (3857)
    // for spatial queries, but we can pass WGS84 (4326) coords if we
    // specify inSR=4326. The API handles the projection internally.
    const params = new URLSearchParams({
        where: '1=1',
        geometry: `${lon},${lat}`,
        geometryType: 'esriGeometryPoint',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        distance: String(DEFAULT_RADIUS_METERS),
        units: 'esriSRUnit_Meter',
        outFields: buildOutFields(registry),
        outSR: '4326',
        orderByFields: `${registry.column_map.issue_date} DESC`,
        resultRecordCount: '200',
        f: 'json',
    })

    const url = `${registry.arcgis_url}/query?${params}`
    if (process.env.NODE_ENV !== 'production') console.log(`[arcgis] Fetching from ${registry.city}:`, url)

    const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 0 },
    })

    if (!res.ok) {
        const errorText = await res.text()
        console.error(`[arcgis] ${registry.city} error:`, errorText)
        throw new Error(`ArcGIS API error (${registry.city}): ${res.status} ${res.statusText}`)
    }

    const data: ArcGISQueryResponse = await res.json()

    if (!data.features) {
        console.warn(`[arcgis] ${registry.city}: no features array in response`)
        return []
    }

    if (process.env.NODE_ENV !== 'production') console.log(`[arcgis] ${registry.city} results:`, data.features.length)

    return data.features.map((f) => normalizeArcGISFeature(f, registry))
}

/**
 * Fetch permits from an ArcGIS Feature Service that has NO geometry.
 *
 * NOTE(Agent): Some datasets (e.g., Naperville) store only street addresses
 * without lat/lon. This function fetches recent permits filtered by type,
 * batch-geocodes addresses, then filters by distance from the search point.
 * Addresses that fail geocoding are dropped (no map pin possible).
 */
export async function fetchPermitsFromArcGISNoGeo(
    lat: number,
    lon: number,
    registry: CityRegistry
): Promise<NormalizedRawPermit[]> {
    if (!registry.arcgis_url) {
        throw new Error(`[arcgis-no-geo] No arcgis_url configured for ${registry.city}`)
    }

    // Build WHERE clause: type filter + non-null issue date
    const whereParts = [`${registry.column_map.issue_date} IS NOT NULL`]
    if (registry.permit_type_filter) {
        whereParts.push(registry.permit_type_filter)
    }

    const params = new URLSearchParams({
        where: whereParts.join(' AND '),
        outFields: buildOutFields(registry),
        orderByFields: `${registry.column_map.issue_date} DESC`,
        resultRecordCount: '100',
        f: 'json',
    })

    const url = `${registry.arcgis_url}/query?${params}`
    if (process.env.NODE_ENV !== 'production') console.log(`[arcgis-no-geo] Fetching from ${registry.city}:`, url)

    const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 0 },
    })

    if (!res.ok) {
        const errorText = await res.text()
        console.error(`[arcgis-no-geo] ${registry.city} error:`, errorText)
        throw new Error(`ArcGIS API error (${registry.city}): ${res.status} ${res.statusText}`)
    }

    const data: ArcGISQueryResponse = await res.json()
    const features = data.features ?? []
    if (process.env.NODE_ENV !== 'production') console.log(`[arcgis-no-geo] ${registry.city} raw features:`, features.length)

    if (features.length === 0) return []

    // Normalize first (without lat/lon — they'll be 0/0)
    const normalized = features.map((f) => normalizeArcGISFeature(f, registry))

    // Build addresses for geocoding
    const addressEntries = normalized
        .map((p) => ({
            permitId: p.permit_id,
            address: buildAddressFromPermit(p, registry.city),
        }))
        .filter((e) => e.address.length > 5) // Skip empty/tiny addresses

    // Batch geocode
    const geocodeInput = addressEntries.map((e) => ({
        address: e.address,
        city: registry.city,
    }))
    const geocoded = await batchGeocode(geocodeInput)

    // Inject coordinates and filter by distance
    const permitAddressMap = new Map(
        addressEntries.map((e) => [e.permitId, e.address])
    )

    const results: NormalizedRawPermit[] = []
    for (const permit of normalized) {
        const addr = permitAddressMap.get(permit.permit_id)
        if (!addr) continue

        const coords = geocoded.get(addr)
        if (!coords?.lat || !coords?.lon) continue

        // Check if within radius
        const distance = haversineDistance(lat, lon, coords.lat, coords.lon)
        if (distance <= DEFAULT_RADIUS_METERS) {
            results.push({
                ...permit,
                latitude: String(coords.lat),
                longitude: String(coords.lon),
            })
        }
    }

    if (process.env.NODE_ENV !== 'production') console.log(`[arcgis-no-geo] ${registry.city}: ${results.length} permits within radius (of ${features.length} fetched)`)
    return results
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalize an ArcGIS feature to our standard permit shape.
 *
 * NOTE(Agent): ArcGIS dates are epoch milliseconds. We convert them to
 * ISO strings. Geometry coordinates come back in outSR=4326 (WGS84).
 */
function normalizeArcGISFeature(
    feature: ArcGISFeature,
    registry: CityRegistry
): NormalizedRawPermit {
    const { attributes, geometry } = feature
    const { column_map } = registry

    const rawDate = attributes[column_map.issue_date]
    const issueDate = typeof rawDate === 'number'
        ? new Date(rawDate).toISOString()
        : String(rawDate ?? '')

    const rawCost = attributes[column_map.reported_cost]
    const cost = typeof rawCost === 'number' ? String(rawCost) : String(rawCost ?? '0')

    // Prefer explicit lat/lon fields, fall back to geometry
    const lat = attributes[column_map.latitude]
        ?? geometry?.y
        ?? 0
    const lon = attributes[column_map.longitude]
        ?? geometry?.x
        ?? 0

    return {
        permit_id: String(attributes[column_map.permit_id] ?? ''),
        permit_type: String(attributes[column_map.permit_type] ?? ''),
        work_description: String(attributes[column_map.work_description] ?? ''),
        reported_cost: cost,
        issue_date: issueDate,
        latitude: String(lat),
        longitude: String(lon),
        street_number: column_map.street_number
            ? String(attributes[column_map.street_number] ?? '')
            : undefined,
        street_direction: column_map.street_direction
            ? String(attributes[column_map.street_direction] ?? '')
            : undefined,
        street_name: column_map.street_name
            ? String(attributes[column_map.street_name] ?? '')
            : undefined,
        suffix: column_map.suffix
            ? String(attributes[column_map.suffix] ?? '')
            : undefined,
    }
}

/**
 * Build a full geocodable address string from permit fields.
 */
function buildAddressFromPermit(permit: NormalizedRawPermit, city: string): string {
    const parts = [
        permit.street_number,
        permit.street_direction,
        permit.street_name,
        permit.suffix,
    ].filter(Boolean)

    if (parts.length === 0) return ''
    return `${parts.join(' ')}, ${city}, IL`
}

/**
 * Build a selective outFields string from the registry's column_map.
 *
 * NOTE(Agent): P2-3 from backend perf audit. Replaced `outFields: '*'` with
 * selective fields to reduce response payload size. ArcGIS returns 400 for
 * unknown field names, so we must filter out placeholder values like 'UNUSED'
 * that appear in no-geo registries (e.g., Naperville).
 */
function buildOutFields(registry: CityRegistry): string {
    const { column_map } = registry
    const fields = new Set<string>()

    const addIfReal = (field: string | undefined) => {
        if (field && field !== 'UNUSED' && field !== 'unused') {
            fields.add(field)
        }
    }

    // Required fields (may be 'UNUSED' for no-geo adapters)
    addIfReal(column_map.permit_id)
    addIfReal(column_map.permit_type)
    addIfReal(column_map.work_description)
    addIfReal(column_map.reported_cost)
    addIfReal(column_map.issue_date)
    // NOTE(Agent): Skip lat/lon for no-geo adapters — these columns don't
    // exist in the dataset. The addIfReal sentinel check is a secondary
    // safety net; this structural check is the primary guard.
    if (registry.geo_type !== 'none') {
        addIfReal(column_map.latitude)
        addIfReal(column_map.longitude)
    }
    // Optional fields
    addIfReal(column_map.location)
    addIfReal(column_map.full_address)
    addIfReal(column_map.street_number)
    addIfReal(column_map.street_direction)
    addIfReal(column_map.street_name)
    addIfReal(column_map.suffix)

    // Fallback to * if no valid fields (shouldn't happen with a valid registry)
    return fields.size > 0 ? [...fields].join(',') : '*'
}
