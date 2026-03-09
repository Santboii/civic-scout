import { NextRequest, NextResponse } from 'next/server'
import { normalizeAddress } from '@/lib/geocoder'

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
    limit: '5',
    language: 'en',
  })

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

  // NOTE(Agent): Geocode results are location-stable — cache 60s in browser,
  // allow CDN edge to serve stale for 10 min. Public because requests are unauthenticated.
  return NextResponse.json(
    { results },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
      },
    }
  )
}
