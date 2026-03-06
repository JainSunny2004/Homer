import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button }    from '@/components/ui/button';
import { Input }     from '@/components/ui/input';
import { Label }     from '@/components/ui/label';
import { Switch }    from '@/components/ui/switch';
import { Slider }    from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator }  from '@/components/ui/separator';
import { ManagerSettings, DEFAULT_SETTINGS } from '@/types/settings';
import {
  Clock,
  Monitor,
  RotateCcw,
  ShieldAlert,
  Activity,
  WifiOff,
  Users,
  Bell,
  MessageCircle,
} from 'lucide-react';


interface SettingsDialogProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  settings:     ManagerSettings;
  onSave:       (settings: ManagerSettings) => void;
  onReset:      () => void;
}


export const SettingsDialog = ({
  open,
  onOpenChange,
  settings,
  onSave,
  onReset,
}: SettingsDialogProps) => {
  const [local, setLocal] = useState<ManagerSettings>(settings);

  useEffect(() => {
    if (open) setLocal(settings);
  }, [open, settings]);

  const upd = (updates: Partial<ManagerSettings>) =>
    setLocal(prev => ({ ...prev, ...updates }));

  const handleSave = () => {
    onSave(local);
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocal(DEFAULT_SETTINGS);
    onReset();
  };

  const sectionHeader = (icon: React.ReactNode, title: string) => (
    <div className="flex items-center gap-2.5 pt-1">
      <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <span className="text-sm font-semibold text-foreground">{title}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        ── Key UI fix: flex-col + overflow-hidden on DialogContent,
           fixed header/footer, ScrollArea on body so nothing is cut off
      ── */}
      <DialogContent className="max-w-lg flex flex-col p-0 gap-0 max-h-[88vh] overflow-hidden">

        {/* ── Fixed Header ── */}
        <DialogHeader className="px-5 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent flex-shrink-0">
          <DialogTitle className="text-base font-semibold">Settings</DialogTitle>
        </DialogHeader>

        {/* ── Scrollable Body ── */}
        <ScrollArea className="flex-1">
          <div className="px-5 py-4 space-y-5">


            {/* ══════════════════════════════════════════════
                Device Monitoring
            ══════════════════════════════════════════════ */}
            {sectionHeader(
              <Monitor className="h-3.5 w-3.5 text-blue-400" />,
              'Device Monitoring',
            )}

            <div className="section-card space-y-4">

              {/* Offline Timeout */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">Offline Timeout</Label>
                  <span className="text-xs font-semibold text-primary tabular-nums">
                    {local.deviceTimeoutSeconds}s
                  </span>
                </div>
                <Slider
                  value={[local.deviceTimeoutSeconds]}
                  onValueChange={([v]) => upd({ deviceTimeoutSeconds: v })}
                  min={10} max={60} step={5}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>10s</span><span>60s</span>
                </div>
              </div>

              {/* Out-of-Zone Alert Delay */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">Out-of-Zone Alert Delay</Label>
                  <span className="text-xs font-semibold text-primary tabular-nums">
                    {local.outOfZoneAlertDelaySeconds}s
                  </span>
                </div>
                <Slider
                  value={[local.outOfZoneAlertDelaySeconds]}
                  onValueChange={([v]) => upd({ outOfZoneAlertDelaySeconds: v })}
                  min={10} max={120} step={10}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>10s</span><span>120s</span>
                </div>
              </div>

            </div>

            <Separator />


            {/* ══════════════════════════════════════════════
                Work Schedule
            ══════════════════════════════════════════════ */}
            {sectionHeader(
              <Clock className="h-3.5 w-3.5 text-green-400" />,
              'Work Schedule',
            )}

            <div className="section-card space-y-4">

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Break Start</Label>
                  <Input
                    type="time"
                    value={local.breakStartTime}
                    onChange={e => upd({ breakStartTime: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Break Duration</Label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      value={local.breakDurationValue}
                      onChange={e => upd({ breakDurationValue: parseInt(e.target.value) || 1 })}
                      className="w-16 h-8 text-sm"
                    />
                    <Select
                      value={local.breakDurationUnit}
                      onValueChange={v => upd({ breakDurationUnit: v as 'minutes' | 'hours' })}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">min</SelectItem>
                        <SelectItem value="hours">hr</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Shift Change Time</Label>
                  <Input
                    type="time"
                    value={local.shiftChangeTime}
                    onChange={e => upd({ shiftChangeTime: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Shift Change Window</Label>
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      {local.shiftChangeWindowMinutes} min
                    </span>
                  </div>
                  <Slider
                    value={[local.shiftChangeWindowMinutes]}
                    onValueChange={([v]) => upd({ shiftChangeWindowMinutes: v })}
                    min={5} max={30} step={5}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>5 min</span><span>30 min</span>
                  </div>
                </div>
              </div>

            </div>

            <Separator />


            {/* ══════════════════════════════════════════════
                Safety Alerts
            ══════════════════════════════════════════════ */}
            {sectionHeader(
              <ShieldAlert className="h-3.5 w-3.5 text-orange-400" />,
              'Safety Alerts',
            )}

            <div className="section-card space-y-5">

              {/* ── Inactivity ── */}
              <div className="space-y-3 pl-3 border-l-2 border-orange-500/40">
                <p className="text-xs font-semibold flex items-center gap-1.5 text-orange-400">
                  <Activity className="h-3 w-3" /> Inactivity Detection
                </p>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Inactivity Threshold</Label>
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      {local.inactivityThresholdMinutes} min
                    </span>
                  </div>
                  <Slider
                    value={[local.inactivityThresholdMinutes]}
                    onValueChange={([v]) => upd({ inactivityThresholdMinutes: v })}
                    min={5} max={30} step={1}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>5 min</span><span>30 min</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Break Extension</Label>
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      +{local.inactivityBreakExtendMinutes} min
                    </span>
                  </div>
                  <Slider
                    value={[local.inactivityBreakExtendMinutes]}
                    onValueChange={([v]) => upd({ inactivityBreakExtendMinutes: v })}
                    min={0} max={30} step={5}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Extra grace period added to threshold during break time.
                  </p>
                </div>
              </div>

              {/* ── Silence ── */}
              <div className="space-y-3 pl-3 border-l-2 border-red-500/40">
                <p className="text-xs font-semibold flex items-center gap-1.5 text-red-400">
                  <WifiOff className="h-3 w-3" /> Tracker Silence Alert
                </p>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Silence Threshold</Label>
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      {local.silenceAlertMinutes} min
                    </span>
                  </div>
                  <Slider
                    value={[local.silenceAlertMinutes]}
                    onValueChange={([v]) => upd({ silenceAlertMinutes: v })}
                    min={2} max={30} step={1}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>2 min</span><span>30 min</span>
                  </div>
                </div>
              </div>

              {/* ── Co-movement ── */}
              <div className="space-y-3 pl-3 border-l-2 border-blue-500/40">
                <p className="text-xs font-semibold flex items-center gap-1.5 text-blue-400">
                  <Users className="h-3 w-3" /> Co-movement Detection
                </p>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Proximity Threshold</Label>
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      {local.coMovementThresholdMeters} m
                    </span>
                  </div>
                  <Slider
                    value={[local.coMovementThresholdMeters]}
                    onValueChange={([v]) => upd({ coMovementThresholdMeters: v })}
                    min={5} max={50} step={5}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>5 m</span><span>50 m</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Duration to Alert</Label>
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      {local.coMovementDurationSeconds} s
                    </span>
                  </div>
                  <Slider
                    value={[local.coMovementDurationSeconds]}
                    onValueChange={([v]) => upd({ coMovementDurationSeconds: v })}
                    min={30} max={300} step={30}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>30 s</span><span>300 s</span>
                  </div>
                </div>
              </div>

            </div>

            <Separator />


            {/* ══════════════════════════════════════════════
                Advanced Alerts — Sprint 4
            ══════════════════════════════════════════════ */}
            {sectionHeader(
              <ShieldAlert className="h-3.5 w-3.5 text-purple-400" />,
              'Advanced Alerts',
            )}

            <div className="section-card space-y-4">

              <div className="grid grid-cols-2 gap-4">

                {/* Battery Alert Threshold */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Battery Alert Threshold</Label>
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      {local.batteryAlertThreshold}%
                    </span>
                  </div>
                  <Slider
                    value={[local.batteryAlertThreshold]}
                    onValueChange={([v]) => upd({ batteryAlertThreshold: v })}
                    min={5} max={50} step={5}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>5%</span><span>50%</span>
                  </div>
                </div>

                {/* Escalation Delay */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Escalation Delay</Label>
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      {local.escalationMinutes} min
                    </span>
                  </div>
                  <Slider
                    value={[local.escalationMinutes]}
                    onValueChange={([v]) => upd({ escalationMinutes: v })}
                    min={1} max={30} step={1}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>1 min</span><span>30 min</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Unacknowledged alerts escalate after this duration.
                  </p>
                </div>

              </div>
            </div>

            <Separator />


            {/* ══════════════════════════════════════════════
                Notifications — Sprint 5
            ══════════════════════════════════════════════ */}
            {sectionHeader(
              <Bell className="h-3.5 w-3.5 text-yellow-400" />,
              'Notifications',
            )}

            <div className="section-card space-y-4">

              {/* WhatsApp toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <MessageCircle className="w-3 h-3 text-green-500" />
                    WhatsApp Alerts
                  </Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Send WhatsApp messages on critical alerts
                  </p>
                </div>
                <Switch
                  checked={local.whatsappEnabled}
                  onCheckedChange={checked => upd({ whatsappEnabled: checked })}
                />
              </div>

              {/* Phone numbers — only shown when enabled */}
              {local.whatsappEnabled && (
                <div className="space-y-1.5 pl-3 border-l-2 border-green-600/40">
                  <Label className="text-xs">Phone Numbers</Label>
                  <Input
                    value={local.whatsappNumbers}
                    onChange={e => upd({ whatsappNumbers: e.target.value })}
                    placeholder="+919876543210, +911234567890"
                    className="h-8 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Comma-separated numbers with country code.
                  </p>
                </div>
              )}

              {/* Per-level toggles */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Notify on Alert Levels</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { key: 'notifyOnL1', label: 'L1 · Geo-fence',  color: 'text-red-500'    },
                      { key: 'notifyOnL2', label: 'L2 · Impact',      color: 'text-orange-500' },
                      { key: 'notifyOnL3', label: 'L3 · Inactivity',  color: 'text-amber-500'  },
                      { key: 'notifyOnL4', label: 'L4 · Battery',     color: 'text-yellow-500' },
                      { key: 'notifyOnL5', label: 'L5 · Silence',     color: 'text-purple-500' },
                      { key: 'notifyOnL6', label: 'L6 · Co-movement', color: 'text-blue-500'   },
                    ] as { key: keyof ManagerSettings; label: string; color: string }[]
                  ).map(({ key, label, color }) => (
                    <div
                      key={key}
                      className="flex items-center gap-2 bg-muted/50 rounded-lg px-2 py-1.5 border border-border/40"
                    >
                      <Switch
                        checked={!!local[key]}
                        onCheckedChange={checked => upd({ [key]: checked })}
                        className="scale-75 origin-left"
                      />
                      <span className={`text-[11px] font-medium ${color}`}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <Separator />


            {/* ══════════════════════════════════════════════
                Display Preferences
            ══════════════════════════════════════════════ */}
            {sectionHeader(
              <Monitor className="h-3.5 w-3.5 text-slate-400" />,
              'Display Preferences',
            )}

            <div className="section-card space-y-4">

              {/* Auto-Refresh Interval */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">Auto-Refresh Interval</Label>
                  <span className="text-xs font-semibold text-primary tabular-nums">
                    {local.autoRefreshIntervalSeconds}s
                  </span>
                </div>
                <Slider
                  value={[local.autoRefreshIntervalSeconds]}
                  onValueChange={([v]) => upd({ autoRefreshIntervalSeconds: v })}
                  min={3} max={30} step={1}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>3s</span><span>30s</span>
                </div>
              </div>

              {/* Default Map Zoom */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">Default Map Zoom</Label>
                  <span className="text-xs font-semibold text-primary tabular-nums">
                    {local.defaultMapZoom}
                  </span>
                </div>
                <Slider
                  value={[local.defaultMapZoom]}
                  onValueChange={([v]) => upd({ defaultMapZoom: v })}
                  min={10} max={20} step={1}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>10 (far)</span><span>20 (close)</span>
                </div>
              </div>

              {/* Show Offline Devices */}
              <div className="flex items-center justify-between">
                <Label className="text-xs">Show Offline Devices</Label>
                <Switch
                  checked={local.showOfflineDevices}
                  onCheckedChange={checked => upd({ showOfflineDevices: checked })}
                />
              </div>

            </div>

          </div>
        </ScrollArea>

        {/* ── Fixed Footer ── */}
        <DialogFooter className="px-5 py-4 border-t bg-muted/20 flex-shrink-0 gap-2">
          <Button variant="outline" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};
