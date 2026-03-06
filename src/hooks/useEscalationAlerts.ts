import { useEffect, useCallback } from 'react';
import { SafetyAlert } from '@/types/alerts';
import { toast } from 'sonner';

interface Options { escalationMinutes: number; }

export const useEscalationAlerts = (
  alerts:     SafetyAlert[],
  onEscalate: (alertId: string) => void,
  options:    Options,
) => {
  const { escalationMinutes } = options;

  const check = useCallback(() => {
    if (escalationMinutes <= 0) return;
    const now        = Date.now();
    const thresholdMs = escalationMinutes * 60 * 1000;

    alerts.forEach(alert => {
      if (alert.status !== 'active') return;
      const age = now - new Date(alert.timestamp).getTime();
      if (age >= thresholdMs) {
        onEscalate(alert.id);
        toast.warning(`🔺 Escalated: ${alert.title}`, {
          description: `Unacknowledged for ${escalationMinutes}+ min — requires immediate attention`,
          duration: 10_000,
        });
      }
    });
  }, [alerts, escalationMinutes, onEscalate]);

  useEffect(() => {
    const id = setInterval(check, 30_000); // poll every 30s
    return () => clearInterval(id);
  }, [check]);
};
