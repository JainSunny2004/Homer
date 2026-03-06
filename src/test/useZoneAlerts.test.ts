import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useZoneAlerts } from '@/hooks/useZoneAlerts';
import type { GPSLocation, PolygonFence, WorkerAssignment } from '@/types/gps';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));

const FENCE: PolygonFence = {
  id:           'fence-1',
  name:         'Test Zone',
  coordinates: [
    { lat: 28.5440, lng: 77.1910 },
    { lat: 28.5460, lng: 77.1910 },
    { lat: 28.5460, lng: 77.1940 },
    { lat: 28.5440, lng: 77.1940 },
  ],
  color:           '#22c55e',
  shiftStart:      '00:00',
  shiftEnd:        '23:59',
  toleranceMeters:  20,
  isGreenCorridor: false,
};

const ASSIGNMENT: WorkerAssignment = { workerId: 'DEVICE_01', fenceId: 'fence-1' };

const makeLocation = (lat: number, lng: number): GPSLocation => ({
  id:         '1',
  device_id:  'DEVICE_01',
  latitude:    lat,
  longitude:   lng,
  ax: 100, ay: 50, az: 200,
  src:        'GPS',
  battery:     80,
  impact:     false,
  timestamp:  new Date().toISOString(),
  created_at: new Date().toISOString(),
});

// Helper: force a second effect run by re-rendering with a fresh array reference
const nudge = (loc: GPSLocation): GPSLocation => ({ ...loc });

describe('useZoneAlerts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('produces no alert when worker is inside the zone', async () => {
    const { result } = renderHook(() =>
      useZoneAlerts([makeLocation(28.5450, 77.1925)], [FENCE], [ASSIGNMENT], { outOfZoneAlertDelaySeconds: 0 })
    );
    await waitFor(() => expect(result.current.alerts).toHaveLength(0));
  });

  it('produces an alert when worker is outside the zone and delay has passed', async () => {
    const loc = makeLocation(28.5500, 77.2000);
    const { result, rerender } = renderHook(
      (props: { locs: GPSLocation[] }) =>
        useZoneAlerts(props.locs, [FENCE], [ASSIGNMENT], { outOfZoneAlertDelaySeconds: 0 }),
      { initialProps: { locs: [loc] } }
    );
    // Run 1 initialises tracker; Run 2 fires the alert
    rerender({ locs: [nudge(loc)] });
    await waitFor(() => expect(result.current.alerts.length).toBeGreaterThan(0));
    expect(result.current.alerts[0].type).toBe('out-of-zone');
    expect(result.current.alerts[0].deviceId).toBe('DEVICE_01');
  });

  it('does NOT alert when worker is outside zone but within tolerance (±20m)', async () => {
    const { result } = renderHook(() =>
      useZoneAlerts([makeLocation(28.5439, 77.1925)], [FENCE], [ASSIGNMENT], { outOfZoneAlertDelaySeconds: 0 })
    );
    await waitFor(() => expect(result.current.alerts).toHaveLength(0));
  });

  it('does NOT alert when worker is in a green corridor', async () => {
    const greenFence: PolygonFence = { ...FENCE, id: 'fence-green', isGreenCorridor: true };
    const { result } = renderHook(() =>
      useZoneAlerts(
        [makeLocation(28.5450, 77.1925)],
        [FENCE, greenFence],
        [ASSIGNMENT],
        { outOfZoneAlertDelaySeconds: 0 }
      )
    );
    await waitFor(() => expect(result.current.alerts).toHaveLength(0));
  });

  it('clears a specific alert by id', async () => {
    const loc = makeLocation(28.5500, 77.2000);
    const { result, rerender } = renderHook(
      (props: { locs: GPSLocation[] }) =>
        useZoneAlerts(props.locs, [FENCE], [ASSIGNMENT], { outOfZoneAlertDelaySeconds: 0 }),
      { initialProps: { locs: [loc] } }
    );
    rerender({ locs: [nudge(loc)] });
    await waitFor(() => expect(result.current.alerts.length).toBeGreaterThan(0));
    const alertId = result.current.alerts[0].id;
    result.current.clearAlert(alertId);
    await waitFor(() => expect(result.current.alerts).toHaveLength(0));
  });

  it('clears all alerts', async () => {
    const loc = makeLocation(28.5500, 77.2000);
    const { result, rerender } = renderHook(
      (props: { locs: GPSLocation[] }) =>
        useZoneAlerts(props.locs, [FENCE], [ASSIGNMENT], { outOfZoneAlertDelaySeconds: 0 }),
      { initialProps: { locs: [loc] } }
    );
    rerender({ locs: [nudge(loc)] });
    await waitFor(() => expect(result.current.alerts.length).toBeGreaterThan(0));
    result.current.clearAllAlerts();
    await waitFor(() => expect(result.current.alerts).toHaveLength(0));
  });

  it('produces no alert when outside shift hours', async () => {
    const offShiftFence: PolygonFence = { ...FENCE, shiftStart: '02:00', shiftEnd: '03:00' };
    const { result } = renderHook(() =>
      useZoneAlerts([makeLocation(28.5500, 77.2000)], [offShiftFence], [ASSIGNMENT], { outOfZoneAlertDelaySeconds: 0 })
    );
    await waitFor(() => expect(result.current.alerts).toHaveLength(0));
  });
});
