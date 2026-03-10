// ── Shared geographic utilities ─────────────────────────────────────────────
// NOTE(Agent): P2-1 from backend perf audit. Extracted from socrata.ts and
// arcgis.ts where identical copies existed. Single source of truth.

/**
 * Calculate the great-circle distance between two points using the
 * Haversine formula. Returns distance in meters.
 */
export function haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371000 // Earth's radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
