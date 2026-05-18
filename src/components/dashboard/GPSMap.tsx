import React, { useState, useCallback, useMemo, useRef } from "react";
import Map, { Marker, Popup, Source, Layer, NavigationControl } from "react-map-gl/mapbox";
import type { LayerProps, MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { GPSLocation } from "@/types/gps";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

interface GPSMapProps {
  locations: GPSLocation[];
  height?: string;
}

interface PopupState {
  longitude: number;
  latitude: number;
  content: GPSLocation;
}

// ─── Device mode helpers ──────────────────────────────────────────────────────

function getDeviceMode(loc: GPSLocation): "cooperative" | "gps" | "peer" | "offline" {
  if (loc.ownGpsValid && loc.peerValid) return "cooperative";
  if (loc.ownGpsValid) return "gps";
  if (loc.peerValid) return "peer";
  return "offline";
}

function getModeColor(mode: ReturnType<typeof getDeviceMode>): string {
  switch (mode) {
    case "cooperative": return "#10b981";
    case "gps":         return "#3b82f6";
    case "peer":        return "#f59e0b";
    case "offline":     return "#ef4444";
  }
}

function getModeLabel(mode: ReturnType<typeof getDeviceMode>): string {
  switch (mode) {
    case "cooperative": return "Cooperative Mode";
    case "gps":         return "GPS Mode";
    case "peer":        return "Peer Mode";
    case "offline":     return "Offline";
  }
}

// ─── BLE connection lines ─────────────────────────────────────────────────────

function buildBleLineGeoJSON(locations: GPSLocation[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];

  locations.forEach((loc) => {
    if (
      loc.ownGpsValid && loc.peerValid &&
      loc.ownLat && loc.ownLon && loc.ownLat !== 0 && loc.ownLon !== 0 &&
      loc.peerLat && loc.peerLon && loc.peerLat !== 0 && loc.peerLon !== 0
    ) {
      features.push({
        type: "Feature",
        id: `ble-${loc.device_id}`,
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [loc.ownLon, loc.ownLat],
            [loc.peerLon, loc.peerLat],
          ],
        },
      });
    }
  });

  return { type: "FeatureCollection", features };
}

// ─── Marker component ─────────────────────────────────────────────────────────

interface DeviceMarkerProps {
  label: string;
  bgColor: string;
  borderColor: string;
  badgeColor: string;
  onClick: () => void;
}

