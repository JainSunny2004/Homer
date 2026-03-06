import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/contexts/AuthContext';

export interface AuditEntry {
  id:          string;
  actorId:     string;
  actorName:   string;
  actorRole:   string;
  action:      string;
  targetId?:   string;
  targetLabel?:string;
  details?:    Record<string, any>;
  createdAt:   Date;
}

export const ACTION_LABELS: Record<string, string> = {
  acknowledge_alert: '✅ Acknowledged alert',
  silence_alert:     '🔕 Silenced alert',
  escalate_alert:    '🔺 Escalated alert',
  assign_worker:     '👷 Assigned worker to zone',
  unassign_worker:   '🚫 Unassigned worker from zone',
  create_fence:      '📐 Created zone',
  delete_fence:      '🗑️ Deleted zone',
  update_fence:      '✏️ Updated zone',
  update_settings:   '⚙️ Updated settings',
};

export const useAuditLog = (user: User | null) => {
  const [entries, setEntries]     = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadAuditLog = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      setEntries((data ?? []).map((row: any) => ({
        id:          row.id,
        actorId:     row.actor_id,
        actorName:   row.actor_name,
        actorRole:   row.actor_role,
        action:      row.action,
        targetId:    row.target_id,
        targetLabel: row.target_label,
        details:     row.details,
        createdAt:   new Date(row.created_at),
      })));
    } catch (err) {
      console.error('Failed to load audit log:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAuditLog(); }, [loadAuditLog]);

  const logAction = useCallback(async (
    action:       string,
    targetId?:    string,
    targetLabel?: string,
    details?:     Record<string, any>,
  ) => {
    if (!user) return;
    try {
      await supabase.from('audit_logs').insert({
        actor_id:     user.id,
        actor_name:   user.name,
        actor_role:   user.role,
        action,
        target_id:    targetId,
        target_label: targetLabel,
        details,
      });
      // Optimistic local update
      setEntries(prev => [{
        id:          crypto.randomUUID(),
        actorId:     user.id,
        actorName:   user.name,
        actorRole:   user.role,
        action,
        targetId,
        targetLabel,
        details,
        createdAt:   new Date(),
      }, ...prev]);
    } catch (err) {
      console.error('Failed to log action:', err);
    }
  }, [user]);

  return { entries, isLoading, loadAuditLog, logAction };
};
