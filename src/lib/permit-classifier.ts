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
  community_note: string
  // Optional Cook County enrichment
  zoning_classification?: string | null
}

// ── Impact category keyword maps ────────────────────────────────────────────

interface ImpactCategory {
  keywords: readonly string[]
  fragment: string
}

const IMPACT_CATEGORIES: Record<string, ImpactCategory> = {
  airQuality: {
    keywords: [
      'refinery', 'chemical', 'petroleum', 'asphalt', 'incinerator',
      'smokestack', 'combustion', 'crematorium', 'paint shop', 'coating',
      'solvent', 'bitumen',
    ],
    fragment: 'could affect local air quality and emissions levels',
  },
  trafficLogistics: {
    keywords: [
      'warehouse', 'distribution', 'logistics', 'fulfillment', 'freight',
      'trucking', 'truck terminal', 'intermodal',
    ],
    fragment: 'may bring increased truck traffic and road congestion',
  },
  industrialNoise: {
    keywords: [
      'factory', 'manufacturing', 'data center', 'substation',
      'quarry', 'mining', 'crushing', 'aggregate', 'batch plant',
      'concrete plant', 'assembly', 'production facility',
    ],
    fragment: 'may generate ongoing noise from machinery or industrial equipment',
  },
  demolition: {
    keywords: ['demolition', 'wrecking', 'tear down', 'raze'],
    fragment: 'involves demolition — expect significant dust, debris, noise, and possible vibration to nearby structures',
  },
  excavation: {
    keywords: ['excavation', 'pile driving', 'caisson', 'shoring', 'underpinning'],
    fragment: 'involves heavy excavation or foundation work that may cause ground vibration and noise',
  },
  densityChange: {
    keywords: ['high-rise', 'tower', 'mixed-use', 'dwelling unit', 'apartment'],
    fragment: 'may increase neighborhood density, traffic, and demand for local services',
  },
  communityChange: {
    keywords: ['planned development', 'rezoning', 'special use', 'zoning change', 'variance'],
    fragment: 'may signal broader changes to land use and neighborhood character',
  },
  nightlife: {
    keywords: ['bar', 'nightclub', 'concert', 'event space', 'music venue', 'tavern', 'lounge'],
    fragment: 'could bring late-night noise, crowds, and increased parking pressure',
  },
  wasteOdor: {
    keywords: ['waste transfer', 'recycling center', 'composting', 'landfill', 'scrap'],
    fragment: 'may produce odors and attract increased truck traffic',
  },
  gasStation: {
    keywords: ['gas station', 'fuel storage', 'fueling', 'tank farm'],
    fragment: 'may produce fumes and constant vehicle activity',
  },
} as const

// ── Severity classification (unchanged logic) ───────────────────────────────

const HIGH_IMPACT_KEYWORDS = [
  'data center', 'factory', 'industrial', 'manufacturing', 'warehouse',
  'logistics', 'distribution', 'power plant', 'substation', 'refinery',
  'planned development',
]

const HIGH_COST_THRESHOLD = 5_000_000
const MEDIUM_COST_THRESHOLD = 1_000_000

// ── Cost formatting helper ──────────────────────────────────────────────────

function formatCost(cost: number): string | null {
  // NOTE(Agent): We check rounding boundaries carefully to avoid displaying
  // "$1000K" when the cost is just under $1M. Values that round to >=1000K
  // are promoted to the $XM format.
  if (cost >= 1_000_000) {
    const millions = cost / 1_000_000
    return `$${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`
  }
  if (cost >= 100_000) {
    const rounded = Math.round(cost / 1_000)
    if (rounded >= 1000) return '$1M' // boundary: e.g. $999,500 → $1M not $1000K
    return `$${rounded}K`
  }
  if (cost >= 1_000) {
    return `$${(cost / 1_000).toFixed(0)}K`
  }
  return null // too small to be meaningful
}

// ── Project descriptor extraction ───────────────────────────────────────────

