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
import { X, Mountain, ArrowUpDown, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ElevationPanelProps {
  locations: GPSLocation[];
  deviceTimeoutSeconds?: number;
  onClose: () => void;
}

const FLOOR_HEIGHT = 4;
const FLOOR_LABELS = ["Ground", "L1", "L2", "L3", "L4", "L5"];

function getFloorLabel(alt: number) {
  const floor = Math.floor(alt / FLOOR_HEIGHT);
  return FLOOR_LABELS[floor] ?? `L${floor}`;
}

// Delta altitude → warning color
function getDeltaColor(dAlt: number): string {
  if (dAlt >= 8) return "#ef4444";
  if (dAlt >= 4) return "#f97316";
  if (dAlt >= 2) return "#eab308";
  return "#22c55e";
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-xl border shadow-lg text-xs p-3 min-w-[150px]"
      style={{
        background: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
        color: "hsl(var(--foreground))",
        boxShadow: "0 4px 20px hsl(0 0% 0% / 0.15)",
      }}
    >
      <p className="font-bold text-[12px] mb-1.5">{d.deviceId}</p>
      <p className="font-semibold" style={{ color: d.fill }}>
        {d.altitude !== null ? `${d.altitude.toFixed(1)} m` : "No altitude data"}
      </p>
      <p className="text-muted-foreground mt-0.5">{ALTITUDE_BAND_LABEL[d.band]}</p>
    </div>
  );
};

export const ElevationPanel = ({
  locations,
  deviceTimeoutSeconds = 60,
  onClose,
}: ElevationPanelProps) => {
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
            value: loc.altitude ?? 0,
          };
        })
        .sort((a, b) => (b.altitude ?? -1) - (a.altitude ?? -1)),
    [deviceLatest],
  );

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
    <div className="flex flex-col h-full bg-card border-l border-border overflow-hidden">

      {/* ── Header — matches left panel style ── */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0"
        style={{ boxShadow: "0 1px 0 hsl(var(--border)), 0 2px 12px hsl(0 0% 0% / 0.05)" }}
      >
        <div className="flex items-center gap-2.5">
          {/* Icon box — same pattern as fence/worker icon on left panel */}
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: "#84994F22",
              border: "1.5px solid #84994F55",
            }}
          >
            <Mountain className="h-3.5 w-3.5" style={{ color: "#84994F" }} />
          </div>
          <div className="leading-none">
            <p className="text-[13px] font-bold text-foreground">Elevation View</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {deviceLatest.length > 0
                ? `${deviceLatest.length} device${deviceLatest.length !== 1 ? "s" : ""} online`
                : "No online devices"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7 rounded-lg"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 py-3 space-y-4">

          {/* Altitude band legend */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Altitude Bands
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(ALTITUDE_BAND_LABEL) as [keyof typeof ALTITUDE_BAND_LABEL, string][])
                .filter(([k]) => k !== "unknown")
                .map(([band, label]) => (
                  <span
                    key={band}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: ALTITUDE_BAND_COLOR[band] }}
                  >
                    {label}
                  </span>
                ))}
            </div>
          </div>

          {/* Worker elevation chart */}
          <div>
            {/* Section header — matches left panel collapsible trigger style */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Worker Elevation
                </span>
              </div>
              <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                {chartData.length}
              </span>
            </div>

            {chartData.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-3 bg-muted/40 rounded-2xl border border-dashed border-border">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                  <Mountain className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">No elevation data</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Online workers will appear here</p>
                </div>
              </div>
            ) : (
              <div
                className="rounded-xl border border-border bg-card overflow-hidden"
                style={{ boxShadow: "0 1px 4px hsl(0 0% 0% / 0.06)" }}
              >
                <div className="h-1 w-full bg-[#84994F]" />
                <div className="p-3">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
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
              </div>
            )}
          </div>

          {/* Height differences between workers */}
          {heightDiffs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Height Differences
                </span>
              </div>

              <div className="space-y-1.5">
                {heightDiffs.map((pair, i) => {
                  const accentColor = getDeltaColor(pair.dAlt);
                  return (
                    <div
                      key={i}
                      className="rounded-xl bg-card border border-border overflow-hidden transition-all duration-150 hover:shadow-md hover:-translate-y-px"
                      style={{ boxShadow: "0 1px 4px hsl(0 0% 0% / 0.06)" }}
                    >
                      {/* Top accent bar colored by delta severity */}
                      <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />
                      <div className="px-3 py-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-foreground truncate max-w-[52%]">
                          {pair.a} ↔ {pair.b}
                        </span>
                        <div className="flex gap-3 text-right flex-shrink-0">
                          <span className="text-[10px] text-muted-foreground">
                            Δh{" "}
                            <span
                              className="font-bold text-[11px]"
                              style={{ color: accentColor }}
                            >
                              {pair.dAlt.toFixed(1)} m
                            </span>
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            3D{" "}
                            <span className="font-semibold text-foreground">
                              {pair.dist3d.toFixed(1)} m
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No altitude note */}
          {deviceLatest.some((l) => l.altitude === undefined) && (
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Some devices are not reporting altitude yet. Hardware support required for full 3D tracking.
              </p>
            </div>
          )}

        </div>
      </ScrollArea>
    </div>
  );
};
