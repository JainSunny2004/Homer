-- Migration: Add Cooperative Transmission Fields
-- Date: 2026-02-17
-- Purpose: Support simultaneous own GPS and peer GPS data transmission

-- Add new columns to sensor_readings table
ALTER TABLE public.sensor_readings
ADD COLUMN IF NOT EXISTS own_lat FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS own_lon FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS own_gps_valid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS peer_lat FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS peer_lon FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS peer_dist FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS peer_id INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS peer_valid BOOLEAN DEFAULT false;

-- Add comment to document the new fields
COMMENT ON COLUMN public.sensor_readings.own_lat IS 'Device own GPS latitude';
COMMENT ON COLUMN public.sensor_readings.own_lon IS 'Device own GPS longitude';
COMMENT ON COLUMN public.sensor_readings.own_gps_valid IS 'True if device has valid GPS fix';
COMMENT ON COLUMN public.sensor_readings.peer_lat IS 'Peer device GPS latitude (from BLE)';
COMMENT ON COLUMN public.sensor_readings.peer_lon IS 'Peer device GPS longitude (from BLE)';
COMMENT ON COLUMN public.sensor_readings.peer_dist IS 'Distance to peer device in meters';
COMMENT ON COLUMN public.sensor_readings.peer_id IS 'ID of the peer device';
COMMENT ON COLUMN public.sensor_readings.peer_valid IS 'True if peer data is available';

-- Recreate the view to include new fields
CREATE OR REPLACE VIEW public.latest_device_locations AS
SELECT DISTINCT ON (device_id) 
  id,
  device_id,
  latitude,
  longitude,
  own_lat,
  own_lon,
  own_gps_valid,
  peer_lat,
  peer_lon,
  peer_dist,
  peer_id,
  peer_valid,
  ax,
  ay,
  az,
  src,
  p_dist,
  pair_id,
  created_at
FROM public.sensor_readings
ORDER BY device_id, created_at DESC;

-- Grant permissions
GRANT SELECT ON public.latest_device_locations TO anon, authenticated, service_role;
