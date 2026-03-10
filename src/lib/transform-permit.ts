// ── Shared permit transformation ────────────────────────────────────────────
// NOTE(Agent): P1-2 from backend perf audit. Extracted from permits/route.ts
// and cron/pre-warm/route.ts where near-identical copies existed. Unified on
// the richer cleanDisplayAddress implementation from the permits route.

import { enrichWithCookCounty } from './cook-county'
import { classifyPermit, ClassifiedPermit } from './permit-classifier'
import type { NormalizedRawPermit } from './socrata'

export type { ClassifiedPermit }

/**
 * Transform a raw permit into a classified permit with enrichment.
 *
 * Applies classification (severity, community note, label),
 * Cook County GIS enrichment for red-severity permits,
 * and address normalization.
 */
export async function transformPermit(
    p: NormalizedRawPermit,
    domain: string
): Promise<ClassifiedPermit> {
    const lat = parseFloat(p.latitude ?? '0')
    const lon = parseFloat(p.longitude ?? '0')
    const { severity, reason, communityNote, permitLabel } = classifyPermit({
        permit_type: p.permit_type,
        work_description: p.work_description,
        reported_cost: p.reported_cost,
    })

    // NOTE(Agent): Cook County enrichment works for any Cook County domain,
    // including Chicago's Socrata portal and the Assessor's suburban dataset.
    const isCookCounty = domain === 'data.cityofchicago.org' || domain === 'datacatalog.cookcountyil.gov'
    let zoningClassification: string | null = null
    if (severity === 'red' && lat && lon && isCookCounty) {
        const enriched = await enrichWithCookCounty(lat, lon)
        zoningClassification = enriched?.zoning_classification ?? null
    }

    // NOTE(Agent): Build display address from components first, then fall back to
    // full_address (Cook County suburbs), then coordinates as last resort.
    const parts = [p.street_number, p.street_direction, p.street_name, p.suffix].filter(Boolean)
    const componentAddress = parts.join(' ').trim()
    const displayAddress = componentAddress
        || (p.full_address ? cleanDisplayAddress(p.full_address) : '')
        || `${lat},${lon}`

    return {
        id: p.permit_id,
        address: displayAddress,
        lat,
        lon,
        permit_type: p.permit_type ?? '',
        permit_label: permitLabel,
        work_description: p.work_description ?? '',
        reported_cost: Number(p.reported_cost) || 0,
        issue_date: p.issue_date ?? '',
        severity,
        severity_reason: reason,
        community_note: communityNote,
        zoning_classification: zoningClassification,
    }
}

/**
 * Clean up a Cook County Assessor mailing address for UI display.
 * Strips truncated municipality prefixes like "VILLAGE OF RIVER F"
 * and the trailing state/zip, keeping just the street portion.
 */
function cleanDisplayAddress(address: string): string {
    // Extract just "539 WILLIAM ST" from "539 WILLIAM ST, VILLAGE OF RIVER F, IL 60305"
    const firstComma = address.indexOf(',')
    if (firstComma > 0) {
        return address.slice(0, firstComma).trim()
    }
    return address.trim()
}
