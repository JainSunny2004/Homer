import { useMemo } from "react";
import { GPSLocation } from "@/types/gps";
import {
  getAltitudeBand,
  ALTITUDE_BAND_COLOR,
  ALTITUDE_BAND_LABEL,
  distance3D,
  haversineDistance,
} from "@/lib/geoUtils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { X, Mountain } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ElevationPanelProps {
  locations: GPSLocation[];
  deviceTimeoutSeconds?: number;
  onClose: () => void;
}

const FLOOR_HEIGHT = 4; // metres per construction floor
const FLOOR_LABELS = ["Ground", "L1", "L2", "L3", "L4", "L5"];

function getFloorLabel(alt: number) {
  const floor = Math.floor(alt / FLOOR_HEIGHT);
  return FLOOR_LABELS[floor] ?? `L${floor}`;
}

// Custom tooltip for the bar chart
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-lg border shadow-lg text-xs p-2 min-w-[140px]"
      style={{ background: "#1e1e2e", borderColor: "#3b3b52", color: "#fff" }}
    >
      <p className="font-bold mb-1">{d.deviceId}</p>
      <p style={{ color: d.fill }}>
        {d.altitude !== null ? `${d.altitude.toFixed(1)} m` : "No altitude data"}
      </p>
      <p className="text-gray-400">{ALTITUDE_BAND_LABEL[d.band]}</p>
    </div>
  );
};

export const ElevationPanel = ({
  locations,
  deviceTimeoutSeconds = 60,
  onClose,
}: ElevationPanelProps) => {
  // Latest location per device, online only
  const deviceLatest = useMemo(() => {
    const map = new Map<string, GPSLocation>();
    const cutoff = Date.now() - deviceTimeoutSeconds * 1000;
    locations.forEach((loc) => {
      if (new Date(loc.timestamp).getTime() < cutoff) return;
      const existing = map.get(loc.device_id);
      if (!existing || new Date(loc.timestamp) > new Date(existing.timestamp)) {
        map.set(loc.device_id, loc);
      }
    });
    return Array.from(map.values());
  }, [locations, deviceTimeoutSeconds]);

  const chartData = useMemo(
    () =>
      deviceLatest
        .map((loc) => {
          const band = getAltitudeBand(loc.altitude);
          return {
            deviceId: loc.device_id,
            altitude: loc.altitude ?? null,
            band,
            fill: ALTITUDE_BAND_COLOR[band],
            // bar value — use 0.5 as floor for unknown so it still appears
            value: loc.altitude ?? 0,
          };
        })
        .sort((a, b) => (b.altitude ?? -1) - (a.altitude ?? -1)),
    [deviceLatest],
  );

  // Pairwise height differences for online devices that have altitude
  const heightDiffs = useMemo(() => {
    const withAlt = deviceLatest.filter((l) => l.altitude !== undefined);
    const pairs: { a: string; b: string; dAlt: number; dist3d: number; dist2d: number }[] = [];
    for (let i = 0; i < withAlt.length; i++) {
      for (let j = i + 1; j < withAlt.length; j++) {
        const la = withAlt[i];
        const lb = withAlt[j];
        pairs.push({
          a: la.device_id,
          b: lb.device_id,
          dAlt: Math.abs((la.altitude ?? 0) - (lb.altitude ?? 0)),
          dist3d: distance3D(
            { lat: la.latitude, lng: la.longitude, altitude: la.altitude },
            { lat: lb.latitude, lng: lb.longitude, altitude: lb.altitude },
          ),
          dist2d: haversineDistance(
            { lat: la.latitude, lng: la.longitude },
            { lat: lb.latitude, lng: lb.longitude },
          ),
        });
      }
    }
    return pairs.sort((a, b) => b.dAlt - a.dAlt).slice(0, 10);
  }, [deviceLatest]);

  const maxAlt = Math.max(...chartData.map((d) => d.value), 16);
  const floorLines = Array.from(
    { length: Math.ceil(maxAlt / FLOOR_HEIGHT) + 1 },
    (_, i) => i * FLOOR_HEIGHT,
  );

  return (
    <div className="flex flex-col h-full bg-card border-l overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #84994F 0%, #6b7a3f 100%)" }}
      >
        <div className="flex items-center gap-2">
          <Mountain className="h-4 w-4 text-white" />
          <span className="font-semibold text-sm text-white">Elevation View</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 text-white hover:bg-white/20 rounded-md"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Legend */}
        <div className="flex flex-wrap gap-2">
          {(Object.entries(ALTITUDE_BAND_LABEL) as [keyof typeof ALTITUDE_BAND_LABEL, string][])
            .filter(([k]) => k !== "unknown")
            .map(([band, label]) => (
              <span
                key={band}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: ALTITUDE_BAND_COLOR[band] }}
              >
                {label}
              </span>
            ))}
        </div>

        {/* Bar chart */}
        {chartData.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No online workers with data.
          </p>
        ) : (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Worker Elevation
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                {floorLines.map((y) => (
                  <ReferenceLine
                    key={y}
                    y={y}
                    stroke="hsl(var(--border))"
                    strokeDasharray="4 4"
                    label={{
                      value: getFloorLabel(y),
                      position: "insideLeft",
                      fontSize: 9,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                ))}
                <XAxis
                  dataKey="deviceId"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  unit=" m"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  domain={[0, Math.ceil(maxAlt / FLOOR_HEIGHT + 1) * FLOOR_HEIGHT]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pairwise height differences */}
        {heightDiffs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Height Differences Between Workers
            </p>
            <div className="space-y-1.5">
              {heightDiffs.map((pair, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-xs border"
                  style={{ background: "hsl(var(--muted)/0.4)" }}
                >
                  <span className="font-medium text-foreground truncate max-w-[55%]">
                    {pair.a} ↔ {pair.b}
                  </span>
                  <div className="flex gap-3 text-right flex-shrink-0">
                    <span className="text-muted-foreground">
                      Δh{" "}
                      <span className="font-semibold text-foreground">
                        {pair.dAlt.toFixed(1)} m
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      3D{" "}
                      <span className="font-semibold text-foreground">
                        {pair.dist3d.toFixed(1)} m
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No altitude note */}
        {deviceLatest.some((l) => l.altitude === undefined) && (
          <p className="text-[11px] text-muted-foreground border rounded-lg px-3 py-2">
            Some devices are not reporting altitude yet. Hardware support required
            for full 3D tracking.
          </p>
        )}
      </div>
    </div>
  );
};
