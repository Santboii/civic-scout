import { NextRequest, NextResponse } from 'next/server'
import { redis, permitCacheKey, permitStaleCacheKey, CACHE_TTL_SECONDS } from '@/lib/redis'
import { fetchPermitsNearby, RawPermit } from '@/lib/socrata'
import { enrichWithCookCounty } from '@/lib/cook-county'
import { classifyPermit, ClassifiedPermit } from '@/lib/permit-classifier'
import { verifyToken, extractToken } from '@/lib/auth'
import { isWithinChicago } from '@/lib/geocoder'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lon = parseFloat(searchParams.get('lon') ?? '')

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 })
  }

  if (!isWithinChicago(lat, lon)) {
    return NextResponse.json({ error: 'Location is outside Chicago' }, { status: 400 })
  }

  // Verify access
  const token = await extractToken(request)
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // NOTE(Agent): In development, allow the hardcoded 'dev-token' to bypass JWT verification.
  // The PaymentModal dev bypass sets ds_session=dev-token (a plain string, not a JWT).
  // A previous proxy.ts intended to handle this but was never wired as middleware.
  // In production builds, NODE_ENV is always 'production', so this branch is dead-code eliminated.
  const isDev = process.env.NODE_ENV === 'development' && token === 'dev-token'
  if (!isDev) {
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
  }

  const cacheKey = permitCacheKey(lat, lon)
  const staleKey = permitStaleCacheKey(lat, lon)

  // Try primary cache first
  const cached = await redis.get<ClassifiedPermit[]>(cacheKey)
  if (cached) {
    return NextResponse.json({ permits: cached, source: 'cache' })
  }

  // Fetch fresh data from Socrata
  let permits: ClassifiedPermit[]
  try {
    const raw = await fetchPermitsNearby(lat, lon)
    permits = await Promise.all(raw.map((p) => transformPermit(p, lat, lon)))

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
    }).then(() => { })

    return NextResponse.json({ permits, source: 'live' })
  } catch (err) {
    // Socrata unavailable — try stale fallback
    const stale = await redis.get<ClassifiedPermit[]>(staleKey)
    if (stale) {
      return NextResponse.json({ permits: stale, source: 'stale' })
    }
    console.error('Permits fetch failed and no stale cache:', err)
    return NextResponse.json({ error: 'Unable to fetch permit data' }, { status: 502 })
  }
}

async function transformPermit(p: RawPermit, searchLat: number, searchLon: number): Promise<ClassifiedPermit> {
  const lat = parseFloat(p.latitude ?? p.location?.latitude ?? '0')
  const lon = parseFloat(p.longitude ?? p.location?.longitude ?? '0')
  const { severity, reason, communityNote } = classifyPermit(p)

  // Enrich high-severity permits with Cook County zoning (best-effort)
  let zoningClassification: string | null = null
  if (severity === 'red' && lat && lon) {
    const enriched = await enrichWithCookCounty(lat, lon)
    zoningClassification = enriched?.zoning_classification ?? null
  }

  const parts = [p.street_number, p.street_direction, p.street_name, p.suffix].filter(Boolean)

  return {
    id: p.permit_,
    address: parts.join(' ').trim() || `${lat},${lon}`,
    lat,
    lon,
    permit_type: p.permit_type ?? '',
    work_description: p.work_description ?? '',
    reported_cost: Number(p.reported_cost) || 0,
    issue_date: p.issue_date ?? '',
    severity,
    severity_reason: reason,
    community_note: communityNote,
    zoning_classification: zoningClassification,
  }
}
