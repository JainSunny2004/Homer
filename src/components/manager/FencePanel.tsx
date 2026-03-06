import { useState } from "react";
import { PolygonFence } from "@/types/gps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Clock,
  Square,
  PenTool,
  Type,
  X,
  Circle,
  Leaf,
  Gauge,
  ChevronDown,
  ChevronRight,
  MapPin,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export type DrawingMode = "none" | "polygon" | "rectangle" | "circle";

interface FencePanelProps {
  fences: PolygonFence[];
  onAddFence: (fence: Omit<PolygonFence, "id">) => void;
  onRemoveFence: (id: string) => void;
  onUpdateFence: (id: string, updates: Partial<PolygonFence>) => void;
  drawingMode: DrawingMode;
  onSetDrawingMode: (mode: DrawingMode) => void;
  pendingCoords: { lat: number; lng: number }[] | null;
  onClearPendingCoords: () => void;
  isCreating: boolean;
  onSetIsCreating: (creating: boolean) => void;
}

const COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

export const FencePanel = ({
  fences,
  onAddFence,
  onRemoveFence,
  onUpdateFence,
  drawingMode,
  onSetDrawingMode,
  pendingCoords,
  onClearPendingCoords,
  isCreating,
  onSetIsCreating,
}: FencePanelProps) => {
  const [zonesOpen, setZonesOpen] = useState(true);
  if (isCreating) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Create button */}
      <div className="px-3 pt-3 pb-3 border-b border-border flex-shrink-0">
        <Button
          onClick={() => {
            onSetIsCreating(true);
            onSetDrawingMode("rectangle");
          }}
          className="w-full gap-2 h-10 text-sm font-bold rounded-xl shadow-sm"
          style={{ backgroundColor: "#c3f832", color: "#141414" }}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New Task Area
        </Button>
      </div>

      {/* Zone list */}
      <Collapsible
        open={zonesOpen}
        onOpenChange={setZonesOpen}
        className="flex-1 min-h-0 flex flex-col"
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-muted/50 transition-colors flex-shrink-0">
          <div className="flex items-center gap-2">
            {zonesOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Task Areas
            </span>
          </div>
          <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
            {fences.length}
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-2 py-2 space-y-1.5">
              {fences.length === 0 && (
                <div className="mx-3 mt-2 py-10 flex flex-col items-center gap-3 bg-muted/40 rounded-2xl border border-dashed border-border">
                  <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">
                      No task areas yet
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Click "New Task Area" to start
                    </p>
                  </div>
                </div>
              )}

              {fences.map((fence) => (
                <div
                  key={fence.id}
                  className="group mx-3 mb-2 rounded-xl bg-card border border-border overflow-hidden transition-all duration-150 hover:shadow-md hover:-translate-y-px"
                  style={{ boxShadow: "0 1px 4px hsl(0 0% 0% / 0.06)" }}
                >
                  {/* Top color accent bar */}
                  <div
                    className="h-1 w-full"
                    style={{ backgroundColor: fence.color }}
                  />

                  <div className="p-3 flex items-start gap-3">
                    {/* Color dot */}
                    <div
                      className="h-8 w-8 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5"
                      style={{
                        backgroundColor: fence.color + "22",
                        border: `1.5px solid ${fence.color}`,
                      }}
                    >
                      <MapPin
                        className="h-3.5 w-3.5"
                        style={{ color: fence.color }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[13px] text-foreground break-all">
                          {fence.name}
                        </span>
                        {fence.isGreenCorridor && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: "#c3f832",
                              color: "#141414",
                            }}
                          >
                            CORRIDOR
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fence.shiftStart} – {fence.shiftEnd}
                        </span>
                        <span className="flex items-center gap-1">
                          <Gauge className="h-3 w-3" />±
                          {fence.toleranceMeters ?? 20}m
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive rounded-lg flex-shrink-0"
                      onClick={() => onRemoveFence(fence.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

// ─── FenceCreationPanel ───────────────────────────────────────────────────────

interface FenceCreationPanelProps {
  onClose: () => void;
  onSave: (fence: Omit<PolygonFence, "id">) => void;
  drawingMode: DrawingMode;
  onSetDrawingMode: (mode: DrawingMode) => void;
  pendingCoords: { lat: number; lng: number }[] | null;
  onClearPendingCoords: () => void;
}

export const FenceCreationPanel = ({
  onClose,
  onSave,
  drawingMode,
  onSetDrawingMode,
  pendingCoords,
  onClearPendingCoords,
}: FenceCreationPanelProps) => {
  const [newFence, setNewFence] = useState({
    name: "",
    shiftStart: "09:00",
    shiftEnd: "17:00",
    color: COLORS[0],
  });
  const [createMethod, setCreateMethod] = useState<
    "draw" | "rectangle" | "circle" | "coordinates"
  >("rectangle");
  const [isGreenCorridor, setIsGreenCorridor] = useState(false);
  const [toleranceMeters, setToleranceMeters] = useState(20);
  const [manualCoords, setManualCoords] = useState([
    { lat: "", lng: "" },
    { lat: "", lng: "" },
    { lat: "", lng: "" },
    { lat: "", lng: "" },
  ]);

  const handleMethodChange = (method: typeof createMethod) => {
    setCreateMethod(method);
    onClearPendingCoords();
    if (method === "draw") onSetDrawingMode("polygon");
    else if (method === "rectangle") onSetDrawingMode("rectangle");
    else if (method === "circle") onSetDrawingMode("circle");
    else onSetDrawingMode("none");
  };

  const handleSave = () => {
    if (!newFence.name.trim()) return;
    let coords: { lat: number; lng: number }[];
    if (createMethod === "coordinates") {
      const valid = manualCoords
        .filter((c) => c.lat && c.lng)
        .map((c) => ({ lat: parseFloat(c.lat), lng: parseFloat(c.lng) }))
        .filter((c) => !isNaN(c.lat) && !isNaN(c.lng));
      if (valid.length < 3) {
        alert("At least 3 valid coordinates required");
        return;
      }
      coords = valid;
    } else if (pendingCoords && pendingCoords.length >= 3) {
      coords = pendingCoords;
    } else {
      alert("Draw a task area on the map first");
      return;
    }
    onSave({
      name: newFence.name,
      coordinates: coords,
      color: newFence.color,
      shiftStart: newFence.shiftStart,
      shiftEnd: newFence.shiftEnd,
      isGreenCorridor,
      toleranceMeters,
    });
  };

  const addCoordRow = () =>
    setManualCoords([...manualCoords, { lat: "", lng: "" }]);
  const updateCoord = (i: number, f: "lat" | "lng", v: string) => {
    const u = [...manualCoords];
    u[i][f] = v;
    setManualCoords(u);
  };
  const removeCoordRow = (i: number) => {
    if (manualCoords.length > 3)
      setManualCoords(manualCoords.filter((_, idx) => idx !== i));
  };

  return (
    <div className="w-80 border-l bg-card flex flex-col h-full flex-shrink-0 panel-shadow-l">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-transparent flex-shrink-0">
        <div>
          <h2 className="font-bold text-sm">New Task Area</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Define zone on map or enter coordinates
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Drawing method */}
          <Tabs
            value={createMethod}
            onValueChange={(v) => handleMethodChange(v as typeof createMethod)}
          >
            <TabsList className="w-full grid grid-cols-4 h-9 bg-muted/60 rounded-lg p-0.5">
              <TabsTrigger
                value="rectangle"
                className="h-8 rounded-md text-xs gap-1 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <Square className="h-3 w-3" />
                <span className="hidden sm:inline">Rect</span>
              </TabsTrigger>
              <TabsTrigger
                value="circle"
                className="h-8 rounded-md text-xs gap-1 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <Circle className="h-3 w-3" />
                <span className="hidden sm:inline">Circle</span>
              </TabsTrigger>
              <TabsTrigger
                value="draw"
                className="h-8 rounded-md text-xs gap-1 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <PenTool className="h-3 w-3" />
                <span className="hidden sm:inline">Draw</span>
              </TabsTrigger>
              <TabsTrigger
                value="coordinates"
                className="h-8 rounded-md text-xs gap-1 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <Type className="h-3 w-3" />
                <span className="hidden sm:inline">Manual</span>
              </TabsTrigger>
            </TabsList>

            {(["rectangle", "circle", "draw"] as const).map((method) => (
              <TabsContent key={method} value={method} className="mt-3">
                <div className="p-3 bg-muted/40 rounded-xl border border-border/40 text-xs">
                  <p className="font-semibold mb-1">
                    {method === "rectangle"
                      ? "Draw a rectangle"
                      : method === "circle"
                        ? "Drop a circle"
                        : "Draw a polygon"}
                  </p>
                  <p className="text-muted-foreground">
                    {method === "rectangle"
                      ? "Click and drag on the map. Resize using corner handles."
                      : method === "circle"
                        ? "Click and drag on the map to set radius."
                        : "Click to place points. Click first point to close."}
                  </p>
                </div>
                {pendingCoords && pendingCoords.length > 0 && (
                  <div className="mt-2 p-2.5 bg-primary/8 rounded-xl border border-primary/20 text-xs text-primary font-semibold flex items-center gap-1.5">
                    ✓{" "}
                    {method === "draw"
                      ? `Shape drawn (${pendingCoords.length} pts)`
                      : `${method.charAt(0).toUpperCase() + method.slice(1)} placed`}
                  </div>
                )}
              </TabsContent>
            ))}

            <TabsContent value="coordinates" className="mt-3 space-y-2">
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 text-xs">
                <p className="font-semibold mb-1">Enter coordinates</p>
                <p className="text-muted-foreground">
                  Min 3 points · Decimal degrees
                </p>
              </div>
              <div className="space-y-1.5">
                {manualCoords.map((coord, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <span className="text-[10px] text-muted-foreground w-4 text-center flex-shrink-0 font-bold">
                      {i + 1}
                    </span>
                    <Input
                      placeholder="Lat"
                      value={coord.lat}
                      onChange={(e) => updateCoord(i, "lat", e.target.value)}
                      className="flex-1 h-7 text-xs"
                    />
                    <Input
                      placeholder="Lng"
                      value={coord.lng}
                      onChange={(e) => updateCoord(i, "lng", e.target.value)}
                      className="flex-1 h-7 text-xs"
                    />
                    {manualCoords.length > 3 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeCoordRow(i)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addCoordRow}
                className="w-full gap-1 h-8"
              >
                <Plus className="h-3 w-3" />
                Add Point
              </Button>
            </TabsContent>
          </Tabs>

          {/* Details form */}
          <div className="space-y-4 pt-3 border-t border-border/40">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Zone Name</Label>
              <Input
                placeholder="e.g., Crane Zone A"
                value={newFence.name}
                onChange={(e) =>
                  setNewFence({ ...newFence, name: e.target.value })
                }
                className="h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Shift Start</Label>
                <Input
                  type="time"
                  value={newFence.shiftStart}
                  onChange={(e) =>
                    setNewFence({ ...newFence, shiftStart: e.target.value })
                  }
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Shift End</Label>
                <Input
                  type="time"
                  value={newFence.shiftEnd}
                  onChange={(e) =>
                    setNewFence({ ...newFence, shiftEnd: e.target.value })
                  }
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Zone Color</Label>
              <div className="flex items-center gap-2.5">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    className={`w-7 h-7 rounded-lg transition-all duration-150 ${
                      newFence.color === color
                        ? "ring-2 ring-offset-2 ring-offset-card scale-110 ring-foreground/30"
                        : "hover:scale-105 ring-1 ring-black/10"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewFence({ ...newFence, color })}
                  />
                ))}
              </div>
            </div>

            {/* GPS Tolerance */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Gauge className="h-3 w-3" />
                GPS Tolerance
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={toleranceMeters}
                  onChange={(e) => setToleranceMeters(Number(e.target.value))}
                  className="h-9 text-sm flex-1"
                />
                <span className="text-xs text-muted-foreground font-medium flex-shrink-0">
                  metres
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Default 20m · compensates for GPS drift
              </p>
            </div>

            {/* Green Corridor */}
            <div
              className={`flex items-center justify-between rounded-xl border p-3 transition-all duration-200 ${
                isGreenCorridor
                  ? "border-green-500/40 bg-green-500/5"
                  : "border-border/50 bg-muted/20"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <Leaf
                  className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isGreenCorridor ? "text-green-500" : "text-muted-foreground"}`}
                />
                <div>
                  <p className="text-sm font-semibold">Green Corridor</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                    Shared path · workers here skip zone alerts
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isGreenCorridor}
                onChange={(e) => setIsGreenCorridor(e.target.checked)}
                className="w-4 h-4 accent-green-500 cursor-pointer flex-shrink-0 ml-2"
              />
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex-shrink-0 p-4 border-t bg-muted/10">
        <Button
          onClick={handleSave}
          className="w-full h-10 font-semibold rounded-xl"
        >
          Save Task Area
        </Button>
      </div>
    </div>
  );
};
