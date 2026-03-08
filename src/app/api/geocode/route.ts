import { NextRequest, NextResponse } from 'next/server'
import { normalizeAddress } from '@/lib/geocoder'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()

  if (!query || query.length < 3) {
    return NextResponse.json({ error: 'Query too short' }, { status: 400 })
  }

  // NOTE(Agent): Removed the old ", Chicago, IL" suffix and viewbox/bounded params
  // that locked geocoding to Chicago only. Now uses countrycodes=us to scope to the US
  // while allowing nationwide geocoding for multi-city support.
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'us',
  })

  const url = `https://nominatim.openstreetmap.org/search?${params}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'CivicScout/1.0 (contact@socialsgenie.com)',
    },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 502 })
  }

  const data = await res.json()
  const results = data.map((item: Record<string, unknown>) => ({
    address: item.display_name as string,
    normalizedAddress: normalizeAddress(item.display_name as string),
    lat: parseFloat(item.lat as string),
    lon: parseFloat(item.lon as string),
  }))

  return NextResponse.json({ results })
}
