import type { GPSLocation, PolygonFence } from "@/types/gps";
import { getPolygonCenter } from "@/lib/geoUtils";

// ─── Coordinate Conversion ────────────────────────────────────────────────────
// Google Maps uses { lat, lng }. Mapbox/GeoJSON uses [longitude, latitude].
// ALL conversions must go through these helpers — never scatter them inline.

export function toMapboxCoord(p: { lat: number; lng: number }): [number, number] {
  return [p.lng, p.lat];
}

export function fromMapboxCoord(c: [number, number]): { lat: number; lng: number } {
  return { lat: c[1], lng: c[0] };
}

// ─── GeoJSON Builders ─────────────────────────────────────────────────────────

export function fenceToGeoJSON(fence: PolygonFence): GeoJSON.Feature<GeoJSON.Polygon> {
  // GeoJSON polygon rings must be closed (first === last point)
  const ring = fence.coordinates.map(toMapboxCoord);
  const closed: [number, number][] =
    ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
      ? [...ring, ring[0]]
      : ring;

  return {
    type: "Feature",
    id: fence.id,
    properties: {
      id: fence.id,
      name: fence.name,
      color: fence.color || "#22c55e",
      isGreenCorridor: fence.isGreenCorridor ?? false,
      shiftStart: fence.shiftStart,
      shiftEnd: fence.shiftEnd,
    },
    geometry: {
      type: "Polygon",
      coordinates: [closed],
    },
  };
}

export function fencesToGeoJSON(fences: PolygonFence[]): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: fences.map(fenceToGeoJSON),
  };
}

export function fenceLabelPointsGeoJSON(fences: PolygonFence[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: fences.map((fence) => {
      const center = getPolygonCenter(fence.coordinates);
      return {
        type: "Feature",
        id: `label-${fence.id}`,
        properties: { name: fence.name, color: fence.color || "#22c55e" },
        geometry: { type: "Point", coordinates: toMapboxCoord(center) },
      };
    }),
  };
}

export function locationToGeoJSON(loc: GPSLocation): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: "Feature",
    id: loc.device_id,
    properties: { device_id: loc.device_id, altitude: loc.altitude ?? null },
    geometry: {
      type: "Point",
      coordinates: [loc.longitude, loc.latitude],
    },
  };
}

/** Extracts fence coords from a GeoJSON Polygon draw result (Mapbox Draw output). */
export function geoJSONRingToFenceCoords(
  ring: [number, number][]
): { lat: number; lng: number }[] {
  // Mapbox Draw closes the ring (first === last); drop the duplicate.
  const points = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring;
  return points.map(fromMapboxCoord);
}

// ─── Altitude System ──────────────────────────────────────────────────────────
//
// TWO separate altitude values are maintained:
//
//   Real altitude   – the raw GPS value (stored in DB, used in alerts/analytics)
//   Visual altitude – scaled, relative height for map rendering readability
//
// Formula: visualHeight = (rawAlt - groundReference) * visualScale
//
// Example with default scale=5:
//   Ground (0 m)  → visual z  0
//   Level 1 (4 m) → visual z 20
//   Level 2 (8 m) → visual z 40
//   Level 3 (12m) → visual z 60

export const VISUAL_ALTITUDE_SCALE = 5;

/**
 * Normalise raw GPS altitude against a ground reference.
 * Returns metres above local ground level (clamped to 0).
 */
export function normalizeAltitude(
  rawAlt: number | undefined,
  groundRef = 0
): number {
  if (rawAlt === undefined || rawAlt === null) return 0;
  return Math.max(0, rawAlt - groundRef);
}

/** Same as normalizeAltitude — explicit alias used in altitude-aware logic. */
export function getRelativeAltitude(
  rawAlt: number | undefined,
  groundRef = 0
): number {
  return normalizeAltitude(rawAlt, groundRef);
}

/**
 * Returns the visual altitude (metres) to use for rendering.
 * Kept separate from real altitude so rendering can be exaggerated without
 * affecting analytics.
 */
export function getVisualAltitude(
  rawAlt: number | undefined,
  groundRef = 0,
  scale = VISUAL_ALTITUDE_SCALE
): number {
  return normalizeAltitude(rawAlt, groundRef) * scale;
}

/**
 * Estimates the floor number (0-indexed) from raw altitude.
 * Matches the existing 4 m/floor convention.
 */
export function estimateFloorLevel(rawAlt: number | undefined, groundRef = 0): number {
  if (rawAlt === undefined || rawAlt === null) return 0;
  const relative = Math.max(0, rawAlt - groundRef);
  return Math.floor(relative / 4);
}
