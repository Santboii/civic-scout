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
    fetchCrimeIncidents,
    fetchBuildingViolations,
    fetchTrafficCrashes,
    type CrimeIncident,
    type BuildingViolation,
    type TrafficCrash,
    type DataLayerType,
} from '@/lib/data-layers'
import { findDataLayersByCoords } from '@/lib/data-layer-registry'

export const runtime = 'edge'

// NOTE(Agent): Valid layer names the client can request. Prevents arbitrary
// strings from reaching the fetch dispatchers or cache keys.
const VALID_LAYERS = new Set<DataLayerType>(['crimes', 'violations', 'crashes'])

type LayerResult = CrimeIncident[] | BuildingViolation[] | TrafficCrash[]

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

    // NOTE(Agent): Replaced isWithinChicago() gate with registry lookup.
    // If no registries match this coordinate, return empty — same behavior
    // as before but now city-agnostic.
    const registries = await findDataLayersByCoords(lat, lon)
    if (registries.length === 0) {
        return NextResponse.json(
            {},
            { headers: { 'Cache-Control': 'private, max-age=300' } }
        )
    }

    // Build a map of layer_type → registry for quick lookup
    const registryByLayer = new Map(registries.map((r) => [r.layer_type, r]))

    // Fetch each requested layer (cache-first, parallel)
    const results = await Promise.allSettled(
        requestedLayers.map(async (layer) => {
            const registry = registryByLayer.get(layer)
            if (!registry) {
                // No registry for this layer at this location — return empty
                return { layer, data: [] as unknown[], source: 'unsupported', sourceUrl: null, sourceLabel: null }
            }

            const cacheKey = dataLayersCacheKey(lat, lon, layer, registry.domain)

            // Try primary cache
            try {
                const cached = await redis.get<LayerResult>(cacheKey)
                if (cached) {
                    return {
                        layer,
                        data: cached,
                        source: 'cache',
                        sourceUrl: registry.source_url,
                        sourceLabel: registry.source_label,
                    }
                }
            } catch {
                // Redis unavailable — fall through to live fetch
            }

            // Live fetch using registry
            let data: LayerResult
            switch (layer) {
                case 'crimes':
                    data = await fetchCrimeIncidents(lat, lon, registry)
                    break
                case 'violations':
                    data = await fetchBuildingViolations(lat, lon, registry)
                    break
                case 'crashes':
                    data = await fetchTrafficCrashes(lat, lon, registry)
                    break
            }

            // Cache results (primary + stale fallback)
            try {
                const staleKey = dataLayersStaleCacheKey(lat, lon, layer, registry.domain)
                await Promise.all([
                    redis.set(cacheKey, data, { ex: DATA_LAYERS_CACHE_TTL_SECONDS }),
                    redis.set(staleKey, data, { ex: DATA_LAYERS_STALE_TTL_SECONDS }),
                ])
            } catch {
                // Redis unavailable — result still returned, just not cached
            }

            return {
                layer,
                data,
                source: 'live',
                sourceUrl: registry.source_url,
                sourceLabel: registry.source_label,
            }
        })
    )

    // Assemble response with per-layer source metadata
    const response: Record<string, { data: unknown[]; source: string; sourceUrl?: string | null; sourceLabel?: string | null }> = {}

    for (const [i, result] of results.entries()) {
        if (result.status === 'fulfilled') {
            const { layer, data, source, sourceUrl, sourceLabel } = result.value
            response[layer] = { data, source, sourceUrl, sourceLabel }
        } else {
            // Fetch failed — try stale cache before giving up
            const failedLayer = requestedLayers[i]
            const failedRegistry = failedLayer ? registryByLayer.get(failedLayer) : null
            if (failedLayer) {
                try {
                    const domain = failedRegistry?.domain ?? 'unknown'
                    const staleKey = dataLayersStaleCacheKey(lat, lon, failedLayer, domain)
                    const stale = await redis.get<unknown[]>(staleKey)
                    if (stale) {
                        response[failedLayer] = {
                            data: stale,
                            source: 'stale',
                            sourceUrl: failedRegistry?.source_url,
                            sourceLabel: failedRegistry?.source_label,
                        }
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
