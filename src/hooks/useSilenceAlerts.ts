import { useState, useEffect, useCallback, useRef } from 'react';
import { GPSLocation, WorkerAssignment } from '@/types/gps';
import { SafetyAlert } from '@/types/alerts';
import { toast } from 'sonner';

interface SilenceTracker {
  deviceId: string;
  alerted: boolean;
}

interface UseSilenceOptions {
  silenceAlertMinutes: number;
}

export const useSilenceAlerts = (
  locations: GPSLocation[],
  assignments: WorkerAssignment[],
  options: UseSilenceOptions
) => {
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const trackerRef          = useRef<Map<string, SilenceTracker>>(new Map());
  const { silenceAlertMinutes } = options;

  const getLatestLocations = useCallback((): Map<string, GPSLocation> => {
    const map = new Map<string, GPSLocation>();
    locations.forEach(loc => {
      const existing = map.get(loc.device_id);
      if (!existing || new Date(loc.timestamp) > new Date(existing.timestamp))
        map.set(loc.device_id, loc);
    });
    return map;
  }, [locations]);

  const assignedWorkerIds = new Set(assignments.map(a => a.workerId));

  useEffect(() => {
    const latestLocations = getLatestLocations();
    const now             = Date.now();
    const thresholdMs     = silenceAlertMinutes * 60 * 1000;
    const tracker         = trackerRef.current;

    latestLocations.forEach((loc, deviceId) => {
      if (!assignedWorkerIds.has(deviceId)) return;

      const lastPing    = new Date(loc.timestamp).getTime();
      const silentForMs = now - lastPing;
      const existing    = tracker.get(deviceId);

      if (silentForMs >= thresholdMs) {
        if (!existing) {
          tracker.set(deviceId, { deviceId, alerted: false });
        } else if (!existing.alerted) {
          const silentMin = Math.floor(silentForMs / 60000);
          const alertId   = `silence-${deviceId}-${now}`;
          const newAlert: SafetyAlert = {
            id:          alertId,
            deviceId,
            type:        'silence',
            title:       `Tracker Silent: ${deviceId}`,
            description: `No ping received for ${silentMin} minute${silentMin !== 1 ? 's' : ''}. Device may be off or out of network.`,
            timestamp:   new Date(),
          };
          setAlerts(prev => {
            if (prev.some(a => a.deviceId === deviceId && a.type === 'silence')) return prev;
            return [...prev, newAlert];
          });
          toast.error(`🔴 Tracker Silent: ${deviceId}`, {
            description: `No ping for ${silentMin}+ min`,
            duration: 8000,
          });
          tracker.set(deviceId, { ...existing, alerted: true });
        }
      } else {
        // Device back online — clear tracker and alert
        if (existing) {
          tracker.delete(deviceId);
          setAlerts(prev => prev.filter(a => !(a.deviceId === deviceId && a.type === 'silence')));
        }
      }
    });

    // Clean up trackers for devices no longer present
    tracker.forEach((_, id) => {
      if (!latestLocations.has(id)) tracker.delete(id);
    });
  }, [locations, assignments, silenceAlertMinutes, getLatestLocations]);

  const clearAlert     = useCallback((id: string) => setAlerts(prev => prev.filter(a => a.id !== id)), []);
  const clearAllAlerts = useCallback(() => { setAlerts([]); trackerRef.current.clear(); }, []);

  return { alerts, clearAlert, clearAllAlerts };
};