const DeviceMarker = React.memo(({ label, bgColor, borderColor, badgeColor, onClick }: DeviceMarkerProps) => (
  <div
    onClick={onClick}
    style={{ cursor: "pointer", position: "relative" }}
  >
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: bgColor,
        border: `4px solid ${borderColor}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        fontSize: 13,
        fontWeight: "bold",
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
      }}
    >
      {label}
    </div>
    <div
      style={{
        position: "absolute",
        top: -2,
        right: -2,
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: badgeColor,
        border: "2px solid #ffffff",
      }}
    />
  </div>
));

// ─── Main component ───────────────────────────────────────────────────────────

const GPSMap: React.FC<GPSMapProps> = ({ locations, height = "600px" }) => {
  const mapRef = useRef<MapRef>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);

  const initialCenter = useMemo(() => {
    const valid = locations.filter(
      (l) => (l.ownLat && l.ownLat !== 0) || (l.latitude && l.latitude !== 0),
    );
    if (!valid.length) return { latitude: 28.545, longitude: 77.1926 };
    const lat = valid.reduce((s, l) => s + (l.ownLat || l.latitude || 0), 0) / valid.length;
    const lng = valid.reduce((s, l) => s + (l.ownLon || l.longitude || 0), 0) / valid.length;
    return { latitude: lat, longitude: lng };
  }, []); // intentionally stable on mount

  const bleLines = useMemo(() => buildBleLineGeoJSON(locations), [locations]);

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || map.getSource("mapbox-dem")) return;
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
    });
    map.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });
  }, []);

  if (!MAPBOX_TOKEN) {
    return (
      <Card className="p-8 text-center">
        <p className="text-red-500 font-semibold">Mapbox token missing</p>
        <p className="text-sm text-gray-600 mt-2">
          Add VITE_MAPBOX_ACCESS_TOKEN to your .env file
        </p>
      </Card>
    );
  }

  const bleLinesLayer: LayerProps = {
    id: "ble-lines",
    type: "line",
    paint: {
      "line-color": "#10b981",
      "line-width": 2,
      "line-opacity": 0.6,
      "line-dasharray": [2, 2],
    },
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Legend */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 10,
          background: "#ffffff",
          borderRadius: 8,
          boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
          padding: "12px 14px",
          minWidth: 170,
        }}
      >
        <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Device Status</p>
        {(["cooperative", "gps", "peer", "offline"] as const).map((mode) => (
          <div key={mode} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: getModeColor(mode), flexShrink: 0 }} />
            <span style={{ fontSize: 12 }}>{getModeLabel(mode)}</span>
          </div>
        ))}
      </div>

      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ ...initialCenter, zoom: 15, pitch: 30 }}
        style={{ width: "100%", height }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        onLoad={handleLoad}
        reuseMaps
        cooperativeGestures
      >
        <NavigationControl position="top-left" visualizePitch />

        {/* BLE connection lines */}
        <Source id="ble-lines" type="geojson" data={bleLines}>
          <Layer {...bleLinesLayer} />
        </Source>

        {/* Device markers */}
        {locations.map((location) => {
          const mode = getDeviceMode(location);
          const modeColor = getModeColor(mode);
          const numLabel = location.device_id.match(/\d+/)?.[0] || "?";

          return (
            <React.Fragment key={`${location.device_id}-${location.timestamp}`}>
              {/* Own GPS marker */}
              {location.ownGpsValid && location.ownLat && location.ownLon &&
               location.ownLat !== 0 && location.ownLon !== 0 && (
                <Marker
                  longitude={location.ownLon}
                  latitude={location.ownLat}
                  anchor="center"
                >
                  <DeviceMarker
                    label={numLabel}
                    bgColor={modeColor}
                    borderColor="#3b82f6"
                    badgeColor="#3b82f6"
                    onClick={() =>
                      setPopup({ longitude: location.ownLon!, latitude: location.ownLat!, content: location })
                    }
                  />
                </Marker>
              )}

              {/* Peer GPS marker */}
              {location.peerValid && location.peerLat && location.peerLon &&
               location.peerLat !== 0 && location.peerLon !== 0 && (
                <Marker
                  longitude={location.peerLon}
                  latitude={location.peerLat}
                  anchor="center"
                >
                  <DeviceMarker
                    label={`P${location.peerId || "?"}`}
                    bgColor="#10b981"
                    borderColor="#10b981"
                    badgeColor="#10b981"
                    onClick={() =>
                      setPopup({ longitude: location.peerLon!, latitude: location.peerLat!, content: location })
                    }
                  />
                </Marker>
              )}

              {/* Fallback: legacy lat/lng marker */}
              {!location.ownGpsValid && !location.peerValid &&
               location.latitude && location.longitude &&
               location.latitude !== 0 && location.longitude !== 0 && (
                <Marker
                  longitude={location.longitude}
                  latitude={location.latitude}
                  anchor="center"
                >
                  <DeviceMarker
                    label={numLabel}
                    bgColor={modeColor}
                    borderColor={modeColor}
                    badgeColor={modeColor}
                    onClick={() =>
                      setPopup({ longitude: location.longitude, latitude: location.latitude, content: location })
                    }
                  />
                </Marker>
              )}
            </React.Fragment>
          );
        })}

        {/* Popup */}
        {popup && (
          <Popup
            longitude={popup.longitude}
            latitude={popup.latitude}
            anchor="bottom"
            onClose={() => setPopup(null)}
            closeButton
            closeOnClick={false}
            maxWidth="280px"
          >
            <div style={{ padding: "4px 2px", minWidth: 230 }}>
              <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                {popup.content.device_id}
              </h3>
              <Badge style={{ backgroundColor: getModeColor(getDeviceMode(popup.content)), color: "#fff", marginBottom: 10 }}>
                {getModeLabel(getDeviceMode(popup.content))}
              </Badge>

              {popup.content.ownGpsValid && (
                <div style={{ background: "#eff6ff", borderRadius: 6, padding: "6px 8px", marginBottom: 6 }}>
                  <p style={{ fontWeight: 600, fontSize: 12, color: "#1d4ed8" }}>🔵 Own GPS</p>
                  <p style={{ fontSize: 11, color: "#374151" }}>
                    {popup.content.ownLat?.toFixed(6)}, {popup.content.ownLon?.toFixed(6)}
                  </p>
                </div>
              )}

              {popup.content.peerValid && (
                <div style={{ background: "#f0fdf4", borderRadius: 6, padding: "6px 8px", marginBottom: 6 }}>
                  <p style={{ fontWeight: 600, fontSize: 12, color: "#15803d" }}>🟢 Peer GPS</p>
                  <p style={{ fontSize: 11, color: "#374151" }}>
                    {popup.content.peerLat?.toFixed(6)}, {popup.content.peerLon?.toFixed(6)}
                  </p>
                  <p style={{ fontSize: 11, color: "#6b7280" }}>
                    Dist: {popup.content.peerDist?.toFixed(2)}m · ID: {popup.content.peerId}
                  </p>
                </div>
              )}

              <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                <strong>Updated:</strong>{" "}
                {new Date(popup.content.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
};

export default GPSMap;
