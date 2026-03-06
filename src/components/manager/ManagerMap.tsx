import { useCallback, useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Polygon,
  Polyline,
  DrawingManager,
  InfoWindow,
} from "@react-google-maps/api";
import { GPSLocation, PolygonFence, WorkerAssignment } from "@/types/gps";
import { MAP_CONFIG } from "@/config/api";
import { Skeleton } from "@/components/ui/skeleton";
import { isPointInPolygon, isWithinShift } from "@/lib/geoUtils";
import { DrawingMode } from "./FencePanel";
import React from "react";

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

const containerStyle = {
  width: "100%",
  height: "100%",
};

const PIN_PATH =
  "M12 0C7.31 0 3.5 3.81 3.5 8.5C3.5 14.88 12 24 12 24S20.5 14.88 20.5 8.5C20.5 3.81 16.69 0 12 0ZM12 11.5C10.34 11.5 9 10.16 9 8.5C9 6.84 10.34 5.5 12 5.5C13.66 5.5 15 6.84 15 8.5C15 10.16 13.66 11.5 12 11.5Z";

const libraries: "drawing"[] = ["drawing"];

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
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [infoWindow, setInfoWindow] = useState<{
    position: google.maps.LatLngLiteral;
    deviceId: string;
    location: GPSLocation;
    status: "compliant" | "violation" | "unassigned";
  } | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  // Get latest location per device
  const deviceLocations = new Map<string, GPSLocation>();
  locations.forEach((loc) => {
    const existing = deviceLocations.get(loc.device_id);
    if (!existing || new Date(loc.timestamp) > new Date(existing.timestamp)) {
      deviceLocations.set(loc.device_id, loc);
    }
  });

  // Filter offline devices from map if showOfflineDevices is false
  const now = Date.now();
  const visibleDeviceLocations = showOfflineDevices
    ? deviceLocations
    : new Map(
        Array.from(deviceLocations.entries()).filter(([, loc]) => {
          const lastSeen = new Date(loc.timestamp).getTime();
          return now - lastSeen < deviceTimeoutSeconds * 1000;
        }),
      );

  const getWorkerStatus = (
    deviceId: string,
    location: GPSLocation,
  ): "compliant" | "violation" | "unassigned" => {
    const assignment = assignments.find((a) => a.workerId === deviceId);
    if (!assignment) return "unassigned";

    const fence = fences.find((f) => f.id === assignment.fenceId);
    if (!fence) return "unassigned";

    const now = new Date();
    const withinShift = isWithinShift(now, fence.shiftStart, fence.shiftEnd);
    const insideFence = isPointInPolygon(
      { lat: location.latitude, lng: location.longitude },
      fence.coordinates,
    );

    if (withinShift && insideFence) {
      return "compliant";
    }
    return "violation";
  };

  const getMarkerColor = (deviceId: string): string => {
    const assignment = assignments.find((a) => a.workerId === deviceId);
    if (!assignment) return "#94a3b8";

    const fence = fences.find((f) => f.id === assignment.fenceId);
    return fence?.color || "#94a3b8";
  };

  const getStatusLabel = (
    status: "compliant" | "violation" | "unassigned",
  ): string => {
    switch (status) {
      case "compliant":
        return "Inside Task Area";
      case "violation":
        return "Violation";
      case "unassigned":
        return "Unassigned";
    }
  };

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const onPolygonComplete = (polygon: google.maps.Polygon) => {
    const path = polygon.getPath();
    const coords: { lat: number; lng: number }[] = [];

    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      coords.push({ lat: point.lat(), lng: point.lng() });
    }

    polygon.setMap(null);
    onFenceComplete(coords);
  };

  const onRectangleComplete = (rectangle: google.maps.Rectangle) => {
    const bounds = rectangle.getBounds();
    if (!bounds) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    const coords: { lat: number; lng: number }[] = [
      { lat: ne.lat(), lng: sw.lng() }, // NW
      { lat: ne.lat(), lng: ne.lng() }, // NE
      { lat: sw.lat(), lng: ne.lng() }, // SE
      { lat: sw.lat(), lng: sw.lng() }, // SW
    ];

    rectangle.setMap(null);
    onFenceComplete(coords);
  };

  const onCircleComplete = (circle: google.maps.Circle) => {
    const center = circle.getCenter();
    const radius = circle.getRadius();
    if (!center) return;

    const numPoints = 32;
    const coords: { lat: number; lng: number }[] = [];

    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      const latOffset = (radius / 111320) * Math.cos(angle);
      const lngOffset =
        (radius / (111320 * Math.cos((center.lat() * Math.PI) / 180))) *
        Math.sin(angle);

      coords.push({
        lat: center.lat() + latOffset,
        lng: center.lng() + lngOffset,
      });
    }

    circle.setMap(null);
    onFenceComplete(coords);
  };

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-muted">
        <div className="text-center">
          <p className="text-destructive font-medium">
            Failed to load Google Maps
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Please check your API key configuration
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return <Skeleton className="w-full h-full" />;
  }

  const getDrawingMode = () => {
    if (drawingMode === "polygon") {
      return google.maps.drawing.OverlayType.POLYGON;
    }
    if (drawingMode === "rectangle") {
      return google.maps.drawing.OverlayType.RECTANGLE;
    }
    if (drawingMode === "circle") {
      return google.maps.drawing.OverlayType.CIRCLE;
    }
    return null;
  };

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={MAP_CONFIG.defaultCenter}
      zoom={defaultZoom}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={{
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      }}
    >
      {/* Drawing Manager */}
      {drawingMode !== "none" && (
        <DrawingManager
          onPolygonComplete={onPolygonComplete}
          onRectangleComplete={onRectangleComplete}
          onCircleComplete={onCircleComplete}
          options={{
            drawingMode: getDrawingMode(),
            drawingControl: false,
            polygonOptions: {
              fillColor: "#3b82f6",
              fillOpacity: 0.3,
              strokeColor: "#3b82f6",
              strokeWeight: 2,
              editable: true,
            },
            rectangleOptions: {
              fillColor: "#3b82f6",
              fillOpacity: 0.3,
              strokeColor: "#3b82f6",
              strokeWeight: 2,
              editable: true,
              draggable: true,
            },
            circleOptions: {
              fillColor: "#3b82f6",
              fillOpacity: 0.3,
              strokeColor: "#3b82f6",
              strokeWeight: 2,
              editable: true,
              draggable: true,
            },
          }}
        />
      )}

      {/* Drawing mode indicator */}
      {drawingMode !== "none" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium shadow-lg z-10">
          {drawingMode === "polygon"
            ? "Click to draw polygon points"
            : drawingMode === "circle"
              ? "Click and drag to create circle"
              : "Click and drag to draw rectangle"}
        </div>
      )}

      {/* Fence Polygons */}
      {fences.map((fence) => {
        const lats = fence.coordinates.map((c) => c.lat);
        const lngs = fence.coordinates.map((c) => c.lng);
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

        return (
          <React.Fragment key={fence.id}>
            <Polygon
              paths={fence.coordinates}
              options={{
                strokeColor: fence.isGreenCorridor
                  ? "#86efac"
                  : fence.color || "#22c55e",
                strokeOpacity: 1,
                strokeWeight: 2,
                fillColor: fence.isGreenCorridor
                  ? "#86efac"
                  : fence.color || "#22c55e",
                fillOpacity: fence.isGreenCorridor ? 0.08 : 0.18,
                zIndex: fence.isGreenCorridor ? 1 : 2,
              }}
            />
            <Marker
              position={{ lat: centerLat, lng: centerLng }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 0,
                labelOrigin: new google.maps.Point(0, 0),
              }}
              label={{
                text: fence.name,
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: "bold",
                className: "fence-label",
              }}
              zIndex={10}
            />
          </React.Fragment>
        );
      })}

      {/* Worker Markers — uses visibleDeviceLocations to respect showOfflineDevices */}
      {Array.from(visibleDeviceLocations.entries()).map(([deviceId, location]) => {
        const status = getWorkerStatus(deviceId, location);
        return (
          <Marker
            key={deviceId}
            position={{ lat: location.latitude, lng: location.longitude }}
            title={deviceId}
            icon={{
              path: PIN_PATH,
              scale: 1.5,
              fillColor: getMarkerColor(deviceId),
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 1,
              anchor: new google.maps.Point(12, 24),
            }}
            onClick={() =>
              setInfoWindow({
                position: { lat: location.latitude, lng: location.longitude },
                deviceId,
                location,
                status,
              })
            }
          />
        );
      })}

      {/* BLE Connection Lines — uses visibleDeviceLocations */}
      {(() => {
        const blePairs: {
          from: GPSLocation;
          to: GPSLocation;
          distance: number;
        }[] = [];
        const processedPairs = new Set<string>();

        visibleDeviceLocations.forEach((loc, deviceId) => {
          if (loc.locationSource === "PEER" && loc.pairId && loc.pairId > 0) {
            const peerEntry = Array.from(visibleDeviceLocations.entries()).find(
              ([peerId]) => {
                const numMatch = peerId.match(/(\d+)$/);
                return numMatch && parseInt(numMatch[1]) === loc.pairId;
              },
            );

            if (peerEntry) {
              const pairKey = [deviceId, peerEntry[0]].sort().join("|");
              if (!processedPairs.has(pairKey)) {
                processedPairs.add(pairKey);
                blePairs.push({
                  from: loc,
                  to: peerEntry[1],
                  distance: loc.peerDistance || 0,
                });
              }
            }
          }
        });

        return blePairs.map((pair, idx) => {
          const midLat = (pair.from.latitude + pair.to.latitude) / 2;
          const midLng = (pair.from.longitude + pair.to.longitude) / 2;

          return (
            <span key={`ble-pair-${idx}`}>
              <Polyline
                path={[
                  { lat: pair.from.latitude, lng: pair.from.longitude },
                  { lat: pair.to.latitude, lng: pair.to.longitude },
                ]}
                options={{
                  strokeColor: "#3b82f6",
                  strokeOpacity: 0.8,
                  strokeWeight: 2,
                  icons: [
                    {
                      icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
                      offset: "0",
                      repeat: "12px",
                    },
                  ],
                }}
              />
              {pair.distance > 0 && (
                <Marker
                  position={{ lat: midLat, lng: midLng }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 0,
                  }}
                  label={{
                    text: `${pair.distance.toFixed(1)}m`,
                    color: "#3b82f6",
                    fontSize: "11px",
                    fontWeight: "bold",
                    className: "ble-distance-label",
                  }}
                />
              )}
            </span>
          );
        });
      })()}

      {/* Info Window */}
      {infoWindow && (
        <InfoWindow
          position={infoWindow.position}
          onCloseClick={() => setInfoWindow(null)}
        >
          <div className="min-w-[200px] font-[Lexend,sans-serif]">
            <div
              className="px-3 py-2 rounded-t-md"
              style={{
                background: "linear-gradient(135deg, #84994F 0%, #6b7a3f 100%)",
              }}
            >
              <h3 className="font-semibold text-sm text-white">
                {infoWindow.deviceId}
              </h3>
            </div>

            <div
              className="px-3 py-2 space-y-2 rounded-b-md"
              style={{ backgroundColor: "#faf8f0" }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-medium"
                  style={{ color: "#5a6b3a" }}
                >
                  Status
                </span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor:
                      infoWindow.status === "compliant"
                        ? "#84994F"
                        : infoWindow.status === "violation"
                          ? "#A72703"
                          : "#94a3b8",
                    color: "#ffffff",
                  }}
                >
                  {getStatusLabel(infoWindow.status)}
                </span>
              </div>

              <div className="border-t" style={{ borderColor: "#e5e2d3" }} />

              {infoWindow.location.locationSource && (
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#5a6b3a" }}
                  >
                    Source
                  </span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor:
                        infoWindow.location.locationSource === "GPS"
                          ? "#22c55e"
                          : infoWindow.location.locationSource === "PEER"
                            ? "#3b82f6"
                            : "#ef4444",
                      color: "#ffffff",
                    }}
                  >
                    {infoWindow.location.locationSource === "PEER"
                      ? "BLE Peer"
                      : infoWindow.location.locationSource}
                  </span>
                </div>
              )}

              {infoWindow.location.locationSource === "PEER" &&
                infoWindow.location.pairId &&
                infoWindow.location.pairId > 0 && (
                  <div>
                    <span
                      className="text-xs font-medium block"
                      style={{ color: "#5a6b3a" }}
                    >
                      Paired Device
                    </span>
                    <span className="text-xs" style={{ color: "#3d4a28" }}>
                      ID #{infoWindow.location.pairId}
                      {infoWindow.location.peerDistance
                        ? ` · ${infoWindow.location.peerDistance.toFixed(1)}m away`
                        : ""}
                    </span>
                  </div>
                )}

              <div className="border-t" style={{ borderColor: "#e5e2d3" }} />

              <div>
                <span
                  className="text-xs font-medium block"
                  style={{ color: "#5a6b3a" }}
                >
                  Position
                </span>
                <span className="text-xs" style={{ color: "#3d4a28" }}>
                  {infoWindow.location.latitude.toFixed(6)},{" "}
                  {infoWindow.location.longitude.toFixed(6)}
                </span>
              </div>

              <div>
                <span
                  className="text-xs font-medium block"
                  style={{ color: "#5a6b3a" }}
                >
                  Last Update
                </span>
                <span className="text-xs" style={{ color: "#3d4a28" }}>
                  {new Date(infoWindow.location.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
};
