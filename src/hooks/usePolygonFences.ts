import { useState, useEffect, useCallback } from 'react';
import { PolygonFence } from '@/types/gps';
import { supabase } from '@/integrations/supabase/client';

interface UsePolygonFencesReturn {
  fences: PolygonFence[];
  addFence: (fence: Omit<PolygonFence, 'id'>) => Promise<void>;
  removeFence: (id: string) => Promise<void>;
  updateFence: (id: string, updates: Partial<PolygonFence>) => Promise<void>;
  isLoading: boolean;
}

const toFence = (row: any): PolygonFence => ({
  id:               row.id,
  name:             row.name,
  coordinates:      row.coordinates as { lat: number; lng: number }[],
  color:            row.color,
  shiftStart:       row.shift_start,
  shiftEnd:         row.shift_end,
  isGreenCorridor:  row.is_green_corridor,
  toleranceMeters:  row.tolerance_meters,
});

export const usePolygonFences = (): UsePolygonFencesReturn => {
  const [fences, setFences]     = useState<PolygonFence[]>([]);
  const [isLoading, setLoading] = useState(true);

  const fetchFences = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('polygon_fences')
      .select('*')
      .order('created_at');
    if (error) {
      console.error('[usePolygonFences] fetch error:', error);
    } else if (data) {
      setFences(data.map(toFence));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchFences(); }, [fetchFences]);

  const addFence = useCallback(async (fence: Omit<PolygonFence, 'id'>) => {
    const { data, error } = await supabase
      .from('polygon_fences')
      .insert({
        name:              fence.name,
        coordinates:       fence.coordinates,
        color:             fence.color,
        shift_start:       fence.shiftStart,
        shift_end:         fence.shiftEnd,
        is_green_corridor: fence.isGreenCorridor ?? false,
        tolerance_meters:  fence.toleranceMeters  ?? 20,
      })
      .select()
      .single();
    if (error) console.error('[usePolygonFences] add error:', error);
    else if (data) setFences(prev => [...prev, toFence(data)]);
  }, []);

  const removeFence = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('polygon_fences')
      .delete()
      .eq('id', id);
    if (error) console.error('[usePolygonFences] remove error:', error);
    else setFences(prev => prev.filter(f => f.id !== id));
  }, []);

  const updateFence = useCallback(async (id: string, updates: Partial<PolygonFence>) => {
    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name             !== undefined) dbUpdates.name              = updates.name;
    if (updates.coordinates      !== undefined) dbUpdates.coordinates       = updates.coordinates;
    if (updates.color            !== undefined) dbUpdates.color             = updates.color;
    if (updates.shiftStart       !== undefined) dbUpdates.shift_start       = updates.shiftStart;
    if (updates.shiftEnd         !== undefined) dbUpdates.shift_end         = updates.shiftEnd;
    if (updates.isGreenCorridor  !== undefined) dbUpdates.is_green_corridor = updates.isGreenCorridor;
    if (updates.toleranceMeters  !== undefined) dbUpdates.tolerance_meters  = updates.toleranceMeters;

    const { error } = await supabase
      .from('polygon_fences')
      .update(dbUpdates)
      .eq('id', id);
    if (error) console.error('[usePolygonFences] update error:', error);
    else setFences(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  return { fences, addFence, removeFence, updateFence, isLoading };
};
