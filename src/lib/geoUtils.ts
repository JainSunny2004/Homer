// ─── Ray Casting: Point in Polygon ────────────────────────────────────────────
export function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: { lat: number; lng: number }[]
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  const x = point.lng;
  const y = point.lat;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ─── Shift Time Check ─────────────────────────────────────────────────────────
export function isWithinShift(now: Date, shiftStart: string, shiftEnd: string): boolean {
  const [startHour, startMin] = shiftStart.split(':').map(Number);
  const [endHour,   endMin  ] = shiftEnd.split(':').map(Number);
  const current = now.getHours() * 60 + now.getMinutes();
  const start   = startHour * 60 + startMin;
  const end     = endHour   * 60 + endMin;
  if (end < start) return current >= start || current <= end; // overnight
  return current >= start && current <= end;
}

// ─── Polygon Center ────────────────────────────────────────────────────────────
export function getPolygonCenter(
  coords: { lat: number; lng: number }[]
): { lat: number; lng: number } {
  if (coords.length === 0) return { lat: 0, lng: 0 };
  const sum = coords.reduce(
    (acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / coords.length, lng: sum.lng / coords.length };
}

// ─── Altitude Band ────────────────────────────────────────────────────────────
export type AltitudeBand = "ground" | "level1" | "level2" | "level3plus" | "unknown";

export function getAltitudeBand(altitudeMeters: number | undefined): AltitudeBand {
  if (altitudeMeters === undefined || altitudeMeters === null) return "unknown";
  if (altitudeMeters < 4)   return "ground";
  if (altitudeMeters < 8)   return "level1";
  if (altitudeMeters < 12)  return "level2";
  return "level3plus";
}

export const ALTITUDE_BAND_COLOR: Record<AltitudeBand, string> = {
  ground:     "#22c55e",  // green
  level1:     "#eab308",  // yellow
  level2:     "#f97316",  // orange
  level3plus: "#ef4444",  // red
  unknown:    "#94a3b8",  // gray
};

export const ALTITUDE_BAND_LABEL: Record<AltitudeBand, string> = {
  ground:     "Ground (< 4 m)",
  level1:     "Level 1 (4–8 m)",
  level2:     "Level 2 (8–12 m)",
  level3plus: "Level 3+ (≥ 12 m)",
  unknown:    "Altitude Unknown",
};

// ─── 3-D Distance (metres) ────────────────────────────────────────────────────
export function distance3D(
  p1: { lat: number; lng: number; altitude?: number },
  p2: { lat: number; lng: number; altitude?: number }
): number {
  const horizontal = haversineDistance(p1, p2);
  const dAlt = (p2.altitude ?? 0) - (p1.altitude ?? 0);
  return Math.sqrt(horizontal ** 2 + dAlt ** 2);
}

// ─── Haversine Distance (metres) ──────────────────────────────────────────────
export function haversineDistance(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number {
  const R    = 6371000;
  const toR  = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(p2.lat - p1.lat);
  const dLng = toR(p2.lng - p1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(p1.lat)) * Math.cos(toR(p2.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ─── Distance from Point to Line Segment (metres) ─────────────────────────────
function distanceToSegment(
  p: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dx    = b.lat - a.lat;
  const dy    = b.lng - a.lng;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return haversineDistance(p, a);
  const t = Math.max(0, Math.min(1,
    ((p.lat - a.lat) * dx + (p.lng - a.lng) * dy) / lenSq
  ));
  return haversineDistance(p, { lat: a.lat + t * dx, lng: a.lng + t * dy });
}

// ─── Min Distance from Point to Polygon Boundary (metres) ─────────────────────
export function distanceToPolygonBoundary(
  point: { lat: number; lng: number },
  polygon: { lat: number; lng: number }[]
): number {
  let min = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const d = distanceToSegment(point, polygon[j], polygon[i]);
    if (d < min) min = d;
  }
  return min;
}

// ─── Point Inside Polygon OR Within Tolerance of Its Boundary ─────────────────
// Implements the ±20m GPS tolerance from the spec
export function isPointNearOrInPolygon(
  point: { lat: number; lng: number },
  polygon: { lat: number; lng: number }[],
  toleranceMeters: number = 20
): boolean {
  if (isPointInPolygon(point, polygon)) return true;
  return distanceToPolygonBoundary(point, polygon) <= toleranceMeters;
}

// ─── Green Corridor Check ──────────────────────────────────────────────────────
// Worker inside ANY green corridor → suppress out-of-zone alert
export function isPointInAnyGreenCorridor(
  point: { lat: number; lng: number },
  fences: { coordinates: { lat: number; lng: number }[]; isGreenCorridor?: boolean }[]
): boolean {
  return fences
    .filter(f => f.isGreenCorridor === true)
    .some(f => isPointInPolygon(point, f.coordinates));
}
