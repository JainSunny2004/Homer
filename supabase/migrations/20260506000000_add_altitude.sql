-- Migration: Add altitude field for Z-axis (height) tracking
-- Date: 2026-05-06

ALTER TABLE public.sensor_readings
ADD COLUMN IF NOT EXISTS altitude FLOAT DEFAULT NULL;

COMMENT ON COLUMN public.sensor_readings.altitude IS 'Altitude in metres above sea level from GPS module. NULL when not reported.';

-- Recreate view to include altitude
CREATE OR REPLACE VIEW public.latest_device_locations AS
SELECT DISTINCT ON (device_id)
  id,
  device_id,
  latitude,
  longitude,
  altitude,
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
  battery,
  impact,
  created_at
FROM public.sensor_readings
ORDER BY device_id, created_at DESC;

GRANT SELECT ON public.latest_device_locations TO anon, authenticated, service_role;
