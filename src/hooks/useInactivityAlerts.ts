import { useState, useEffect, useCallback, useRef } from 'react';
import { GPSLocation, WorkerAssignment } from '@/types/gps';
import { SafetyAlert } from '@/types/alerts';
import { toast } from 'sonner';

// MPU6050 raw units. Consecutive reading delta below this = no movement.
const MOVEMENT_DELTA_THRESHOLD = 300;

interface DeviceMotionState {
  lastAx: number;
  lastAy: number;
  lastAz: number;
  lastMovementTime: number;
  alerted: boolean;
}

interface UseInactivityOptions {
  inactivityThresholdMinutes: number;
  inactivityBreakExtendMinutes: number;
  breakStartTime: string;
  breakDurationValue: number;
  breakDurationUnit: 'minutes' | 'hours';
}

export const useInactivityAlerts = (
  locations: GPSLocation[],
  assignments: WorkerAssignment[],
  options: UseInactivityOptions
) => {
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const motionRef           = useRef<Map<string, DeviceMotionState>>(new Map());
  const {
    inactivityThresholdMinutes,
    inactivityBreakExtendMinutes,
    breakStartTime,
    breakDurationValue,
    breakDurationUnit,
  } = options;

  // Compute break end time from start + duration
  const getBreakEndTime = useCallback((): string => {
    const [h, m] = breakStartTime.split(':').map(Number);
    const durationMin = breakDurationUnit === 'hours'
      ? breakDurationValue * 60
      : breakDurationValue;
    const endMin = h * 60 + m + durationMin;
    return `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
  }, [breakStartTime, breakDurationValue, breakDurationUnit]);

  const isDuringBreak = useCallback((): boolean => {
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = breakStartTime.split(':').map(Number);
    const breakEndStr = getBreakEndTime();
    const [eh, em]   = breakEndStr.split(':').map(Number);
    const start = sh * 60 + sm;
    const end   = eh * 60 + em;
    return current >= start && current <= end;
  }, [breakStartTime, getBreakEndTime]);

  const getEffectiveThresholdMs = useCallback((): number => {
    const base = inactivityThresholdMinutes * 60 * 1000;
    return isDuringBreak()
      ? base + inactivityBreakExtendMinutes * 60 * 1000
      : base;
  }, [inactivityThresholdMinutes, inactivityBreakExtendMinutes, isDuringBreak]);

  // Latest location per device
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
    const thresholdMs     = getEffectiveThresholdMs();
    const motion          = motionRef.current;

    latestLocations.forEach((loc, deviceId) => {
      if (!assignedWorkerIds.has(deviceId)) return;

      const ax = loc.ax ?? 0;
      const ay = loc.ay ?? 0;
      const az = loc.az ?? 0;

      const existing = motion.get(deviceId);

      if (!existing) {
        // First reading — initialise
        motion.set(deviceId, { lastAx: ax, lastAy: ay, lastAz: az, lastMovementTime: now, alerted: false });
        return;
      }

      const delta = Math.abs(ax - existing.lastAx)
                  + Math.abs(ay - existing.lastAy)
                  + Math.abs(az - existing.lastAz);

      if (delta > MOVEMENT_DELTA_THRESHOLD) {
        // Device moved — reset
        motion.set(deviceId, { lastAx: ax, lastAy: ay, lastAz: az, lastMovementTime: now, alerted: false });
        // Clear any existing inactivity alert for this device
        setAlerts(prev => prev.filter(a => !(a.deviceId === deviceId && a.type === 'inactivity')));
      } else {
        // No significant movement
        motion.set(deviceId, { ...existing, lastAx: ax, lastAy: ay, lastAz: az });

        const inactiveDuration = now - existing.lastMovementTime;
        if (!existing.alerted && inactiveDuration >= thresholdMs) {
          const alertId   = `inactivity-${deviceId}-${now}`;
          const durationMin = Math.floor(inactiveDuration / 60000);
          const newAlert: SafetyAlert = {
            id:          alertId,
            deviceId,
            type:        'inactivity',
            title:       `Inactivity: ${deviceId}`,
            description: `No movement detected for ${durationMin} minute${durationMin !== 1 ? 's' : ''}.`,
            timestamp:   new Date(),
          };
          setAlerts(prev => {
            if (prev.some(a => a.deviceId === deviceId && a.type === 'inactivity')) return prev;
            return [...prev, newAlert];
          });
          toast.warning(`🟠 Inactivity: ${deviceId}`, {
            description: `No movement for ${durationMin}+ min`,
            duration: 6000,
          });
          motion.set(deviceId, { ...existing, alerted: true });
        }
      }
    });

    // Remove motion state for devices no longer tracked
    motion.forEach((_, id) => {
      if (!latestLocations.has(id)) motion.delete(id);
    });
  }, [locations, assignments, getLatestLocations, getEffectiveThresholdMs]);

  const clearAlert     = useCallback((id: string) => setAlerts(prev => prev.filter(a => a.id !== id)), []);
  const clearAllAlerts = useCallback(() => { setAlerts([]); motionRef.current.clear(); }, []);

  return { alerts, clearAlert, clearAllAlerts };
};
