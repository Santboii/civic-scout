// ── Zoning Clipping (Client-Side) ───────────────────────────────────────────
// NOTE(Agent): This module is separated from zoning.ts because the main
// zoning module imports Redis (server-only). This module uses ESM imports
// for Turf.js which work correctly in the Next.js client bundle.

import circle from '@turf/circle'
import intersect from '@turf/intersect'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import type { ZoningFeatureCollection, ZoningGeoJSONFeature } from './zoning'

const RADIUS_KM = 0.805 // 0.5 miles in km — matches RADIUS_METERS (805m) in zoning.ts and Map.tsx circle

/**
 * Clip zoning polygons to a circle around the search center.
 * Socrata's `intersects()` returns the FULL polygon if any part overlaps
 * the bounding box. Large Planned Development districts can extend miles
 * beyond the search area. This function clips each polygon to a circle
 * matching the search radius so the overlay stays visually consistent.
 */
export function clipZoningToRadius(
    fc: ZoningFeatureCollection,
    centerLat: number,
    centerLon: number,
    radiusKm: number = RADIUS_KM,
): ZoningFeatureCollection {
    // Create a 64-segment circle polygon as the clipping mask
    const clipMask = circle([centerLon, centerLat], radiusKm, {
        steps: 64,
        units: 'kilometers',
    })

    const clippedFeatures: ZoningGeoJSONFeature[] = []

    for (const feature of fc.features) {
        try {
            // NOTE(Agent): Zoning features are always Polygon/MultiPolygon from
            // Socrata. Cast to satisfy Turf.js type constraints.
            const polyFeature = feature as unknown as Feature<Polygon | MultiPolygon>
            const clipped = intersect({
                type: 'FeatureCollection',
                features: [polyFeature, clipMask],
            })
            if (clipped) {
                clippedFeatures.push({
                    type: 'Feature',
                    geometry: clipped.geometry,
                    properties: feature.properties,
                })
            }
        } catch {
            // NOTE(Agent): Some geometries (e.g. very thin slivers) can cause
            // topology errors in intersection. Skip them silently — losing one
            // small polygon at the edge is acceptable.
        }
    }

    return { type: 'FeatureCollection', features: clippedFeatures }
}
