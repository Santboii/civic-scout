import { NextRequest, NextResponse } from 'next/server'
import { redis, permitCacheKey, permitStaleCacheKey, CACHE_TTL_SECONDS, STALE_CACHE_TTL_SECONDS } from '@/lib/redis'
import { fetchPermitsForCity } from '@/lib/socrata'
import { ClassifiedPermit } from '@/lib/permit-classifier'
import { transformPermit } from '@/lib/transform-permit'
import { verifyToken, extractToken } from '@/lib/auth'
import { findAllCitiesByCoords } from '@/lib/city-registry'
import { getServiceClient } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lon = parseFloat(searchParams.get('lon') ?? '')

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 })
  }

  // Resolve all matching city registries from coordinates
  const registries = await findAllCitiesByCoords(lat, lon)
  if (registries.length === 0) {
    return NextResponse.json(
      { error: 'No permit data available for this area yet', supported: false },
      { status: 422 }
    )
  }

  // Verify access
  const token = await extractToken(request)
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // NOTE(Agent): Temporarily allow 'dev-token' bypass in ALL environments for beta testing.
  // TODO: Remove this bypass once Stripe payments are fully tested and beta period ends.
  // This matches the approach in proxy.ts for consistency.
  if (token !== 'dev-token') {
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
  }

  // NOTE(Agent): Use the primary (highest-priority) registry for cache keys.
  // Multi-source results are cached together under a single key.
  const primaryDomain = registries[0].domain
  const cacheKey = permitCacheKey(lat, lon, primaryDomain)
  const staleKey = permitStaleCacheKey(lat, lon, primaryDomain)

  // Try primary cache first
  const cached = await redis.get<ClassifiedPermit[]>(cacheKey)
  if (cached) {
    const cityNames = registries.map((r) => r.city).join(', ')
    return NextResponse.json(
      { permits: cached, source: 'cache', city: cityNames },
      { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=3600' } }
    )
  }

  // Fetch fresh data from ALL matching registries in parallel
  let permits: ClassifiedPermit[]
  try {
    // NOTE(Agent): Query all registries in parallel. If one fails, we still
    // use results from the others. Only throw if ALL fail.
    const results = await Promise.allSettled(
      registries.map(async (registry) => {
        const raw = await fetchPermitsForCity(lat, lon, registry)
        return Promise.all(
          raw.map((p) => transformPermit(p, registry.domain))
        )
      })
    )

    const allPermits: ClassifiedPermit[] = []
    let anySucceeded = false
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allPermits.push(...result.value)
        anySucceeded = true
      } else {
        console.warn('[permits] One registry failed:', result.reason)
      }
    }

    if (!anySucceeded) {
      throw new Error('All registries failed')
    }

    // Deduplicate by permit ID (in case of overlap)
    const deduped = [...new Map(allPermits.map((p) => [p.id, p])).values()]
    permits = deduped

    // Write to primary cache (4-hour TTL) and stale cache (no TTL)
    // NOTE(Agent): P1-3 from backend perf audit — stale keys now have a
    // 14-day TTL to prevent unbounded Redis memory growth.
    await Promise.all([
      redis.set(cacheKey, permits, { ex: CACHE_TTL_SECONDS }),
      redis.set(staleKey, permits, { ex: STALE_CACHE_TTL_SECONDS }),
    ])

    // Log search to Supabase (best-effort)
    const supabase = getServiceClient()
    const cityNames = registries.map((r) => r.city).join(', ')
    // NOTE(Agent): P1-5 from backend perf audit — wrapped in Promise.resolve
    // to convert PromiseLike to full Promise, then .catch to suppress
    // unhandled rejection noise when Supabase is unavailable.
    // NOTE(Agent): The Supabase client is untyped (no generated Database types),
    // so the `searches` table columns resolve to `never`. This is a best-effort
    // fire-and-forget insert that works correctly at runtime.
    Promise.resolve(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('searches') as any).insert({
        address: searchParams.get('address') ?? '',
        lat,
        lon,
        result_count: permits.length,
        city: cityNames,
      })
    ).catch(() => { })

    return NextResponse.json(
      { permits, source: 'live', city: cityNames },
      { headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=1800' } }
    )
  } catch (err) {
    // All sources unavailable — try stale fallback
    const stale = await redis.get<ClassifiedPermit[]>(staleKey)
    if (stale) {
      return NextResponse.json(
        { permits: stale, source: 'stale', city: registries[0].city },
        { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=600' } }
      )
    }
    console.error('[permits] All registries failed and no stale cache:', err)
    return NextResponse.json({ error: 'Unable to fetch permit data' }, { status: 502 })
  }
}
