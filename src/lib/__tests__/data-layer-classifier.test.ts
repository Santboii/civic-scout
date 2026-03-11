import { describe, it, expect } from 'vitest'
import { classifyCrime, classifyViolation, classifyCrash } from '../data-layer-classifier'

describe('classifyCrime', () => {
    describe('red severity', () => {
        it('flags HOMICIDE as red', () => {
            const result = classifyCrime({
                primaryType: 'HOMICIDE',
                description: 'FIRST DEGREE MURDER',
                domestic: false,
            })
            expect(result.severity).toBe('red')
            expect(result.severityReason).toContain('HOMICIDE')
            expect(result.communityNote).toContain('Safety Alert')
        })

        it('flags KIDNAPPING as red', () => {
            const result = classifyCrime({
                primaryType: 'KIDNAPPING',
                description: 'CHILD ABDUCTION',
                domestic: false,
            })
            expect(result.severity).toBe('red')
        })

        it('flags CRIM SEXUAL ASSAULT as red', () => {
            const result = classifyCrime({
                primaryType: 'CRIM SEXUAL ASSAULT',
                description: 'NON-AGGRAVATED',
                domestic: false,
            })
            expect(result.severity).toBe('red')
        })

        it('flags HUMAN TRAFFICKING as red', () => {
            const result = classifyCrime({
                primaryType: 'HUMAN TRAFFICKING',
                description: 'COMMERCIAL SEX ACTS',
                domestic: false,
            })
            expect(result.severity).toBe('red')
        })

        it('flags ARSON as red', () => {
            const result = classifyCrime({
                primaryType: 'ARSON',
                description: 'BY FIRE',
                domestic: false,
            })
            expect(result.severity).toBe('red')
        })

        it('elevates yellow type with ARMED qualifier to red', () => {
            const result = classifyCrime({
                primaryType: 'ROBBERY',
                description: 'ARMED: HANDGUN',
                domestic: false,
            })
            expect(result.severity).toBe('red')
            expect(result.severityReason).toContain('aggravating factor')
        })

        it('elevates BATTERY with AGGRAVATED qualifier to red', () => {
            const result = classifyCrime({
                primaryType: 'BATTERY',
                description: 'AGGRAVATED DOMESTIC BATTERY: OTHER DANGEROUS WEAPON',
                domestic: true,
            })
            expect(result.severity).toBe('red')
            expect(result.communityNote).toContain('domestic')
        })

        it('elevates with ATTEMPT MURDER qualifier to red', () => {
            const result = classifyCrime({
                primaryType: 'ASSAULT',
                description: 'ATTEMPT MURDER',
                domestic: false,
            })
            expect(result.severity).toBe('red')
        })
    })

    describe('yellow severity', () => {
        it('classifies ROBBERY as yellow', () => {
            const result = classifyCrime({
                primaryType: 'ROBBERY',
                description: 'STRONGARM - NO WEAPON',
                domestic: false,
            })
            expect(result.severity).toBe('yellow')
            expect(result.communityNote).toContain('Community Concern')
        })

        it('classifies BATTERY as yellow', () => {
            const result = classifyCrime({
                primaryType: 'BATTERY',
                description: 'SIMPLE',
                domestic: false,
            })
            expect(result.severity).toBe('yellow')
        })

        it('classifies ASSAULT as yellow', () => {
            const result = classifyCrime({
                primaryType: 'ASSAULT',
                description: 'SIMPLE',
                domestic: false,
            })
            expect(result.severity).toBe('yellow')
        })

        it('classifies BURGLARY as yellow', () => {
            const result = classifyCrime({
                primaryType: 'BURGLARY',
                description: 'FORCIBLE ENTRY',
                domestic: false,
            })
            expect(result.severity).toBe('yellow')
        })

        it('classifies MOTOR VEHICLE THEFT as yellow', () => {
            const result = classifyCrime({
                primaryType: 'MOTOR VEHICLE THEFT',
                description: 'AUTOMOBILE',
                domestic: false,
            })
            expect(result.severity).toBe('yellow')
        })

        it('classifies WEAPONS VIOLATION as yellow', () => {
            const result = classifyCrime({
                primaryType: 'WEAPONS VIOLATION',
                description: 'UNLAWFUL POSS OF HANDGUN',
                domestic: false,
            })
            expect(result.severity).toBe('yellow')
        })

        it('classifies SEX OFFENSE as yellow', () => {
            const result = classifyCrime({
                primaryType: 'SEX OFFENSE',
                description: 'PUBLIC INDECENCY',
                domestic: false,
            })
            expect(result.severity).toBe('yellow')
        })

        it('classifies STALKING as yellow', () => {
            const result = classifyCrime({
                primaryType: 'STALKING',
                description: 'SIMPLE',
                domestic: false,
            })
            expect(result.severity).toBe('yellow')
        })

        it('classifies INTIMIDATION as yellow', () => {
            const result = classifyCrime({
                primaryType: 'INTIMIDATION',
                description: 'INTIMIDATION',
                domestic: false,
            })
            expect(result.severity).toBe('yellow')
        })
    })

    describe('green severity', () => {
        it('classifies THEFT as green', () => {
            const result = classifyCrime({
                primaryType: 'THEFT',
                description: '$500 AND UNDER',
                domestic: false,
            })
            expect(result.severity).toBe('green')
            expect(result.communityNote).toContain('Incident Report')
            expect(result.communityNote).toContain('non-violent')
        })

        it('classifies CRIMINAL DAMAGE as green', () => {
            const result = classifyCrime({
                primaryType: 'CRIMINAL DAMAGE',
                description: 'TO PROPERTY',
                domestic: false,
            })
            expect(result.severity).toBe('green')
        })

        it('classifies DECEPTIVE PRACTICE as green', () => {
            const result = classifyCrime({
                primaryType: 'DECEPTIVE PRACTICE',
                description: 'FINANCIAL IDENTITY THEFT OVER $ 300',
                domestic: false,
            })
            expect(result.severity).toBe('green')
        })

        it('classifies CRIMINAL TRESPASS as green', () => {
            const result = classifyCrime({
                primaryType: 'CRIMINAL TRESPASS',
                description: 'TO LAND',
                domestic: false,
            })
            expect(result.severity).toBe('green')
        })

        it('classifies NARCOTICS as green', () => {
            const result = classifyCrime({
                primaryType: 'NARCOTICS',
                description: 'POSS: CANNABIS 30GMS OR LESS',
                domestic: false,
            })
            expect(result.severity).toBe('green')
        })

        it('classifies OTHER OFFENSE as green', () => {
            const result = classifyCrime({
                primaryType: 'OTHER OFFENSE',
                description: 'VIOLATION OF ORDER OF PROTECTION',
                domestic: false,
            })
            expect(result.severity).toBe('green')
        })
    })

    describe('edge cases', () => {
        it('handles empty fields gracefully', () => {
            const result = classifyCrime({
                primaryType: '',
                description: '',
                domestic: false,
            })
            expect(result.severity).toBe('green')
            expect(result.communityNote).toBeTruthy()
        })

        it('handles case insensitive primaryType', () => {
            const result = classifyCrime({
                primaryType: 'homicide',
                description: 'first degree murder',
                domestic: false,
            })
            expect(result.severity).toBe('red')
        })

        it('notes domestic incidents in community note', () => {
            const result = classifyCrime({
                primaryType: 'THEFT',
                description: '$500 AND UNDER',
                domestic: true,
            })
            expect(result.severity).toBe('green')
            expect(result.communityNote).toContain('domestic')
        })
    })
})

