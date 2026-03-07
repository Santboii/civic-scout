import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const PROTECTED_PATHS = ['/api/permits']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!PROTECTED_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : request.cookies.get('ds_session')?.value

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  // Bypass strict validation for mock data
  if (process.env.MOCK_DATA === 'true' && token === 'mock-token') {
    return NextResponse.next()
  }

  // For lookup tokens, validate the address key matches the requested lat/lon
  if (payload.type === 'lookup') {
    const lat = request.nextUrl.searchParams.get('lat')
    const lon = request.nextUrl.searchParams.get('lon')
    if (lat && lon) {
      const requestedKey = `permits:${parseFloat(lat).toFixed(4)}:${parseFloat(lon).toFixed(4)}:2mi`
      if (payload.addressKey !== requestedKey) {
        return NextResponse.json({ error: 'Token not valid for this address' }, { status: 403 })
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/permits/:path*'],
}
