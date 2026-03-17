// ── Data Layer Severity Classifiers ─────────────────────────────────────────
// NOTE(Agent): Mirrors the architecture of permit-classifier.ts but for the
// three data layer types (Crime, Violations, Crashes). Each classifier accepts
// RAW (pre-escaped) field values to avoid HTML entity interference with keyword
// matching. Called during normalization in data-layers.ts.

import type { PermitSeverity } from './permit-classifier'

// ── Shared Types ────────────────────────────────────────────────────────────

export interface LayerClassification {
    severity: PermitSeverity
    severityReason: string
    communityNote: string
}

// ── Severity Labels ─────────────────────────────────────────────────────────
// NOTE(Agent): Value-neutral labels to avoid "minimizing" crime/crash severity.
// "Safety Alert" / "Community Concern" / "Incident Report" instead of the
// permit-style "High Impact" / "Medium" / "Standard".

export const LAYER_SEVERITY_LABELS: Record<PermitSeverity, Record<string, string>> = {
    red: {
        crimes: 'Safety Alert',
        violations: 'Critical Violation',
        crashes: 'Severe Crash',
        service_requests: 'Health & Safety',
    },
    yellow: {
        crimes: 'Community Concern',
        violations: 'Active Violation',
        crashes: 'Injury Crash',
        service_requests: 'Quality Concern',
    },
    green: {
        crimes: 'Incident Report',
        violations: 'Routine',
        crashes: 'Minor Crash',
        service_requests: 'Service Request',
    },
}

// ── Crime Classification ────────────────────────────────────────────────────

// NOTE(Agent): Based on FBI UCR hierarchy. Violent felonies = red,
// assault/robbery/burglary = yellow, property/minor = green.
const RED_CRIME_TYPES = new Set([
    'HOMICIDE',
    'KIDNAPPING',
    'CRIM SEXUAL ASSAULT',
    'HUMAN TRAFFICKING',
    'ARSON',
])

const YELLOW_CRIME_TYPES = new Set([
    'ROBBERY',
    'BATTERY',
    'ASSAULT',
    'BURGLARY',
    'MOTOR VEHICLE THEFT',
    'STALKING',
    'WEAPONS VIOLATION',
    'SEX OFFENSE',
    'INTIMIDATION',
])

// NOTE(Agent): Description qualifiers that elevate severity. "ARMED" or
// "AGGRAVATED" on a yellow-tier type promotes it to red. These are checked
// as substrings of the description field.
const RED_QUALIFIERS = ['ARMED', 'AGGRAVATED', 'ATTEMPT MURDER']

export function classifyCrime(fields: {
    primaryType: string
    description: string
    domestic: boolean
}): LayerClassification {
    const type = (fields.primaryType ?? '').toUpperCase().trim()
    const desc = (fields.description ?? '').toUpperCase().trim()

    // RED — Violent felonies or qualified violent crimes
    if (RED_CRIME_TYPES.has(type)) {
        return {
            severity: 'red',
            severityReason: `Violent felony: ${type}`,
            communityNote: buildCrimeCommunityNote('red', type, desc, fields.domestic),
        }
    }

    // Check if a yellow-tier type is elevated by description qualifiers
    if (YELLOW_CRIME_TYPES.has(type) && RED_QUALIFIERS.some((q) => desc.includes(q))) {
        return {
            severity: 'red',
            severityReason: `${type} with aggravating factor`,
            communityNote: buildCrimeCommunityNote('red', type, desc, fields.domestic),
        }
    }

    // YELLOW — Assault, robbery, burglary, etc.
    if (YELLOW_CRIME_TYPES.has(type)) {
        return {
            severity: 'yellow',
            severityReason: type,
            communityNote: buildCrimeCommunityNote('yellow', type, desc, fields.domestic),
        }
    }

    // YELLOW — Domestic violence with any type is at least yellow
    if (fields.domestic && (type.includes('BATTERY') || type.includes('ASSAULT'))) {
        return {
            severity: 'yellow',
            severityReason: 'Domestic violence incident',
            communityNote: buildCrimeCommunityNote('yellow', type, desc, true),
        }
    }

    // GREEN — Everything else
    return {
        severity: 'green',
        severityReason: 'Non-violent incident',
        communityNote: buildCrimeCommunityNote('green', type, desc, fields.domestic),
    }
}

function buildCrimeCommunityNote(
    severity: PermitSeverity,
    type: string,
    description: string,
    domestic: boolean,
): string {
    const label = LAYER_SEVERITY_LABELS[severity].crimes
    const domesticNote = domestic ? ' This was flagged as a domestic incident.' : ''

    if (severity === 'red') {
        const detail = description ? ` (${titleCase(description)})` : ''
        return `${label}: A ${titleCase(type)}${detail} was reported in this area.${domesticNote} Exercise heightened awareness.`
    }

    if (severity === 'yellow') {
        return `${label}: A ${titleCase(type)} incident was reported nearby.${domesticNote} Stay aware of your surroundings.`
    }

    // Green
    return `${label}: A ${titleCase(type)} was reported in the vicinity.${domesticNote} This is a non-violent incident.`
}

