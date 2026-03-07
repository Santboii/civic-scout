const COOK_COUNTY_BASE =
  'https://gis.cookcountyil.gov/traditional/rest/services/CookViewer3Dynamic/MapServer'

const COOK_TIMEOUT_MS = 5_000

export interface CookCountyParcel {
  zoning_classification?: string
  pin?: string
  address?: string
}

/**
 * Best-effort Cook County parcel enrichment.
 * Returns null on any error or timeout — callers must handle gracefully.
 */
export async function enrichWithCookCounty(
  lat: number,
  lon: number
): Promise<CookCountyParcel | null> {
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

    if (!res.ok) return null

    const data = await res.json()
    const feature = data?.features?.[0]?.attributes
    if (!feature) return null

    return {
      zoning_classification: feature.ZONING_CLS ?? null,
      pin: feature.PIN14 ?? null,
      address: feature.FULL_ADDR ?? null,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
