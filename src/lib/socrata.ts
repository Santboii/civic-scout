import type { CityRegistry } from './city-registry'
import { fetchPermitsFromArcGIS } from './arcgis'

const RADIUS_METERS = 8046 // ≈ 5 miles

/**
 * Generic permit fetch router — dispatches to the correct adapter
 * based on the city registry's data_source_type.
 */
export async function fetchPermitsForCity(
  lat: number,
  lon: number,
  registry: CityRegistry
): Promise<NormalizedRawPermit[]> {
  switch (registry.data_source_type) {
    case 'arcgis':
      return fetchPermitsFromArcGIS(lat, lon, registry)
    case 'socrata':
    default:
      return fetchPermitsNearby(lat, lon, registry)
  }
}

/**
 * Raw permit data from any Socrata portal.
 * Field names vary per city — the column_map in CityRegistry
 * is used to normalize them after fetching.
 */
export type RawPermitRow = Record<string, unknown>

/**
 * Normalized permit fields after mapping through the city's column_map.
 * This is the shape the rest of the app expects.
 */
export interface NormalizedRawPermit {
  permit_id: string
  permit_type: string
  work_description: string
  reported_cost: string
  issue_date: string
  latitude: string
  longitude: string
  street_number?: string
  street_direction?: string
  street_name?: string
  suffix?: string
}

// NOTE(Agent): Keep the old RawPermit type as an alias for backward
// compatibility with any code that hasn't been updated yet.
export type RawPermit = NormalizedRawPermit

/**
 * Fetch permits near a lat/lon from a city's Socrata portal.
 *
 * Supports two geo query strategies based on registry.geo_type:
 * - 'point': Uses within_circle() on a Point-type location column (e.g. Chicago)
 * - 'separate': Uses bounding-box math on separate lat/lon number columns
 */
export async function fetchPermitsNearby(
  lat: number,
  lon: number,
  registry: CityRegistry
): Promise<NormalizedRawPermit[]> {
  const base = `https://${registry.domain}/resource/${registry.dataset_id}.json`
  const { column_map, permit_type_filter, geo_type } = registry

  // Build the geo filter
  let geoClause: string
  if (geo_type === 'point' && column_map.location) {
    geoClause = `within_circle(${column_map.location}, ${lat}, ${lon}, ${RADIUS_METERS})`
  } else {
    // NOTE(Agent): Fallback for datasets without a Point-type column.
    // Approximate a circle with a lat/lon bounding box.
    // 1 degree lat ≈ 111,000m. 1 degree lon ≈ 111,000m * cos(lat).
    const latDelta = RADIUS_METERS / 111_000
    const lonDelta = RADIUS_METERS / (111_000 * Math.cos((lat * Math.PI) / 180))
    geoClause = [
      `${column_map.latitude} > ${lat - latDelta}`,
      `${column_map.latitude} < ${lat + latDelta}`,
      `${column_map.longitude} > ${lon - lonDelta}`,
      `${column_map.longitude} < ${lon + lonDelta}`,
    ].join(' AND ')
  }

  // Build full $where clause
  const whereParts = [geoClause]
  if (permit_type_filter) {
    whereParts.push(permit_type_filter)
  }

  const params = new URLSearchParams({
    $where: whereParts.join(' AND '),
    $order: `${column_map.issue_date} DESC`,
    $limit: '200',
  })

  const url = `${base}?${params}`
  console.log(`[socrata] Fetching from ${registry.city}:`, url)

  const res = await fetch(url, {
    headers: {
      'X-App-Token': process.env.SOCRATA_APP_TOKEN ?? '',
      Accept: 'application/json',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`[socrata] ${registry.city} error:`, errorText)
    throw new Error(`Socrata API error (${registry.city}): ${res.status} ${res.statusText}`)
  }

  const data: RawPermitRow[] = await res.json()
  console.log(`[socrata] ${registry.city} results:`, data.length)

  // Normalize using the city's column_map
  return data.map((row) => normalizeRow(row, registry))
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map a raw Socrata row to our normalized permit shape using the city's
 * column_map configuration.
 */
function normalizeRow(
  row: RawPermitRow,
  registry: CityRegistry
): NormalizedRawPermit {
  const { column_map } = registry

  // Handle nested location object (some datasets embed lat/lon inside a location field)
  const locationObj = column_map.location
    ? (row[column_map.location] as { latitude?: string; longitude?: string } | undefined)
    : undefined

  return {
    permit_id: String(row[column_map.permit_id] ?? ''),
    permit_type: String(row[column_map.permit_type] ?? ''),
    work_description: String(row[column_map.work_description] ?? ''),
    reported_cost: String(row[column_map.reported_cost] ?? '0'),
    issue_date: String(row[column_map.issue_date] ?? ''),
    latitude: String(
      row[column_map.latitude] ?? locationObj?.latitude ?? '0'
    ),
    longitude: String(
      row[column_map.longitude] ?? locationObj?.longitude ?? '0'
    ),
    street_number: column_map.street_number
      ? String(row[column_map.street_number] ?? '')
      : undefined,
    street_direction: column_map.street_direction
      ? String(row[column_map.street_direction] ?? '')
      : undefined,
    street_name: column_map.street_name
      ? String(row[column_map.street_name] ?? '')
      : undefined,
    suffix: column_map.suffix
      ? String(row[column_map.suffix] ?? '')
      : undefined,
  }
}