// NOTE(Agent): These patterns extract a human-readable project type from the
// work_description. We check them in order and return the first match. This
// provides much richer community notes than a static "building project" label.
// ⚠️  ORDER MATTERS — more specific patterns (e.g. "parking garage") must
// appear BEFORE generic ones (e.g. "garage") to prevent incorrect matches.
const PROJECT_DESCRIPTORS: { pattern: RegExp; label: string }[] = [
  { pattern: /residential\s+tower/i, label: 'residential tower' },
  { pattern: /(?:apartment|condo(?:minium)?|dwelling\s+unit)/i, label: 'residential building' },
  { pattern: /(?:mixed[- ]use)/i, label: 'mixed-use development' },
  { pattern: /(?:retail|shopping|storefront)/i, label: 'retail space' },
  { pattern: /(?:office|commercial\s+building)/i, label: 'office building' },
  { pattern: /(?:hotel|hospitality)/i, label: 'hotel' },
  { pattern: /(?:school|educational)/i, label: 'educational facility' },
  { pattern: /(?:medical|hospital|clinic|healthcare)/i, label: 'medical facility' },
  { pattern: /(?:church|mosque|temple|religious)/i, label: 'religious facility' },
  { pattern: /(?:restaurant|food\s+service|dining)/i, label: 'restaurant' },
  { pattern: /(?:parking\s+(?:garage|structure|deck))/i, label: 'parking structure' },
  { pattern: /(?:warehouse|distribution|fulfillment)/i, label: 'warehouse' },
  { pattern: /(?:data\s+center)/i, label: 'data center' },
  { pattern: /(?:factory|manufacturing|production)/i, label: 'manufacturing facility' },
  { pattern: /(?:garage|shed|carport)/i, label: 'garage or outbuilding' },
  { pattern: /(?:porch|deck|fence|driveway)/i, label: 'home improvement' },
]

function extractProjectDescriptor(desc: string, type: string): string | null {
  const combined = `${type} ${desc}`
  for (const { pattern, label } of PROJECT_DESCRIPTORS) {
    if (pattern.test(combined)) return label
  }
  return null
}

// ── Dynamic lead sentence builder ───────────────────────────────────────────

function buildLeadSentence(
  severity: PermitSeverity,
  type: string,
  desc: string,
  cost: number,
): string {
  const costStr = formatCost(cost)
  const descriptor = extractProjectDescriptor(desc, type)
  const isNewConstruction = type.includes('new construction') || type.includes('new building')

  // Compose a rich lead combining cost + descriptor when available
  if (severity === 'red') {
    const what = descriptor || 'development'
    if (costStr) {
      return `A ${costStr} ${what} project is planned for this area.`
    }
    return `A large-scale ${what} project is planned for this area.`
  }

  if (severity === 'yellow') {
    const what = descriptor || (isNewConstruction ? 'construction' : 'building')
    if (costStr) {
      return `A ${costStr} ${what} project is planned for this area.`
    }
    return `A notable ${what} project is planned for this area.`
  }

  // Green
  if (descriptor) {
    return `A permit for ${descriptor} work has been issued for this location.`
  }
  return 'A routine building permit has been issued for this location.'
}

// NOTE(Agent): We use a separate lead sentence for demolition/wrecking permits
// since they are fundamentally different from construction projects, even at the
// same severity level.
const DEMOLITION_LEAD = 'An existing structure at this location is scheduled for demolition.'
const RENOVATION_LEAD = 'Renovation or alteration work is planned for this location.'

// ── Public API ──────────────────────────────────────────────────────────────

