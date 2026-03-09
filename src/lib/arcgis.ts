import type { CityRegistry } from './city-registry'
import type { NormalizedRawPermit } from './socrata'

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
        outFields: '*',
        outSR: '4326',
        orderByFields: `${registry.column_map.issue_date} DESC`,
        resultRecordCount: '200',
        f: 'json',
    })

    const url = `${registry.arcgis_url}/query?${params}`
    console.log(`[arcgis] Fetching from ${registry.city}:`, url)

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

    console.log(`[arcgis] ${registry.city} results:`, data.features.length)

    return data.features.map((f) => normalizeArcGISFeature(f, registry))
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
