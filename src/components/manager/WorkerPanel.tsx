import { useState } from "react";
import { PolygonFence, WorkerAssignment, GPSLocation } from "@/types/gps";
import { SafetyAlert } from "@/types/alerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  User, MapPin, Briefcase, Clock, Navigation, AlertCircle,
  History, Activity, ChevronDown, ChevronRight, Cpu,
  Satellite, Bluetooth, WifiOff,
} from "lucide-react";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { isPointInPolygon, isWithinShift } from "@/lib/geoUtils";

// ✅ Shared helper — single source of truth for valid location check
const hasValidLocation = (loc: GPSLocation | undefined): boolean => {
  if (!loc) return false;
  if (loc.locationSource === "NONE") return false;
  if (loc.latitude === 0 && loc.longitude === 0) return false;
  return true;
};

// ─── DeviceHistoryDialog ──────────────────────────────────────────────────────

interface DeviceHistoryDialogProps {
  deviceId: string;
  locations: GPSLocation[];
  isOpen: boolean;
  onClose: () => void;
}

const DeviceHistoryDialog = ({
  deviceId, locations, isOpen, onClose,
}: DeviceHistoryDialogProps) => {
  const deviceReadings = locations
    .filter((loc) => loc.device_id === deviceId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };
  };

  const getMovement = (ax: number, ay: number, az: number) => {
    const m = Math.sqrt(ax * ax + ay * ay + az * az);
    if (m < 1.5) return { label: "Stationary", color: "bg-muted text-muted-foreground" };
    if (m < 3)   return { label: "Low",        color: "bg-accent/20 text-accent-foreground" };
    if (m < 6)   return { label: "Moderate",   color: "bg-primary/20 text-primary" };
    return            { label: "High",         color: "bg-destructive/20 text-destructive" };
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div className="flex-shrink-0 p-5 pb-4 border-b bg-gradient-to-r from-primary/8 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center ring-1 ring-primary/20 flex-shrink-0">
              <History className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm font-bold break-all leading-snug">
                {deviceId}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px]">ESP32</Badge>
                <span className="text-xs text-muted-foreground">
                  {deviceReadings.length} readings
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 px-5 py-2 bg-muted/40 border-b">
          <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-5">Location</div>
            <div className="col-span-4">Accel</div>
            <div className="col-span-3 text-right">Time</div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1.5">
            {deviceReadings.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Navigation className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No data yet</p>
              </div>
            ) : (
              deviceReadings.map((r, i) => {
                const { date, time } = formatTimestamp(r.timestamp);
                const isLatest = i === 0;
                const mv = getMovement(r.ax ?? 0, r.ay ?? 0, r.az ?? 0);
                // ✅ FIX Bug 3: detect no-signal rows visually
                const noSignal = !hasValidLocation(r);

                return (
                  <div
                    key={`${r.timestamp}-${i}`}
                    className={`relative rounded-lg border p-3 transition-all duration-150 ${
                      isLatest
                        ? "border-primary/40 bg-primary/5 shadow-sm"
                        : noSignal
                          ? "border-border/20 bg-muted/30 opacity-50"  // ✅ dim no-signal rows
                          : "border-border/40 bg-card hover:bg-muted/20"
                    }`}
                  >
                    {isLatest && (
                      <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-primary rounded-full" />
                    )}
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-5 flex items-start gap-1.5">
                        <Navigation
                          className={`h-3 w-3 mt-0.5 flex-shrink-0 ${
                            noSignal ? "text-destructive/50" :
                            isLatest  ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                        <div>
                          {/* ✅ FIX Bug 3: show "No Signal" instead of 0.000000 */}
                          {noSignal ? (
                            <p className="text-[11px] font-medium text-destructive/60 italic">
                              No Signal
                            </p>
                          ) : (
                            <>
                              <p className="font-mono text-[11px] font-medium">
                                {r.latitude.toFixed(6)}
                              </p>
                              <p className="font-mono text-[11px] text-muted-foreground">
                                {r.longitude.toFixed(6)}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="col-span-4 flex items-start gap-1.5">
                        <Activity
                          className={`h-3 w-3 mt-0.5 flex-shrink-0 ${isLatest ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <div>
                          <div className="flex gap-1 font-mono text-[10px]">
                            <span className="text-red-500/80">X:{(r.ax ?? 0).toFixed(1)}</span>
                            <span className="text-primary/80">Y:{(r.ay ?? 0).toFixed(1)}</span>
                            <span className="text-muted-foreground">Z:{(r.az ?? 0).toFixed(1)}</span>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`text-[9px] px-1 py-0 h-3.5 mt-0.5 ${mv.color}`}
                          >
                            {mv.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="col-span-3 text-right">
                        {isLatest && (
                          <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4 mb-0.5">
                            Latest
                          </Badge>
                        )}
                        <p className="font-medium text-[10px]">{time}</p>
                        <p className="text-[10px] text-muted-foreground opacity-70">{date}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {deviceReadings.length > 0 && (
          <div className="flex-shrink-0 px-5 py-2.5 border-t bg-muted/20 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span>
              Latest: {formatTimestamp(deviceReadings[0].timestamp).date} ·{" "}
              {formatTimestamp(deviceReadings[0].timestamp).time}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ─── WorkerPanel ──────────────────────────────────────────────────────────────

interface WorkerPanelProps {
  workers: string[];
  fences: PolygonFence[];
  assignments: WorkerAssignment[];
  locations: GPSLocation[];
  onAssignWorker: (a: Omit<WorkerAssignment, "id">) => void;
  onUnassignWorker: (id: string) => void;
  apiError?: string | null;
  deviceTimeoutSeconds?: number;
  showOfflineDevices?: boolean;
  safetyAlerts?: SafetyAlert[];
}

export const WorkerPanel = ({
  workers = [],
  fences = [],
  assignments = [],
  locations = [],
  onAssignWorker,
  onUnassignWorker,
  apiError,
  deviceTimeoutSeconds = 30,
  showOfflineDevices = true,
  safetyAlerts = [],
}: WorkerPanelProps) => {
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [selectedFence, setSelectedFence] = useState("");
  const [jobLabel, setJobLabel] = useState("");
  const [selectedDeviceHistory, setSelectedDeviceHistory] = useState<string | null>(null);
  const [onlineOpen, setOnlineOpen] = useState(true);
  const [offlineOpen, setOfflineOpen] = useState(true);
  const [deviceLogOpen, setDeviceLogOpen] = useState(true);

  const getLatestLocations = (): Map<string, GPSLocation> => {
    const map = new Map<string, GPSLocation>();
    locations.forEach((loc) => {
      const ex = map.get(loc.device_id);
      if (!ex || new Date(loc.timestamp) > new Date(ex.timestamp))
        map.set(loc.device_id, loc);
    });
    return map;
  };

  const latestLocations = getLatestLocations();
  const getWorkerLocation = (id: string) => latestLocations.get(id);

  const isDeviceOnline = (loc: GPSLocation | undefined) =>
    !!loc && Date.now() - new Date(loc.timestamp).getTime() < deviceTimeoutSeconds * 1000;

  const onlineWorkers = workers.filter((id) => isDeviceOnline(getWorkerLocation(id)));
  const offlineWorkers = workers.filter((id) => !isDeviceOnline(getWorkerLocation(id)));

  const getWorkerStatus = (workerId: string) => {
    const assignment = assignments.find((a) => a.workerId === workerId);
    if (!assignment) return { status: "unassigned", color: "secondary" as const };

    const fence = fences.find((f) => f.id === assignment.fenceId);
    if (!fence) return { status: "unassigned", color: "secondary" as const };

    const location = getWorkerLocation(workerId);
    if (!location) return { status: "offline", color: "secondary" as const };

    // ✅ FIX Bug 1: Don't evaluate zone if device has no valid GPS fix
    if (!hasValidLocation(location))
      return { status: "no-signal", color: "secondary" as const };

    if (!isWithinShift(new Date(), fence.shiftStart, fence.shiftEnd))
      return { status: "off-shift", color: "secondary" as const };

    return isPointInPolygon(
      { lat: location.latitude, lng: location.longitude },
      fence.coordinates,
    )
      ? { status: "in-zone",     color: "default"      as const }
      : { status: "out-of-zone", color: "destructive"  as const };
  };

  const getAlertCount = (id: string) =>
    safetyAlerts.filter((a) => a.deviceId === id).length;

  const handleAssign = () => {
    if (!selectedWorker || !selectedFence || !jobLabel.trim()) return;
    onAssignWorker({ workerId: selectedWorker, fenceId: selectedFence, jobLabel: jobLabel.trim() });
    setSelectedWorker(null);
    setSelectedFence("");
    setJobLabel("");
  };

  const formatTs = (ts: string) =>
    new Date(ts).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  // ── Section header ────────────────────────────────────────────────────────
  const SectionHeader = ({
    open, onToggle, dot, label, count, accent,
  }: {
    open: boolean; onToggle: () => void; dot?: React.ReactNode;
    label: string; count: number; accent?: string;
  }) => (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full px-4 py-2.5 border-b border-border hover:bg-muted/40 transition-colors flex-shrink-0"
    >
      <div className="flex items-center gap-2">
        {open
          ? <ChevronDown  className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        {dot}
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <span className={`h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${accent ?? "bg-muted text-muted-foreground"}`}>
        {count}
      </span>
    </button>
  );

  // ── Worker card ───────────────────────────────────────────────────────────
  const renderWorkerCard = (workerId: string) => {
    const assignment = assignments.find((a) => a.workerId === workerId);
    const fence = assignment ? fences.find((f) => f.id === assignment.fenceId) : null;
    const { status } = getWorkerStatus(workerId);
    const location = getWorkerLocation(workerId);
    const online = isDeviceOnline(location);
    const alertCount = getAlertCount(workerId);

    const statusStyle = {
      "in-zone":     "bg-green-500/10 text-green-700 border-green-300/60",
      "out-of-zone": "bg-red-500/10 text-red-700 border-red-300/60",
      "unassigned":  "bg-muted text-muted-foreground border-border/60",
      "offline":     "bg-muted text-muted-foreground border-border/60",
      "off-shift":   "bg-muted text-muted-foreground border-border/60",
      // ✅ FIX Bug 1: no-signal gets its own distinct style
      "no-signal":   "bg-orange-500/10 text-orange-700 border-orange-300/60",
    }[status] ?? "bg-muted text-muted-foreground border-border/60";

    return (
      <div
        key={workerId}
        className="mx-3 mb-2 rounded-xl border border-border bg-card overflow-hidden transition-all duration-150 hover:shadow-lg hover:-translate-y-px"
        style={{
          boxShadow:
            status === "in-zone"
              ? "inset 3px 0 0 #c3f832, 0 1px 4px hsl(0 0% 0% / 0.05)"
              : status === "out-of-zone"
                ? "inset 3px 0 0 #ef4444, 0 1px 4px hsl(0 0% 0% / 0.05)"
                : status === "no-signal"
                  ? "inset 3px 0 0 #f97316, 0 1px 4px hsl(0 0% 0% / 0.05)"
                  : "inset 3px 0 0 hsl(var(--border)), 0 1px 4px hsl(0 0% 0% / 0.05)",
        }}
      >
        <div className="p-2.5 flex items-start gap-2.5">
          {/* Avatar */}
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 relative font-bold text-[13px] select-none"
            style={{
              backgroundColor: online ? "#c3f83225" : "hsl(var(--muted))",
              border: online ? "1.5px solid #c3f832" : "1.5px solid hsl(var(--border))",
              color: online ? "#5a7a00" : "hsl(var(--muted-foreground))",
              opacity: online ? 1 : 0.6,
            }}
          >
            {workerId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase()}
            {online && (
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-card animate-pulse" />
            )}
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5 ring-1 ring-card">
                {alertCount}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[13px] leading-tight break-all">{workerId}</p>

            <div className="flex items-center flex-wrap gap-1 mt-1">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${statusStyle}`}>
                {status}
              </span>
              {fence && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                  <MapPin className="h-2.5 w-2.5 flex-shrink-0" /> {fence.name}
                </span>
              )}
              {assignment?.jobLabel && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                  <Briefcase className="h-2.5 w-2.5 flex-shrink-0" /> {assignment.jobLabel}
                </span>
              )}
            </div>

            {/* Location source badge */}
            {location?.locationSource && (
              <div className="flex items-center gap-1 mt-1.5">
                {location.locationSource === "GPS" && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-700 border border-green-300/40">
                    <Satellite className="h-2.5 w-2.5" /> GPS
                  </span>
                )}
                {location.locationSource === "PEER" && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-700 border border-blue-300/40">
                    <Bluetooth className="h-2.5 w-2.5" />
                    BLE
                    {location.peerDistance ? ` · ${location.peerDistance.toFixed(1)}m` : ""}
                    {location.pairId ? ` · #${location.pairId}` : ""}
                  </span>
                )}
                {location.locationSource === "NONE" && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                    <WifiOff className="h-2.5 w-2.5" /> No Signal
                  </span>
                )}
              </div>
            )}

            {/* Alert badges */}
            {alertCount > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {safetyAlerts
                  .filter((a) => a.deviceId === workerId)
                  .map((alert) => (
                    <span
                      key={alert.id}
                      className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border ${
                        alert.type === "out-of-zone"
                          ? "bg-amber-500/10 text-amber-700 border-amber-300/40"
                          : alert.type === "inactivity"
                            ? "bg-orange-500/10 text-orange-700 border-orange-300/40"
                            : alert.type === "silence"
                              ? "bg-red-500/10 text-red-700 border-red-300/40"
                              : "bg-blue-500/10 text-blue-700 border-blue-300/40"
                      }`}
                    >
                      {alert.type === "out-of-zone" && "⚠ Out of Zone"}
                      {alert.type === "inactivity"  && "😴 Inactive"}
                      {alert.type === "silence"     && "🔇 Silent"}
                      {alert.type === "co-movement" && "👥 Co-movement"}
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* Assign button */}
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant={assignment ? "outline" : "default"}
                size="sm"
                className="h-7 px-2.5 text-[11px] font-bold flex-shrink-0 rounded-lg"
                style={!assignment ? { backgroundColor: "#c3f832", color: "#141414", border: "none" } : {}}
                onClick={() => {
                  setSelectedWorker(workerId);
                  setSelectedFence(assignment?.fenceId ?? "");
                  setJobLabel(assignment?.jobLabel ?? "");
                }}
              >
                {assignment ? "Edit" : "Assign"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="break-all text-sm">Assign: {workerId}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs">Task Area</Label>
                  <Select value={selectedFence} onValueChange={setSelectedFence}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose a task area" />
                    </SelectTrigger>
                    <SelectContent>
                      {fences.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                            {f.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Job Label</Label>
                  <Input
                    className="mt-1"
                    placeholder="e.g., Crane Operator"
                    value={jobLabel}
                    onChange={(e) => setJobLabel(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAssign}
                    className="flex-1"
                    style={{ backgroundColor: "#c3f832", color: "#141414", border: "none" }}
                  >
                    Save
                  </Button>
                  {assignment && (
                    <Button variant="destructive" onClick={() => onUnassignWorker(workerId)}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  };

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col">

        {/* Online Workers */}
        <Collapsible open={onlineOpen} onOpenChange={setOnlineOpen}>
          <CollapsibleTrigger asChild>
            <SectionHeader
              open={onlineOpen} onToggle={() => setOnlineOpen((o) => !o)}
              dot={<div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />}
              label="Online" count={onlineWorkers.length}
              accent="bg-foreground text-background"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="py-1.5">
              {onlineWorkers.length === 0 && !apiError && (
                <p className="text-xs text-muted-foreground text-center py-4 mx-2 bg-muted/20 rounded-lg">
                  No workers currently online
                </p>
              )}
              {apiError && onlineWorkers.length === 0 && (
                <div className="mx-2 p-2.5 bg-destructive/8 rounded-lg text-xs flex items-center gap-2 text-destructive font-medium border border-destructive/15">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" /> API Connection Failed
                </div>
              )}
              {onlineWorkers.map((id) => renderWorkerCard(id))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Offline Workers */}
        {showOfflineDevices && (
          <Collapsible open={offlineOpen} onOpenChange={setOfflineOpen}>
            <CollapsibleTrigger asChild>
              <SectionHeader
                open={offlineOpen} onToggle={() => setOfflineOpen((o) => !o)}
                dot={<div className="w-2 h-2 rounded-full bg-muted-foreground/40 flex-shrink-0" />}
                label="Offline" count={offlineWorkers.length}
                accent="bg-muted text-muted-foreground"
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="py-1.5">
                {offlineWorkers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4 mx-2 bg-muted/20 rounded-lg">
                    All workers online
                  </p>
                ) : (
                  offlineWorkers.map((id) => renderWorkerCard(id))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Device Log */}
        <Collapsible open={deviceLogOpen} onOpenChange={setDeviceLogOpen}>
          <CollapsibleTrigger asChild>
            <SectionHeader
              open={deviceLogOpen} onToggle={() => setDeviceLogOpen((o) => !o)}
              dot={<Cpu className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
              label="Device Log" count={latestLocations.size}
              accent="bg-foreground text-background"
            />
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-3 py-2 space-y-2">
              {latestLocations.size === 0 && (
                <div className="py-8 flex flex-col items-center gap-2 bg-muted/40 rounded-xl border border-dashed border-border">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                    <Cpu className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {apiError ? "Connect to your backend" : "Waiting for device data…"}
                  </p>
                </div>
              )}

              {Array.from(latestLocations.entries()).map(([deviceId, location]) => {
                const online = isDeviceOnline(location);
                const alertCount = getAlertCount(deviceId);
                // ✅ FIX Bug 2: detect no-signal for device log display
                const validLoc = hasValidLocation(location);

                return (
                  <div
                    key={deviceId}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border bg-card cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-px"
                    onClick={() => setSelectedDeviceHistory(deviceId)}
                    style={{
                      boxShadow: online
                        ? "inset 3px 0 0 #c3f832, 0 1px 4px hsl(0 0% 0% / 0.05)"
                        : "inset 3px 0 0 hsl(var(--border)), 0 1px 4px hsl(0 0% 0% / 0.05)",
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 relative font-bold text-[12px] select-none"
                      style={{
                        backgroundColor: online ? "#c3f83225" : "hsl(var(--muted))",
                        border: online ? "1.5px solid #c3f832" : "1.5px solid hsl(var(--border))",
                        color: online ? "#5a7a00" : "hsl(var(--muted-foreground))",
                        opacity: online ? 1 : 0.6,
                      }}
                    >
                      {deviceId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase()}
                      {online && (
                        <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-card animate-pulse" />
                      )}
                      {alertCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5 ring-1 ring-card">
                          {alertCount}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-[13px] break-all leading-tight">{deviceId}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                          style={{ backgroundColor: "#c3f83230", color: "#5a7a00" }}>
                          ESP32
                        </span>
                      </div>

                      <div className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Navigation className={`h-2.5 w-2.5 flex-shrink-0 ${!validLoc ? "text-destructive/50" : ""}`} />
                          {/* ✅ FIX Bug 2: show "No GPS Signal" instead of 0.00000 */}
                          {validLoc ? (
                            <span className="font-mono">
                              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                            </span>
                          ) : (
                            <span className="text-destructive/60 italic font-medium">
                              No GPS Signal
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5 flex-shrink-0" />
                          <span>{formatTs(location.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Device History Dialog */}
      {selectedDeviceHistory && (
        <DeviceHistoryDialog
          deviceId={selectedDeviceHistory}
          locations={locations}
          isOpen={!!selectedDeviceHistory}
          onClose={() => setSelectedDeviceHistory(null)}
        />
      )}
    </ScrollArea>
  );
};
