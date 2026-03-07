const SOCRATA_BASE = 'https://data.cityofchicago.org/resource/ydr8-5enu.json'
const RADIUS_METERS = 3218 // ≈ 2 miles

export interface RawPermit {
  id?: string
  permit_: string
  permit_type?: string
  work_description?: string
  reported_cost?: string
  issue_date?: string
  street_number?: string
  street_direction?: string
  street_name?: string
  suffix?: string
  community_area?: string
  latitude?: string
  longitude?: string
  location?: { latitude: string; longitude: string }
}

export async function fetchPermitsNearby(
  lat: number,
  lon: number
): Promise<RawPermit[]> {
  const params = new URLSearchParams({
    $where: `within_circle(location, ${lat}, ${lon}, ${RADIUS_METERS}) AND permit_type IN ('PERMIT - NEW CONSTRUCTION', 'PERMIT - NEW CONSTRUCTION (COMMON AREAS)', 'PERMIT - RENOVATION/ALTERATION')`,
    $order: 'issue_date DESC',
    $limit: '200',
  })

  const url = `${SOCRATA_BASE}?${params}`
  const res = await fetch(url, {
    headers: {
      'X-App-Token': process.env.SOCRATA_APP_TOKEN ?? '',
      Accept: 'application/json',
    },
    next: { revalidate: 0 }, // always fresh from Socrata
  })

  if (!res.ok) {
    throw new Error(`Socrata API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}
