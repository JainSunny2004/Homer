# Mapbox Migration & 3D Visualization — Full Change Log

This document records every change made during the Google Maps → Mapbox migration and the subsequent 3D worker visualization improvements. It is organized by phase, then by file, with exact decisions and rationale for each change.

---

## Stack Context

| Item | Value |
|------|-------|
| Frontend | React 18.3.1 + Vite 5.4.19 + TypeScript |
| Map library (before) | `@react-google-maps/api ^2.20.6` |
| Map library (after) | `mapbox-gl 3.19.1` + `react-map-gl v8.1.0` (subpath `react-map-gl/mapbox`) |
| Drawing tool | `@mapbox/mapbox-gl-draw 1.5.1` |
| Backend | Supabase (PostgreSQL) — **untouched** |
| Business logic hooks | **untouched** (`useCoMovementAlerts`, `usePolygonFences`, alert hooks) |

---

## Phase 1 — Dependency Swap

### `package.json`

**Removed:**
```json
"@react-google-maps/api": "^2.20.6"
```

**Already present (no additions needed):**
```json
"mapbox-gl": "3.19.1",
"react-map-gl": "8.1.0",
"@mapbox/mapbox-gl-draw": "1.5.1"
```

### `.env`

**Added:**
```
VITE_MAPBOX_ACCESS_TOKEN=""
```

The only manual step required from the developer. The empty string causes a graceful fallback UI in all three map components — they detect the missing token and render an error card instead of crashing.

---

## Phase 2 — New Utility Library

### `src/lib/mapUtils.ts` *(created)*

Central home for all coordinate conversions and altitude math. Nothing else in the codebase is permitted to do raw `[lng, lat]` ↔ `{ lat, lng }` conversions inline.

#### Coordinate helpers

```ts
// Google Maps / Supabase internal format
{ lat: number; lng: number }

// Mapbox / GeoJSON format
[longitude, latitude]   // NOTE: longitude first — opposite to intuition
```

```ts
export function toMapboxCoord(p: { lat: number; lng: number }): [number, number] {
  return [p.lng, p.lat];   // lng first
}

export function fromMapboxCoord(c: [number, number]): { lat: number; lng: number } {
  return { lat: c[1], lng: c[0] };
}
```

#### GeoJSON builders

| Function | Purpose |
|----------|---------|
| `fenceToGeoJSON(fence)` | Converts a single `PolygonFence` to a GeoJSON `Feature<Polygon>`. Closes the ring automatically if the first and last point differ. |
| `fencesToGeoJSON(fences)` | Wraps an array of fences into a `FeatureCollection`. Used as a Mapbox `Source` data prop. |
| `fenceLabelPointsGeoJSON(fences)` | Produces point features at each fence centroid for label `<Marker>` placement. |
| `locationToGeoJSON(loc)` | Converts a `GPSLocation` row to a GeoJSON point feature. |
| `geoJSONRingToFenceCoords(ring)` | Converts a Mapbox Draw output ring back to `{ lat, lng }[]`. Drops the closing duplicate point that Mapbox Draw appends. |

**Why `fenceToGeoJSON` closes the ring explicitly:**
GeoJSON spec requires polygon rings to have first point === last point. Supabase stores coordinates as open arrays. The function closes them on the way out to Mapbox and drops the duplicate on the way back in via `geoJSONRingToFenceCoords`.

#### Altitude system — two separate values

The application maintains two altitude representations that must never be mixed:

| Value | Description | Used for |
|-------|-------------|---------|
| **Real altitude** | Raw GPS value in metres | Database storage, alert logic, analytics |
| **Visual altitude** | Scaled and exaggerated | Rendering only — affects no stored data |

```ts
export const VISUAL_ALTITUDE_SCALE = 5;   // metres → visual metres (terrain layer)

// Clamps to 0 — negative altitude treated as ground
export function normalizeAltitude(rawAlt, groundRef = 0): number
export function getRelativeAltitude(rawAlt, groundRef = 0): number  // alias

// Returns visual altitude for Mapbox 3D rendering
export function getVisualAltitude(rawAlt, groundRef = 0, scale = 5): number

// Returns 0-indexed floor number using 4 m/floor convention
export function estimateFloorLevel(rawAlt, groundRef = 0): number
```

