import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useInactivityAlerts } from '@/hooks/useInactivityAlerts';
import type { GPSLocation, WorkerAssignment } from '@/types/gps';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));

const ASSIGNMENT: WorkerAssignment = { workerId: 'DEVICE_01', fenceId: 'fence-1' };

const DEFAULT_OPTS = {
  inactivityThresholdMinutes:    0,
  inactivityBreakExtendMinutes: 15,
  breakStartTime:             '13:00',
  breakDurationValue:             1,
  breakDurationUnit:         'hours' as const,
};

const makeLocation = (ax: number, ay: number, az: number, minsAgo = 0): GPSLocation => ({
  id:         '1',
  device_id:  'DEVICE_01',
  latitude:    28.5450,
  longitude:   77.1925,
  ax, ay, az,
  src:        'GPS',
  battery:     80,
  impact:     false,
  timestamp:  new Date(Date.now() - minsAgo * 60000).toISOString(),
  created_at: new Date().toISOString(),
});

describe('useInactivityAlerts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fires inactivity alert when accelerometer values do not change', async () => {
    // All 4 readings have identical ax/ay/az → delta = 0 → inactivity
    const staticReadings = [
      makeLocation(100, 50, 200, 15),
      makeLocation(100, 50, 200, 10),
      makeLocation(100, 50, 200,  5),
      makeLocation(100, 50, 200,  0),
    ];
    const { result, rerender } = renderHook(
      (props: { locs: GPSLocation[] }) =>
        useInactivityAlerts(props.locs, [ASSIGNMENT], DEFAULT_OPTS),
      { initialProps: { locs: staticReadings } }
    );
    // Run 1: hook processes locations, initialises motion tracker with lastMovementTime = past
    // Run 2: hook checks timer, fires alert since threshold = 0
    rerender({ locs: staticReadings.map(l => ({ ...l })) });
    await waitFor(() => expect(result.current.alerts.length).toBeGreaterThan(0));
    expect(result.current.alerts[0].type).toBe('inactivity');
  });

  it('does NOT fire when accelerometer shows significant movement', async () => {
    const locations = [
      makeLocation(100,  50, 200, 5),
      makeLocation(800, 700, 900, 0), // large delta
    ];
    const { result } = renderHook(() =>
      useInactivityAlerts(locations, [ASSIGNMENT], DEFAULT_OPTS)
    );
    await waitFor(() => expect(result.current.alerts).toHaveLength(0));
  });

  it('does NOT fire for unassigned devices', async () => {
    const { result } = renderHook(() =>
      useInactivityAlerts([makeLocation(100, 50, 200, 0)], [], DEFAULT_OPTS)
    );
    await waitFor(() => expect(result.current.alerts).toHaveLength(0));
  });
});
