import { describe, it, expect } from 'vitest'
import { isWithinChicago, normalizeAddress } from '../geocoder'

describe('isWithinChicago', () => {
    it('returns true for downtown Chicago', () => {
        expect(isWithinChicago(41.8781, -87.6298)).toBe(true)
    })

    it('returns true for north boundary (Rogers Park area)', () => {
        expect(isWithinChicago(42.02, -87.67)).toBe(true)
    })

    it('returns true for south boundary (Far South Side)', () => {
        expect(isWithinChicago(41.65, -87.60)).toBe(true)
    })

    it('returns false for coordinates north of Chicago (Evanston)', () => {
        expect(isWithinChicago(42.05, -87.69)).toBe(false)
    })

    it('returns false for coordinates south of Chicago (Hammond, IN)', () => {
        expect(isWithinChicago(41.60, -87.50)).toBe(false)
    })

    it('returns false for New York City', () => {
        expect(isWithinChicago(40.7128, -74.006)).toBe(false)
    })

    it('returns true for exact boundary values', () => {
        // All four corners of the bounding box
        expect(isWithinChicago(41.644, -87.940)).toBe(true) // SW corner
        expect(isWithinChicago(42.023, -87.524)).toBe(true) // NE corner
        expect(isWithinChicago(41.644, -87.524)).toBe(true) // SE corner
        expect(isWithinChicago(42.023, -87.940)).toBe(true) // NW corner
    })

    it('returns false for just outside boundary', () => {
        expect(isWithinChicago(41.643, -87.6298)).toBe(false) // just south
        expect(isWithinChicago(42.024, -87.6298)).toBe(false) // just north
        expect(isWithinChicago(41.8781, -87.941)).toBe(false) // just west
        expect(isWithinChicago(41.8781, -87.523)).toBe(false) // just east
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
