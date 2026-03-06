import { describe, it, expect } from 'vitest';
import {
  isPointInPolygon,
  isPointNearOrInPolygon,
  isWithinShift,
  haversineDistance,
  distanceToPolygonBoundary,
  isPointInAnyGreenCorridor,
  getPolygonCenter,
} from '@/lib/geoUtils';

// ── Test polygon: 100m × 100m square centred on Delhi ──────────────────────
const SQUARE = [
  { lat: 28.5440, lng: 77.1910 },
  { lat: 28.5460, lng: 77.1910 },
  { lat: 28.5460, lng: 77.1940 },
  { lat: 28.5440, lng: 77.1940 },
];

const INSIDE  = { lat: 28.5450, lng: 77.1925 }; // centre
const OUTSIDE = { lat: 28.5500, lng: 77.2000 }; // far away
const NEAR_EDGE = { lat: 28.5440, lng: 77.1925 }; // exactly on boundary

describe('isPointInPolygon', () => {
  it('returns true for point clearly inside polygon', () => {
    expect(isPointInPolygon(INSIDE, SQUARE)).toBe(true);
  });

  it('returns false for point clearly outside polygon', () => {
    expect(isPointInPolygon(OUTSIDE, SQUARE)).toBe(false);
  });

  it('returns false for polygon with fewer than 3 points', () => {
    expect(isPointInPolygon(INSIDE, [SQUARE[0], SQUARE[1]])).toBe(false);
  });
});

describe('haversineDistance', () => {
  it('returns ~0 for same point', () => {
    expect(haversineDistance(INSIDE, INSIDE)).toBeCloseTo(0, 1);
  });

  it('returns positive distance between two different points', () => {
    const dist = haversineDistance(INSIDE, OUTSIDE);
    expect(dist).toBeGreaterThan(100);
  });

  it('is symmetric', () => {
    const ab = haversineDistance(INSIDE, OUTSIDE);
    const ba = haversineDistance(OUTSIDE, INSIDE);
    expect(ab).toBeCloseTo(ba, 1);
  });
});

describe('distanceToPolygonBoundary', () => {
  it('returns small distance for point on edge', () => {
    const dist = distanceToPolygonBoundary(NEAR_EDGE, SQUARE);
    expect(dist).toBeLessThan(10);
  });

  it('returns larger distance for point deep inside', () => {
    const dist = distanceToPolygonBoundary(INSIDE, SQUARE);
    expect(dist).toBeGreaterThan(50);
  });
});

describe('isPointNearOrInPolygon', () => {
  it('returns true for point inside polygon', () => {
    expect(isPointNearOrInPolygon(INSIDE, SQUARE, 20)).toBe(true);
  });

  it('returns true for point just outside but within tolerance', () => {
    // 5m outside south edge
    const justOutside = { lat: 28.5439, lng: 77.1925 };
    expect(isPointNearOrInPolygon(justOutside, SQUARE, 20)).toBe(true);
  });

  it('returns false for point far outside and beyond tolerance', () => {
    expect(isPointNearOrInPolygon(OUTSIDE, SQUARE, 20)).toBe(false);
  });
});

describe('isWithinShift', () => {
  it('returns true when current time is mid-shift', () => {
    const midShift = new Date();
    midShift.setHours(12, 0, 0, 0);
    expect(isWithinShift(midShift, '09:00', '17:00')).toBe(true);
  });

  it('returns false before shift starts', () => {
    const early = new Date();
    early.setHours(7, 0, 0, 0);
    expect(isWithinShift(early, '09:00', '17:00')).toBe(false);
  });

  it('returns false after shift ends', () => {
    const late = new Date();
    late.setHours(20, 0, 0, 0);
    expect(isWithinShift(late, '09:00', '17:00')).toBe(false);
  });

  it('handles overnight shifts correctly', () => {
    const night = new Date();
    night.setHours(23, 0, 0, 0);
    expect(isWithinShift(night, '22:00', '06:00')).toBe(true);

    const morning = new Date();
    morning.setHours(3, 0, 0, 0);
    expect(isWithinShift(morning, '22:00', '06:00')).toBe(true);

    const midday = new Date();
    midday.setHours(14, 0, 0, 0);
    expect(isWithinShift(midday, '22:00', '06:00')).toBe(false);
  });
});

describe('getPolygonCenter', () => {
  it('returns centre of a symmetric square', () => {
    const center = getPolygonCenter(SQUARE);
    expect(center.lat).toBeCloseTo(28.5450, 3);
    expect(center.lng).toBeCloseTo(77.1925, 3);
  });

  it('returns {0,0} for empty polygon', () => {
    expect(getPolygonCenter([])).toEqual({ lat: 0, lng: 0 });
  });
});

describe('isPointInAnyGreenCorridor', () => {
  const fences = [
    { coordinates: SQUARE, isGreenCorridor: true  },
    { coordinates: SQUARE, isGreenCorridor: false },
  ];

  it('returns true when point is inside a green corridor', () => {
    expect(isPointInAnyGreenCorridor(INSIDE, fences)).toBe(true);
  });

  it('returns false when point is outside all green corridors', () => {
    expect(isPointInAnyGreenCorridor(OUTSIDE, fences)).toBe(false);
  });

  it('returns false when no fences are green corridors', () => {
    const noGreen = [{ coordinates: SQUARE, isGreenCorridor: false }];
    expect(isPointInAnyGreenCorridor(INSIDE, noGreen)).toBe(false);
  });
});
