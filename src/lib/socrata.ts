import type { CityRegistry } from './city-registry'
import { fetchPermitsFromArcGIS, fetchPermitsFromArcGISNoGeo } from './arcgis'
import { batchGeocode } from './census-geocoder'
import { redis, muniDiscoveryCacheKey, MUNI_DISCOVERY_CACHE_TTL_SECONDS } from './redis'

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

  // Step 1: Discover municipalities within the search radius.
  // NOTE(Agent): We sample 5 points (center + ~4km N/S/E/W offsets) to discover
  // all municipalities that overlap the search circle. Without this, only the
  // center-point's municipality is queried, creating a lopsided distribution.
  const municipalities = await discoverNearbyMunicipalities(lat, lon)
  if (municipalities.length === 0) {
    if (process.env.NODE_ENV !== 'production') console.log('[socrata-no-geo] No municipalities found near search point — skipping')
    return []
  }

  if (process.env.NODE_ENV !== 'production') console.log(`[socrata-no-geo] Discovered ${municipalities.length} municipalities:`, municipalities)

  // Step 2: Build $where clause targeting ALL discovered municipalities
  const municipalityFilter = municipalities
    .map((m: string) => `municipality = '${m}'`)
    .join(' OR ')

  const whereParts: string[] = [
    `(${municipalityFilter})`,
    `${column_map.issue_date} IS NOT NULL`,
  ]

  const params = new URLSearchParams({
    $where: whereParts.join(' AND '),
    $order: `${column_map.issue_date} DESC`,
    $limit: '500',
  })

  const url = `${base}?${params}`
  if (process.env.NODE_ENV !== 'production') console.log(`[socrata-no-geo] Fetching:`, url)

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
  if (process.env.NODE_ENV !== 'production') console.log(`[socrata-no-geo] ${municipalities.join(', ')} raw results:`, data.length)

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
 * Discover all Cook County municipalities within the search radius.
 *
 * NOTE(Agent): Samples 9 points across the search circle (center + 8 compass
 * directions at ~3km offset), reverse-geocodes each via Mapbox, resolves the
 * place names to Cook County municipality strings, and deduplicates. The 3km
 * offset (vs the original 4km) is critical because Cook County suburbs can be
 * as narrow as ~3km (e.g., Oak Park). A larger offset overshoots these
 * municipalities entirely, creating gaps in the permit distribution.
 *
 * ~3km offset ≈ 0.027° lat, 0.036° lon at latitude ~42°N.
 */
async function discoverNearbyMunicipalities(
  lat: number,
  lon: number
): Promise<string[]> {
  // NOTE(Agent): P0-2 from backend perf audit — cache municipality discovery
  // to avoid 9 Mapbox + N Socrata calls on every cache miss.
  const cacheKey = muniDiscoveryCacheKey(lat, lon)
  try {
    const cached = await redis.get<string[]>(cacheKey)
    if (cached) return cached
  } catch {
    // Redis unavailable — fall through to live discovery
  }

  const LAT_OFFSET = 0.027   // ~3km in latitude
  const LON_OFFSET = 0.036   // ~3km in longitude at 42°N
  const DIAG_LAT = 0.019     // ~2.1km diagonal lat component (3km * cos(45°))
  const DIAG_LON = 0.025     // ~2.1km diagonal lon component

  const samplePoints = [
    { lat, lon },                                           // Center
    { lat: lat + LAT_OFFSET, lon },                         // N
    { lat: lat - LAT_OFFSET, lon },                         // S
    { lat, lon: lon + LON_OFFSET },                         // E
    { lat, lon: lon - LON_OFFSET },                         // W
    { lat: lat + DIAG_LAT, lon: lon + DIAG_LON },           // NE
    { lat: lat + DIAG_LAT, lon: lon - DIAG_LON },           // NW
    { lat: lat - DIAG_LAT, lon: lon + DIAG_LON },           // SE
    { lat: lat - DIAG_LAT, lon: lon - DIAG_LON },           // SW
  ]

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) {
    console.warn('[socrata-no-geo] No NEXT_PUBLIC_MAPBOX_TOKEN — cannot reverse-geocode')
    return []
  }

  // Reverse-geocode all sample points in parallel
  const placeNames = await Promise.all(
    samplePoints.map(async (pt) => {
      try {
        const url = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${pt.lon}&latitude=${pt.lat}&types=place&limit=1&access_token=${token}`
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) return null

        const data = await res.json() as {
          features?: Array<{ properties?: { name?: string } }>
        }
        return data.features?.[0]?.properties?.name ?? null
      } catch {
        return null
      }
    })
  )

  // Deduplicate place names (skip nulls and "Chicago" — it has its own adapter)
  const uniquePlaces = [...new Set(
    placeNames.filter((n): n is string => n !== null && n.toUpperCase() !== 'CHICAGO')
  )]

  if (uniquePlaces.length === 0) return []

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[socrata-no-geo] Reverse-geocoded places: [${uniquePlaces.join(', ')}]`)
  }

  // Resolve each place name to its Cook County municipality string in parallel
  const socrataToken = process.env.SOCRATA_APP_TOKEN ?? ''
  const municipalityResults = await Promise.all(
    uniquePlaces.map((place) => resolveToMunicipality(place, socrataToken))
  )

  const allMunicipalities = municipalityResults
    .flat()
    .filter((m): m is string => m !== null)

  // Deduplicate and return
  const result = [...new Set(allMunicipalities)]

  // Cache the discovery result (try-catch: per PE review, never crash on cache failure)
  try {
    await redis.set(cacheKey, result, { ex: MUNI_DISCOVERY_CACHE_TTL_SECONDS })
  } catch {
    // Redis unavailable — result still returned, just not cached
  }

  return result
}

/**
 * Resolve a Mapbox place name (e.g., "Melrose Park") to its Cook County
 * Assessor municipality string (e.g., "VILLAGE OF MELROSE PARK").
 */
async function resolveToMunicipality(
  placeName: string,
  appToken: string
): Promise<string[]> {
  try {
    const matchUrl = `https://datacatalog.cookcountyil.gov/resource/6yjf-dfxs.json?$select=municipality&$where=municipality+like+'%25${encodeURIComponent(placeName.toUpperCase())}%25'&$group=municipality&$limit=5`

    const res = await fetch(matchUrl, {
      headers: {
        'X-App-Token': appToken,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return []

    const matches = await res.json() as Array<{ municipality: string }>
    return matches
      .map((m) => m.municipality)
      .filter((m) => m.toUpperCase() !== 'CITY OF CHICAGO')
  } catch {
    return []
  }
}

