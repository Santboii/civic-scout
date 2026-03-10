import { NextRequest, NextResponse } from 'next/server'
import { redis, permitCacheKey, CACHE_TTL_SECONDS } from '@/lib/redis'
import { fetchPermitsForCity, NormalizedRawPermit } from '@/lib/socrata'
import { ClassifiedPermit } from '@/lib/permit-classifier'
import { transformPermit } from '@/lib/transform-permit'
import { findAllCitiesByCoords } from '@/lib/city-registry'

export const runtime = 'nodejs'

// Top Chicago neighborhoods by population density — pre-warm these on cron schedule
// NOTE(Agent): For Phase 1, we keep Chicago-only hot spots. Phase 2 will
// query recent popular searches from the `searches` table per city.
const HOT_SPOTS: Array<{ lat: number; lon: number; name: string }> = [
  { lat: 41.8827, lon: -87.6233, name: 'The Loop' },
  { lat: 41.8956, lon: -87.6310, name: 'River North' },
  { lat: 41.9742, lon: -87.6698, name: 'Lincoln Square' },
  { lat: 41.9484, lon: -87.6553, name: 'Lakeview' },
  { lat: 41.9254, lon: -87.6510, name: 'Lincoln Park' },
  { lat: 41.8500, lon: -87.6236, name: 'Bronzeville' },
  { lat: 41.7943, lon: -87.5952, name: 'South Shore' },
  { lat: 41.9027, lon: -87.6960, name: 'Wicker Park' },
]

// NOTE(Agent): P1-1 from backend perf audit. Bounded concurrency (4 at a time)
// to prevent memory pressure and respect Vercel's 60s function timeout.
const CRON_CONCURRENCY = 4

export async function GET(request: NextRequest) {
  // Protect cron endpoint
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, string> = {}

  // Process hot spots in batches of CRON_CONCURRENCY
  for (let i = 0; i < HOT_SPOTS.length; i += CRON_CONCURRENCY) {
    const batch = HOT_SPOTS.slice(i, i + CRON_CONCURRENCY)
    const batchResults = await Promise.allSettled(
      batch.map(async (spot) => {
        const registries = await findAllCitiesByCoords(spot.lat, spot.lon)
        if (registries.length === 0) {
          return { name: spot.name, status: 'skipped (no registry)' }
        }

        const primaryDomain = registries[0].domain
        const cacheKey = permitCacheKey(spot.lat, spot.lon, primaryDomain)

        const existing = await redis.get(cacheKey)
        if (existing) {
          return { name: spot.name, status: 'skipped (cached)' }
        }

        const fetchResults = await Promise.allSettled(
          registries.map(async (registry) => {
            const raw = await fetchPermitsForCity(spot.lat, spot.lon, registry)
            return Promise.all(
              raw.map((p: NormalizedRawPermit) => transformPermit(p, registry.domain))
            )
          })
        )

        const allPermits: ClassifiedPermit[] = []
        for (const result of fetchResults) {
          if (result.status === 'fulfilled') {
            allPermits.push(...result.value)
          }
        }

        const permits = [...new Map(allPermits.map((p) => [p.id, p])).values()]
        await redis.set(cacheKey, permits, { ex: CACHE_TTL_SECONDS })
        return { name: spot.name, status: `warmed (${permits.length} permits from ${registries.length} sources)` }
      })
    )

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results[r.value.name] = r.value.status
      } else {
        // Extract spot name from the batch by index
        const idx = batchResults.indexOf(r)
        results[batch[idx].name] = `error: ${String(r.reason)}`
      }
    }
  }

  return NextResponse.json({ warmed: results })
}