---

## Phase 3 — Map Component Replacements

### `src/components/manager/ManagerMap.tsx` *(replaced)*

#### Import rename — critical bug prevention

```ts
// WRONG — shadows the built-in Map constructor:
import Map, { ... } from "react-map-gl/mapbox";
// Line 337: const map = new Map<string, GPSLocation>()  → TypeError: Map is not a constructor

// CORRECT — renamed to MapGL:
import MapGL, { Marker, Popup, Source, Layer, NavigationControl } from "react-map-gl/mapbox";
```

The built-in JavaScript `Map` class was being shadowed. Renaming the component import to `MapGL` eliminates the conflict entirely.

#### Map instance access — `onLoad` pattern

`MapboxEvent` is not exported by `react-map-gl/mapbox`. The correct pattern is:

```ts
const mapRef = useRef<MapRef>(null);

const handleLoad = useCallback(() => {
  const map = mapRef.current?.getMap();  // mapboxgl.Map instance
  if (!map) return;
  // add sources, set terrain, etc.
}, []);

<MapGL ref={mapRef} onLoad={handleLoad} ... />
```

#### Terrain

```ts
map.addSource("mapbox-dem", {
  type: "raster-dem",
  url: "mapbox://mapbox.mapbox-terrain-dem-v1",
  tileSize: 512,
});
map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
```

Gated behind `mapLoaded` state so `<Source>` / `<Layer>` children are not rendered before the map GL context is ready.

#### `line-dasharray` split-layer fix

Mapbox GL JS does not support data-driven expressions for `line-dasharray`. Attempting to use a `case` expression crashes the style parser silently. The fix is two separate layers with filters:

```ts
// Regular fences — solid outline
const fenceOutlineLayer: LayerProps = {
  id: "fences-outline",
  type: "line",
  filter: ["!=", ["get", "isGreenCorridor"], true],
  paint: { "line-color": ["get", "color"], "line-width": 2 },
};

// Green corridors — dashed outline
const corridorOutlineLayer: LayerProps = {
  id: "fences-corridor-outline",
  type: "line",
  filter: ["==", ["get", "isGreenCorridor"], true],
  paint: { "line-color": ["get", "color"], "line-width": 2, "line-dasharray": [4, 3] },
};
```

#### Layer specs moved outside component body

All layer specs that have no dynamic values are defined as module-level constants. Specs that depend on component state (WorkerMap fence color) use `useMemo`. This prevents Mapbox GL from re-evaluating paint specs on every React render.

```ts
// Module level — created once
const fenceFillLayer: LayerProps = { ... };
const fenceOutlineLayer: LayerProps = { ... };
const corridorOutlineLayer: LayerProps = { ... };
const bleLineLayer: LayerProps = { ... };
const bleLabelLayer: LayerProps = { ... };
```

#### BLE distance labels restored

The original Google Maps implementation rendered distance text alongside BLE connection lines. Restored with a `symbol` layer on the same GeoJSON source:

```ts
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
```

#### `WorkerMarker` wrapper — memoization fix

`WorkerPin` was wrapped in `React.memo` but its `onClick` was an inline arrow, creating a new function reference every render and defeating memoization. Fix: introduce a `WorkerMarker` wrapper that owns a stable `useCallback` per device.

```tsx
const WorkerMarker = React.memo(({ deviceId, location, color, band, floorLabel, onSelect }) => {
  const handleClick = useCallback(
    () => onSelect(deviceId, location),
    [deviceId, location, onSelect]   // onSelect is stable via useCallback in parent
  );
  // ...
});
```

`handleMarkerClick` in the parent uses `useCallback([fences, assignments])` so it only changes when fence/assignment data changes, not on every location poll.

#### `cooperativeGestures` added

```tsx
<MapGL ... cooperativeGestures>
```

Prevents single-finger scroll from hijacking the page on mobile/tablet. All three map components received this prop.

#### `reuseMaps` added

```tsx
<MapGL ... reuseMaps>
```

Preserves the WebGL context across React unmount/remount cycles, avoiding GPU context teardown cost during tab switches.

---

### `src/components/dashboard/GPSMap.tsx` *(replaced)*

Key decisions:

