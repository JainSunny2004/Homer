import { useEffect, useRef, useCallback } from "react";
import { useControl } from "react-map-gl/mapbox";
import type { IControl, Map as MapboxMap } from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import type { DrawingMode } from "@/components/manager/FencePanel";
import { geoJSONRingToFenceCoords } from "@/lib/mapUtils";

interface DrawControlProps {
  drawingMode: DrawingMode;
  onFenceComplete: (coords: { lat: number; lng: number }[]) => void;
}

const DRAW_STYLES = [
  {
    id: "gl-draw-polygon-fill-active",
    type: "fill",
    filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    paint: {
      "fill-color": "#3b82f6",
      "fill-outline-color": "#3b82f6",
      "fill-opacity": 0.2,
    },
  },
  {
    id: "gl-draw-polygon-stroke-active",
    type: "line",
    filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#3b82f6", "line-width": 2 },
  },
  {
    id: "gl-draw-polygon-and-line-vertex-active",
    type: "circle",
    filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
    paint: {
      "circle-radius": 5,
      "circle-color": "#ffffff",
      "circle-stroke-color": "#3b82f6",
      "circle-stroke-width": 2,
    },
  },
  {
    id: "gl-draw-polygon-midpoint",
    type: "circle",
    filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]],
    paint: {
      "circle-radius": 4,
      "circle-color": "#3b82f6",
    },
  },
];

/**
 * Wraps @mapbox/mapbox-gl-draw for use inside a react-map-gl <Map>.
 * Must be rendered as a direct child of <Map> (no MapProvider needed).
 *
 * Uses useControl() so the draw instance is registered via react-map-gl's
 * control lifecycle — this is the correct integration path when there is
 * no <MapProvider> ancestor.
 */
export function DrawControl({ drawingMode, onFenceComplete }: DrawControlProps) {
  const onFenceCompleteRef = useRef(onFenceComplete);
  onFenceCompleteRef.current = onFenceComplete;

  // Stable event handler — inner ref keeps it up to date without recreating
  // the listener on every render.
  const innerHandlerRef = useRef<(e: { features: GeoJSON.Feature[] }) => void>(() => {});

  const stableHandler = useCallback((e: { features: GeoJSON.Feature[] }) => {
    innerHandlerRef.current(e);
  }, []);

  const draw = useControl<MapboxDraw>(
    // onCreate — called once when the map is ready
    () =>
      new MapboxDraw({
        displayControlsDefault: false,
        controls: {},
        defaultMode: "simple_select",
        styles: DRAW_STYLES,
      }),
    // onAdd — map instance available; register event listener
    ({ map }: { map: MapboxMap }) => {
      map.on("draw.create", stableHandler);
    },
    // onRemove — cleanup
    ({ map }: { map: MapboxMap }) => {
      map.off("draw.create", stableHandler);
    },
  );

  // Wire the inner handler to the current draw instance and callback.
  useEffect(() => {
    innerHandlerRef.current = (e: { features: GeoJSON.Feature[] }) => {
      if (!e.features.length) return;
      const feature = e.features[0] as GeoJSON.Feature<GeoJSON.Polygon>;
      if (feature.geometry?.type !== "Polygon") return;

      const ring = feature.geometry.coordinates[0] as [number, number][];
      const coords = geoJSONRingToFenceCoords(ring);
      if (coords.length < 3) return;

      // Remove the drawn shape — the fence will be re-rendered as a layer.
      if (feature.id && draw) draw.delete(feature.id as string);

      onFenceCompleteRef.current(coords);
    };
  }, [draw]);

  // Activate / deactivate drawing mode when prop changes.
  useEffect(() => {
    if (!draw) return;
    try {
      if (drawingMode !== "none") {
        draw.changeMode("draw_polygon");
      } else {
        draw.changeMode("simple_select");
      }
    } catch {
      // draw mode change can throw if the map is mid-transition
    }
  }, [draw, drawingMode]);

  return null;
}
