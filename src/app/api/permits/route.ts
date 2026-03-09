import { NextRequest, NextResponse } from 'next/server'
import { redis, permitCacheKey, permitStaleCacheKey, CACHE_TTL_SECONDS } from '@/lib/redis'
import { fetchPermitsForCity, NormalizedRawPermit } from '@/lib/socrata'
import { enrichWithCookCounty } from '@/lib/cook-county'
import { classifyPermit, ClassifiedPermit } from '@/lib/permit-classifier'
import { verifyToken, extractToken } from '@/lib/auth'
import { findAllCitiesByCoords } from '@/lib/city-registry'
import { createServiceClient } from '@/lib/supabase'

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
    await Promise.all([
      redis.set(cacheKey, permits, { ex: CACHE_TTL_SECONDS }),
      redis.set(staleKey, permits),
    ])

    // Log search to Supabase (best-effort)
    const supabase = createServiceClient()
    const cityNames = registries.map((r) => r.city).join(', ')
    supabase.from('searches').insert({
      address: searchParams.get('address') ?? '',
      lat,
      lon,
      result_count: permits.length,
      city: cityNames,
    }).then(() => { })

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

  // NOTE(Agent): Cook County enrichment works for any Cook County domain,
  // including Chicago's Socrata portal and the Assessor's suburban dataset.
  const isCookCounty = domain === 'data.cityofchicago.org' || domain === 'datacatalog.cookcountyil.gov'
  let zoningClassification: string | null = null
  if (severity === 'red' && lat && lon && isCookCounty) {
    const enriched = await enrichWithCookCounty(lat, lon)
    zoningClassification = enriched?.zoning_classification ?? null
  }

  // NOTE(Agent): Build display address from components first, then fall back to
  // full_address (Cook County suburbs), then coordinates as last resort.
  const parts = [p.street_number, p.street_direction, p.street_name, p.suffix].filter(Boolean)
  const componentAddress = parts.join(' ').trim()
  const displayAddress = componentAddress
    || (p.full_address ? cleanDisplayAddress(p.full_address) : '')
    || `${lat},${lon}`

  return {
    id: p.permit_id,
    address: displayAddress,
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

/**
 * Clean up a Cook County Assessor mailing address for UI display.
 * Strips truncated municipality prefixes like "VILLAGE OF RIVER F"
 * and the trailing state/zip, keeping just the street portion.
 */
function cleanDisplayAddress(address: string): string {
  // Extract just "539 WILLIAM ST" from "539 WILLIAM ST, VILLAGE OF RIVER F, IL 60305"
  const firstComma = address.indexOf(',')
  if (firstComma > 0) {
    return address.slice(0, firstComma).trim()
  }
  return address.trim()
}
