import { redis } from './redis'

// ── Types ───────────────────────────────────────────────────────────────────

interface GeocodeResult {
    lat: number | null
    lon: number | null
}

interface CensusMatch {
    matchedAddress: string
    coordinates: { x: number; y: number }
}

interface CensusResponse {
    result: {
        addressMatches: CensusMatch[]
    }
}

// ── Constants ───────────────────────────────────────────────────────────────

const GEOCODE_CACHE_TTL = 30 * 24 * 60 * 60 // 30 days — addresses don't move
// NOTE(Agent): P0-3 from backend perf audit. Increased from 5 to 10 for better
// throughput. Conservative cap (vs 15+) because the Census Bureau geocoder is
// unreliable — higher concurrency risks simultaneous timeout cascades that then
// fan out into Mapbox fallback calls, which could hit Mapbox rate limits.
const MAX_CONCURRENT = 10

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Geocode a single US address using a two-tier strategy:
 * 1. US Census Bureau geocoder (free, no API key)
 * 2. Mapbox fallback (uses existing NEXT_PUBLIC_MAPBOX_TOKEN)
 *
 * Results are cached in Redis for 30 days. Failed geocodes are cached
 * as { lat: null, lon: null } to prevent retry storms.
 *
 * NOTE(Agent): Census geocoder handles ~85% of standard addresses.
 * Highway-style addresses ("Route 59") and PO Boxes fail — Mapbox
 * catches those as fallback.
 */
export async function geocodeAddress(
    address: string,
    city: string
): Promise<GeocodeResult> {
    const cacheKey = geocodeCacheKey(city, address)

    // Check Redis cache first
    const cached = await redis.get<GeocodeResult>(cacheKey)
    if (cached !== null && cached !== undefined) return cached

    // Tier 1: Census Bureau (free)
    let result = await geocodeViaCensus(address)

    // Tier 2: Mapbox fallback
    if (!result.lat) {
        result = await geocodeViaMapbox(address)
    }

    // Cache result (even failures, to prevent retry storms)
    await redis.set(cacheKey, result, { ex: GEOCODE_CACHE_TTL })

    return result
}

/**
 * Batch geocode multiple addresses with concurrency control.
 * Returns a Map of address → { lat, lon } (or null coords for failures).
 */
export async function batchGeocode(
    addresses: { address: string; city: string }[]
): Promise<Map<string, GeocodeResult>> {
    const results = new Map<string, GeocodeResult>()

    // Process in chunks of MAX_CONCURRENT
    for (let i = 0; i < addresses.length; i += MAX_CONCURRENT) {
        const chunk = addresses.slice(i, i + MAX_CONCURRENT)
        const chunkResults = await Promise.all(
            chunk.map(({ address, city }) =>
                geocodeAddress(address, city).then((result) => ({
                    address,
                    result,
                }))
            )
        )
        for (const { address, result } of chunkResults) {
            results.set(address, result)
        }
    }

    return results
}

// ── Internal Geocoders ──────────────────────────────────────────────────────

async function geocodeViaCensus(address: string): Promise<GeocodeResult> {
    try {
        const params = new URLSearchParams({
            address,
            benchmark: 'Public_AR_Current',
            format: 'json',
        })

        const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params}`

        const res = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(5000), // 5s timeout
        })

        if (!res.ok) {
            console.warn(`[census-geocoder] HTTP ${res.status} for: ${address}`)
            return { lat: null, lon: null }
        }

        const data: CensusResponse = await res.json()
        const matches = data.result?.addressMatches ?? []

        if (matches.length === 0) {
            if (process.env.NODE_ENV !== 'production') console.log(`[census-geocoder] No match for: ${address}`)
            return { lat: null, lon: null }
        }

        const { coordinates } = matches[0]
        if (process.env.NODE_ENV !== 'production') console.log(`[census-geocoder] Hit: ${address} → (${coordinates.y}, ${coordinates.x})`)
        return { lat: coordinates.y, lon: coordinates.x }
    } catch (err) {
        console.warn(`[census-geocoder] Error for ${address}:`, err)
        return { lat: null, lon: null }
    }
}

async function geocodeViaMapbox(address: string): Promise<GeocodeResult> {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) {
        console.warn('[census-geocoder] No NEXT_PUBLIC_MAPBOX_TOKEN — skipping Mapbox fallback')
        return { lat: null, lon: null }
    }

    try {
        const encoded = encodeURIComponent(address)
        const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encoded}&country=us&limit=1&access_token=${token}`

        const res = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
        })

        if (!res.ok) {
            console.warn(`[mapbox-geocoder] HTTP ${res.status} for: ${address}`)
            return { lat: null, lon: null }
        }

        const data = await res.json() as {
            features?: Array<{
                geometry?: { coordinates?: [number, number] }
            }>
        }

        const coords = data.features?.[0]?.geometry?.coordinates
        if (!coords) {
            if (process.env.NODE_ENV !== 'production') console.log(`[mapbox-geocoder] No match for: ${address}`)
            return { lat: null, lon: null }
        }

        // Mapbox returns [lon, lat]
        if (process.env.NODE_ENV !== 'production') console.log(`[mapbox-geocoder] Hit: ${address} → (${coords[1]}, ${coords[0]})`)
        return { lat: coords[1], lon: coords[0] }
    } catch (err) {
        console.warn(`[mapbox-geocoder] Error for ${address}:`, err)
        return { lat: null, lon: null }
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function geocodeCacheKey(city: string, address: string): string {
    // Normalize: lowercase, collapse whitespace
    const normalized = address.toLowerCase().replace(/\s+/g, ' ').trim()
    return `geocode:${city.toLowerCase()}:${normalized}`
}
