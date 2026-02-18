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
  const [locations, setLocations] = useState<GPSLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isAutoRefresh, setAutoRefresh] = useState(true);

  const fetchLocations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: sbError } = await supabase
        .from('latest_device_locations')
        .select('*');

      if (sbError) {
        throw new Error(sbError.message);
      }

      if (data) {
        console.log('📡 Raw data from Supabase:', data);
        
        const mappedLocations = data.map((loc) => ({
          device_id: loc.device_id,
          // Legacy fields (primary display location)
          latitude: loc.latitude,
          longitude: loc.longitude,
          timestamp: loc.created_at,
          // Sensor data
          ax: loc.ax || 0,
          ay: loc.ay || 0,
          az: loc.az || 0,
          // Location source
          locationSource: loc.src || 'GPS',
          peerDistance: loc.p_dist || 0,
          pairId: loc.pair_id || 0,
          // NEW: Cooperative transmission fields
          ownLat: loc.own_lat || 0,
          ownLon: loc.own_lon || 0,
          ownGpsValid: loc.own_gps_valid || false,
          peerLat: loc.peer_lat || 0,
          peerLon: loc.peer_lon || 0,
          peerDist: loc.peer_dist || 0,
          peerId: loc.peer_id || 0,
          peerValid: loc.peer_valid || false,
        }));

        console.log('✅ Mapped locations with new fields:', mappedLocations);
        
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

  // Initial fetch
  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Auto-refresh with configurable interval
  useEffect(() => {
    if (!isAutoRefresh) return;

    const intervalMs = refreshIntervalSeconds * 1000;
    const interval = setInterval(fetchLocations, intervalMs);

    return () => clearInterval(interval);
  }, [isAutoRefresh, fetchLocations, refreshIntervalSeconds]);

  return {
    locations,
    isLoading,
    error,
    lastUpdate,
    refresh: fetchLocations,
    isAutoRefresh,
    setAutoRefresh,
  };
};