export function classifyPermit(permit: {
  permit_type?: string
  work_description?: string
  reported_cost?: number | string
}): { severity: PermitSeverity; reason: string; communityNote: string } {
  const cost = Number(permit.reported_cost) || 0
  const desc = (permit.work_description ?? '').toLowerCase()
  const type = (permit.permit_type ?? '').toLowerCase()
  const isNewConstruction = type.includes('new construction') || type.includes('new building')
  const hasHighImpactKeyword = HIGH_IMPACT_KEYWORDS.some((kw) => desc.includes(kw))

  let severity: PermitSeverity
  let reason: string

  if (isNewConstruction && (cost >= HIGH_COST_THRESHOLD || hasHighImpactKeyword)) {
    severity = 'red'
    reason = hasHighImpactKeyword
      ? 'New construction with industrial/high-impact use'
      : `New construction ≥$${(HIGH_COST_THRESHOLD / 1e6).toFixed(0)}M`
  } else if (isNewConstruction && cost >= MEDIUM_COST_THRESHOLD) {
    severity = 'yellow'
    reason = `New construction $${(MEDIUM_COST_THRESHOLD / 1e6).toFixed(0)}M–$${(HIGH_COST_THRESHOLD / 1e6).toFixed(0)}M`
  } else if (!isNewConstruction && hasHighImpactKeyword) {
    // NOTE(Agent): Cost-only fallback for non-Chicago cities whose permit_type
    // strings don't match known patterns. When high-impact keywords are present
    // in the description, classify as red regardless of permit_type.
    severity = 'red'
    reason = 'High-impact use detected in description'
  } else if (!isNewConstruction && cost >= HIGH_COST_THRESHOLD) {
    // NOTE(Agent): Cost-only fallback — large project without recognized permit type
    severity = 'red'
    reason = `High-cost project ≥$${(HIGH_COST_THRESHOLD / 1e6).toFixed(0)}M`
  } else if (!isNewConstruction && cost >= MEDIUM_COST_THRESHOLD) {
    severity = 'yellow'
    reason = `Mid-cost project $${(MEDIUM_COST_THRESHOLD / 1e6).toFixed(0)}M–$${(HIGH_COST_THRESHOLD / 1e6).toFixed(0)}M`
  } else {
    severity = 'green'
    reason = 'Standard permit'
  }

  const communityNote = buildCommunityNote(severity, type, desc, cost)

  return { severity, reason, communityNote }
}

// ── Internal helpers ────────────────────────────────────────────────────────

function detectImpactCategories(type: string, desc: string): string[] {
  const combined = `${type} ${desc}`
  const matched: string[] = []

  for (const [key, category] of Object.entries(IMPACT_CATEGORIES)) {
    if (category.keywords.some((kw) => combined.includes(kw))) {
      matched.push(key)
    }
  }

  return matched
}

function buildCommunityNote(
  severity: PermitSeverity,
  type: string,
  desc: string,
  cost: number,
): string {
  const matchedKeys = detectImpactCategories(type, desc)

  // Pick the lead sentence based on permit context
  let lead: string
  const isDemolition = type.includes('wrecking') || matchedKeys.includes('demolition')
  const isRenovation = type.includes('renovation') || type.includes('alteration')

  if (isDemolition) {
    lead = DEMOLITION_LEAD
  } else if (isRenovation && severity === 'green') {
    lead = RENOVATION_LEAD
  } else {
    lead = buildLeadSentence(severity, type, desc, cost)
  }

  // Build impact fragments
  const fragments = matchedKeys
    .map((key) => IMPACT_CATEGORIES[key]?.fragment)
    .filter(Boolean)

  if (fragments.length === 0) {
    // No specific impacts detected — use severity-based generic note
    const genericTails: Record<PermitSeverity, string> = {
      red: 'Expect significant construction activity and potential impacts to traffic and nearby properties.',
      yellow: 'You may notice construction activity in the area for several months.',
      green: 'This is typical neighborhood activity with minimal expected disruption.',
    }
    return `${lead} ${genericTails[severity]}`
  }

  // Compose: lead + "This type of project" + joined fragments
  const joinedFragments =
    fragments.length === 1
      ? fragments[0]
      : `${fragments.slice(0, -1).join(', ')}, and ${fragments[fragments.length - 1]}`

  return `${lead} This type of project ${joinedFragments}.`
}
