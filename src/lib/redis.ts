import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

/** Cache key for a 2-mile permit radius, keyed to 4-decimal lat/lon */
export function permitCacheKey(lat: number, lon: number): string {
  return `permits:${lat.toFixed(4)}:${lon.toFixed(4)}:2mi`
}

/** Stale fallback key — no TTL, used when primary key has expired */
export function permitStaleCacheKey(lat: number, lon: number): string {
  return `permits_stale:${lat.toFixed(4)}:${lon.toFixed(4)}:2mi`
}

export const CACHE_TTL_SECONDS = 4 * 60 * 60 // 4 hours
