// Chicago bounding box
const CHICAGO_BOUNDS = {
  latMin: 41.644,
  latMax: 42.023,
  lonMin: -87.940,
  lonMax: -87.524,
}

export function isWithinChicago(lat: number, lon: number): boolean {
  return (
    lat >= CHICAGO_BOUNDS.latMin &&
    lat <= CHICAGO_BOUNDS.latMax &&
    lon >= CHICAGO_BOUNDS.lonMin &&
    lon <= CHICAGO_BOUNDS.lonMax
  )
}

/** Normalize an address string for cache key comparisons */
export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ')
}
