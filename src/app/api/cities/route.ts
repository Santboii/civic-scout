import { NextResponse } from 'next/server'
import { getAllRegistries } from '@/lib/city-registry'

export const runtime = 'edge'

/**
 * GET /api/cities
 *
 * Returns a list of enabled cities with only public-safe fields.
 * No auth required — this powers the landing page.
 *
 * NOTE(Agent): Uses getAllRegistries() which is Redis-cached (5 min TTL),
 * so this endpoint is effectively free to call. We add browser caching
 * on top (5 min + 30 min SWR) to minimize even those cheap hits.
 */
export async function GET() {
  const registries = await getAllRegistries()

  const cities = registries.map((r) => ({
    city: r.city,
    state: r.state,
    sourceUrl: r.source_url,
    // NOTE(Agent): Expose bbox center so the frontend can compute distances
    // to nearby supported cities when a user searches an unsupported area.
    // Also enables "click to search this city" by using center as search coords.
    center: r.bbox
      ? {
          lat: (r.bbox.latMin + r.bbox.latMax) / 2,
          lon: (r.bbox.lonMin + r.bbox.lonMax) / 2,
        }
      : null,
  }))

  return NextResponse.json(
    { cities },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
      },
    }
  )
}