// ── Building Violation Classification ───────────────────────────────────────

// NOTE(Agent): Life/safety keywords in violation descriptions that indicate
// critical severity. These are checked as substrings (case-insensitive).
const RED_VIOLATION_KEYWORDS = [
    'fire', 'structural', 'unsafe', 'condemned', 'hazardous',
    'imminent danger', 'electrical hazard', 'collapse', 'no heat',
    'carbon monoxide', 'gas leak', 'emergency',
]

const YELLOW_VIOLATION_KEYWORDS = [
    'construction without permit', 'no permit', 'occupancy',
    'code violation', 'illegal conversion', 'overcrowding',
    'building code', 'zoning', 'egress',
]

export function classifyViolation(fields: {
    violationDescription: string
    violationStatus: string
    violationCode: string
}): LayerClassification {
    const desc = (fields.violationDescription ?? '').toLowerCase()
    const status = (fields.violationStatus ?? '').toUpperCase().trim()
    const isOpen = status.includes('OPEN') || status === 'FAILED' || status === 'NON COMPLIANCE'
    const isClosed = status.includes('CLOSED') || status.includes('COMPLIED') || status.includes('PASSED')

    // RED — Life/safety keywords + open status
    if (isOpen && RED_VIOLATION_KEYWORDS.some((kw) => desc.includes(kw))) {
        return {
            severity: 'red',
            severityReason: 'Life/safety violation (open)',
            communityNote: buildViolationCommunityNote('red', desc, isOpen),
        }
    }

    // NOTE(Agent): Even closed violations with critical keywords are yellow,
    // not green. A "closed fire hazard" is still worth noting.
    if (isClosed && RED_VIOLATION_KEYWORDS.some((kw) => desc.includes(kw))) {
        return {
            severity: 'yellow',
            severityReason: 'Life/safety violation (resolved)',
            communityNote: buildViolationCommunityNote('yellow', desc, false),
        }
    }

    // YELLOW — Active compliance issues
    if (isOpen && YELLOW_VIOLATION_KEYWORDS.some((kw) => desc.includes(kw))) {
        return {
            severity: 'yellow',
            severityReason: 'Active compliance issue',
            communityNote: buildViolationCommunityNote('yellow', desc, isOpen),
        }
    }

    // YELLOW — Open violations without specific keywords default to yellow
    // NOTE(Agent): Bias toward yellow when uncertain per P0 risk analysis.
    // A false-green for a real hazard is worse than a false-yellow for a routine issue.
    if (isOpen) {
        return {
            severity: 'yellow',
            severityReason: 'Open violation',
            communityNote: buildViolationCommunityNote('yellow', desc, true),
        }
    }

    // GREEN — Closed/resolved violations
    return {
        severity: 'green',
        severityReason: 'Resolved violation',
        communityNote: buildViolationCommunityNote('green', desc, false),
    }
}

function buildViolationCommunityNote(
    severity: PermitSeverity,
    description: string,
    isOpen: boolean,
): string {
    const label = LAYER_SEVERITY_LABELS[severity].violations
    const statusText = isOpen ? 'currently open and unresolved' : 'has been addressed'
    // Truncate long violation descriptions for the community note
    const truncDesc = description.length > 100
        ? description.substring(0, 100).trim() + '…'
        : description

    if (severity === 'red') {
        return `${label}: A building violation involving "${truncDesc}" is ${statusText}. This may pose a safety risk to nearby residents.`
    }

    if (severity === 'yellow') {
        return `${label}: A building violation (${truncDesc}) is ${statusText}. Monitor for updates.`
    }

    return `${label}: A resolved building violation was documented at this location.`
}

// ── Traffic Crash Classification ────────────────────────────────────────────

export function classifyCrash(fields: {
    injuriesTotal: number
    injuriesFatal: number
    crashType: string
    primContributoryCause: string
}): LayerClassification {
    const fatal = Number(fields.injuriesFatal) || 0
    const total = Number(fields.injuriesTotal) || 0

    // RED — Fatality or mass-injury
    if (fatal > 0) {
        return {
            severity: 'red',
            severityReason: `${fatal} ${fatal > 1 ? 'fatalities' : 'fatality'}`,
            communityNote: buildCrashCommunityNote('red', fatal, total, fields.crashType, fields.primContributoryCause),
        }
    }

    if (total >= 3) {
        return {
            severity: 'red',
            severityReason: `${total} ${total > 1 ? 'injuries' : 'injury'}`,
            communityNote: buildCrashCommunityNote('red', 0, total, fields.crashType, fields.primContributoryCause),
        }
    }

    // YELLOW — Injuries
    if (total > 0) {
        return {
            severity: 'yellow',
            severityReason: `${total} ${total > 1 ? 'injuries' : 'injury'}`,
            communityNote: buildCrashCommunityNote('yellow', 0, total, fields.crashType, fields.primContributoryCause),
        }
    }

    // GREEN — Property damage only
    return {
        severity: 'green',
        severityReason: 'Property damage only',
        communityNote: buildCrashCommunityNote('green', 0, 0, fields.crashType, fields.primContributoryCause),
    }
}

