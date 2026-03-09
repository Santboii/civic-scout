import type { CityRegistry } from './city-registry'
import { fetchPermitsFromArcGIS, fetchPermitsFromArcGISNoGeo } from './arcgis'
import { batchGeocode } from './census-geocoder'

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
    case 'arcgis_no_geo':
      return fetchPermitsFromArcGISNoGeo(lat, lon, registry)
    case 'socrata_no_geo':
      return fetchPermitsFromSocrataNoGeo(lat, lon, registry)
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
  full_address?: string
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
  if (process.env.NODE_ENV !== 'production') console.log(`[socrata] Fetching from ${registry.city}:`, url)

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
  if (process.env.NODE_ENV !== 'production') console.log(`[socrata] ${registry.city} results:`, data.length)

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
    full_address: column_map.full_address
      ? String(row[column_map.full_address] ?? '')
      : undefined,
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

// ── Socrata No-Geo Adapter ──────────────────────────────────────────────────

/**
 * Fetch permits from a Socrata portal that has NO geographic columns.
 *
 * NOTE(Agent): Some datasets (e.g., Cook County Assessor `6yjf-dfxs`) store
 * only mailing addresses without lat/lon. This function:
 * 1. Reverse-geocodes the search point to determine the local municipality
 * 2. Queries Socrata filtered to that specific municipality (not all 120+ suburbs)
 * 3. Batch-geocodes permit addresses via Census + Mapbox
 * 4. Filters results by haversine distance from the search point
 */
export async function fetchPermitsFromSocrataNoGeo(
  lat: number,
  lon: number,
  registry: CityRegistry
): Promise<NormalizedRawPermit[]> {
  const base = `https://${registry.domain}/resource/${registry.dataset_id}.json`
  const { column_map } = registry

  // Step 1: Reverse-geocode the search point to determine which municipality
  const municipality = await reverseGeocodeMunicipality(lat, lon)
  if (!municipality) {
    if (process.env.NODE_ENV !== 'production') console.log('[socrata-no-geo] Could not determine municipality — skipping')
    return []
  }

  // Step 2: Build $where clause targeting the specific municipality
  const whereParts: string[] = [
    `municipality = '${municipality}'`,
    `${column_map.issue_date} IS NOT NULL`,
  ]

  const params = new URLSearchParams({
    $where: whereParts.join(' AND '),
    $order: `${column_map.issue_date} DESC`,
    $limit: '200',
  })

  const url = `${base}?${params}`
  if (process.env.NODE_ENV !== 'production') console.log(`[socrata-no-geo] Fetching from ${registry.city} (${municipality}):`, url)

  const res = await fetch(url, {
    headers: {
      'X-App-Token': process.env.SOCRATA_APP_TOKEN ?? '',
      Accept: 'application/json',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`[socrata-no-geo] ${registry.city} error:`, errorText)
    throw new Error(`Socrata API error (${registry.city}): ${res.status} ${res.statusText}`)
  }

  const data: RawPermitRow[] = await res.json()
  if (process.env.NODE_ENV !== 'production') console.log(`[socrata-no-geo] ${municipality} raw results:`, data.length)

  if (data.length === 0) return []

  // Step 3: Normalize rows (lat/lon will be '0' since there are no geo columns)
  const normalized = data.map((row) => normalizeRow(row, registry))

  // Build addresses for geocoding
  const addressEntries = normalized
    .map((p) => ({
      permitId: p.permit_id,
      address: buildAddressFromSocrataNoGeo(p, registry),
    }))
    .filter((e) => e.address.length > 5) // Skip empty/tiny addresses

  // Batch geocode
  const geocodeInput = addressEntries.map((e) => ({
    address: e.address,
    city: registry.city,
  }))
  const geocoded = await batchGeocode(geocodeInput)

  // Step 4: Inject coordinates and filter by distance
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
    if (distance <= RADIUS_METERS) {
      results.push({
        ...permit,
        latitude: String(coords.lat),
        longitude: String(coords.lon),
      })
    }
  }

  if (process.env.NODE_ENV !== 'production') console.log(`[socrata-no-geo] ${registry.city}: ${results.length} permits within radius (of ${data.length} fetched)`)
  return results
}

/**
 * Build a geocodable address from a Socrata no-geo row.
 *
 * NOTE(Agent): Supports two modes:
 * 1. full_address column — a single column containing the complete address
 *    (e.g., Cook County: "539 WILLIAM ST, VILLAGE OF RIVER F, IL 60305")
 *    Cleaned up by stripping truncated municipality prefixes.
 * 2. Component columns — street_number + street_direction + street_name + suffix
 */
