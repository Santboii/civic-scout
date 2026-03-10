import { redis, cookCountyCacheKey, COOK_COUNTY_CACHE_TTL_SECONDS } from './redis'

const COOK_COUNTY_BASE =
  'https://gis.cookcountyil.gov/traditional/rest/services/CookViewer3Dynamic/MapServer'

const COOK_TIMEOUT_MS = 5_000

export interface CookCountyParcel {
  zoning_classification?: string
  pin?: string
  address?: string
}

/**
 * Best-effort Cook County parcel enrichment with Redis caching.
 * Returns null on any error or timeout — callers must handle gracefully.
 *
 * NOTE(Agent): Added 7-day Redis cache (P0-1 from backend perf audit).
 * Null results are also cached to prevent retry storms on parcels
 * outside Cook County GIS coverage.
 */
export async function enrichWithCookCounty(
  lat: number,
  lon: number
): Promise<CookCountyParcel | null> {
  const cacheKey = cookCountyCacheKey(lat, lon)

  // Check Redis cache first (try-catch: per PE review, never crash on cache failure)
  try {
    const cached = await redis.get<CookCountyParcel | null>(cacheKey)
    if (cached !== null && cached !== undefined) {
      return cached
    }
  } catch {
    // Redis unavailable — fall through to live GIS
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), COOK_TIMEOUT_MS)

  try {
    // Layer 6 = Zoning, query by geometry point
    const params = new URLSearchParams({
      geometry: JSON.stringify({ x: lon, y: lat }),
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'ZONING_CLS,PIN14,FULL_ADDR',
      returnGeometry: 'false',
      f: 'json',
    })

    const url = `${COOK_COUNTY_BASE}/6/query?${params}`
    const res = await fetch(url, { signal: controller.signal })

    if (!res.ok) {
      // Cache the failure as null to prevent retry storms
      try { await redis.set(cacheKey, null, { ex: COOK_COUNTY_CACHE_TTL_SECONDS }) } catch { /* ignore */ }
      return null
    }

    const data = await res.json()
    const feature = data?.features?.[0]?.attributes
    if (!feature) {
      // No parcel found — cache null to avoid re-querying
      try { await redis.set(cacheKey, null, { ex: COOK_COUNTY_CACHE_TTL_SECONDS }) } catch { /* ignore */ }
      return null
    }

    const result: CookCountyParcel = {
      zoning_classification: feature.ZONING_CLS ?? null,
      pin: feature.PIN14 ?? null,
      address: feature.FULL_ADDR ?? null,
    }

    // Cache successful result
    try { await redis.set(cacheKey, result, { ex: COOK_COUNTY_CACHE_TTL_SECONDS }) } catch { /* ignore */ }

    return result
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
