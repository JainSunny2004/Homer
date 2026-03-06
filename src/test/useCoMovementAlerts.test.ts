import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCoMovementAlerts } from '@/hooks/useCoMovementAlerts';
import type { GPSLocation } from '@/types/gps';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));

const DEFAULT_OPTS = {
  coMovementThresholdMeters:   10,
  coMovementDurationSeconds:    0,
  shiftChangeTime:          '02:00',
  shiftChangeWindowMinutes:     5,
};

const makeLocation = (deviceId: string, lat: number, lng: number): GPSLocation => ({
  id:         deviceId,
  device_id:  deviceId,
  latitude:    lat,
  longitude:   lng,
  ax: 100, ay: 50, az: 200,
  src:        'GPS',
  battery:     80,
  impact:     false,
  timestamp:  new Date().toISOString(),
  created_at: new Date().toISOString(),
});

describe('useCoMovementAlerts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fires co-movement alert when two devices are within threshold', async () => {
    const locs = [
      makeLocation('DEVICE_01', 28.5450, 77.1925),
      makeLocation('DEVICE_02', 28.5450, 77.1925), // same point → 0m apart
    ];
    const { result, rerender } = renderHook(
      (props: { locs: GPSLocation[] }) =>
        useCoMovementAlerts(props.locs, DEFAULT_OPTS),
      { initialProps: { locs } }
    );
    // Run 1: tracker entry created for pair DEVICE_01|DEVICE_02
    // Run 2: entry exists + durationSeconds=0 → alert fires
    rerender({ locs: locs.map(l => ({ ...l })) });
    await waitFor(() => expect(result.current.alerts.length).toBeGreaterThan(0));
    expect(result.current.alerts[0].type).toBe('co-movement');
  });

  it('does NOT fire when devices are far apart', async () => {
    const { result } = renderHook(() =>
      useCoMovementAlerts([
        makeLocation('DEVICE_01', 28.5450, 77.1925),
        makeLocation('DEVICE_02', 28.5600, 77.2100),
      ], DEFAULT_OPTS)
    );
    await waitFor(() => expect(result.current.alerts).toHaveLength(0));
  });

  it('does NOT fire during shift-change window', async () => {
    const now = new Date();
    const shiftNow = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const locs = [
      makeLocation('DEVICE_01', 28.5450, 77.1925),
      makeLocation('DEVICE_02', 28.5450, 77.1925),
    ];
    const { result, rerender } = renderHook(
      (props: { locs: GPSLocation[] }) =>
        useCoMovementAlerts(props.locs, { ...DEFAULT_OPTS, shiftChangeTime: shiftNow, shiftChangeWindowMinutes: 10 }),
      { initialProps: { locs } }
    );
    rerender({ locs: locs.map(l => ({ ...l })) });
    await waitFor(() => expect(result.current.alerts).toHaveLength(0));
  });

  it('does NOT fire with only one device', async () => {
    const { result } = renderHook(() =>
      useCoMovementAlerts([makeLocation('DEVICE_01', 28.5450, 77.1925)], DEFAULT_OPTS)
    );
    await waitFor(() => expect(result.current.alerts).toHaveLength(0));
  });
});
