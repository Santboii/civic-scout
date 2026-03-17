import { describe, expect, it } from 'vitest'
import { classifyZoneClass, getZoningColor, getZoningLabel, ZONING_COLORS } from '../zoning'

describe('classifyZoneClass', () => {
    it('classifies residential zones', () => {
        expect(classifyZoneClass('RS-3')).toBe('residential')
        expect(classifyZoneClass('RT-4')).toBe('residential')
        expect(classifyZoneClass('RM-5')).toBe('residential')
    })

    it('classifies commercial/business zones', () => {
        expect(classifyZoneClass('B3-2')).toBe('commercial')
        expect(classifyZoneClass('C1-2')).toBe('commercial')
    })

    it('classifies manufacturing zones', () => {
        expect(classifyZoneClass('M1-2')).toBe('manufacturing')
        expect(classifyZoneClass('M2-3')).toBe('manufacturing')
    })

    it('classifies planned development zones', () => {
        expect(classifyZoneClass('PD 1234')).toBe('planned-development')
        expect(classifyZoneClass('PMD 5')).toBe('planned-development')
    })

    it('classifies downtown zones', () => {
        expect(classifyZoneClass('DC-12')).toBe('downtown')
        expect(classifyZoneClass('DX-16')).toBe('downtown')
        expect(classifyZoneClass('DS-5')).toBe('downtown')
        expect(classifyZoneClass('DR-10')).toBe('downtown')
    })

    it('classifies parks/open space', () => {
        expect(classifyZoneClass('POS-1')).toBe('parks')
    })

    it('classifies transportation zones', () => {
        expect(classifyZoneClass('T2')).toBe('transportation')
    })

    it('returns other for unknown zones', () => {
        expect(classifyZoneClass('')).toBe('other')
        expect(classifyZoneClass('XYZ')).toBe('other')
    })

    it('is case insensitive', () => {
        expect(classifyZoneClass('rs-3')).toBe('residential')
        expect(classifyZoneClass('b3-2')).toBe('commercial')
    })
})

describe('getZoningColor', () => {
    it('returns the correct color for a zone class', () => {
        expect(getZoningColor('RS-3')).toBe(ZONING_COLORS.residential)
        expect(getZoningColor('B3-2')).toBe(ZONING_COLORS.commercial)
        expect(getZoningColor('M1-2')).toBe(ZONING_COLORS.manufacturing)
    })
})

describe('getZoningLabel', () => {
    it('returns human-readable labels', () => {
        expect(getZoningLabel('RS-3')).toBe('Residential')
        expect(getZoningLabel('B3-2')).toBe('Commercial')
        expect(getZoningLabel('M1-2')).toBe('Manufacturing')
        expect(getZoningLabel('PD 1234')).toBe('Planned Dev.')
        expect(getZoningLabel('DC-12')).toBe('Downtown')
    })
})
