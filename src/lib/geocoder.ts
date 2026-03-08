import type { BoundingBox } from './city-registry'

/**
 * Generic bounding-box containment check.
 *
 * NOTE(Agent): This replaces the old `isWithinChicago` function.
 * Previously hardcoded to Chicago's bbox, now accepts any arbitrary
 * bounding box for multi-city support.
 */
export function isWithinBounds(
  lat: number,
  lon: number,
  bbox: BoundingBox
): boolean {
  return (
    lat >= bbox.latMin &&
    lat <= bbox.latMax &&
    lon >= bbox.lonMin &&
    lon <= bbox.lonMax
  )
}

/** Normalize an address string for cache key comparisons */
export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ')
}
