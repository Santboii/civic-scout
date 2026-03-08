import { NextRequest, NextResponse } from 'next/server'
import { isWithinChicago, normalizeAddress } from '@/lib/geocoder'

export const runtime = 'edge'

interface MapboxFeature {
  id: string
  place_name: string
  center: [number, number] // [lon, lat]
  context?: Array<{ id: string; text: string }>
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()

  if (!query || query.length < 3) {
    return NextResponse.json({ error: 'Query too short' }, { status: 400 })
  }

  // Use OpenStreetMap Nominatim (Free, no token required)
  const params = new URLSearchParams({
    q: `${query}, Chicago, IL`,
    format: 'json',
    addressdetails: '1',
    limit: '5',
    viewbox: '-87.940,42.023,-87.524,41.644', // Chicago bounding box
    bounded: '1',
  })

  const url = `https://nominatim.openstreetmap.org/search?${params}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'ChicagoCivicScout/1.0 (contact@socialsgenie.com)',
    },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 502 })
  }

  const data = await res.json()
  const results = data.map((item: any) => ({
    address: item.display_name,
    normalizedAddress: normalizeAddress(item.display_name),
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
  }))

  return NextResponse.json({ results })
}
