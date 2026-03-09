import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchPermitsNearby } from '../socrata'
import type { CityRegistry } from '../city-registry'

const CHICAGO_REGISTRY: CityRegistry = {
    id: 'test-id',
    city: 'Chicago',
    state: 'IL',
    country: 'US',
    domain: 'data.cityofchicago.org',
    dataset_id: 'ydr8-5enu',
    column_map: {
        permit_id: 'permit_',
        permit_type: 'permit_type',
        work_description: 'work_description',
        reported_cost: 'reported_cost',
        issue_date: 'issue_date',
        latitude: 'latitude',
        longitude: 'longitude',
        location: 'location',
        street_number: 'street_number',
        street_direction: 'street_direction',
        street_name: 'street_name',
        suffix: 'suffix',
    },
    permit_type_filter: "permit_type IN ('PERMIT - NEW CONSTRUCTION','PERMIT - RENOVATION/ALTERATION')",
    geo_type: 'point',
    bbox: { latMin: 41.644, latMax: 42.023, lonMin: -87.940, lonMax: -87.524 },
    priority: 10,
    verified: true,
    enabled: true,
    data_source_type: 'socrata' as const,
    arcgis_url: null,
}

const SEATTLE_REGISTRY: CityRegistry = {
    id: 'test-seattle',
    city: 'Seattle',
    state: 'WA',
    country: 'US',
    domain: 'cos-data.seattle.gov',
    dataset_id: '76t5-zqzr',
    column_map: {
        permit_id: 'PermitNum',
        permit_type: 'PermitTypeDesc',
        work_description: 'Description',
        reported_cost: 'Value',
        issue_date: 'IssuedDate',
        latitude: 'Latitude',
        longitude: 'Longitude',
    },
    permit_type_filter: null,
    geo_type: 'separate',
    bbox: { latMin: 47.49, latMax: 47.74, lonMin: -122.44, lonMax: -122.24 },
    priority: 10,
    verified: true,
    enabled: true,
    data_source_type: 'socrata' as const,
    arcgis_url: null,
}

describe('fetchPermitsNearby', () => {
    const originalFetch = globalThis.fetch

    beforeEach(() => {
        vi.stubEnv('SOCRATA_APP_TOKEN', 'test-token')
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
        vi.unstubAllEnvs()
    })

    it('constructs URL from registry domain and dataset_id', async () => {
        let capturedUrl = ''
        globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
            capturedUrl = typeof input === 'string' ? input : input.toString()
            return new Response(JSON.stringify([]), { status: 200 })
        }) as unknown as typeof fetch

        await fetchPermitsNearby(41.8781, -87.6298, CHICAGO_REGISTRY)

        const decoded = decodeURIComponent(capturedUrl)
        expect(decoded).toContain('data.cityofchicago.org/resource/ydr8-5enu.json')
    })

    it('uses within_circle for point geo_type', async () => {
        let capturedUrl = ''
        globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
            capturedUrl = typeof input === 'string' ? input : input.toString()
            return new Response(JSON.stringify([]), { status: 200 })
        }) as unknown as typeof fetch

        await fetchPermitsNearby(41.8781, -87.6298, CHICAGO_REGISTRY)

        const decoded = decodeURIComponent(capturedUrl)
        expect(decoded).toContain('within_circle(location')
        expect(decoded).toContain('41.8781')
        expect(decoded).toContain('-87.6298')
    })

    it('uses bounding-box math for separate geo_type', async () => {
        let capturedUrl = ''
        globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
            capturedUrl = typeof input === 'string' ? input : input.toString()
            return new Response(JSON.stringify([]), { status: 200 })
        }) as unknown as typeof fetch

        await fetchPermitsNearby(47.6, -122.33, SEATTLE_REGISTRY)

        const decoded = decodeURIComponent(capturedUrl)
        // Should NOT use within_circle
        expect(decoded).not.toContain('within_circle')
        // Should use lat/lon range filters (URL-encoded, spaces become +)
        expect(decoded).toContain('Latitude+>')
        expect(decoded).toContain('Longitude+>')
        // Should use Seattle's domain
        expect(decoded).toContain('cos-data.seattle.gov')
    })

    it('includes permit_type_filter when present', async () => {
        let capturedUrl = ''
        globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
            capturedUrl = typeof input === 'string' ? input : input.toString()
            return new Response(JSON.stringify([]), { status: 200 })
        }) as unknown as typeof fetch

        await fetchPermitsNearby(41.8781, -87.6298, CHICAGO_REGISTRY)

        const decoded = decodeURIComponent(capturedUrl).replaceAll('+', ' ')
        expect(decoded).toContain('NEW CONSTRUCTION')
        expect(decoded).toContain('RENOVATION/ALTERATION')
    })

    it('omits permit_type_filter when null', async () => {
        let capturedUrl = ''
        globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
            capturedUrl = typeof input === 'string' ? input : input.toString()
            return new Response(JSON.stringify([]), { status: 200 })
        }) as unknown as typeof fetch

        await fetchPermitsNearby(47.6, -122.33, SEATTLE_REGISTRY)

        const decoded = decodeURIComponent(capturedUrl)
        expect(decoded).not.toContain('permit_type IN')
    })

    it('sends the Socrata app token header', async () => {
        let capturedHeaders: HeadersInit | undefined
        globalThis.fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
            capturedHeaders = init?.headers
            return new Response(JSON.stringify([]), { status: 200 })
        }) as unknown as typeof fetch

        await fetchPermitsNearby(41.8781, -87.6298, CHICAGO_REGISTRY)

        expect(capturedHeaders).toBeDefined()
        expect((capturedHeaders as Record<string, string>)['X-App-Token']).toBe('test-token')
    })

    it('normalizes raw rows using column_map', async () => {
        const mockData = [
            {
                permit_: '12345',
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'Build new building',
                reported_cost: '5000000',
                issue_date: '2026-01-01',
                latitude: '41.88',
                longitude: '-87.63',
                street_number: '123',
                street_name: 'MAIN',
                suffix: 'ST',
            },
        ]

        globalThis.fetch = vi.fn(async () => {
            return new Response(JSON.stringify(mockData), { status: 200 })
        }) as unknown as typeof fetch

        const result = await fetchPermitsNearby(41.8781, -87.6298, CHICAGO_REGISTRY)

        expect(result).toHaveLength(1)
        expect(result[0].permit_id).toBe('12345')
        expect(result[0].permit_type).toBe('PERMIT - NEW CONSTRUCTION')
        expect(result[0].latitude).toBe('41.88')
    })

    it('throws on non-OK response with city name', async () => {
        globalThis.fetch = vi.fn(async () => {
            return new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' })
        }) as unknown as typeof fetch

        await expect(fetchPermitsNearby(41.8781, -87.6298, CHICAGO_REGISTRY))
            .rejects.toThrow('Socrata API error (Chicago): 500')
    })

    it('orders results by issue_date DESC and limits to 200', async () => {
        let capturedUrl = ''
        globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
            capturedUrl = typeof input === 'string' ? input : input.toString()
            return new Response(JSON.stringify([]), { status: 200 })
        }) as unknown as typeof fetch

        await fetchPermitsNearby(41.8781, -87.6298, CHICAGO_REGISTRY)

        expect(capturedUrl).toContain('issue_date+DESC')
        expect(capturedUrl).toContain('200')
    })
})