function buildCrashCommunityNote(
    severity: PermitSeverity,
    fatal: number,
    total: number,
    crashType: string,
    cause: string,
): string {
    const label = LAYER_SEVERITY_LABELS[severity].crashes
    const causeNote = cause && cause !== 'UNABLE TO DETERMINE'
        ? ` Contributing factor: ${titleCase(cause)}.`
        : ''

    if (severity === 'red' && fatal > 0) {
        return `${label}: A traffic crash at this location resulted in ${fatal} fatality${fatal > 1 ? 's' : ''}${total > fatal ? ` and ${total - fatal} additional injury${total - fatal > 1 ? 's' : ''}` : ''}.${causeNote} Exercise caution in this area.`
    }

    if (severity === 'red') {
        return `${label}: A traffic crash at this location resulted in ${total} injuries.${causeNote} Exercise caution in this area.`
    }

    if (severity === 'yellow') {
        const typeNote = crashType ? ` (${titleCase(crashType)})` : ''
        return `${label}: A traffic crash${typeNote} at this location resulted in ${total} injury${total > 1 ? 's' : ''}.${causeNote}`
    }

    // Green
    const typeNote = crashType ? ` (${titleCase(crashType)})` : ''
    return `${label}: A property-damage-only traffic crash${typeNote} was reported at this location.${causeNote}`
}

// ── Shared Helpers ──────────────────────────────────────────────────────────

function titleCase(str: string): string {
    if (!str) return ''
    return str
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── 311 Service Request Classification ──────────────────────────────────────

// NOTE(Agent): 311 sr_type values are highly varied (100+ distinct types per city).
// We use substring keyword matching (like violations) rather than exact set matching
// (like crimes) because sr_type strings are long and inconsistent across cities.

const RED_311_KEYWORDS = [
    'rodent', 'rat complaint', 'water main', 'gas leak',
    'sewer cave', 'building collapse', 'hazardous', 'carbon monoxide',
    'flooding', 'lead', 'asbestos',
]

const YELLOW_311_KEYWORDS = [
    'noise', 'illegal dumping', 'pothole', 'street light',
    'graffiti', 'abandoned vehicle', 'abandoned building',
    'sidewalk', 'alley light', 'fly dumping', 'weed',
    'garbage', 'trash', 'sanitation', 'vacant lot',
    'water on street', 'water leak', 'e-scooter',
]

// NOTE(Agent): 311 has many status values. Completed/Closed* statuses indicate
// the issue has been resolved. "Open - Dup" means a duplicate was filed — still
// treated as active since the original request may still be open.
const RESOLVED_311_STATUSES = ['completed', 'closed', 'closed (duplicate)']

export function classify311(fields: {
    srType: string
    status: string
}): LayerClassification {
    const type = (fields.srType ?? '').toLowerCase()
    const status = (fields.status ?? '').toLowerCase()
    const isResolved = RESOLVED_311_STATUSES.some((s) => status.includes(s))

    // Resolved requests are always green regardless of type
    if (isResolved) {
        return {
            severity: 'green',
            severityReason: 'Resolved request',
            communityNote: build311CommunityNote('green', fields.srType, isResolved),
        }
    }

    // RED — Health/safety hazards (open)
    if (RED_311_KEYWORDS.some((kw) => type.includes(kw))) {
        return {
            severity: 'red',
            severityReason: 'Health/safety concern (open)',
            communityNote: build311CommunityNote('red', fields.srType, false),
        }
    }

    // YELLOW — Active quality-of-life issues
    if (YELLOW_311_KEYWORDS.some((kw) => type.includes(kw))) {
        return {
            severity: 'yellow',
            severityReason: 'Quality-of-life issue (open)',
            communityNote: build311CommunityNote('yellow', fields.srType, false),
        }
    }

    // NOTE(Agent): Bias unknown open requests toward yellow (same logic as violations).
    // A false-green for an actual issue is worse than a false-yellow for something routine.
    return {
        severity: 'yellow',
        severityReason: 'Open request',
        communityNote: build311CommunityNote('yellow', fields.srType, false),
    }
}

function build311CommunityNote(
    severity: PermitSeverity,
    srType: string,
    isResolved: boolean,
): string {
    const label = LAYER_SEVERITY_LABELS[severity].service_requests
    const statusText = isResolved ? 'has been addressed' : 'is currently open'
    const truncType = srType.length > 80
        ? srType.substring(0, 80).trim() + '…'
        : srType

    if (severity === 'red') {
        return `${label}: A "${titleCase(truncType)}" request ${statusText}. This may indicate a health or safety concern in the area.`
    }

    if (severity === 'yellow') {
        return `${label}: A "${titleCase(truncType)}" request ${statusText}. Monitor for neighborhood conditions.`
    }

    return `${label}: A "${titleCase(truncType)}" request ${statusText}.`
}
