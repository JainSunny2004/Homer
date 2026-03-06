import { useState, useEffect, useCallback, useRef } from 'react';
import { GPSLocation } from '@/types/gps';
import { SafetyAlert } from '@/types/alerts';
import { haversineDistance } from '@/lib/geoUtils';
import { toast } from 'sonner';

interface ProximityTracker {
  pairKey: string;
  deviceA: string;
  deviceB: string;
  startTime: number;
  alerted: boolean;
}

interface UseCoMovementOptions {
  coMovementThresholdMeters: number;
  coMovementDurationSeconds: number;
  shiftChangeTime: string;
  shiftChangeWindowMinutes: number;
}

export const useCoMovementAlerts = (
  locations: GPSLocation[],
  options: UseCoMovementOptions
) => {
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const trackerRef          = useRef<Map<string, ProximityTracker>>(new Map());
  const {
    coMovementThresholdMeters,
    coMovementDurationSeconds,
    shiftChangeTime,
    shiftChangeWindowMinutes,
  } = options;

  // Returns true if we're within the shift-change window
  const isShiftChangeWindow = useCallback((): boolean => {
    const now     = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const [h, m]  = shiftChangeTime.split(':').map(Number);
    const shiftMin = h * 60 + m;
    return Math.abs(current - shiftMin) <= shiftChangeWindowMinutes;
  }, [shiftChangeTime, shiftChangeWindowMinutes]);

  const getLatestLocations = useCallback((): Map<string, GPSLocation> => {
    const map = new Map<string, GPSLocation>();
    locations.forEach(loc => {
      const existing = map.get(loc.device_id);
      if (!existing || new Date(loc.timestamp) > new Date(existing.timestamp))
        map.set(loc.device_id, loc);
    });
    return map;
  }, [locations]);

  useEffect(() => {
    if (isShiftChangeWindow()) return; // suppress during shift-change grace period

    const latestLocations = getLatestLocations();
    const devices         = Array.from(latestLocations.keys());
    const now             = Date.now();
    const durationMs      = coMovementDurationSeconds * 1000;
    const tracker         = trackerRef.current;

    for (let i = 0; i < devices.length; i++) {
      for (let j = i + 1; j < devices.length; j++) {
        const idA  = devices[i];
        const idB  = devices[j];
        const locA = latestLocations.get(idA)!;
        const locB = latestLocations.get(idB)!;

        const dist = haversineDistance(
          { lat: locA.latitude, lng: locA.longitude },
          { lat: locB.latitude, lng: locB.longitude }
        );

        const pairKey = [idA, idB].sort().join('|');
        const existing = tracker.get(pairKey);

        if (dist <= coMovementThresholdMeters) {
          if (!existing) {
            tracker.set(pairKey, { pairKey, deviceA: idA, deviceB: idB, startTime: now, alerted: false });
          } else if (!existing.alerted && (now - existing.startTime) >= durationMs) {
            const alertId   = `co-movement-${pairKey}-${now}`;
            const newAlert: SafetyAlert = {
              id:              alertId,
              deviceId:        idA,
              relatedDeviceId: idB,
              type:            'co-movement',
              title:           `Co-movement: ${idA} & ${idB}`,
              description:     `Both devices within ${coMovementThresholdMeters}m of each other for ${coMovementDurationSeconds}+ seconds.`,
              timestamp:       new Date(),
            };
            setAlerts(prev => {
              if (prev.some(a => a.deviceId === idA && a.relatedDeviceId === idB && a.type === 'co-movement'))
                return prev;
              return [...prev, newAlert];
            });
            toast.warning(`🔵 Co-movement: ${idA} & ${idB}`, {
              description: `Within ${coMovementThresholdMeters}m for ${coMovementDurationSeconds}+ seconds`,
              duration: 6000,
            });
            tracker.set(pairKey, { ...existing, alerted: true });
          }
        } else {
          if (existing) tracker.delete(pairKey);
        }
      }
    }

    // Clean up stale trackers
    const deviceSet = new Set(devices);
    tracker.forEach((v, k) => {
      if (!deviceSet.has(v.deviceA) || !deviceSet.has(v.deviceB)) tracker.delete(k);
    });
  }, [locations, coMovementThresholdMeters, coMovementDurationSeconds, isShiftChangeWindow, getLatestLocations]);

  const clearAlert     = useCallback((id: string) => setAlerts(prev => prev.filter(a => a.id !== id)), []);
  const clearAllAlerts = useCallback(() => { setAlerts([]); trackerRef.current.clear(); }, []);

  return { alerts, clearAlert, clearAllAlerts };
};
