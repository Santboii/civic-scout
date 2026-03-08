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