- Import kept as `Map` (no shadowing issue here — no `new Map()` calls in this component).
- `initialCenter` computed with `useMemo(fn, [])` — intentionally stable so the viewport doesn't re-center on every 5-second location poll. This is an improvement over the original.
- Cooperative/GPS/peer/offline mode detection logic preserved character-for-character from the original.
- BLE connecting lines rendered as a GeoJSON `Source` + `line` `Layer`. Coordinate order is `[ownLon, ownLat]` (Mapbox/GeoJSON order).
- `DeviceMarker` is `React.memo`.
- `cooperativeGestures` and `reuseMaps` added.

---

### `src/components/worker/WorkerMap.tsx` *(replaced)*

Key decisions:

- Terrain at `exaggeration: 1.2` (lower than ManagerMap's 1.5 — the worker view is focused on their own fence, not a wide-area overview).
- Fence layer specs use `useMemo([assignedFence?.color])` because the color value is dynamic:

```ts
const fenceFillLayer = useMemo<LayerProps>(
  () => ({ id: "fence-fill", type: "fill", paint: { "fill-color": assignedFence?.color || "#22c55e", ... } }),
  [assignedFence?.color],
);
```

- `cooperativeGestures` and `reuseMaps` added.
- Named export `WorkerMap` preserved.

---

## Phase 4 — Drawing System Fix

### `src/components/map/DrawControl.tsx` *(created, then critically fixed)*

#### Root cause of original failure

The initial implementation used `useMap()`:

```ts
const { current: mapRef } = useMap();  // always undefined — no <MapProvider> in app
useEffect(() => {
  if (!mapRef) return;  // always exits here — MapboxDraw never added
  // ...
}, [mapRef]);
```

`useMap()` requires a `<MapProvider>` ancestor. The application wraps maps with `<MapGL>` directly, not `<MapProvider>`. Result: `MapboxDraw` was never instantiated and all three drawing modes (polygon, rectangle, circle) were silently inert.

#### Fix — `useControl()`

`useControl()` integrates directly with the surrounding `<Map>` component without requiring `<MapProvider>`. It receives the map instance via callbacks:

```ts
const draw = useControl<MapboxDraw>(
  // onCreate — called once, returns the control instance
  () => new MapboxDraw({ displayControlsDefault: false, defaultMode: "simple_select", styles: DRAW_STYLES }),

  // onAdd — map instance available; register event listener
  ({ map }: { map: MapboxMap }) => {
    map.on("draw.create", stableHandler);
  },

  // onRemove — cleanup
  ({ map }: { map: MapboxMap }) => {
    map.off("draw.create", stableHandler);
  },
);
```

#### Stable event handler pattern

The `onFenceComplete` callback prop changes identity on every parent render. To avoid re-registering the event listener, a ref-indirection pattern is used:

```ts
const onFenceCompleteRef = useRef(onFenceComplete);
onFenceCompleteRef.current = onFenceComplete;  // always current, no re-render

const innerHandlerRef = useRef<(e) => void>(() => {});

// Stable function — registered once, never changes identity
const stableHandler = useCallback((e) => { innerHandlerRef.current(e); }, []);

// Inner handler wired to draw instance when it becomes available
useEffect(() => {
  innerHandlerRef.current = (e) => {
    // ... extract ring, convert coords, call onFenceCompleteRef.current(coords)
  };
}, [draw]);
```

#### Coordinate round-trip

```
User draws on map
  → Mapbox Draw emits GeoJSON Polygon ring: [number, number][]  (lng, lat order)
  → geoJSONRingToFenceCoords(ring)
  → drops closing duplicate point
  → fromMapboxCoord() on each point
  → { lat, lng }[]  (matches Supabase schema)
  → stored via usePolygonFences.addFence()
  → re-fetched as { lat, lng }[]
  → fenceToGeoJSON() for rendering
  → toMapboxCoord() on each point
  → [lng, lat][]  (Mapbox GL layer)
```

No coordinate corruption at any step.

#### Drawing modes

All three UI drawing modes map to `draw_polygon` in Mapbox Draw. The mode label is purely informational (shown in the UI overlay):

| UI mode | Mapbox Draw mode | How user draws |
|---------|-----------------|----------------|
| `polygon` | `draw_polygon` | Click each vertex, double-click to finish |
| `rectangle` | `draw_polygon` | Click 4 corners, double-click to finish |
| `circle` | `draw_polygon` | Click points to approximate a circle, double-click to finish |

---

## Phase 5 — Post-Migration Bug Fixes

Eight bugs were identified by static analysis after the migration. All fixed.

### BUG-001 — CRITICAL: DrawControl never mounted
**Fixed in Phase 4 above.** `useMap()` → `useControl()`.

### BUG-002 — HIGH: WorkerPin memoization defeated
**Fixed.** Inline `onClick` arrow replaced with `WorkerMarker` wrapper component holding a stable `useCallback`. See Phase 3 ManagerMap section.

### BUG-003 — HIGH: No gesture handling on mobile
**Fixed.** `cooperativeGestures` prop added to all three `<Map>` / `<MapGL>` components.

### BUG-004 — MEDIUM: BLE distance labels missing
**Fixed.** `bleLabelLayer` symbol layer added to ManagerMap's BLE source. See Phase 3 section.

### BUG-005/006 — MEDIUM: Layer specs recreated every render
**Fixed.** Static specs moved to module scope; color-dependent specs in WorkerMap moved to `useMemo`. See Phase 3 sections.

---

## Phase 6 — 3D Worker Visualization

All changes confined to the marker rendering section of `ManagerMap.tsx`. No hooks, business logic, APIs, or Supabase code touched.

### Visual altitude pixel scale

A separate pixel-space height value drives all rendering — independent of the real altitude stored in the database.

```ts
const VISUAL_PX_SCALE = 10;   // px per metre
const VISUAL_PX_MAX   = 200;  // cap — prevents extremely tall stems

function getVisualPixelHeight(rawAlt: number | undefined): number {
  if (rawAlt == null) return 0;
  return Math.min(Math.max(0, rawAlt) * VISUAL_PX_SCALE, VISUAL_PX_MAX);
}
```

| Raw altitude | Visual stem height |
|-------------|-------------------|
| 0 m (ground) | 0 px |
| 4 m (floor 1) | 40 px |
| 8 m (floor 2) | 80 px |
| 12 m (floor 3) | 120 px |
| ≥20 m | 200 px (cap) |

### Altitude band halo colors

```ts
const BAND_HALO: Record<string, string> = {
  ground:     "rgba(34,  197, 94,  0.55)",   // green
  level1:     "rgba(234, 179, 8,   0.55)",   // yellow
  level2:     "rgba(249, 115, 22,  0.55)",   // orange
  level3plus: "rgba(239, 68,  68,  0.55)",   // red
  unknown:    "rgba(100, 116, 139, 0.30)",
};
```

### WorkerPin structure

The pin is a vertical flexbox column, anchored at the bottom to the map coordinate:

```
┌───────────────┐
│  [halo glow]  │  ← blurred div, color from BAND_HALO, blur grows with height
│  [pin SVG]    │  ← scales 1×→1.25× with height; drop-shadow grows with height
│  [floor badge]│  ← "F0", "F1", "F2" … top-right of SVG
├───────────────┤
│  [stem line]  │  ← 2px wide, gradient color→color@27%, height = visualPixelHeight px
│               │    (omitted entirely when visualHeight === 0)
├───────────────┤
│  [shadow dot] │  ← ellipse; shrinks and fades as worker rises
└───────────────┘
        ↑
   map coordinate (anchor="bottom")
```

#### Pin scaling
```ts
const pinScale = 1 + Math.min(visualHeight, VISUAL_PX_MAX) * 0.002;
// 0 px → 1.00×  (28×36 svg)
// 40 px → 1.08×
// 120 px → 1.24×
// 200 px → 1.40×
```

#### Drop-shadow scaling
```ts
const shadowBlur    = 3  + visualHeight * 0.06;
const shadowOpacity = 0.38 + visualHeight * 0.002;
const shadowOffsetY = 2  + visualHeight * 0.04;
// Higher workers cast larger, darker shadows — reinforces floating effect
```

#### Halo glow scaling
```ts
const haloBlur = 6  + visualHeight * 0.12;
const haloSize = 10 + visualHeight * 0.1;
// Higher workers have a wider, softer aura
```

#### Ground-contact shadow dot
```ts
const dotW  = Math.max(6,  14 - visualHeight * 0.04);   // shrinks as worker rises
const dotH  = Math.max(2,   5 - visualHeight * 0.02);
const dotOp = Math.max(0.12, 0.45 - visualHeight * 0.003);
// Wide + opaque at ground → narrow + dim when elevated
// Communicates: "this worker is far above the ground point"
```

#### Stem gradient
```ts
background: `linear-gradient(to bottom, ${color}dd 0%, ${color}44 100%)`;
// Full opacity at pin, 27% opacity at ground
// Gives stem a sense of depth / distance
```

### Z-order for depth perception

Two complementary mechanisms ensure taller workers appear on top:

1. **DOM render order** — markers sorted ascending by altitude before mapping, so taller workers are rendered last (higher in the DOM stacking context).
2. **Marker `style.zIndex`** — set to `Math.floor(visualHeight)` so the browser compositor also respects the ordering.

```tsx
// Sorted ascending so higher workers render last (on top)
Array.from(visibleDeviceLocations.entries())
  .filter(([, loc]) => hasValidLocation(loc))
  .sort(([, a], [, b]) => (a.altitude ?? 0) - (b.altitude ?? 0))
  .map(([deviceId, location]) => (
    <WorkerMarker
      key={deviceId}
      ...
      style={{ zIndex: Math.floor(getVisualPixelHeight(location.altitude)) }}
    />
  ))
```

---

## Files Changed — Summary

| File | Status | What changed |
|------|--------|-------------|
| `package.json` | Modified | Removed `@react-google-maps/api` |
| `.env` | Modified | Added `VITE_MAPBOX_ACCESS_TOKEN` placeholder |
| `src/lib/mapUtils.ts` | **Created** | All coordinate conversions + altitude utilities |
| `src/components/map/DrawControl.tsx` | **Created** | `@mapbox/mapbox-gl-draw` wrapper using `useControl()` |
| `src/components/manager/ManagerMap.tsx` | Replaced | Full Mapbox implementation + 3D worker visualization |
| `src/components/dashboard/GPSMap.tsx` | Replaced | Full Mapbox implementation |
| `src/components/worker/WorkerMap.tsx` | Replaced | Full Mapbox implementation |

**Unchanged (zero modifications):**
- `src/hooks/useCoMovementAlerts.ts`
- `src/hooks/usePolygonFences.ts`
- `src/lib/geoUtils.ts`
- All Supabase integration files
- All alert/notification logic
- All type definitions (`src/types/gps.ts`, `src/types/alerts.ts`)

---

## Architecture Decisions Log

### Why `react-map-gl/mapbox` subpath instead of `react-map-gl` directly?
`react-map-gl` v8 ships multiple renderer backends. The `/mapbox` subpath re-exports from `@vis.gl/react-mapbox` and is the correct entry point for `mapbox-gl`. Using the root import can resolve to the wrong renderer.

### Why not use `MapProvider`?
The app renders each map as a standalone component. There is no cross-map state sharing requirement. Adding `<MapProvider>` would be an unnecessary abstraction. `useControl()` works without it; `useMap()` does not.

### Why DOM-space stems instead of GeoJSON vertical lines?
True 3D vertical lines in Mapbox GL JS require custom WebGL layers (significant complexity). DOM-space stems in the marker element achieve the same visual readability goal with zero additional dependencies and work at all zoom levels and pitch angles without projection math.

### Why pixel height instead of metre height for stems?
Metre-based offsets in Mapbox world coordinates depend on zoom level and projection — a 4-metre stem looks different at zoom 14 vs zoom 19. Pixel heights are constant on screen regardless of zoom, giving consistent readability at all zoom levels.

### Why cap visual pixel height at 200 px?
Buildings taller than 20 m (20 × 10 = 200 px) are uncommon in construction/industrial sites. At 200 px, the stem already spans a large fraction of the map viewport. Uncapped, a worker at 50 m would render a 500 px stem that breaks the layout.

### Why `VISUAL_PX_SCALE = 10` specifically?
The target specification was: 0 m → 0, 4 m → 40, 8 m → 80, 12 m → 120. This is exactly 10 px/m. The scale aligns floor increments (4 m each) to 40 px steps, making floor differences immediately distinct at typical map zoom levels.
