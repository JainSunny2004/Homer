import { useState, useEffect, useCallback } from 'react';
import { GPSLocation } from '@/types/gps';
import { supabase } from '@/integrations/supabase/client';

interface UseGPSDataOptions {
  refreshIntervalSeconds?: number;
}

interface UseGPSDataReturn {
  locations: GPSLocation[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  refresh: () => Promise<void>;
  isAutoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
}

export const useGPSData = (options: UseGPSDataOptions = {}): UseGPSDataReturn => {
  const { refreshIntervalSeconds = 5 } = options;
  const [locations, setLocations]       = useState<GPSLocation[]>([]);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [lastUpdate, setLastUpdate]     = useState<Date | null>(null);
  const [isAutoRefresh, setAutoRefresh] = useState(true);

  const fetchLocations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: sbError } = await supabase
        .from('latest_device_locations')
        .select('*');

      if (sbError) throw new Error(sbError.message);

      if (data) {
        console.log('📡 Raw data from Supabase:', data);

        const mappedLocations: GPSLocation[] = data.map((loc) => ({
          device_id:      loc.device_id,
          latitude:       loc.latitude,
          longitude:      loc.longitude,
          timestamp:      loc.created_at,
          ax:             loc.ax            || 0,
          ay:             loc.ay            || 0,
          az:             loc.az            || 0,
          locationSource: loc.src           || 'GPS',
          peerDistance:   loc.p_dist        || 0,
          pairId:         loc.pair_id       || 0,
          ownLat:         loc.own_lat       || 0,
          ownLon:         loc.own_lon       || 0,
          ownGpsValid:    loc.own_gps_valid  || false,
          peerLat:        loc.peer_lat      || 0,
          peerLon:        loc.peer_lon      || 0,
          peerDist:       loc.peer_dist     || 0,
          peerId:         loc.peer_id       || 0,
          peerValid:      loc.peer_valid    || false,
          battery:        loc.battery       ?? 0,    // Sprint 1
          impact:         loc.impact        ?? false, // Sprint 1
        }));

        console.log('✅ Mapped locations:', mappedLocations);
        setLocations(mappedLocations);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error('❌ Error fetching locations:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    if (!isAutoRefresh) return;
    const interval = setInterval(fetchLocations, refreshIntervalSeconds * 1000);
    return () => clearInterval(interval);
  }, [isAutoRefresh, fetchLocations, refreshIntervalSeconds]);

  return { locations, isLoading, error, lastUpdate, refresh: fetchLocations, isAutoRefresh, setAutoRefresh };
};
