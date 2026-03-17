import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, extractToken } from '@/lib/auth'
import { fetchZoningDistrictsWithFallback } from '@/lib/zoning'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const lat = parseFloat(searchParams.get('lat') ?? '')
    const lon = parseFloat(searchParams.get('lon') ?? '')

    if (isNaN(lat) || isNaN(lon)) {
        return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 })
    }

    // Auth check (mirrors permits/data-layers route pattern)
    const token = await extractToken(request)
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // NOTE(Agent): Same dev-token bypass as other routes for beta testing.
    if (token !== 'dev-token') {
        const payload = await verifyToken(token)
        if (!payload) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
        }
    }

    const data = await fetchZoningDistrictsWithFallback(lat, lon)

    return NextResponse.json(data, {
        headers: {
            // NOTE(Agent): Long max-age since zoning boundaries rarely change.
            // stale-while-revalidate allows the browser to serve a cached response
            // while revalidating in the background.
            'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
        },
    })
}
