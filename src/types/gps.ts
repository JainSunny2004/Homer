export interface GPSLocation {
  device_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  ax?: number;
  ay?: number;
  az?: number;
  locationSource?: string;
  peerDistance?: number;
  pairId?: number;
  // NEW: Cooperative transmission fields
  ownLat?: number;
  ownLon?: number;
  ownGpsValid?: boolean;
  peerLat?: number;
  peerLon?: number;
  peerDist?: number;
  peerId?: number;
  peerValid?: boolean;
}

export interface Geofence {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  radius: number;
  color: string;
}

export interface PolygonFence {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number }[];
  color: string;
  shiftStart: string;
  shiftEnd: string;
}

export interface WorkerAssignment {
  id: string;
  workerId: string;
  fenceId: string;
  jobLabel: string;
}

export interface DeviceStatus {
  device_id: string;
  isOnline: boolean;
  lastUpdate: Date;
  currentPosition: { lat: number; lng: number };
  accelerometer: { ax: number; ay: number; az: number };
}
