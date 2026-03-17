// ── Marker Clustering ────────────────────────────────────────────────────────
// NOTE(Agent): Groups co-located map markers (permits + data layer items) into
// clusters based on grid-quantized lat/lon. Markers within ~22m of each other
// are grouped so overlapping markers become a single marker with a count badge
// and paginated popup. Pure function, O(n), no side effects.

import type { ClassifiedPermit } from './permit-classifier'
import type { DataLayerItem } from './data-layers'

// ── Types ───────────────────────────────────────────────────────────────────

export interface MarkerGroupItem {
  type: 'permit' | 'dataLayer'
  permit?: ClassifiedPermit
  dataLayerItem?: DataLayerItem
}

export interface MarkerGroup {
  /** Grid cell key — stable identifier for the group */
  key: string
  /** Centroid latitude (average of all items in the group) */
  lat: number
  /** Centroid longitude (average of all items in the group) */
  lon: number
  /** Items in this group, ordered: permits first, then data layers */
  items: MarkerGroupItem[]
}

// ── Constants ───────────────────────────────────────────────────────────────

// NOTE(Agent): 0.0002° ≈ 22m at the equator. This catches markers at the same
// intersection or building without being too aggressive. At Chicago's latitude
// (~42°N), this is ~22m lat and ~16m lon — close enough for same-spot grouping.
const DEFAULT_GRID_SIZE = 0.0002

// ── Severity ordering used to determine cluster marker color ────────────────

const SEVERITY_ORDER: Record<string, number> = {
  red: 2,
  yellow: 1,
  green: 0,
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Groups permits and data layer items by geographic proximity using grid
 * quantization. Returns MarkerGroup[] where groups of size 1 are "solo"
 * markers (render as usual) and groups of size 2+ are "clusters" (render
 * with a badge and paginated popup).
 *
 * Items are ordered within each group: permits first (sorted by severity
 * desc), then data layer items (sorted by severity desc). This ensures
 * permits — the primary data — appear first in paginated popups.
 */
export function groupByLocation(
  permits: ClassifiedPermit[],
  dataLayerItems: DataLayerItem[],
  gridSize: number = DEFAULT_GRID_SIZE,
): MarkerGroup[] {
  const buckets = new Map<string, MarkerGroupItem[]>()

  // Bucket permits
  for (const permit of permits) {
    const key = gridKey(permit.lat, permit.lon, gridSize)
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = []
      buckets.set(key, bucket)
    }
    bucket.push({ type: 'permit', permit })
  }

  // Bucket data layer items
  for (const item of dataLayerItems) {
    const key = gridKey(item.lat, item.lon, gridSize)
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = []
      buckets.set(key, bucket)
    }
    bucket.push({ type: 'dataLayer', dataLayerItem: item })
  }

  // Convert buckets to MarkerGroup[], computing centroids and sorting items
  const groups: MarkerGroup[] = []
  for (const [key, items] of buckets) {
    // Sort: permits first (severity desc), then data layers (severity desc)
    items.sort((a, b) => {
      // Permits before data layers
      if (a.type !== b.type) return a.type === 'permit' ? -1 : 1
      // Within same type, higher severity first
      const sevA = getSeverity(a)
      const sevB = getSeverity(b)
      return (SEVERITY_ORDER[sevB] ?? 0) - (SEVERITY_ORDER[sevA] ?? 0)
    })

    // Compute centroid
    let sumLat = 0
    let sumLon = 0
    for (const item of items) {
      const [lat, lon] = getLatLon(item)
      sumLat += lat
      sumLon += lon
    }

    groups.push({
      key,
      lat: sumLat / items.length,
      lon: sumLon / items.length,
      items,
    })
  }

  return groups
}

/**
 * Builds a lookup map from item ID → cluster group key.
 * Used by the flyTo/selection effect to find which cluster contains a selected item.
 * Permits use their `id` as key. Data layer items use `layerType:id` as key
 * (matching the composite key pattern in Map.tsx).
 */
export function buildItemToGroupLookup(groups: MarkerGroup[]): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const group of groups) {
    for (const item of group.items) {
      if (item.type === 'permit' && item.permit) {
        lookup.set(item.permit.id, group.key)
      } else if (item.type === 'dataLayer' && item.dataLayerItem) {
        const compositeKey = `${item.dataLayerItem.layerType}:${item.dataLayerItem.id}`
        lookup.set(compositeKey, group.key)
        // Also store by plain ID for sidebar selection lookup
        lookup.set(item.dataLayerItem.id, group.key)
      }
    }
  }
  return lookup
}

/**
 * Returns the page index (0-based) of a specific item within a group.
 * Used to open the paginated popup at the correct page when selecting from sidebar.
 */
export function findPageIndex(group: MarkerGroup, itemId: string): number {
  for (let i = 0; i < group.items.length; i++) {
    const item = group.items[i]
    if (item.type === 'permit' && item.permit?.id === itemId) return i
    if (item.type === 'dataLayer' && item.dataLayerItem?.id === itemId) return i
  }
  return 0
}

/**
 * Returns the highest severity in a group. Used to color cluster markers.
 */
export function getGroupSeverity(group: MarkerGroup): string {
  let maxSev = 0
  for (const item of group.items) {
    const sev = SEVERITY_ORDER[getSeverity(item)] ?? 0
    if (sev > maxSev) maxSev = sev
  }
  return maxSev >= 2 ? 'red' : maxSev >= 1 ? 'yellow' : 'green'
}

// ── Internal Helpers ────────────────────────────────────────────────────────

function gridKey(lat: number, lon: number, gridSize: number): string {
  return `${Math.round(lat / gridSize)}_${Math.round(lon / gridSize)}`
}

function getSeverity(item: MarkerGroupItem): string {
  if (item.type === 'permit') return item.permit?.severity ?? 'green'
  return item.dataLayerItem?.severity ?? 'green'
}

function getLatLon(item: MarkerGroupItem): [number, number] {
  if (item.type === 'permit' && item.permit) return [item.permit.lat, item.permit.lon]
  if (item.type === 'dataLayer' && item.dataLayerItem) return [item.dataLayerItem.lat, item.dataLayerItem.lon]
  return [0, 0]
}
