import { NextRequest, NextResponse } from 'next/server'
import { redis, permitCacheKey, CACHE_TTL_SECONDS } from '@/lib/redis'
import { fetchPermitsNearby } from '@/lib/socrata'
import { classifyPermit, ClassifiedPermit } from '@/lib/permit-classifier'
import { enrichWithCookCounty } from '@/lib/cook-county'
import { RawPermit } from '@/lib/socrata'

export const runtime = 'nodejs'

// Top Chicago neighborhoods by population density — pre-warm these on cron schedule
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

export async function GET(request: NextRequest) {
  // Protect cron endpoint
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, string> = {}

  for (const spot of HOT_SPOTS) {
    const cacheKey = permitCacheKey(spot.lat, spot.lon)
    try {
      const existing = await redis.get(cacheKey)
      if (existing) {
        results[spot.name] = 'skipped (cached)'
        continue
      }

      const raw = await fetchPermitsNearby(spot.lat, spot.lon)
      const permits: ClassifiedPermit[] = await Promise.all(
        raw.map((p: RawPermit) => transformPermit(p))
      )
      await redis.set(cacheKey, permits, { ex: CACHE_TTL_SECONDS })
      results[spot.name] = `warmed (${permits.length} permits)`
    } catch (err) {
      results[spot.name] = `error: ${String(err)}`
    }
  }

  return NextResponse.json({ warmed: results })
}

async function transformPermit(p: RawPermit): Promise<ClassifiedPermit> {
  const lat = parseFloat(p.latitude ?? p.location?.latitude ?? '0')
  const lon = parseFloat(p.longitude ?? p.location?.longitude ?? '0')
  const { severity, reason, communityNote } = classifyPermit(p)

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
