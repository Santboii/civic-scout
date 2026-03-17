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
    fetchServiceRequests,
    type CrimeIncident,
    type BuildingViolation,
    type TrafficCrash,
    type ServiceRequest,
    type DataLayerType,
} from '@/lib/data-layers'
import { findDataLayersWithFallbacks } from '@/lib/data-layer-registry'

export const runtime = 'edge'

// NOTE(Agent): Valid layer names the client can request. Prevents arbitrary
// strings from reaching the fetch dispatchers or cache keys.
const VALID_LAYERS = new Set<DataLayerType>(['crimes', 'violations', 'crashes', 'service_requests'])

type LayerResult = CrimeIncident[] | BuildingViolation[] | TrafficCrash[] | ServiceRequest[]

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
        return NextResponse.json({ error: 'At least one valid layer required (crimes, violations, crashes, service_requests)' }, { status: 400 })
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

    // NOTE(Agent): Use findDataLayersWithFallbacks to get ALL matching registries
    // per layer_type, sorted by priority. This enables fallback when the primary
    // registry returns 0 results (e.g., Chicago bbox covers suburbs but Socrata
    // data doesn't — fall back to IDOT ArcGIS data for suburban crash coverage).
    const registriesByLayer = await findDataLayersWithFallbacks(lat, lon)
    if (registriesByLayer.size === 0) {
        return NextResponse.json(
            {},
            { headers: { 'Cache-Control': 'private, max-age=300' } }
        )
    }

    // Fetch each requested layer (cache-first, parallel, with fallback)
    const results = await Promise.allSettled(
        requestedLayers.map(async (layer) => {
            const registryList = registriesByLayer.get(layer)
            if (!registryList || registryList.length === 0) {
                // No registry for this layer at this location — return empty
                return { layer, data: [] as unknown[], source: 'unsupported', sourceUrl: null, sourceLabel: null }
            }

            // Try each registry in priority order until one returns results
            for (const registry of registryList) {
                const cacheKey = dataLayersCacheKey(lat, lon, layer, registry.domain || registry.city)

                // Try primary cache
                try {
                    const cached = await redis.get<LayerResult>(cacheKey)
                    if (cached && cached.length > 0) {
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
                let data: LayerResult = [] as unknown as LayerResult
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
                    case 'service_requests':
                        data = await fetchServiceRequests(lat, lon, registry)
                        break
                }

                // Cache results (primary + stale fallback)
                try {
                    const staleKey = dataLayersStaleCacheKey(lat, lon, layer, registry.domain || registry.city)
                    await Promise.all([
                        redis.set(cacheKey, data, { ex: DATA_LAYERS_CACHE_TTL_SECONDS }),
                        redis.set(staleKey, data, { ex: DATA_LAYERS_STALE_TTL_SECONDS }),
                    ])
                } catch {
                    // Redis unavailable — result still returned, just not cached
                }

                // If we got results, return immediately (don't try fallbacks)
                if (data.length > 0) {
                    return {
                        layer,
                        data,
                        source: 'live',
                        sourceUrl: registry.source_url,
                        sourceLabel: registry.source_label,
                    }
                }

                // NOTE(Agent): Primary returned 0 results — try next registry (fallback).
                // This is the key path for suburban areas covered by overlapping bboxes.
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`[data-layers] ${layer}: 0 results from ${registry.city}, trying fallback...`)
                }
            }

            // All registries exhausted, return empty from last attempt
            const lastRegistry = registryList[registryList.length - 1]
            return {
                layer,
                data: [] as unknown[],
                source: 'live',
                sourceUrl: lastRegistry.source_url,
                sourceLabel: lastRegistry.source_label,
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
            const failedRegistryList = failedLayer ? registriesByLayer.get(failedLayer) : null
            const failedRegistry = failedRegistryList?.[0]
            if (failedLayer) {
                try {
                    const domain = failedRegistry?.domain || failedRegistry?.city || 'unknown'
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