describe('classifyViolation', () => {
    describe('red severity', () => {
        it('flags open fire violation as red', () => {
            const result = classifyViolation({
                violationDescription: 'Failed to maintain fire escape in good condition',
                violationStatus: 'OPEN',
                violationCode: 'CN070024',
            })
            expect(result.severity).toBe('red')
            expect(result.severityReason).toContain('Life/safety')
            expect(result.communityNote).toContain('Critical Violation')
        })

        it('flags open structural violation as red', () => {
            const result = classifyViolation({
                violationDescription: 'STRUCTURAL DEFECTS OR HAZARDS',
                violationStatus: 'OPEN',
                violationCode: 'BV100',
            })
            expect(result.severity).toBe('red')
        })

        it('flags open unsafe building as red', () => {
            const result = classifyViolation({
                violationDescription: 'Building is unsafe and dangerous to occupants',
                violationStatus: 'OPEN',
                violationCode: 'BV200',
            })
            expect(result.severity).toBe('red')
        })

        it('flags open condemned building as red', () => {
            const result = classifyViolation({
                violationDescription: 'Building has been condemned by department',
                violationStatus: 'OPEN',
                violationCode: 'BV300',
            })
            expect(result.severity).toBe('red')
        })

        it('flags open hazardous condition as red', () => {
            const result = classifyViolation({
                violationDescription: 'HAZARDOUS condition in the building',
                violationStatus: 'OPEN',
                violationCode: 'BV400',
            })
            expect(result.severity).toBe('red')
        })

        it('flags open electrical hazard as red', () => {
            const result = classifyViolation({
                violationDescription: 'ELECTRICAL HAZARD - exposed wiring',
                violationStatus: 'OPEN',
                violationCode: 'BV500',
            })
            expect(result.severity).toBe('red')
        })

        it('flags open no heat violation as red', () => {
            const result = classifyViolation({
                violationDescription: 'No heat in the building during winter months',
                violationStatus: 'OPEN',
                violationCode: 'CN060',
            })
            expect(result.severity).toBe('red')
        })

        it('flags open gas leak as red', () => {
            const result = classifyViolation({
                violationDescription: 'GAS LEAK reported at premises',
                violationStatus: 'NON COMPLIANCE',
                violationCode: 'BV600',
            })
            expect(result.severity).toBe('red')
        })
    })

    describe('yellow severity', () => {
        it('classifies closed fire violation as yellow (not green)', () => {
            const result = classifyViolation({
                violationDescription: 'Failed to maintain fire escape in good condition',
                violationStatus: 'CLOSED',
                violationCode: 'CN070024',
            })
            expect(result.severity).toBe('yellow')
            expect(result.severityReason).toContain('resolved')
        })

        it('classifies open construction without permit as yellow', () => {
            const result = classifyViolation({
                violationDescription: 'Construction without permit observed',
                violationStatus: 'OPEN',
                violationCode: 'CN100',
            })
            expect(result.severity).toBe('yellow')
        })

        it('classifies open occupancy violation as yellow', () => {
            const result = classifyViolation({
                violationDescription: 'Exceeded maximum occupancy limits',
                violationStatus: 'OPEN',
                violationCode: 'CN200',
            })
            expect(result.severity).toBe('yellow')
        })

        it('classifies open violation without specific keywords as yellow', () => {
            const result = classifyViolation({
                violationDescription: 'General maintenance deficiency noted',
                violationStatus: 'OPEN',
                violationCode: 'CN300',
            })
            expect(result.severity).toBe('yellow')
            expect(result.severityReason).toBe('Open violation')
        })

        it('classifies FAILED status as yellow (open)', () => {
            const result = classifyViolation({
                violationDescription: 'Minor plumbing issue',
                violationStatus: 'FAILED',
                violationCode: 'CN400',
            })
            expect(result.severity).toBe('yellow')
        })
    })

    describe('green severity', () => {
        it('classifies closed routine violation as green', () => {
            const result = classifyViolation({
                violationDescription: 'Failed to maintain exterior walls in good repair',
                violationStatus: 'CLOSED',
                violationCode: 'CN080',
            })
            expect(result.severity).toBe('green')
            expect(result.communityNote).toContain('Routine')
        })

        it('classifies COMPLIED status as green', () => {
            const result = classifyViolation({
                violationDescription: 'Minor handrail repair needed',
                violationStatus: 'COMPLIED',
                violationCode: 'CN500',
            })
            expect(result.severity).toBe('green')
        })

        it('classifies PASSED status as green', () => {
            const result = classifyViolation({
                violationDescription: 'Inspection item',
                violationStatus: 'PASSED',
                violationCode: 'CN600',
            })
            expect(result.severity).toBe('green')
        })
    })

    describe('edge cases', () => {
        it('handles empty fields gracefully', () => {
            const result = classifyViolation({
                violationDescription: '',
                violationStatus: '',
                violationCode: '',
            })
            expect(result.severity).toBe('green')
            expect(result.communityNote).toBeTruthy()
        })

        it('truncates long violation descriptions in community note', () => {
            const longDesc = 'A'.repeat(200)
            const result = classifyViolation({
                violationDescription: longDesc,
                violationStatus: 'OPEN',
                violationCode: 'CN700',
            })
            expect(result.communityNote.length).toBeLessThan(longDesc.length + 100)
        })
    })
})

