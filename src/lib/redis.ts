import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

/**
 * Cache key for permits near a location, namespaced by city domain.
 *
 * NOTE(Agent): The domain namespace prevents collisions when two cities'
 * search radii might overlap at the same lat/lon precision.
 */
export function permitCacheKey(lat: number, lon: number, domain: string): string {
  return `permits:${domain}:${lat.toFixed(4)}:${lon.toFixed(4)}`
}

/** Stale fallback key — no TTL, used when primary key has expired */
export function permitStaleCacheKey(lat: number, lon: number, domain: string): string {
  return `permits_stale:${domain}:${lat.toFixed(4)}:${lon.toFixed(4)}`
}

export const CACHE_TTL_SECONDS = 4 * 60 * 60 // 4 hours
export const STALE_CACHE_TTL_SECONDS = 14 * 24 * 60 * 60 // 14 days

// NOTE(Agent): Cook County GIS enrichment is expensive (external HTTP call per
// red-severity permit). Zoning classifications don't change frequently, so a
// 7-day cache aggressively eliminates redundant queries.
const COOK_COUNTY_CACHE_TTL = 7 * 24 * 60 * 60 // 7 days

// NOTE(Agent): Municipality discovery involves 9 Mapbox reverse-geocode calls +
// N Socrata group-by queries. The results are stable — municipalities don't change.
// 24h TTL provides a safety valve; flush `muni_disc:*` manually when onboarding
// new Cook County suburbs.
const MUNI_DISCOVERY_CACHE_TTL = 24 * 60 * 60 // 24 hours

export function cookCountyCacheKey(lat: number, lon: number): string {
  return `cook:${lat.toFixed(4)}:${lon.toFixed(4)}`
}

export const COOK_COUNTY_CACHE_TTL_SECONDS = COOK_COUNTY_CACHE_TTL

export function muniDiscoveryCacheKey(lat: number, lon: number): string {
  // NOTE(Agent): toFixed(3) gives ~111m grid cells. Municipality boundaries
  // are km-scale, so nearby points almost always resolve to the same set.
  return `muni_disc:${lat.toFixed(3)}:${lon.toFixed(3)}`
}

export const MUNI_DISCOVERY_CACHE_TTL_SECONDS = MUNI_DISCOVERY_CACHE_TTL

// ── Data Layers Cache ───────────────────────────────────────────────────────

// NOTE(Agent): Shorter TTL than permits (2h vs 4h) because crime/violation/crash
// data updates more frequently than permit records.
const DATA_LAYERS_CACHE_TTL = 2 * 60 * 60 // 2 hours
const DATA_LAYERS_STALE_TTL = 7 * 24 * 60 * 60 // 7 days

export function dataLayersCacheKey(lat: number, lon: number, layer: string): string {
  return `layers:${layer}:${lat.toFixed(4)}:${lon.toFixed(4)}`
}

export function dataLayersStaleCacheKey(lat: number, lon: number, layer: string): string {
  return `layers_stale:${layer}:${lat.toFixed(4)}:${lon.toFixed(4)}`
}

export const DATA_LAYERS_CACHE_TTL_SECONDS = DATA_LAYERS_CACHE_TTL
export const DATA_LAYERS_STALE_TTL_SECONDS = DATA_LAYERS_STALE_TTL
