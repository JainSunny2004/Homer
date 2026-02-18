import React, { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, Polyline } from '@vis.gl/react-google-maps';
import { GPSLocation } from '@/types/gps';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface GPSMapProps {
  locations: GPSLocation[];
  height?: string;
}

interface InfoWindowState {
  position: { lat: number; lng: number };
  content: GPSLocation;
  isOpen: boolean;
}

const GPSMap: React.FC<GPSMapProps> = ({ locations, height = '600px' }) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const [infoWindow, setInfoWindow] = useState<InfoWindowState | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 28.5450, lng: 77.1926 });

  // DEBUG: Log locations to see the data structure
  useEffect(() => {
    console.log('🗺️ GPSMap received locations:', locations);
    if (locations.length > 0) {
      console.log('📍 First location details:', locations[0]);
    }
  }, [locations]);

  useEffect(() => {
    if (locations.length > 0) {
      const validLocations = locations.filter(loc => 
        (loc.ownLat && loc.ownLat !== 0) || (loc.latitude && loc.latitude !== 0)
      );
      
      if (validLocations.length > 0) {
        const avgLat = validLocations.reduce((sum, loc) => 
          sum + (loc.ownLat || loc.latitude || 0), 0
        ) / validLocations.length;
        
        const avgLng = validLocations.reduce((sum, loc) => 
          sum + (loc.ownLon || loc.longitude || 0), 0
        ) / validLocations.length;
        
        setMapCenter({ lat: avgLat, lng: avgLng });
      }
    }
  }, [locations]);

  if (!apiKey) {
    return (
      <Card className="p-8 text-center">
        <p className="text-red-500 font-semibold">Failed to load Google Maps</p>
        <p className="text-sm text-gray-600 mt-2">Please check your API key configuration</p>
      </Card>
    );
  }

  const handleMarkerClick = (location: GPSLocation, lat: number, lng: number) => {
    setInfoWindow({
      position: { lat, lng },
      content: location,
      isOpen: true,
    });
  };

  const getDeviceMode = (location: GPSLocation) => {
    console.log(`📊 Device ${location.device_id} mode check:`, {
      ownGpsValid: location.ownGpsValid,
      peerValid: location.peerValid,
      mode: location.ownGpsValid && location.peerValid ? 'cooperative' : 
            location.ownGpsValid ? 'gps' : 
            location.peerValid ? 'peer' : 'offline'
    });
    
    if (location.ownGpsValid && location.peerValid) return 'cooperative';
    if (location.ownGpsValid) return 'gps';
    if (location.peerValid) return 'peer';
    return 'offline';
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'cooperative': return '#10b981'; // Green - Energy efficient
      case 'gps': return '#3b82f6'; // Blue - Normal
      case 'peer': return '#f59e0b'; // Orange - Backup
      case 'offline': return '#ef4444'; // Red - No signal
      default: return '#6b7280';
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'cooperative': return 'Cooperative Mode';
      case 'gps': return 'GPS Mode';
      case 'peer': return 'Peer Mode';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  return (
    <div className="relative">
      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg p-4 space-y-2 max-w-[200px]">
        <h3 className="font-semibold text-sm mb-2">Device Status</h3>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></div>
          <span>Cooperative</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"></div>
          <span>GPS Mode</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded-full bg-orange-500 flex-shrink-0"></div>
          <span>Peer Mode</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0"></div>
          <span>Offline</span>
        </div>
      </div>

      <APIProvider apiKey={apiKey}>
        <Map
          style={{ width: '100%', height }}
          defaultCenter={mapCenter}
          center={mapCenter}
          defaultZoom={15}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapId="worker-tracking-map"
        >
          {locations.map((location) => {
            const mode = getDeviceMode(location);
            const modeColor = getModeColor(mode);

            console.log(`🎯 Rendering ${location.device_id}:`, {
              mode,
              ownGpsValid: location.ownGpsValid,
              peerValid: location.peerValid,
              ownLat: location.ownLat,
              ownLon: location.ownLon,
              peerLat: location.peerLat,
              peerLon: location.peerLon
            });

            return (
              <React.Fragment key={`${location.device_id}-${location.timestamp}`}>
                {/* Own GPS Marker (Blue border) */}
                {location.ownGpsValid && location.ownLat && location.ownLon && 
                 location.ownLat !== 0 && location.ownLon !== 0 && (
                  <AdvancedMarker
                    position={{ lat: location.ownLat, lng: location.ownLon }}
                    onClick={() => handleMarkerClick(location, location.ownLat!, location.ownLon!)}
                  >
                    <div className="relative">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg border-4"
                        style={{
                          backgroundColor: modeColor,
                          borderColor: '#3b82f6',
                        }}
                      >
                        {location.device_id.match(/\d+/)?.[0] || '?'}
                      </div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>
                    </div>
                  </AdvancedMarker>
                )}

                {/* Peer GPS Marker (Green border) */}
                {location.peerValid && location.peerLat && location.peerLon && 
                 location.peerLat !== 0 && location.peerLon !== 0 && (
                  <AdvancedMarker
                    position={{ lat: location.peerLat, lng: location.peerLon }}
                    onClick={() => handleMarkerClick(location, location.peerLat!, location.peerLon!)}
                  >
                    <div className="relative">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg border-4"
                        style={{
                          backgroundColor: '#10b981',
                          borderColor: '#10b981',
                        }}
                      >
                        P{location.peerId || '?'}
                      </div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                    </div>
                  </AdvancedMarker>
                )}

                {/* Connecting Line (Cooperative Mode) */}
                {location.ownGpsValid && location.peerValid && 
                 location.ownLat && location.ownLon && location.peerLat && location.peerLon &&
                 location.ownLat !== 0 && location.ownLon !== 0 &&
                 location.peerLat !== 0 && location.peerLon !== 0 && (
                  <Polyline
                    path={[
                      { lat: location.ownLat, lng: location.ownLon },
                      { lat: location.peerLat, lng: location.peerLon },
                    ]}
                    strokeColor="#10b981"
                    strokeOpacity={0.6}
                    strokeWeight={3}
                    geodesic={true}
                  />
                )}

                {/* Fallback: Legacy marker */}
                {!location.ownGpsValid && !location.peerValid && 
                 location.latitude && location.longitude &&
                 location.latitude !== 0 && location.longitude !== 0 && (
                  <AdvancedMarker
                    position={{ lat: location.latitude, lng: location.longitude }}
                    onClick={() => handleMarkerClick(location, location.latitude, location.longitude)}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg"
                      style={{ backgroundColor: modeColor }}
                    >
                      {location.device_id.match(/\d+/)?.[0] || '?'}
                    </div>
                  </AdvancedMarker>
                )}
              </React.Fragment>
            );
          })}

          {/* Info Window */}
          {infoWindow?.isOpen && (
            <InfoWindow
              position={infoWindow.position}
              onCloseClick={() => setInfoWindow(null)}
            >
              <div className="p-2 min-w-[250px]">
                <h3 className="font-bold text-lg mb-2">{infoWindow.content.device_id}</h3>
                
                <Badge 
                  className="mb-3 text-white"
                  style={{ backgroundColor: getModeColor(getDeviceMode(infoWindow.content)) }}
                >
                  {getModeLabel(getDeviceMode(infoWindow.content))}
                </Badge>

                {infoWindow.content.ownGpsValid && (
                  <div className="mb-3 p-2 bg-blue-50 rounded">
                    <p className="font-semibold text-sm text-blue-700">🔵 Own GPS</p>
                    <p className="text-xs text-gray-700">
                      {infoWindow.content.ownLat?.toFixed(6)}, {infoWindow.content.ownLon?.toFixed(6)}
                    </p>
                  </div>
                )}

                {infoWindow.content.peerValid && (
                  <div className="mb-3 p-2 bg-green-50 rounded">
                    <p className="font-semibold text-sm text-green-700">🟢 Peer GPS</p>
                    <p className="text-xs text-gray-700">
                      {infoWindow.content.peerLat?.toFixed(6)}, {infoWindow.content.peerLon?.toFixed(6)}
                    </p>
                    <p className="text-xs text-gray-600">
                      Dist: {infoWindow.content.peerDist?.toFixed(2)}m | ID: {infoWindow.content.peerId}
                    </p>
                  </div>
                )}

                <div className="text-xs text-gray-600">
                  <p><strong>Updated:</strong> {new Date(infoWindow.content.timestamp).toLocaleTimeString()}</p>
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
    </div>
  );
};

export default GPSMap;
