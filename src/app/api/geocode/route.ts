import { NextRequest, NextResponse } from 'next/server'
import { normalizeAddress, isWithinBounds } from '@/lib/geocoder'
import { getAllRegistries } from '@/lib/city-registry'
import type { BoundingBox } from '@/lib/city-registry'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()

  if (!query || query.length < 3) {
    return NextResponse.json({ error: 'Query too short' }, { status: 400 })
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) {
    console.error('[geocode] NEXT_PUBLIC_MAPBOX_TOKEN is not set')
    return NextResponse.json({ error: 'Geocoding unavailable' }, { status: 503 })
  }

  // NOTE(Agent): Fetch supported city bboxes for post-filtering. getAllRegistries()
  // is Redis-cached (5 min TTL) so this adds ~1ms. Registries are sorted by
  // priority DESC — used for proximity bias below.
  const registries = await getAllRegistries()
  const bboxes: BoundingBox[] = registries
    .map((r) => r.bbox)
    .filter((b): b is BoundingBox => b !== null)

  // NOTE(Agent): Switched from Nominatim to Mapbox Geocoding v6 for
  // significantly better address autocomplete quality. The `autocomplete=true`
  // flag enables prefix matching so partial input like "123 Mai" returns
  // relevant address suggestions immediately.
  const params = new URLSearchParams({
    q: query,
    access_token: token,
    autocomplete: 'true',
    country: 'us',
    types: 'address',
    limit: '10',
    language: 'en',
  })

  // NOTE(Agent): Proximity bias — Mapbox ranks results closer to this point
  // higher. We use the centroid of the highest-priority supported city so
  // partial queries like "123 Main" prefer supported-area results. This makes
  // the post-filter below more likely to retain results (better UX).
  if (bboxes.length > 0) {
    const primary = bboxes[0]
    const proxLat = (primary.latMin + primary.latMax) / 2
    const proxLon = (primary.lonMin + primary.lonMax) / 2
    params.set('proximity', `${proxLon},${proxLat}`)
  }

  const url = `https://api.mapbox.com/search/geocode/v6/forward?${params}`
  const res = await fetch(url)

  if (!res.ok) {
    console.error('[geocode] Mapbox API error:', res.status, await res.text())
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 502 })
  }

  const data = await res.json()

  // NOTE(Agent): Mapbox Geocoding v6 returns GeoJSON FeatureCollection.
  // Each feature has properties.full_address (or properties.name_preferred)
  // and geometry.coordinates [lon, lat].
  const features = (data.features ?? []) as Array<{
    properties: { full_address?: string; name_preferred?: string; place_formatted?: string }
    geometry: { coordinates: [number, number] }
  }>

  const results = features.map((f) => {
    const address =
      f.properties.full_address ??
      [f.properties.name_preferred, f.properties.place_formatted].filter(Boolean).join(', ')
    const [lon, lat] = f.geometry.coordinates
    return {
      address,
      normalizedAddress: normalizeAddress(address),
      lat,
      lon,
    }
  })

  // NOTE(Agent): Per-bbox post-filtering — only return results that fall within
  // ANY supported city's bounding box. This ensures every autocomplete suggestion
  // leads to an area with real data (eliminates "unsupported area" dead-ends).
  // When bboxes is empty (no registries), fall back to unfiltered results.
  // We request 10 from Mapbox but slice to 5 after filtering so the post-filter
  // has more candidates (proximity bias doesn't guarantee all top-5 are in-bbox).
  const filtered = bboxes.length > 0
    ? results.filter((r) => bboxes.some((bbox) => isWithinBounds(r.lat, r.lon, bbox))).slice(0, 5)
    : results.slice(0, 5)

  // NOTE(Agent): Geocode results are location-stable — cache 60s in browser,
  // allow CDN edge to serve stale for 10 min. Public because requests are unauthenticated.
  return NextResponse.json(
    { results: filtered },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
      },
    }
  )
}
