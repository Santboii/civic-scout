export type PermitSeverity = 'red' | 'yellow' | 'green'

export interface ClassifiedPermit {
  id: string
  address: string
  lat: number
  lon: number
  permit_type: string
  work_description: string
  reported_cost: number
  issue_date: string
  severity: PermitSeverity
  severity_reason: string
  // Optional Cook County enrichment
  zoning_classification?: string | null
}

const HIGH_IMPACT_KEYWORDS = [
  'data center', 'factory', 'industrial', 'manufacturing', 'warehouse',
  'logistics', 'distribution', 'power plant', 'substation', 'refinery',
  'planned development',
]

const HIGH_COST_THRESHOLD = 5_000_000
const MEDIUM_COST_THRESHOLD = 1_000_000

export function classifyPermit(permit: {
  permit_type?: string
  work_description?: string
  reported_cost?: number | string
}): { severity: PermitSeverity; reason: string } {
  const cost = Number(permit.reported_cost) || 0
  const desc = (permit.work_description ?? '').toLowerCase()
  const type = (permit.permit_type ?? '').toLowerCase()
  const isNewConstruction = type.includes('new construction') || type.includes('new building')
  const hasHighImpactKeyword = HIGH_IMPACT_KEYWORDS.some((kw) => desc.includes(kw))

  if (isNewConstruction && (cost >= HIGH_COST_THRESHOLD || hasHighImpactKeyword)) {
    return {
      severity: 'red',
      reason: hasHighImpactKeyword
        ? 'New construction with industrial/high-impact use'
        : `New construction ≥$${(HIGH_COST_THRESHOLD / 1e6).toFixed(0)}M`,
    }
  }

  if (isNewConstruction && cost >= MEDIUM_COST_THRESHOLD) {
    return {
      severity: 'yellow',
      reason: `New construction $${(MEDIUM_COST_THRESHOLD / 1e6).toFixed(0)}M–$${(HIGH_COST_THRESHOLD / 1e6).toFixed(0)}M`,
    }
  }

  return { severity: 'green', reason: 'Standard permit' }
}
