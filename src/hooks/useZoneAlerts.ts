import { useState, useEffect, useCallback, useRef } from 'react';
import { GPSLocation, PolygonFence, WorkerAssignment } from '@/types/gps';
import { SafetyAlert } from '@/types/alerts';
import {
  isPointNearOrInPolygon,
  isPointInAnyGreenCorridor,
  isWithinShift,
} from '@/lib/geoUtils';
import { toast } from 'sonner';

interface ViolationTracker {
  workerId: string;
  startTime: number;
  alerted: boolean;
}

interface UseZoneAlertsOptions {
  outOfZoneAlertDelaySeconds: number;
}

interface UseZoneAlertsReturn {
  alerts: SafetyAlert[];
  clearAlert: (alertId: string) => void;
  clearAllAlerts: () => void;
}

export const useZoneAlerts = (
  locations: GPSLocation[],
  fences: PolygonFence[],
  assignments: WorkerAssignment[],
  options: UseZoneAlertsOptions
): UseZoneAlertsReturn => {
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const trackerRef          = useRef<Map<string, ViolationTracker>>(new Map());
  const { outOfZoneAlertDelaySeconds } = options;

  const getLatestLocations = useCallback((): Map<string, GPSLocation> => {
    const map = new Map<string, GPSLocation>();
    locations.forEach(loc => {
      const existing = map.get(loc.device_id);
      if (!existing || new Date(loc.timestamp) > new Date(existing.timestamp))
        map.set(loc.device_id, loc);
    });
    return map;
  }, [locations]);

  const isWorkerInViolation = useCallback((
    workerId: string,
    location: GPSLocation
  ): { inViolation: boolean; fence: PolygonFence | null } => {
    const assignment = assignments.find(a => a.workerId === workerId);
    if (!assignment) return { inViolation: false, fence: null };

    const fence = fences.find(f => f.id === assignment.fenceId);
    if (!fence) return { inViolation: false, fence: null };

    if (!isWithinShift(new Date(), fence.shiftStart, fence.shiftEnd))
      return { inViolation: false, fence: null };

    const point = { lat: location.latitude, lng: location.longitude };

    if (isPointInAnyGreenCorridor(point, fences))
      return { inViolation: false, fence: null };

    const tolerance = fence.toleranceMeters ?? 20;
    const inside    = isPointNearOrInPolygon(point, fence.coordinates, tolerance);

    return { inViolation: !inside, fence };
  }, [assignments, fences]);

  useEffect(() => {
    const latestLocations = getLatestLocations();
    const now     = Date.now();
    const delayMs = outOfZoneAlertDelaySeconds * 1000;
    const tracker = trackerRef.current;

    assignments.forEach(assignment => {
      const location = latestLocations.get(assignment.workerId);
      if (!location) return;

      const { inViolation, fence } = isWorkerInViolation(assignment.workerId, location);
      const existing = tracker.get(assignment.workerId);

      if (inViolation && fence) {
        if (!existing) {
          tracker.set(assignment.workerId, {
            workerId:  assignment.workerId,
            startTime: now,
            alerted:   false,
          });
        } else if (!existing.alerted && (now - existing.startTime) >= delayMs) {
          const alertId  = `zone-${assignment.workerId}-${now}`;
          const newAlert: SafetyAlert = {
            id:          alertId,
            deviceId:    assignment.workerId,
            type:        'out-of-zone',
            title:       `Out of Zone: ${assignment.workerId}`,
            description: `Outside "${fence.name}" for ${outOfZoneAlertDelaySeconds}+ seconds`,
            timestamp:   new Date(),
            fenceId:     fence.id,
            fenceName:   fence.name,
          };

          setAlerts(prev => {
            if (prev.some(a => a.deviceId === assignment.workerId && a.type === 'out-of-zone'))
              return prev;
            return [...prev, newAlert];
          });

          toast.error(`⚠️ Zone Violation: ${assignment.workerId}`, {
            description: `Outside "${fence.name}" for ${outOfZoneAlertDelaySeconds}+ seconds`,
            duration: 6000,
          });

          tracker.set(assignment.workerId, { ...existing, alerted: true });
        }
      } else {
        if (existing) tracker.delete(assignment.workerId);
      }
    });

    const assignedIds = new Set(assignments.map(a => a.workerId));
    tracker.forEach((_, workerId) => {
      if (!assignedIds.has(workerId)) tracker.delete(workerId);
    });
  }, [locations, assignments, fences, outOfZoneAlertDelaySeconds, getLatestLocations, isWorkerInViolation]);

  const clearAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
    trackerRef.current.clear();
  }, []);

  return { alerts, clearAlert, clearAllAlerts };
};
