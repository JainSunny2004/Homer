import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SafetyAlert } from '@/types/alerts';

export interface PersistedAlert extends SafetyAlert {
  resolvedAt?: Date;
}

export const useAlertPersistence = () => {
  const [history, setHistory]     = useState<PersistedAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load last 14 days of alert history from Supabase on mount
  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - 14);

      const { data, error } = await supabase
        .from('alert_logs')
        .select('*')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const mapped: PersistedAlert[] = (data ?? []).map((row: any) => ({
        id:              row.alert_id,
        deviceId:        row.device_id,
        type:            row.type,
        priority:        row.priority,
        title:           row.title,
        description:     row.description ?? '',
        status:          row.status,
        fenceId:         row.fence_id,
        fenceName:       row.fence_name,
        relatedDeviceId: row.related_device_id,
        acknowledgedBy:  row.acknowledged_by,
        acknowledgedAt:  row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
        silencedBy:      row.silenced_by,
        silencedAt:      row.silenced_at ? new Date(row.silenced_at) : undefined,
        escalatedAt:     row.escalated_at ? new Date(row.escalated_at) : undefined,
        timestamp:       new Date(row.created_at),
        resolvedAt:      row.resolved_at ? new Date(row.resolved_at) : undefined,
      }));

      setHistory(mapped);
    } catch (err) {
      console.error('Failed to load alert history:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Persist a new alert to Supabase
  const persistAlert = useCallback(async (alert: SafetyAlert) => {
    try {
      await supabase.from('alert_logs').upsert({
        alert_id:          alert.id,
        device_id:         alert.deviceId,
        type:              alert.type,
        priority:          alert.priority ?? 6,
        title:             alert.title,
        description:       alert.description,
        status:            alert.status ?? 'active',
        fence_id:          alert.fenceId,
        fence_name:        alert.fenceName,
        related_device_id: alert.relatedDeviceId,
      }, { onConflict: 'alert_id' });
    } catch (err) {
      console.error('Failed to persist alert:', err);
    }
  }, []);

  // Update alert status in Supabase
  const updateAlertStatus = useCallback(async (
    alertId: string,
    status:  string,
    by?:     string,
  ) => {
    try {
      const updates: Record<string, any> = { status };
      const now = new Date().toISOString();
      if (status === 'acknowledged') { updates.acknowledged_by = by; updates.acknowledged_at = now; }
      if (status === 'silenced')     { updates.silenced_by     = by; updates.silenced_at     = now; }
      if (status === 'escalated')    { updates.escalated_at    = now; }
      if (status === 'resolved')     { updates.resolved_at     = now; }

      await supabase.from('alert_logs').update(updates).eq('alert_id', alertId);
    } catch (err) {
      console.error('Failed to update alert status:', err);
    }
  }, []);

  return { history, isLoading, loadHistory, persistAlert, updateAlertStatus };
};
