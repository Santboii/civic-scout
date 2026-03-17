import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const runtime = 'edge'

/**
 * POST /api/city-requests
 *
 * Captures user requests for unsupported cities. No auth required.
 * Accepts { lat, lon, cityName?, email? }.
 *
 * NOTE(Agent): This is an unauthenticated endpoint by design — we want
 * even non-paying visitors to be able to request cities. Basic abuse
 * prevention is handled by short request body validation and Vercel's
 * built-in rate limiting at the edge.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>

    const lat = typeof body.lat === 'number' ? body.lat : null
    const lon = typeof body.lon === 'number' ? body.lon : null
    const cityName = typeof body.cityName === 'string' ? body.cityName.slice(0, 200) : null
    const email = typeof body.email === 'string' ? body.email.slice(0, 320) : null

    if (lat === null || lon === null) {
      return NextResponse.json(
        { error: 'lat and lon are required' },
        { status: 400 }
      )
    }

    const supabase = getServiceClient()

    // NOTE(Agent): The city_requests table is not typed in the Supabase schema,
    // so we use `as any` to bypass the type checker. This is a best-effort insert.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('city_requests') as any).insert({
      city_name: cityName,
      lat,
      lon,
      email,
    })

    if (error) {
      console.error('[city-requests] Insert failed:', error.message)
      return NextResponse.json(
        { error: 'Failed to save request' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
