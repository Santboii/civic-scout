import { describe, it, expect } from 'vitest'
import { isWithinBounds, normalizeAddress } from '../geocoder'

describe('isWithinBounds', () => {
    const chicagoBbox = {
        latMin: 41.644,
        latMax: 42.023,
        lonMin: -87.940,
        lonMax: -87.524,
    }

    const seattleBbox = {
        latMin: 47.49,
        latMax: 47.74,
        lonMin: -122.44,
        lonMax: -122.24,
    }

    it('returns true for downtown Chicago within Chicago bbox', () => {
        expect(isWithinBounds(41.8781, -87.6298, chicagoBbox)).toBe(true)
    })

    it('returns true for north boundary (Rogers Park area)', () => {
        expect(isWithinBounds(42.02, -87.67, chicagoBbox)).toBe(true)
    })

    it('returns true for south boundary (Far South Side)', () => {
        expect(isWithinBounds(41.65, -87.60, chicagoBbox)).toBe(true)
    })

    it('returns false for coordinates north of Chicago (Evanston)', () => {
        expect(isWithinBounds(42.05, -87.69, chicagoBbox)).toBe(false)
    })

    it('returns false for coordinates south of Chicago (Hammond, IN)', () => {
        expect(isWithinBounds(41.60, -87.50, chicagoBbox)).toBe(false)
    })

    it('returns false for New York City in Chicago bbox', () => {
        expect(isWithinBounds(40.7128, -74.006, chicagoBbox)).toBe(false)
    })

    it('returns true for exact boundary values', () => {
        expect(isWithinBounds(41.644, -87.940, chicagoBbox)).toBe(true) // SW corner
        expect(isWithinBounds(42.023, -87.524, chicagoBbox)).toBe(true) // NE corner
        expect(isWithinBounds(41.644, -87.524, chicagoBbox)).toBe(true) // SE corner
        expect(isWithinBounds(42.023, -87.940, chicagoBbox)).toBe(true) // NW corner
    })

    it('returns false for just outside boundary', () => {
        expect(isWithinBounds(41.643, -87.6298, chicagoBbox)).toBe(false) // just south
        expect(isWithinBounds(42.024, -87.6298, chicagoBbox)).toBe(false) // just north
        expect(isWithinBounds(41.8781, -87.941, chicagoBbox)).toBe(false) // just west
        expect(isWithinBounds(41.8781, -87.523, chicagoBbox)).toBe(false) // just east
    })

    // Multi-city tests
    it('returns true for downtown Seattle within Seattle bbox', () => {
        expect(isWithinBounds(47.6062, -122.3321, seattleBbox)).toBe(true)
    })

    it('returns false for Chicago coords in Seattle bbox', () => {
        expect(isWithinBounds(41.8781, -87.6298, seattleBbox)).toBe(false)
    })

    it('returns false for Seattle coords in Chicago bbox', () => {
        expect(isWithinBounds(47.6062, -122.3321, chicagoBbox)).toBe(false)
    })
})

describe('normalizeAddress', () => {
    it('lowercases text', () => {
        expect(normalizeAddress('123 Main ST')).toBe('123 main st')
    })

    it('trims whitespace', () => {
        expect(normalizeAddress('  123 Main St  ')).toBe('123 main st')
    })

    it('collapses multiple spaces', () => {
        expect(normalizeAddress('123   Main    St')).toBe('123 main st')
    })

    it('handles empty string', () => {
        expect(normalizeAddress('')).toBe('')
    })
})
