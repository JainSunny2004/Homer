import React, { useCallback, useMemo, useRef, useState } from "react";
import MapGL, {
  Marker,
  Popup,
  Source,
  Layer,
  NavigationControl,
} from "react-map-gl/mapbox";
import type { LayerProps, MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { GPSLocation, PolygonFence, WorkerAssignment } from "@/types/gps";
import { MAP_CONFIG } from "@/config/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isPointInPolygon,
  isWithinShift,
  getAltitudeBand,
  ALTITUDE_BAND_COLOR,
  ALTITUDE_BAND_LABEL,
} from "@/lib/geoUtils";
import {
  fencesToGeoJSON,
  fenceLabelPointsGeoJSON,
} from "@/lib/mapUtils";
import { DrawControl } from "@/components/map/DrawControl";
import type { DrawingMode } from "./FencePanel";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

// ─── Pin SVG path (same as original) ─────────────────────────────────────────
const PIN_PATH =
  "M12 0C7.31 0 3.5 3.81 3.5 8.5C3.5 14.88 12 24 12 24S20.5 14.88 20.5 8.5C20.5 3.81 16.69 0 12 0ZM12 11.5C10.34 11.5 9 10.16 9 8.5C9 6.84 10.34 5.5 12 5.5C13.66 5.5 15 6.84 15 8.5C15 10.16 13.66 11.5 12 11.5Z";

// ─── 3D altitude rendering helpers ───────────────────────────────────────────
//
// Visual pixel height gives the stem length in screen pixels.
// Scale = 10 px/m → 0 m = 0 px, 4 m = 40 px, 8 m = 80 px, 12 m = 120 px.
// Capped at 200 px so very tall structures don't overwhelm the viewport.

const VISUAL_PX_SCALE = 10;
const VISUAL_PX_MAX   = 200;

function getVisualPixelHeight(rawAlt: number | undefined): number {
  if (rawAlt == null) return 0;
  return Math.min(Math.max(0, rawAlt) * VISUAL_PX_SCALE, VISUAL_PX_MAX);
}

