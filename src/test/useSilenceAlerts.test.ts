import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSilenceAlerts } from '@/hooks/useSilenceAlerts';
import type { GPSLocation, WorkerAssignment } from '@/types/gps';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));

const ASSIGNMENT: WorkerAssignment = { workerId: 'DEVICE_01', fenceId: 'fence-1' };

const makeLocation = (minsAgo: number): GPSLocation => ({
  id:         '1',
  device_id:  'DEVICE_01',
  latitude:    28.5450,
  longitude:   77.1925,
  ax: 100, ay: 50, az: 200,
  src:        'GPS',
  battery:     80,
  impact:     false,
  timestamp:  new Date(Date.now() - minsAgo * 60000).toISOString(),
  created_at: new Date().toISOString(),
});

describe('useSilenceAlerts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fires silence alert when last ping is older than threshold', async () => {
    const staleLocation = makeLocation(10); // 10 mins old
    const { result, rerender } = renderHook(
      (props: { locs: GPSLocation[] }) =>
        useSilenceAlerts(props.locs, [ASSIGNMENT], { silenceAlertMinutes: 5 }),
      { initialProps: { locs: [staleLocation] } }
    );
    // Run 1: tracker initialised as { alerted: false }
    // Run 2: existing entry found → alert fires
    rerender({ locs: [{ ...staleLocation }] });
    await waitFor(() => expect(result.current.alerts.length).toBeGreaterThan(0));
    expect(result.current.alerts[0].type).toBe('silence');
    expect(result.current.alerts[0].deviceId).toBe('DEVICE_01');
  });

  it('does NOT fire when device pinged recently', async () => {
    const { result } = renderHook(() =>
      useSilenceAlerts([makeLocation(1)], [ASSIGNMENT], { silenceAlertMinutes: 5 })
    );
    await waitFor(() => expect(result.current.alerts).toHaveLength(0));
  });

  it('does NOT fire for unassigned devices', async () => {
    const { result } = renderHook(() =>
      useSilenceAlerts([makeLocation(10)], [], { silenceAlertMinutes: 5 })
    );
    await waitFor(() => expect(result.current.alerts).toHaveLength(0));
  });
});