describe('classifyCrash', () => {
    describe('red severity', () => {
        it('flags fatal crash as red', () => {
            const result = classifyCrash({
                injuriesTotal: 2,
                injuriesFatal: 1,
                crashType: 'INJURY AND / OR TOW DUE TO CRASH',
                primContributoryCause: 'FAILING TO YIELD RIGHT-OF-WAY',
            })
            expect(result.severity).toBe('red')
            expect(result.severityReason).toContain('fatality')
            expect(result.communityNote).toContain('Severe Crash')
            expect(result.communityNote).toContain('fatality')
        })

        it('flags multiple fatalities as red with correct count', () => {
            const result = classifyCrash({
                injuriesTotal: 5,
                injuriesFatal: 3,
                crashType: 'INJURY AND / OR TOW DUE TO CRASH',
                primContributoryCause: 'DRIVING SKILLS/KNOWLEDGE/EXPERIENCE',
            })
            expect(result.severity).toBe('red')
            expect(result.severityReason).toContain('3')
            expect(result.severityReason).toContain('fatalities')
        })

        it('flags 3+ injuries as red', () => {
            const result = classifyCrash({
                injuriesTotal: 4,
                injuriesFatal: 0,
                crashType: 'INJURY AND / OR TOW DUE TO CRASH',
                primContributoryCause: 'DISREGARDING TRAFFIC SIGNALS',
            })
            expect(result.severity).toBe('red')
            expect(result.severityReason).toContain('4 injuries')
        })

        it('flags exactly 3 injuries as red', () => {
            const result = classifyCrash({
                injuriesTotal: 3,
                injuriesFatal: 0,
                crashType: 'INJURY AND / OR TOW DUE TO CRASH',
                primContributoryCause: 'FOLLOWING TOO CLOSELY',
            })
            expect(result.severity).toBe('red')
        })
    })

    describe('yellow severity', () => {
        it('classifies 1 injury as yellow', () => {
            const result = classifyCrash({
                injuriesTotal: 1,
                injuriesFatal: 0,
                crashType: 'INJURY AND / OR TOW DUE TO CRASH',
                primContributoryCause: 'IMPROPER LANE USAGE',
            })
            expect(result.severity).toBe('yellow')
            expect(result.severityReason).toContain('1 injury')
            expect(result.communityNote).toContain('Injury Crash')
        })

        it('classifies 2 injuries as yellow', () => {
            const result = classifyCrash({
                injuriesTotal: 2,
                injuriesFatal: 0,
                crashType: 'INJURY AND / OR TOW DUE TO CRASH',
                primContributoryCause: 'TURNING RIGHT ON RED',
            })
            expect(result.severity).toBe('yellow')
            expect(result.severityReason).toContain('2 injuries')
        })
    })

    describe('green severity', () => {
        it('classifies property-damage-only crash as green', () => {
            const result = classifyCrash({
                injuriesTotal: 0,
                injuriesFatal: 0,
                crashType: 'NO INJURY / DRIVE AWAY',
                primContributoryCause: 'FOLLOWING TOO CLOSELY',
            })
            expect(result.severity).toBe('green')
            expect(result.severityReason).toBe('Property damage only')
            expect(result.communityNote).toContain('Minor Crash')
        })
    })

    describe('edge cases', () => {
        it('handles zero values gracefully', () => {
            const result = classifyCrash({
                injuriesTotal: 0,
                injuriesFatal: 0,
                crashType: '',
                primContributoryCause: '',
            })
            expect(result.severity).toBe('green')
            expect(result.communityNote).toBeTruthy()
        })

        it('handles NaN/string injury values (from raw API)', () => {
            const result = classifyCrash({
                injuriesTotal: NaN,
                injuriesFatal: NaN,
                crashType: 'NO INJURY / DRIVE AWAY',
                primContributoryCause: 'UNABLE TO DETERMINE',
            })
            expect(result.severity).toBe('green')
        })

        it('excludes UNABLE TO DETERMINE from contributing factor note', () => {
            const result = classifyCrash({
                injuriesTotal: 1,
                injuriesFatal: 0,
                crashType: 'INJURY AND / OR TOW DUE TO CRASH',
                primContributoryCause: 'UNABLE TO DETERMINE',
            })
            expect(result.communityNote).not.toContain('Unable To Determine')
        })

        it('includes contributing cause when present', () => {
            const result = classifyCrash({
                injuriesTotal: 1,
                injuriesFatal: 0,
                crashType: 'INJURY AND / OR TOW DUE TO CRASH',
                primContributoryCause: 'DISTRACTION - FROM OUTSIDE VEHICLE',
            })
            expect(result.communityNote).toContain('Contributing factor')
        })

        it('handles fatality with additional injuries', () => {
            const result = classifyCrash({
                injuriesTotal: 3,
                injuriesFatal: 1,
                crashType: 'INJURY AND / OR TOW DUE TO CRASH',
                primContributoryCause: 'EXCEEDING AUTHORIZED SPEED LIMIT',
            })
            expect(result.communityNote).toContain('1 fatality')
            expect(result.communityNote).toContain('2 additional')
        })
    })

    describe('community note quality', () => {
        it('includes crash type in yellow notes', () => {
            const result = classifyCrash({
                injuriesTotal: 1,
                injuriesFatal: 0,
                crashType: 'REAR END',
                primContributoryCause: 'FOLLOWING TOO CLOSELY',
            })
            expect(result.communityNote).toContain('Rear End')
        })

        it('includes crash type in green notes', () => {
            const result = classifyCrash({
                injuriesTotal: 0,
                injuriesFatal: 0,
                crashType: 'SIDESWIPE SAME DIRECTION',
                primContributoryCause: 'IMPROPER LANE USAGE',
            })
            expect(result.communityNote).toContain('Sideswipe Same Direction')
        })
    })
})
