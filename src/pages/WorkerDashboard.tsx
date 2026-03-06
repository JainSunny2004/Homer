import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGPSData } from "@/hooks/useGPSData";
import { usePolygonFences } from "@/hooks/usePolygonFences";
import { useWorkerAssignments } from "@/hooks/useWorkerAssignments";
import { useManagerSettings } from "@/hooks/useManagerSettings";
import { useZoneAlerts } from "@/hooks/useZoneAlerts";
import { useInactivityAlerts } from "@/hooks/useInactivityAlerts";
import { useSilenceAlerts } from "@/hooks/useSilenceAlerts";
import { useCoMovementAlerts } from "@/hooks/useCoMovementAlerts";
import { useEscalationAlerts } from "@/hooks/useEscalationAlerts";
import { useAlertPersistence } from "@/hooks/useAlertPersistence";
import { useAuditLog } from "@/hooks/useAuditLog";
import { ManagerMap } from "@/components/manager/ManagerMap";
import {
  FencePanel,
  FenceCreationPanel,
  DrawingMode,
} from "@/components/manager/FencePanel";
import { WorkerPanel } from "@/components/manager/WorkerPanel";
import { SettingsDialog } from "@/components/manager/SettingsDialog";
import { AlertsHistoryPanel } from "@/components/manager/AlertsHistoryPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, RefreshCw, Users, MapPin, Settings, Bell, Moon, Sun } from "lucide-react";
import homerLogo from "@/assets/homer-logo.gif";
import { PolygonFence } from "@/types/gps";
import { AlertStatus, ALERT_PRIORITY } from "@/types/alerts";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const ManagerDashboard = () => {
  const { user, logout, hasPermission } = useAuth();
  const [drawingMode, setDrawingMode]   = useState<DrawingMode>("none");
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number }[] | null>(null);
  const [isCreatingFence, setIsCreatingFence] = useState(false);
  const [settingsOpen, setSettingsOpen]       = useState(false);
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);

  // ── Theme toggle ─────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("homer-theme");
    if (saved === "dark") { document.documentElement.classList.add("dark"); return true; }
    return false;
  });
  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("homer-theme", next ? "dark" : "light");
      return next;
    });
  }, []);

  // ── Resizable panels ─────────────────────────────────────────────────────
  const [sidebarWidth, setSidebarWidth]         = useState(288);
  const [alertsPanelWidth, setAlertsPanelWidth] = useState(320);
  const sidebarResizing = useRef(false);
  const alertsResizing  = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (sidebarResizing.current) setSidebarWidth(clamp(e.clientX, 240, 480));
      if (alertsResizing.current)  setAlertsPanelWidth(clamp(window.innerWidth - e.clientX, 280, 540));
    };
    const onUp = () => {
      if (sidebarResizing.current || alertsResizing.current) {
        sidebarResizing.current = false;
        alertsResizing.current  = false;
        document.body.style.cursor     = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, []);

  // ── Alert status overrides ───────────────────────────────────────────────
  const [alertStatuses, setAlertStatuses] = useState<
    Map<string, { status: AlertStatus; by: string; at: Date }>
  >(new Map());

  const { settings, updateSettings, resetToDefaults } = useManagerSettings();
  const { locations, isLoading, refresh, error }       = useGPSData({
    refreshIntervalSeconds: settings.autoRefreshIntervalSeconds,
  });
  const { fences, addFence, removeFence, updateFence } = usePolygonFences();
  const { assignments, assignWorker, unassignWorker }  = useWorkerAssignments();

  const workers = useMemo(
    () => [...new Set((locations ?? []).map((l) => l.device_id))],
    [locations],
  );

  const { alerts: zoneAlerts,       clearAlert: clearZone,       clearAllAlerts: clearAllZone       } = useZoneAlerts(locations ?? [], fences ?? [], assignments ?? [], { outOfZoneAlertDelaySeconds: settings.outOfZoneAlertDelaySeconds });
  const { alerts: inactivityAlerts, clearAlert: clearInactivity, clearAllAlerts: clearAllInactivity } = useInactivityAlerts(locations ?? [], assignments ?? [], { inactivityThresholdMinutes: settings.inactivityThresholdMinutes, inactivityBreakExtendMinutes: settings.inactivityBreakExtendMinutes, breakStartTime: settings.breakStartTime, breakDurationValue: settings.breakDurationValue, breakDurationUnit: settings.breakDurationUnit });
  const { alerts: silenceAlerts,    clearAlert: clearSilence,    clearAllAlerts: clearAllSilence    } = useSilenceAlerts(locations ?? [], assignments ?? [], { silenceAlertMinutes: settings.silenceAlertMinutes });
  const { alerts: coMovementAlerts, clearAlert: clearCoMovement, clearAllAlerts: clearAllCoMovement } = useCoMovementAlerts(locations ?? [], { coMovementThresholdMeters: settings.coMovementThresholdMeters, coMovementDurationSeconds: settings.coMovementDurationSeconds, shiftChangeTime: settings.shiftChangeTime, shiftChangeWindowMinutes: settings.shiftChangeWindowMinutes });

  const allAlerts = useMemo(() => {
    const merged = [...zoneAlerts, ...inactivityAlerts, ...silenceAlerts, ...coMovementAlerts];
    return merged
      .map((a) => {
        const override = alertStatuses.get(a.id);
        return {
          ...a,
          priority:        ALERT_PRIORITY[a.type] ?? 6,
          status:          override?.status ?? ("active" as AlertStatus),
          acknowledgedBy:  override?.status === "acknowledged" ? override.by : undefined,
          acknowledgedAt:  override?.status === "acknowledged" ? override.at : undefined,
          silencedBy:      override?.status === "silenced"     ? override.by : undefined,
          silencedAt:      override?.status === "silenced"     ? override.at : undefined,
          escalatedAt:     override?.status === "escalated"    ? override.at : undefined,
        };
      })
      .sort((a, b) => a.priority - b.priority);
  }, [zoneAlerts, inactivityAlerts, silenceAlerts, coMovementAlerts, alertStatuses]);

  const { history, isLoading: historyLoading, loadHistory, persistAlert, updateAlertStatus } = useAlertPersistence();
  const { entries: auditEntries, isLoading: auditLoading, loadAuditLog, logAction }          = useAuditLog(user);

  const prevAlertIds = useRef(new Set<string>());
  useEffect(() => {
    allAlerts.forEach((alert) => {
      if (!prevAlertIds.current.has(alert.id)) {
        prevAlertIds.current.add(alert.id);
        persistAlert(alert);
      }
    });
  }, [allAlerts, persistAlert]);

  const handleAcknowledgeAlert = useCallback((id: string) => {
    setAlertStatuses((prev) => new Map(prev).set(id, { status: "acknowledged", by: user?.name ?? "Unknown", at: new Date() }));
    updateAlertStatus(id, "acknowledged", user?.name);
    const alert = allAlerts.find((a) => a.id === id);
    logAction("acknowledge_alert", id, alert?.title);
  }, [user, allAlerts, updateAlertStatus, logAction]);

  const handleSilenceAlert = useCallback((id: string) => {
    setAlertStatuses((prev) => new Map(prev).set(id, { status: "silenced", by: user?.name ?? "Unknown", at: new Date() }));
    updateAlertStatus(id, "silenced", user?.name);
    const alert = allAlerts.find((a) => a.id === id);
    logAction("silence_alert", id, alert?.title);
  }, [user, allAlerts, updateAlertStatus, logAction]);

  const handleEscalateAlert = useCallback((id: string) => {
    setAlertStatuses((prev) => {
      const existing = prev.get(id);
      if (existing && existing.status !== "active") return prev;
      return new Map(prev).set(id, { status: "escalated", by: "system", at: new Date() });
    });
  }, []);

  useEscalationAlerts(allAlerts, handleEscalateAlert, { escalationMinutes: settings.escalationMinutes });

  const activeAlertCount = useMemo(
    () => allAlerts.filter((a) => a.status === "active" || a.status === "escalated").length,
    [allAlerts],
  );

  const clearAlertById = useCallback((id: string) => {
    clearZone(id); clearInactivity(id); clearSilence(id); clearCoMovement(id);
    setAlertStatuses((prev) => { const next = new Map(prev); next.delete(id); return next; });
  }, [clearZone, clearInactivity, clearSilence, clearCoMovement]);

  const clearAllAlerts = useCallback(() => {
    clearAllZone(); clearAllInactivity(); clearAllSilence(); clearAllCoMovement();
    setAlertStatuses(new Map());
  }, [clearAllZone, clearAllInactivity, clearAllSilence, clearAllCoMovement]);

  const handleFenceComplete  = (coords: { lat: number; lng: number }[]) => setPendingCoords(coords);
  const handleStartCreating  = () => { setIsCreatingFence(true); setDrawingMode("rectangle"); setPendingCoords(null); };
  const handleCancelCreating = () => { setIsCreatingFence(false); setDrawingMode("none"); setPendingCoords(null); };
  const handleSaveFence      = (fence: Omit<PolygonFence, "id">) => { addFence(fence); handleCancelCreating(); };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b bg-card/95 backdrop-blur-sm flex-shrink-0 panel-shadow">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg overflow-hidden ring-1 ring-border/60 flex-shrink-0">
            <img src={homerLogo} alt="Homer" className="h-full w-full object-cover" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight tracking-tight">ST-Homer Manager</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">{user?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          {user?.role && (
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 capitalize mr-2">
              {user.role}
            </span>
          )}

          {/* Dark mode toggle */}
          <Button variant="ghost" size="icon" onClick={toggleTheme} title={isDark ? "Light mode" : "Dark mode"}
            className="h-8 w-8 rounded-lg">
            {isDark
              ? <Sun  className="h-4 w-4 text-accent" />
              : <Moon className="h-4 w-4" />}
          </Button>

          <Button variant="ghost" size="icon" onClick={refresh} disabled={isLoading} title="Refresh"
            className="h-8 w-8 rounded-lg">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-primary" : ""}`} />
          </Button>

          {hasPermission("view_settings") && (
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="Settings"
              className="h-8 w-8 rounded-lg">
              <Settings className="h-4 w-4" />
            </Button>
          )}

          <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-lg"
            onClick={() => setAlertsPanelOpen((o) => !o)} title="Alerts">
            <Bell className={`h-4 w-4 ${activeAlertCount > 0 ? "text-amber-500" : ""}`} />
            {activeAlertCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5 ring-1 ring-card">
                {activeAlertCount > 99 ? "99+" : activeAlertCount}
              </span>
            )}
          </Button>

          <Button variant="ghost" size="icon" onClick={logout} title="Logout"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left Sidebar */}
        <div
          className="border-r flex flex-col bg-card flex-shrink-0 overflow-hidden panel-shadow"
          style={{ width: sidebarWidth }}
        >
          <Tabs defaultValue="fences" className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="grid grid-cols-2 m-2 mb-1">
              <TabsTrigger value="fences"  className="gap-1.5 text-xs">
                <MapPin className="h-3 w-3" /> Task Areas
              </TabsTrigger>
              <TabsTrigger value="workers" className="gap-1.5 text-xs">
                <Users className="h-3 w-3" /> Workers
              </TabsTrigger>
            </TabsList>

            <TabsContent value="fences"  className="flex-1 overflow-hidden mt-0">
              <FencePanel
                fences={fences ?? []}
                onAddFence={addFence}
                onRemoveFence={removeFence}
                onUpdateFence={updateFence}
                drawingMode={drawingMode}
                onSetDrawingMode={setDrawingMode}
                pendingCoords={pendingCoords}
                onClearPendingCoords={() => setPendingCoords(null)}
                isCreating={isCreatingFence}
                onSetIsCreating={handleStartCreating}
              />
            </TabsContent>

            <TabsContent value="workers" className="flex-1 overflow-hidden mt-0">
              <WorkerPanel
                workers={workers}
                locations={locations ?? []}
                assignments={assignments ?? []}
                fences={fences ?? []}
                onAssignWorker={assignWorker}
                onUnassignWorker={unassignWorker}
                apiError={error}
                deviceTimeoutSeconds={settings.deviceTimeoutSeconds}
                showOfflineDevices={settings.showOfflineDevices}
                safetyAlerts={allAlerts}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Sidebar resize handle ── */}
        <div
          className="resize-handle"
          onMouseDown={(e) => {
            e.preventDefault();
            sidebarResizing.current    = true;
            document.body.style.cursor     = "col-resize";
            document.body.style.userSelect = "none";
          }}
        />

        {/* Map */}
        <div className="flex-1 relative overflow-hidden">
          <ManagerMap
            locations={locations ?? []}
            fences={fences ?? []}
            assignments={assignments ?? []}
            drawingMode={drawingMode}
            onFenceComplete={handleFenceComplete}
            defaultZoom={settings.defaultMapZoom}
            showOfflineDevices={settings.showOfflineDevices}
            deviceTimeoutSeconds={settings.deviceTimeoutSeconds}
          />
        </div>

        {/* Right panels */}
        {isCreatingFence && (
          <FenceCreationPanel
            onClose={handleCancelCreating}
            onSave={handleSaveFence}
            drawingMode={drawingMode}
            onSetDrawingMode={setDrawingMode}
            pendingCoords={pendingCoords}
            onClearPendingCoords={() => setPendingCoords(null)}
          />
        )}

        {alertsPanelOpen && !isCreatingFence && (
          <>
            {/* ── Alerts panel resize handle ── */}
            <div
              className="resize-handle"
              onMouseDown={(e) => {
                e.preventDefault();
                alertsResizing.current     = true;
                document.body.style.cursor     = "col-resize";
                document.body.style.userSelect = "none";
              }}
            />
            <div style={{ width: alertsPanelWidth }} className="flex-shrink-0 h-full">
              <AlertsHistoryPanel
                alerts={allAlerts}
                history={history}
                auditEntries={auditEntries}
                historyLoading={historyLoading}
                auditLoading={auditLoading}
                onClearAlert={clearAlertById}
                onClearAll={clearAllAlerts}
                onAcknowledge={handleAcknowledgeAlert}
                onSilence={handleSilenceAlert}
                onClose={() => setAlertsPanelOpen(false)}
                onRefreshHistory={loadHistory}
                onRefreshAudit={loadAuditLog}
                hasPermission={hasPermission}
              />
            </div>
          </>
        )}
      </div>

      {hasPermission("view_settings") && (
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          settings={settings}
          onSave={updateSettings}
          onReset={resetToDefaults}
        />
      )}
    </div>
  );
};

export default ManagerDashboard;
