import { describe, it, expect } from 'vitest'
import { classifyPermit } from '../permit-classifier'

describe('classifyPermit', () => {
    describe('red severity', () => {
        it('flags new construction >= $5M as red', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'Build new residential tower',
                reported_cost: 6_000_000,
            })
            expect(result.severity).toBe('red')
            expect(result.reason).toContain('$5M')
            expect(result.communityNote).toBeTruthy()
        })

        it('flags new construction with high-impact keyword as red regardless of cost', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'Construction of new data center facility',
                reported_cost: 1_000,
            })
            expect(result.severity).toBe('red')
            expect(result.reason).toContain('industrial/high-impact')
            expect(result.communityNote).toContain('noise')
        })

        it('detects all high-impact keywords', () => {
            // NOTE(Agent): These must match HIGH_IMPACT_KEYWORDS exactly.
            // 'industrial' alone is NOT a keyword — use the full forms.
            const keywords = [
                'data center', 'factory', 'industrial facility', 'industrial park',
                'industrial site', 'manufacturing', 'warehouse',
                'logistics', 'distribution', 'power plant', 'substation', 'refinery',
                'planned development',
            ]
            for (const kw of keywords) {
                const result = classifyPermit({
                    permit_type: 'PERMIT - NEW CONSTRUCTION',
                    work_description: `Building a ${kw} on this lot`,
                    reported_cost: 100,
                })
                expect(result.severity).toBe('red')
                expect(result.communityNote).toBeTruthy()
            }
        })

        it('flags new construction with exact $5M threshold as red', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'New office building',
                reported_cost: 5_000_000,
            })
            expect(result.severity).toBe('red')
            expect(result.communityNote).toBeTruthy()
        })
    })

    describe('yellow severity', () => {
        it('flags new construction $1M-$5M as yellow', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'New residential building',
                reported_cost: 2_500_000,
            })
            expect(result.severity).toBe('yellow')
            expect(result.reason).toContain('$1M')
            expect(result.communityNote).toContain('$2.5M')
        })

        it('flags new construction at exact $1M threshold as yellow', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'New building',
                reported_cost: 1_000_000,
            })
            expect(result.severity).toBe('yellow')
            expect(result.communityNote).toBeTruthy()
        })

        it('flags just below $5M as yellow', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'New building',
                reported_cost: 4_999_999,
            })
            expect(result.severity).toBe('yellow')
        })
    })

    describe('green severity', () => {
        it('classifies renovation permits as green', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - RENOVATION/ALTERATION',
                work_description: 'Interior renovation of office space',
                reported_cost: 10_000_000,
            })
            // NOTE(Agent): Renovation with $10M cost now triggers cost-only fallback (red).
            // Previously this was always green because it wasn't "new construction".
            // The new classifier recognizes high-cost projects regardless of type.
            expect(result.severity).toBe('red')
            expect(result.reason).toContain('High-cost')
        })

        it('classifies low-cost new construction as green', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'Build new garage',
                reported_cost: 500_000,
            })
            expect(result.severity).toBe('green')
            expect(result.communityNote).toContain('garage or outbuilding')
        })

        it('handles missing fields gracefully', () => {
            const result = classifyPermit({})
            expect(result.severity).toBe('green')
            expect(result.reason).toBe('Standard permit')
            expect(result.communityNote).toBeTruthy()
        })

        it('handles zero cost', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'Small shed',
                reported_cost: 0,
            })
            expect(result.severity).toBe('green')
            expect(result.communityNote).toBeTruthy()
        })

        it('handles string cost (from raw API)', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'New building',
                reported_cost: '3000000' as unknown as number,
            })
            expect(result.severity).toBe('yellow')
        })
    })

    describe('cost-only fallback for non-Chicago permit types', () => {
        it('classifies unknown permit type with $5M+ as red', () => {
            const result = classifyPermit({
                permit_type: 'Building Permit - Commercial',
                work_description: 'Construct new commercial building',
                reported_cost: 8_000_000,
            })
            expect(result.severity).toBe('red')
            expect(result.reason).toContain('High-cost')
        })

        it('classifies unknown permit type with $1M-$5M as yellow', () => {
            const result = classifyPermit({
                permit_type: 'Commercial Building Permit',
                work_description: 'Construct retail space',
                reported_cost: 2_500_000,
            })
            expect(result.severity).toBe('yellow')
            expect(result.reason).toContain('Mid-cost')
        })

        it('classifies unknown permit type with low cost as green', () => {
            const result = classifyPermit({
                permit_type: 'Residential Alteration',
                work_description: 'Replace kitchen countertops',
                reported_cost: 15_000,
            })
            expect(result.severity).toBe('green')
        })

        it('flags unknown permit type with high-impact keywords as red', () => {
            const result = classifyPermit({
                permit_type: 'Commercial Permit',
                work_description: 'New warehouse and distribution facility',
                reported_cost: 500_000,
            })
            expect(result.severity).toBe('red')
            expect(result.reason).toContain('High-impact')
        })
    })

    describe('communityNote impact categories', () => {
        it('detects warehouse/logistics traffic impact', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'Construction of new warehouse and distribution center',
                reported_cost: 8_000_000,
            })
            expect(result.communityNote).toContain('truck traffic')
        })

        it('detects air quality impact for refinery', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'New petroleum refinery processing facility',
                reported_cost: 50_000_000,
            })
            expect(result.communityNote).toContain('air quality')
        })

        it('detects demolition impact', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - WRECKING/DEMOLITION',
                work_description: 'Full demolition of existing structure',
                reported_cost: 100_000,
            })
            expect(result.communityNote).toContain('demolition')
        })

        it('detects nightlife impact', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'New nightclub and music venue',
                reported_cost: 2_000_000,
            })
            expect(result.communityNote).toContain('late-night')
        })

        it('composes multiple impact categories', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'New chemical manufacturing warehouse',
                reported_cost: 10_000_000,
            })
            // Should detect both air quality and traffic/logistics and industrial noise
            expect(result.communityNote).toContain('air quality')
            expect(result.communityNote).toContain('truck traffic')
        })

        it('uses generic note when no specific categories match', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'New office building',
                reported_cost: 6_000_000,
            })
            // No specific impact keywords, should get generic high-severity note
            expect(result.communityNote).toContain('significant construction activity')
        })

        it('uses renovation lead for green renovation permits', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - RENOVATION/ALTERATION',
                work_description: 'Replace windows and doors',
                reported_cost: 50_000,
            })
            expect(result.communityNote).toContain('Renovation')
            expect(result.communityNote).toContain('minimal')
        })

        it('uses demolition lead for wrecking permits', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - WRECKING/DEMOLITION',
                work_description: 'Demolition of 3-story building',
                reported_cost: 200_000,
            })
            expect(result.communityNote).toContain('demolition')
            expect(result.communityNote).toContain('dust')
        })
    })

    describe('permitLabel', () => {
        it('returns descriptor-based label for residential tower', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'Build new residential tower',
                reported_cost: 6_000_000,
            })
            expect(result.permitLabel).toBe('Residential Tower')
        })

        it('returns descriptor-based label for restaurant', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'New restaurant and dining area',
                reported_cost: 500_000,
            })
            expect(result.permitLabel).toBe('Restaurant')
        })

        it('returns descriptor-based label for garage', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'Build new garage',
                reported_cost: 50_000,
            })
            expect(result.permitLabel).toBe('Garage Or Outbuilding')
        })

        it('falls back to Demolition for wrecking permits', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - WRECKING/DEMOLITION',
                work_description: 'Full teardown',
                reported_cost: 100_000,
            })
            expect(result.permitLabel).toBe('Demolition')
        })

        it('falls back to Renovation for alteration permits', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - RENOVATION/ALTERATION',
                work_description: 'Replace windows and doors',
                reported_cost: 50_000,
            })
            expect(result.permitLabel).toBe('Home Improvement')
        })

        it('falls back to New Construction when no descriptor matches', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'New building',
                reported_cost: 1_000_000,
            })
            expect(result.permitLabel).toBe('New Construction')
        })

        it('returns Building Permit for empty input', () => {
            const result = classifyPermit({})
            expect(result.permitLabel).toBe('Building Permit')
        })

        it('detects townhouse descriptor', () => {
            const result = classifyPermit({
                permit_type: 'PERMIT - NEW CONSTRUCTION',
                work_description: 'New 4-unit townhouse development',
                reported_cost: 2_000_000,
            })
            expect(result.permitLabel).toBe('Townhouse')
        })

        it('detects home improvement from roof keyword', () => {
            const result = classifyPermit({
                permit_type: 'Residential Alteration',
                work_description: 'Reroof entire house with new shingles',
                reported_cost: 15_000,
            })
            expect(result.permitLabel).toBe('Home Improvement')
        })
    })
})
