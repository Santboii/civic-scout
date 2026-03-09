import { NextRequest, NextResponse } from 'next/server'
import { redis, permitCacheKey, permitStaleCacheKey, CACHE_TTL_SECONDS } from '@/lib/redis'
import { fetchPermitsForCity, NormalizedRawPermit } from '@/lib/socrata'
import { enrichWithCookCounty } from '@/lib/cook-county'
import { classifyPermit, ClassifiedPermit } from '@/lib/permit-classifier'
import { verifyToken, extractToken } from '@/lib/auth'
import { findCityByCoords } from '@/lib/city-registry'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lon = parseFloat(searchParams.get('lon') ?? '')

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 })
  }

  // Resolve city from coordinates using the registry
  const registry = await findCityByCoords(lat, lon)
  if (!registry) {
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

  // NOTE(Agent): dev-token bypass is gated behind ALLOW_DEV_BYPASS=true env var.
  // It must NEVER be set in production. Default behaviour rejects the token.
  const isDev = process.env.ALLOW_DEV_BYPASS === 'true' && token === 'dev-token'
  if (isDev) {
    console.warn('[permits] WARNING: dev-token bypass is active. Do not use in production.')
  } else {
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
  }

  const cacheKey = permitCacheKey(lat, lon, registry.domain)
  const staleKey = permitStaleCacheKey(lat, lon, registry.domain)

  // Try primary cache first
  const cached = await redis.get<ClassifiedPermit[]>(cacheKey)
  if (cached) {
    // NOTE(Agent): Cache hit — permit data is already fresh from Redis (4h TTL).
    // Allow browser to reuse for 5 min; serve stale for up to 1h while revalidating.
    // Private because responses are auth-gated (token per user).
    return NextResponse.json(
      { permits: cached, source: 'cache', city: registry.city },
      { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=3600' } }
    )
  }

  // Fetch fresh data from the city's Socrata portal
  let permits: ClassifiedPermit[]
  try {
    const raw = await fetchPermitsForCity(lat, lon, registry)
    permits = await Promise.all(
      raw.map((p) => transformPermit(p, registry.domain))
    )

    // Write to primary cache (4-hour TTL) and stale cache (no TTL)
    await Promise.all([
      redis.set(cacheKey, permits, { ex: CACHE_TTL_SECONDS }),
      redis.set(staleKey, permits),
    ])

    // Log search to Supabase (best-effort)
    const supabase = createServiceClient()
    supabase.from('searches').insert({
      address: searchParams.get('address') ?? '',
      lat,
      lon,
      result_count: permits.length,
      city: registry.city,
    }).then(() => { })

    // NOTE(Agent): Live fetch — shorter browser TTL (2 min) since data was just ingested.
    return NextResponse.json(
      { permits, source: 'live', city: registry.city },
      { headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=1800' } }
    )
  } catch (err) {
    // Socrata unavailable — try stale fallback
    const stale = await redis.get<ClassifiedPermit[]>(staleKey)
    if (stale) {
      return NextResponse.json(
        { permits: stale, source: 'stale', city: registry.city },
        { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=600' } }
      )
    }
    console.error(`[permits] ${registry.city} fetch failed and no stale cache:`, err)
    return NextResponse.json({ error: 'Unable to fetch permit data' }, { status: 502 })
  }
}

async function transformPermit(
  p: NormalizedRawPermit,
  domain: string
): Promise<ClassifiedPermit> {
  const lat = parseFloat(p.latitude ?? '0')
  const lon = parseFloat(p.longitude ?? '0')
  const { severity, reason, communityNote, permitLabel } = classifyPermit({
    permit_type: p.permit_type,
    work_description: p.work_description,
    reported_cost: p.reported_cost,
  })

  // NOTE(Agent): Cook County enrichment is only available for Chicago / Cook County.
  // For other cities, zoning_classification will be null. Additional enrichment
  // providers can be added per-city in Phase 2.
  let zoningClassification: string | null = null
  if (severity === 'red' && lat && lon && domain === 'data.cityofchicago.org') {
    const enriched = await enrichWithCookCounty(lat, lon)
    zoningClassification = enriched?.zoning_classification ?? null
  }

  const parts = [p.street_number, p.street_direction, p.street_name, p.suffix].filter(Boolean)

  return {
    id: p.permit_id,
    address: parts.join(' ').trim() || `${lat},${lon}`,
    lat,
    lon,
    permit_type: p.permit_type ?? '',
    permit_label: permitLabel,
    work_description: p.work_description ?? '',
    reported_cost: Number(p.reported_cost) || 0,
    issue_date: p.issue_date ?? '',
    severity,
    severity_reason: reason,
    community_note: communityNote,
    zoning_classification: zoningClassification,
  }
}
