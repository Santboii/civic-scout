import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchPermitsNearby } from '../socrata'

describe('fetchPermitsNearby', () => {
    const originalFetch = globalThis.fetch

    beforeEach(() => {
        vi.stubEnv('SOCRATA_APP_TOKEN', 'test-token')
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
        vi.unstubAllEnvs()
    })

    it('constructs the correct Socrata API URL with within_circle', async () => {
        let capturedUrl = ''
        globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
            capturedUrl = typeof input === 'string' ? input : input.toString()
            return new Response(JSON.stringify([]), { status: 200 })
        }) as unknown as typeof fetch

        await fetchPermitsNearby(41.8781, -87.6298)

        const decoded = decodeURIComponent(capturedUrl)
        expect(decoded).toContain('data.cityofchicago.org/resource/ydr8-5enu.json')
        expect(decoded).toContain('within_circle(location')
        expect(decoded).toContain('41.8781')
        expect(decoded).toContain('-87.6298')
    })

    it('filters for construction and renovation permits', async () => {
        let capturedUrl = ''
        globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
            capturedUrl = typeof input === 'string' ? input : input.toString()
            return new Response(JSON.stringify([]), { status: 200 })
        }) as unknown as typeof fetch

        await fetchPermitsNearby(41.8781, -87.6298)

        const decoded = decodeURIComponent(capturedUrl).replaceAll('+', ' ')
        expect(decoded).toContain('NEW CONSTRUCTION')
        expect(decoded).toContain('RENOVATION/ALTERATION')
    })

    it('sends the Socrata app token header', async () => {
        let capturedHeaders: HeadersInit | undefined
        globalThis.fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
            capturedHeaders = init?.headers
            return new Response(JSON.stringify([]), { status: 200 })
        }) as unknown as typeof fetch

        await fetchPermitsNearby(41.8781, -87.6298)

        expect(capturedHeaders).toBeDefined()
        expect((capturedHeaders as Record<string, string>)['X-App-Token']).toBe('test-token')
    })

    it('returns parsed permit data', async () => {
        const mockPermits = [
            {
                permit_: '12345',
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'Build new building',
                reported_cost: '5000000',
                latitude: '41.88',
                longitude: '-87.63',
            },
        ]

        globalThis.fetch = vi.fn(async () => {
            return new Response(JSON.stringify(mockPermits), { status: 200 })
        }) as unknown as typeof fetch

        const result = await fetchPermitsNearby(41.8781, -87.6298)

        expect(result).toHaveLength(1)
        expect(result[0].permit_).toBe('12345')
        expect(result[0].permit_type).toBe('PERMIT - NEW CONSTRUCTION')
    })

    it('throws on non-OK response', async () => {
        globalThis.fetch = vi.fn(async () => {
            return new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' })
        }) as unknown as typeof fetch

        await expect(fetchPermitsNearby(41.8781, -87.6298)).rejects.toThrow('Socrata API error: 500')
    })

    it('orders results by issue_date DESC and limits to 200', async () => {
        let capturedUrl = ''
        globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
            capturedUrl = typeof input === 'string' ? input : input.toString()
            return new Response(JSON.stringify([]), { status: 200 })
        }) as unknown as typeof fetch

        await fetchPermitsNearby(41.8781, -87.6298)

        expect(capturedUrl).toContain('issue_date+DESC')
        expect(capturedUrl).toContain('200')
    })
})