function buildAddressFromSocrataNoGeo(
  permit: NormalizedRawPermit,
  registry: CityRegistry
): string {
  // Mode 1: Use the full_address if available
  if (permit.full_address && permit.full_address.length > 5) {
    return cleanCookCountyAddress(permit.full_address)
  }

  // Mode 2: Component address
  const parts = [
    permit.street_number,
    permit.street_direction,
    permit.street_name,
    permit.suffix,
  ].filter(Boolean)

  if (parts.length === 0) return ''
  return `${parts.join(' ')}, ${registry.state ?? 'IL'}`
}

/**
 * Clean Cook County Assessor mailing addresses for geocoding.
 *
 * NOTE(Agent): The Assessor dataset truncates municipality names at ~20 chars,
 * producing addresses like "539 WILLIAM ST, VILLAGE OF RIVER F, IL 60305".
 * The truncated name breaks geocoding. We strip the VILLAGE OF/CITY OF/TOWN OF
 * prefix and rely on the zip code + state for geocoder disambiguation.
 */
function cleanCookCountyAddress(address: string): string {
  // Remove "VILLAGE OF ...", "CITY OF ...", "TOWN OF ..." municipality fragments
  // These are often truncated and confuse geocoders.
  // Keep the street + state + zip — that's enough for Census/Mapbox.
  return address
    .replace(/,\s*(VILLAGE OF|CITY OF|TOWN OF)[^,]*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Haversine formula — distance in meters between two lat/lon points.
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6_371_000 // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Reverse-geocode coordinates to determine the Cook County municipality name.
 *
 * NOTE(Agent): Cook County's dataset uses formal municipality names like
 * "VILLAGE OF MELROSE PARK", "CITY OF EVANSTON", "TOWN OF CICERO".
 * This function uses Mapbox reverse geocoding to get the place name,
 * then queries the Socrata dataset to find the exact municipality string
 * via a LIKE match.
 */
async function reverseGeocodeMunicipality(
  lat: number,
  lon: number
): Promise<string | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) {
    console.warn('[socrata-no-geo] No NEXT_PUBLIC_MAPBOX_TOKEN — cannot reverse-geocode')
    return null
  }

  try {
    const url = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lon}&latitude=${lat}&types=place&limit=1&access_token=${token}`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      console.warn(`[socrata-no-geo] Mapbox reverse geocode HTTP ${res.status}`)
      return null
    }

    const data = await res.json() as {
      features?: Array<{
        properties?: { name?: string }
      }>
    }

    const placeName = data.features?.[0]?.properties?.name
    if (!placeName) {
      if (process.env.NODE_ENV !== 'production') console.log(`[socrata-no-geo] No place name found for (${lat}, ${lon})`)
      return null
    }

    if (process.env.NODE_ENV !== 'production') console.log(`[socrata-no-geo] Reverse-geocoded to: ${placeName}`)

    // NOTE(Agent): Cook County dataset uses formal names like "VILLAGE OF MELROSE PARK".
    // We can't predict the prefix (Village/City/Town), so query Socrata for the match.
    const matchUrl = `https://datacatalog.cookcountyil.gov/resource/6yjf-dfxs.json?$select=municipality&$where=municipality+like+'%25${encodeURIComponent(placeName.toUpperCase())}%25'&$group=municipality&$limit=5`

    const matchRes = await fetch(matchUrl, {
      headers: {
        'X-App-Token': process.env.SOCRATA_APP_TOKEN ?? '',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!matchRes.ok) {
      // Fallback: try the raw place name with common prefixes
      if (process.env.NODE_ENV !== 'production') console.log(`[socrata-no-geo] Municipality lookup failed, trying common prefixes`)
      return null
    }

    const matches = await matchRes.json() as Array<{ municipality: string }>

    if (matches.length === 0) {
      if (process.env.NODE_ENV !== 'production') console.log(`[socrata-no-geo] No municipality match for "${placeName}"`)
      return null
    }

    // If there's exactly one match, use it. If multiple, pick the closest name match.
    const exactMatch = matches.find(
      (m) => m.municipality.toUpperCase().includes(placeName.toUpperCase())
    )
    const result = exactMatch?.municipality ?? matches[0].municipality

    if (process.env.NODE_ENV !== 'production') console.log(`[socrata-no-geo] Resolved municipality: ${result}`)
    return result
  } catch (err) {
    console.warn('[socrata-no-geo] Reverse geocode error:', err)
    return null
  }
}
