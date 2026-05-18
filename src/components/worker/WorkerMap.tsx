import { useCallback, useMemo, useRef, useState } from "react";
import Map, { Marker, Source, Layer, NavigationControl } from "react-map-gl/mapbox";
import type { LayerProps, MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { GPSLocation, PolygonFence } from "@/types/gps";
import { MAP_CONFIG } from "@/config/api";
import { Skeleton } from "@/components/ui/skeleton";
import { getPolygonCenter } from "@/lib/geoUtils";
import { fenceToGeoJSON } from "@/lib/mapUtils";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

interface WorkerMapProps {
  workerLocation: GPSLocation | null;
  assignedFence: PolygonFence | null;
  isInsideFence: boolean;
}

export const WorkerMap = ({ workerLocation, assignedFence, isInsideFence }: WorkerMapProps) => {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const center = useMemo(() => {
    if (assignedFence) return getPolygonCenter(assignedFence.coordinates);
    if (workerLocation) return { lat: workerLocation.latitude, lng: workerLocation.longitude };
    return MAP_CONFIG.defaultCenter;
  }, [assignedFence, workerLocation]);

  const fenceGeoJSON = useMemo(
    () => (assignedFence ? fenceToGeoJSON(assignedFence) : null),
    [assignedFence],
  );

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (!map.getSource("mapbox-dem")) {
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
      });
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });
    }
    setMapLoaded(true);
  }, []);

  const fenceFillLayer = useMemo<LayerProps>(
    () => ({
      id: "fence-fill",
      type: "fill",
      paint: {
        "fill-color": assignedFence?.color || "#22c55e",
        "fill-opacity": 0.2,
      },
    }),
    [assignedFence?.color],
  );

  const fenceOutlineLayer = useMemo<LayerProps>(
    () => ({
      id: "fence-outline",
      type: "line",
      paint: {
        "line-color": assignedFence?.color || "#22c55e",
        "line-width": 2,
        "line-opacity": 0.8,
      },
    }),
    [assignedFence?.color],
  );

  const markerColor = isInsideFence ? "#22c55e" : "#ef4444";

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
    <div style={{ width: "100%", height: "100%" }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: center.lng,
          latitude: center.lat,
          zoom: 17,
          pitch: 30,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        onLoad={handleLoad}
        reuseMaps
        cooperativeGestures
      >
        <NavigationControl position="top-right" visualizePitch />

        {/* Assigned fence polygon */}
        {fenceGeoJSON && mapLoaded && (
          <Source id="assigned-fence" type="geojson" data={fenceGeoJSON}>
            <Layer {...fenceFillLayer} />
            <Layer {...fenceOutlineLayer} />
          </Source>
        )}

        {/* Worker position marker */}
        {workerLocation && (
          <Marker
            longitude={workerLocation.longitude}
            latitude={workerLocation.latitude}
            anchor="center"
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: markerColor,
                border: "3px solid #ffffff",
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              }}
            />
          </Marker>
        )}
      </Map>

      {!mapLoaded && (
        <div className="absolute inset-0">
          <Skeleton className="w-full h-full" />
        </div>
      )}
    </div>
  );
};