// Halo glow color per altitude band (semi-transparent, used with blur filter).
const BAND_HALO: Record<string, string> = {
  ground:      "rgba(34,  197, 94,  0.55)",
  level1:      "rgba(234, 179, 8,   0.55)",
  level2:      "rgba(249, 115, 22,  0.55)",
  level3plus:  "rgba(239, 68,  68,  0.55)",
  unknown:     "rgba(100, 116, 139, 0.30)",
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface ManagerMapProps {
  locations: GPSLocation[];
  fences: PolygonFence[];
  assignments: WorkerAssignment[];
  drawingMode: DrawingMode;
  onFenceComplete: (coords: { lat: number; lng: number }[]) => void;
  defaultZoom?: number;
  showOfflineDevices?: boolean;
  deviceTimeoutSeconds?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hasValidLocation = (loc: GPSLocation): boolean => {
  if (!loc) return false;
  if (loc.locationSource === "NONE") return false;
  if (loc.latitude === 0 && loc.longitude === 0) return false;
  return true;
};

type WorkerStatus = "compliant" | "violation" | "unassigned" | "no-signal";

function getWorkerStatus(
  deviceId: string,
  location: GPSLocation,
  fences: PolygonFence[],
  assignments: WorkerAssignment[],
): WorkerStatus {
  if (!hasValidLocation(location)) return "no-signal";
  const assignment = assignments.find((a) => a.workerId === deviceId);
  if (!assignment) return "unassigned";
  const fence = fences.find((f) => f.id === assignment.fenceId);
  if (!fence) return "unassigned";
  const withinShift = isWithinShift(new Date(), fence.shiftStart, fence.shiftEnd);
  const insideFence = isPointInPolygon(
    { lat: location.latitude, lng: location.longitude },
    fence.coordinates,
  );
  return withinShift && insideFence ? "compliant" : "violation";
}

function getStatusLabel(status: WorkerStatus): string {
  switch (status) {
    case "compliant":  return "Inside Task Area";
    case "violation":  return "Violation";
    case "unassigned": return "Unassigned";
    case "no-signal":  return "No Signal";
  }
}

function getStatusColor(status: WorkerStatus): string {
  switch (status) {
    case "compliant":  return "#84994F";
    case "violation":  return "#A72703";
    case "unassigned": return "#94a3b8";
    case "no-signal":  return "#64748b";
  }
}

// ─── Worker pin marker ────────────────────────────────────────────────────────

interface WorkerPinProps {
  color: string;
  band: string;
  floorLabel: string | null;
  visualHeight: number;
  onClick: () => void;
}

const WorkerPin = React.memo(({ color, band, floorLabel, visualHeight, onClick }: WorkerPinProps) => {
  // Subtle size growth: 1× at ground, 1.25× at 120 px stem, 1.4× max.
  const pinScale  = 1 + Math.min(visualHeight, VISUAL_PX_MAX) * 0.002;
  const pinW      = Math.round(28 * pinScale);
  const pinH      = Math.round(36 * pinScale);

  // Shadow spreads and darkens as the worker rises.
  const shadowBlur    = 3  + visualHeight * 0.06;
  const shadowOpacity = 0.38 + visualHeight * 0.002;
  const shadowOffsetY = 2  + visualHeight * 0.04;

  // Halo glow intensifies with height.
  const haloColor = BAND_HALO[band] ?? BAND_HALO.unknown;
  const haloBlur  = 6 + visualHeight * 0.12;
  const haloSize  = 10 + visualHeight * 0.1;

  // Ground-contact ellipse: wider and more opaque at ground; thin and dim when elevated.
  const dotW   = visualHeight > 0 ? Math.max(6, 14 - visualHeight * 0.04) : 10;
  const dotH   = visualHeight > 0 ? Math.max(2,  5 - visualHeight * 0.02) : 6;
  const dotOp  = visualHeight > 0 ? Math.max(0.12, 0.45 - visualHeight * 0.003) : 0.5;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={onClick}
    >
      {/* Pin head with halo + floor badge */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {/* Altitude halo glow — rendered behind the SVG */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: haloSize,
            height: haloSize,
            borderRadius: "50%",
            background: haloColor,
            filter: `blur(${haloBlur}px)`,
            pointerEvents: "none",
          }}
        />

        <svg
          width={pinW}
          height={pinH}
          viewBox="0 0 24 24"
          style={{
            filter: `drop-shadow(0 ${shadowOffsetY.toFixed(1)}px ${shadowBlur.toFixed(1)}px rgba(0,0,0,${shadowOpacity.toFixed(2)}))`,
            position: "relative",
            display: "block",
          }}
        >
          <path d={PIN_PATH} fill={color} stroke="#ffffff" strokeWidth="1" />
        </svg>

        {floorLabel !== null && (
          <div
            style={{
              position: "absolute",
              top: -6,
              right: -10,
              background: "#1e293b",
              color: "#ffffff",
              fontSize: 9,
              fontWeight: 700,
              borderRadius: 3,
              padding: "1px 4px",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
            }}
          >
            {floorLabel}
          </div>
        )}
      </div>

      {/* Vertical stem — only present when worker is above ground */}
      {visualHeight > 0 && (
        <div
          style={{
            width: 2,
            height: visualHeight,
            background: `linear-gradient(to bottom, ${color}dd 0%, ${color}44 100%)`,
            borderRadius: 1,
            flexShrink: 0,
          }}
        />
      )}

      {/* Ground-contact shadow dot */}
      <div
        style={{
          width: dotW,
          height: dotH,
          borderRadius: "50%",
          background: `rgba(0,0,0,${dotOp.toFixed(2)})`,
          flexShrink: 0,
        }}
      />
    </div>
  );
});

// ─── Layer definitions (outside component — no dynamic values) ────────────────

const fenceFillLayer: LayerProps = {
  id: "fences-fill",
  type: "fill",
  paint: {
    "fill-color": ["get", "color"],
    "fill-opacity": [
      "case",
      ["==", ["get", "isGreenCorridor"], true], 0.08,
      0.18,
    ],
  },
};

const fenceOutlineLayer: LayerProps = {
  id: "fences-outline",
  type: "line",
  filter: ["!=", ["get", "isGreenCorridor"], true],
  paint: {
    "line-color": ["get", "color"],
    "line-width": 2,
    "line-opacity": 1,
  },
};

const corridorOutlineLayer: LayerProps = {
  id: "fences-corridor-outline",
  type: "line",
  filter: ["==", ["get", "isGreenCorridor"], true],
  paint: {
    "line-color": ["get", "color"],
    "line-width": 2,
    "line-opacity": 0.7,
    "line-dasharray": [4, 3],
  },
};

const bleLineLayer: LayerProps = {
  id: "ble-lines",
  type: "line",
  paint: {
    "line-color": "#3b82f6",
    "line-width": 2,
    "line-opacity": 0.8,
    "line-dasharray": [4, 3],
  },
};

const bleLabelLayer: LayerProps = {
  id: "ble-labels",
  type: "symbol",
  layout: {
    "text-field": ["concat", ["to-string", ["round", ["get", "distance"]]], "m"],
    "text-size": 11,
    "text-font": ["Open Sans SemiBold", "Arial Unicode MS Bold"],
    "symbol-placement": "line-center",
    "text-allow-overlap": false,
  },
  paint: {
    "text-color": "#3b82f6",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
};

// ─── Worker marker (memoized with stable callback) ────────────────────────────

interface WorkerMarkerProps {
  deviceId: string;
  location: GPSLocation;
  color: string;
  band: string;
  floorLabel: string | null;
  onSelect: (deviceId: string, location: GPSLocation) => void;
}

const WorkerMarker = React.memo(({ deviceId, location, color, band, floorLabel, onSelect }: WorkerMarkerProps) => {
  const handleClick   = useCallback(() => onSelect(deviceId, location), [deviceId, location, onSelect]);
  const visualHeight  = getVisualPixelHeight(location.altitude);

  return (
    // z-index orders taller workers above shorter ones so stems don't obscure pins.
    <Marker
      longitude={location.longitude}
      latitude={location.latitude}
      anchor="bottom"
      style={{ zIndex: Math.floor(visualHeight) }}
    >
      <WorkerPin
        color={color}
        band={band}
        floorLabel={floorLabel}
        visualHeight={visualHeight}
        onClick={handleClick}
      />
    </Marker>
  );
});

// ─── BLE line GeoJSON ─────────────────────────────────────────────────────────

function buildBleLines(
  deviceMap: Map<string, GPSLocation>,
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  const seen = new Set<string>();

  deviceMap.forEach((loc, deviceId) => {
    if (!hasValidLocation(loc)) return;
    if (loc.locationSource !== "PEER" || !loc.pairId || loc.pairId <= 0) return;

    const peerEntry = Array.from(deviceMap.entries()).find(([peerId]) => {
      const m = peerId.match(/(\d+)$/);
      return m && parseInt(m[1]) === loc.pairId;
    });
    if (!peerEntry || !hasValidLocation(peerEntry[1])) return;

    const key = [deviceId, peerEntry[0]].sort().join("|");
    if (seen.has(key)) return;
    seen.add(key);

    features.push({
      type: "Feature",
      id: key,
      properties: { distance: loc.peerDistance || 0 },
      geometry: {
        type: "LineString",
        coordinates: [
          [loc.longitude, loc.latitude],
          [peerEntry[1].longitude, peerEntry[1].latitude],
        ],
      },
    });
  });

  return { type: "FeatureCollection", features };
}

// ─── Popup content ────────────────────────────────────────────────────────────

interface PopupState {
  longitude: number;
  latitude: number;
  deviceId: string;
  location: GPSLocation;
  status: WorkerStatus;
}

const WorkerPopup = ({
  popup,
  onClose,
}: {
  popup: PopupState;
  onClose: () => void;
}) => {
  const { location } = popup;
  const band = getAltitudeBand(location.altitude);

  return (
    <Popup
      longitude={popup.longitude}
      latitude={popup.latitude}
      anchor="bottom"
      onClose={onClose}
      closeButton
      closeOnClick={false}
      maxWidth="240px"
      offset={[0, -10] as [number, number]}
    >
      <div style={{ fontFamily: "Lexend, sans-serif", minWidth: 200 }}>
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #84994F 0%, #6b7a3f 100%)",
            borderRadius: "6px 6px 0 0",
            padding: "8px 12px",
            marginBottom: 0,
          }}
        >
          <p style={{ fontWeight: 600, fontSize: 13, color: "#ffffff", margin: 0 }}>
            {popup.deviceId}
          </p>
        </div>

        {/* Body */}
        <div style={{ background: "#faf8f0", padding: "8px 12px", borderRadius: "0 0 6px 6px" }}>
          {/* Status */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#5a6b3a" }}>Status</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                background: getStatusColor(popup.status),
                color: "#ffffff",
                padding: "1px 7px",
                borderRadius: 20,
              }}
            >
              {getStatusLabel(popup.status)}
            </span>
          </div>

          <div style={{ borderTop: "1px solid #e5e2d3", margin: "6px 0" }} />

          {/* Location source */}
          {location.locationSource && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: "#5a6b3a" }}>Source</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  background:
                    location.locationSource === "GPS"  ? "#22c55e" :
                    location.locationSource === "PEER" ? "#3b82f6" : "#ef4444",
                  color: "#ffffff",
                  padding: "1px 7px",
                  borderRadius: 20,
                }}
              >
                {location.locationSource === "PEER" ? "BLE Peer" : location.locationSource}
              </span>
            </div>
          )}

          {/* Pair info */}
          {location.locationSource === "PEER" && location.pairId && location.pairId > 0 && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: "#5a6b3a", display: "block" }}>Paired Device</span>
              <span style={{ fontSize: 11, color: "#3d4a28" }}>
                ID #{location.pairId}
                {location.peerDistance ? ` · ${location.peerDistance.toFixed(1)}m away` : ""}
              </span>
            </div>
          )}

          <div style={{ borderTop: "1px solid #e5e2d3", margin: "6px 0" }} />

          {/* Position */}
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#5a6b3a", display: "block" }}>Position</span>
            <span style={{ fontSize: 11, color: "#3d4a28" }}>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </span>
          </div>

          {/* Altitude */}
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#5a6b3a", display: "block" }}>Altitude</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                background: ALTITUDE_BAND_COLOR[band],
                color: "#ffffff",
                padding: "1px 7px",
                borderRadius: 20,
                display: "inline-block",
              }}
            >
              {location.altitude !== undefined
                ? `${location.altitude.toFixed(1)} m — ${ALTITUDE_BAND_LABEL[band]}`
                : ALTITUDE_BAND_LABEL["unknown"]}
            </span>
          </div>

          {/* Last update */}
          <div>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#5a6b3a", display: "block" }}>Last Update</span>
            <span style={{ fontSize: 11, color: "#3d4a28" }}>
              {new Date(location.timestamp).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </Popup>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const ManagerMap = ({
  locations,
  fences,
  assignments,
  drawingMode,
  onFenceComplete,
  defaultZoom = 16,
  showOfflineDevices = true,
  deviceTimeoutSeconds = 60,
}: ManagerMapProps) => {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [popup, setPopup] = useState<PopupState | null>(null);

  // Deduplicate to latest location per device.
  const deviceLocations = useMemo(() => {
    const map = new Map<string, GPSLocation>();
    locations.forEach((loc) => {
      const existing = map.get(loc.device_id);
      if (!existing || new Date(loc.timestamp) > new Date(existing.timestamp)) {
        map.set(loc.device_id, loc);
      }
    });
    return map;
  }, [locations]);

  // Filter offline if needed.
  const visibleDeviceLocations = useMemo(() => {
    if (showOfflineDevices) return deviceLocations;
    const now = Date.now();
    return new Map(
      Array.from(deviceLocations.entries()).filter(([, loc]) => {
        return now - new Date(loc.timestamp).getTime() < deviceTimeoutSeconds * 1000;
      }),
    );
  }, [deviceLocations, showOfflineDevices, deviceTimeoutSeconds]);

  // GeoJSON for fences.
  const fencesGeoJSON = useMemo(() => fencesToGeoJSON(fences), [fences]);
  const fenceLabelsGeoJSON = useMemo(() => fenceLabelPointsGeoJSON(fences), [fences]);

  // GeoJSON for BLE connection lines.
  const bleLines = useMemo(() => buildBleLines(visibleDeviceLocations), [visibleDeviceLocations]);

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (!map.getSource("mapbox-dem")) {
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
      });
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
    }
    setMapLoaded(true);
  }, []);

  const handleMarkerClick = useCallback(
    (deviceId: string, location: GPSLocation) => {
      setPopup({
        longitude: location.longitude,
        latitude: location.latitude,
        deviceId,
        location,
        status: getWorkerStatus(deviceId, location, fences, assignments),
      });
    },
    [fences, assignments],
  );

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-full bg-muted">
        <div className="text-center">
          <p className="text-destructive font-medium">Mapbox token missing</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add VITE_MAPBOX_ACCESS_TOKEN to your .env file
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <MapGL
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: MAP_CONFIG.defaultCenter.lng,
          latitude: MAP_CONFIG.defaultCenter.lat,
          zoom: defaultZoom,
          pitch: 30,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        onLoad={handleLoad}
        reuseMaps
        cooperativeGestures
      >
        <NavigationControl position="top-right" visualizePitch />

        {/* Drawing tool */}
        <DrawControl drawingMode={drawingMode} onFenceComplete={onFenceComplete} />

        {mapLoaded && (
          <>
            {/* Fence fills and outlines */}
            <Source id="fences" type="geojson" data={fencesGeoJSON}>
              <Layer {...fenceFillLayer} />
              <Layer {...fenceOutlineLayer} />
              <Layer {...corridorOutlineLayer} />
            </Source>

            {/* BLE connection lines + distance labels */}
            <Source id="ble-lines" type="geojson" data={bleLines}>
              <Layer {...bleLineLayer} />
              <Layer {...bleLabelLayer} />
            </Source>
          </>
        )}

        {/* Fence labels — rendered as DOM markers for simplicity */}
        {fenceLabelsGeoJSON.features.map((f) => {
          const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
          return (
            <Marker key={`label-${f.id}`} longitude={lng} latitude={lat} anchor="center">
              <div
                style={{
                  color: "#ffffff",
                  fontSize: 11,
                  fontWeight: 700,
                  textShadow: "0 1px 3px rgba(0,0,0,0.7), 0 0 6px rgba(0,0,0,0.5)",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {f.properties?.name}
              </div>
            </Marker>
          );
        })}

        {/* Worker markers — sorted by ascending visual height so taller workers
            are rendered last (on top) and their pins remain clickable. */}
        {Array.from(visibleDeviceLocations.entries())
          .filter(([, loc]) => hasValidLocation(loc))
          .sort(([, a], [, b]) => (a.altitude ?? 0) - (b.altitude ?? 0))
          .map(([deviceId, location]) => {
            const band  = getAltitudeBand(location.altitude);
            const color = ALTITUDE_BAND_COLOR[band];
            const floor =
              location.altitude !== undefined
                ? `F${Math.floor(Math.max(0, location.altitude) / 4)}`
                : null;

            return (
              <WorkerMarker
                key={deviceId}
                deviceId={deviceId}
                location={location}
                color={color}
                band={band}
                floorLabel={floor}
                onSelect={handleMarkerClick}
              />
            );
          })}

        {/* Worker popup */}
        {popup && <WorkerPopup popup={popup} onClose={() => setPopup(null)} />}
      </MapGL>

      {/* Drawing mode indicator — same as original */}
      {drawingMode !== "none" && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            padding: "6px 18px",
            borderRadius: 9999,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            pointerEvents: "none",
          }}
        >
          {drawingMode === "polygon"
            ? "Click to add points · Double-click to finish"
            : drawingMode === "circle"
            ? "Click to add points · Double-click to finish"
            : "Click to add corners · Double-click to finish"}
        </div>
      )}

      {!mapLoaded && (
        <div className="absolute inset-0">
          <Skeleton className="w-full h-full" />
        </div>
      )}
    </div>
  );
};
