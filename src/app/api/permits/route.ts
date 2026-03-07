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

  // Mock data for development - MUST BE AT THE VERY TOP
  if (process.env.MOCK_DATA === 'true') {
    return NextResponse.json({
      permits: [
        {
          id: '10001',
          address: '110 N Wacker Dr',
          lat: lat + 0.0015,
          lon: lon - 0.002,
          permit_type: 'PERMIT - NEW CONSTRUCTION',
          work_description: 'ERECT A NEW 55-STORY OFFICE TOWER WITH GROUND FLOOR RETAIL AND RIVERWALK ACCESS.',
          reported_cost: 250000000,
          issue_date: '2026-03-01T00:00:00',
          severity: 'red',
          severity_reason: 'High Rise, Riverfront Impact',
          zoning_classification: 'DC-16',
        },
        {
          id: '10002',
          address: '601 W Polk St',
          lat: lat - 0.006,
          lon: lon + 0.004,
          permit_type: 'PERMIT - RENOVATION',
          work_description: 'ADAPTIVE REUSE OF HISTORIC POST OFFICE INTO LOGISTICS AND TECH HUB.',
          reported_cost: 45000000,
          issue_date: '2026-02-15T00:00:00',
          severity: 'red',
          severity_reason: 'Industrial Adaptive Reuse, Large Scale',
          zoning_classification: 'DS-5',
        },
        {
          id: '10003',
          address: '222 W Adams St',
          lat: lat - 0.002,
          lon: lon + 0.001,
          permit_type: 'PERMIT - RENOVATION',
          work_description: 'INTERIOR BUILD-OUT FOR MULTI-TENANT OFFICE SUITES.',
          reported_cost: 5000000,
          issue_date: '2026-03-05T00:00:00',
          severity: 'yellow',
          severity_reason: 'Major Interior Renovation',
          zoning_classification: 'DC-16',
        },
        {
          id: '10004',
          address: '150 N Riverside Plaza',
          lat: lat + 0.004,
          lon: lon - 0.005,
          permit_type: 'PERMIT - NEW CONSTRUCTION',
          work_description: 'CONSTRUCTION OF PUBLIC PLAZA AND RIVERWALK ENHANCEMENTS.',
          reported_cost: 3500000,
          issue_date: '2026-01-20T00:00:00',
          severity: 'yellow',
          severity_reason: 'Public Infrastructure Impact',
          zoning_classification: 'DX-12',
        },
        {
          id: '10005',
          address: '10 S LaSalle St',
          lat: lat + 0.001,
          lon: lon + 0.003,
          permit_type: 'PERMIT - SIGNS',
          work_description: 'INSTALLATION OF EXTERIOR IDENTIFICATION SIGNAGE.',
          reported_cost: 25000,
          issue_date: '2026-03-06T00:00:00',
          severity: 'green',
          severity_reason: 'Standard Signage',
          zoning_classification: 'DC-16',
        }
      ],
      source: 'mock'
    })
  }

  if (!isWithinChicago(lat, lon)) {
    return NextResponse.json({ error: 'Location is outside Chicago' }, { status: 400 })
  }

  // Verify access
  const token = await extractToken(request)
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const payload = await verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
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
    }).then(() => {})

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
  const { severity, reason } = classifyPermit(p)

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
    zoning_classification: zoningClassification,
  }
}
