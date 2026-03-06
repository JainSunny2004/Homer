import { useState, useEffect, useCallback } from 'react';
import { WorkerAssignment } from '@/types/gps';
import { supabase } from '@/integrations/supabase/client';

interface UseWorkerAssignmentsReturn {
  assignments: WorkerAssignment[];
  assignWorker: (assignment: Omit<WorkerAssignment, 'id'>) => Promise<void>;
  unassignWorker: (workerId: string) => Promise<void>;
  getWorkerAssignment: (workerId: string) => WorkerAssignment | undefined;
  isLoading: boolean;
}

const toAssignment = (row: any): WorkerAssignment => ({
  id:        row.id,
  workerId:  row.worker_id,
  fenceId:   row.fence_id,
  jobLabel:  row.job_label,
});

export const useWorkerAssignments = (): UseWorkerAssignmentsReturn => {
  const [assignments, setAssignments] = useState<WorkerAssignment[]>([]);
  const [isLoading, setLoading]       = useState(true);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('worker_assignments')
      .select('*');
    if (error) console.error('[useWorkerAssignments] fetch error:', error);
    else if (data) setAssignments(data.map(toAssignment));
    setLoading(false);
  }, []);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const assignWorker = useCallback(async (assignment: Omit<WorkerAssignment, 'id'>) => {
    const { data, error } = await supabase
      .from('worker_assignments')
      .upsert({
        worker_id: assignment.workerId,
        fence_id:  assignment.fenceId,
        job_label: assignment.jobLabel,
      }, { onConflict: 'worker_id' })
      .select()
      .single();
    if (error) {
      console.error('[useWorkerAssignments] assign error:', error);
    } else if (data) {
      setAssignments(prev => [
        ...prev.filter(a => a.workerId !== assignment.workerId),
        toAssignment(data),
      ]);
    }
  }, []);

  const unassignWorker = useCallback(async (workerId: string) => {
    const { error } = await supabase
      .from('worker_assignments')
      .delete()
      .eq('worker_id', workerId);
    if (error) console.error('[useWorkerAssignments] unassign error:', error);
    else setAssignments(prev => prev.filter(a => a.workerId !== workerId));
  }, []);

  const getWorkerAssignment = useCallback((workerId: string) =>
    assignments.find(a => a.workerId === workerId),
  [assignments]);

  return { assignments, assignWorker, unassignWorker, getWorkerAssignment, isLoading };
};
