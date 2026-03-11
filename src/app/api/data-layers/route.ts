import { NextRequest, NextResponse } from 'next/server'
import {
    redis,
    dataLayersCacheKey,
    dataLayersStaleCacheKey,
    DATA_LAYERS_CACHE_TTL_SECONDS,
    DATA_LAYERS_STALE_TTL_SECONDS,
} from '@/lib/redis'
import { verifyToken, extractToken } from '@/lib/auth'
import {
    isWithinChicago,
    fetchCrimeIncidents,
    fetchBuildingViolations,
    fetchTrafficCrashes,
    type CrimeIncident,
    type BuildingViolation,
    type TrafficCrash,
    type DataLayerType,
} from '@/lib/data-layers'

export const runtime = 'edge'

// NOTE(Agent): Valid layer names the client can request. Prevents arbitrary
// strings from reaching the fetch dispatchers or cache keys.
const VALID_LAYERS = new Set<DataLayerType>(['crimes', 'violations', 'crashes'])

type LayerFetcher = (lat: number, lon: number) => Promise<CrimeIncident[] | BuildingViolation[] | TrafficCrash[]>

const LAYER_FETCHERS: Record<DataLayerType, LayerFetcher> = {
    crimes: fetchCrimeIncidents,
    violations: fetchBuildingViolations,
    crashes: fetchTrafficCrashes,
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const lat = parseFloat(searchParams.get('lat') ?? '')
    const lon = parseFloat(searchParams.get('lon') ?? '')

    if (isNaN(lat) || isNaN(lon)) {
        return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 })
    }

    // Parse requested layers
    const layersParam = searchParams.get('layers') ?? ''
    const requestedLayers = layersParam
        .split(',')
        .map((l) => l.trim() as DataLayerType)
        .filter((l) => VALID_LAYERS.has(l))

    if (requestedLayers.length === 0) {
        return NextResponse.json({ error: 'At least one valid layer required (crimes, violations, crashes)' }, { status: 400 })
    }

    // Auth check (mirrors permits route pattern)
    const token = await extractToken(request)
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // NOTE(Agent): Same dev-token bypass as permits route for beta testing.
    // TODO: Remove when Stripe payments are fully tested.
    if (token !== 'dev-token') {
        const payload = await verifyToken(token)
        if (!payload) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
        }
    }

    // Chicago-only gate
    if (!isWithinChicago(lat, lon)) {
        // NOTE(Agent): Return empty layers object — not an error. Non-Chicago
        // searches just don't have these data layers available.
        return NextResponse.json(
            {},
            { headers: { 'Cache-Control': 'private, max-age=300' } }
        )
    }

    // Fetch each requested layer (cache-first, parallel)
    const results = await Promise.allSettled(
        requestedLayers.map(async (layer) => {
            const cacheKey = dataLayersCacheKey(lat, lon, layer)

            // Try primary cache
            try {
                const cached = await redis.get<CrimeIncident[] | BuildingViolation[] | TrafficCrash[]>(cacheKey)
                if (cached) {
                    return { layer, data: cached, source: 'cache' }
                }
            } catch {
                // Redis unavailable — fall through to live fetch
            }

            // Live fetch
            const fetcher = LAYER_FETCHERS[layer]
            const data = await fetcher(lat, lon)

            // Cache results (primary + stale fallback)
            try {
                const staleKey = dataLayersStaleCacheKey(lat, lon, layer)
                await Promise.all([
                    redis.set(cacheKey, data, { ex: DATA_LAYERS_CACHE_TTL_SECONDS }),
                    redis.set(staleKey, data, { ex: DATA_LAYERS_STALE_TTL_SECONDS }),
                ])
            } catch {
                // Redis unavailable — result still returned, just not cached
            }

            return { layer, data, source: 'live' }
        })
    )

    // Assemble response with per-layer source metadata
    const response: Record<string, { data: unknown[]; source: string }> = {}

    for (const result of results) {
        if (result.status === 'fulfilled') {
            const { layer, data, source } = result.value
            response[layer] = { data, source }
        } else {
            // Fetch failed — try stale cache before giving up
            const failedLayer = requestedLayers[results.indexOf(result)]
            if (failedLayer) {
                try {
                    const staleKey = dataLayersStaleCacheKey(lat, lon, failedLayer)
                    const stale = await redis.get<unknown[]>(staleKey)
                    if (stale) {
                        response[failedLayer] = { data: stale, source: 'stale' }
                        continue
                    }
                } catch {
                    // Redis unavailable
                }
                console.error(`[data-layers] Layer "${failedLayer}" failed:`, result.reason)
                response[failedLayer] = { data: [], source: 'error' }
            }
        }
    }

    return NextResponse.json(response, {
        headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=1800' },
    })
}
