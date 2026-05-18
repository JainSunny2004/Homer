import { useState, useMemo } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  X, BellOff, CheckCheck, ChevronDown, ChevronUp,
  Trash2, History, ClipboardList, RefreshCw, Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SafetyAlert, AlertType, ALERT_LABELS, ALERT_COLORS, ALERT_PRIORITY } from '@/types/alerts';
import { PersistedAlert } from '@/hooks/useAlertPersistence';
import { AuditEntry, ACTION_LABELS } from '@/hooks/useAuditLog';

type FilterTab = 'all' | 'active' | 'acknowledged' | 'escalated' | 'silenced';
type PanelTab  = 'live' | 'history' | 'audit';

interface AlertsHistoryPanelProps {
  alerts:           SafetyAlert[];
  history:          PersistedAlert[];
  auditEntries:     AuditEntry[];
  historyLoading:   boolean;
  auditLoading:     boolean;
  onClearAlert:     (id: string) => void;
  onClearAll:       () => void;
  onAcknowledge:    (id: string) => void;
  onSilence:        (id: string) => void;
  onClose:          () => void;
  onRefreshHistory: () => void;
  onRefreshAudit:   () => void;
  hasPermission:    (p: string) => boolean;
}

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  active:       { label: 'Active',       bg: '#fee2e2', text: '#b91c1c' },
  acknowledged: { label: 'Acknowledged', bg: '#dcfce7', text: '#15803d' },
  escalated:    { label: 'Escalated',    bg: '#ffedd5', text: '#c2410c' },
  silenced:     { label: 'Silenced',     bg: 'hsl(var(--muted))', text: 'hsl(var(--muted-foreground))' },
};

const ROLE_COLORS: Record<string, string> = {
  admin:      'text-red-600',
  manager:    'text-blue-600',
  supervisor: 'text-green-600',
  worker:     'text-muted-foreground',
};

const LEVEL_LABEL: Record<1|2|3|4|5|6, string> = {
  1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4', 5: 'L5', 6: 'L6',
};

export const AlertsHistoryPanel = ({
  alerts, history, auditEntries,
  historyLoading, auditLoading,
  onClearAlert, onClearAll,
  onAcknowledge, onSilence, onClose,
  onRefreshHistory, onRefreshAudit,
  hasPermission,
}: AlertsHistoryPanelProps) => {
  const [panelTab,  setPanelTab]  = useState<PanelTab>('live');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [expanded,  setExpanded]  = useState<string | null>(null);

  const getAlertPriority = (a: SafetyAlert): 1|2|3|4|5|6 =>
    (a.priority ?? ALERT_PRIORITY[a.type as AlertType] ?? 6) as 1|2|3|4|5|6;

  const getAlertStatus = (a: SafetyAlert) => a.status ?? 'active';

  const filtered = useMemo(() => {
    const base = filterTab === 'all' ? alerts : alerts.filter(a => getAlertStatus(a) === filterTab);
    return [...base].sort((a, b) => getAlertPriority(a) - getAlertPriority(b));
  }, [alerts, filterTab]);

  const counts = useMemo(() => ({
    all:          alerts.length,
    active:       alerts.filter(a => getAlertStatus(a) === 'active').length,
    acknowledged: alerts.filter(a => getAlertStatus(a) === 'acknowledged').length,
    escalated:    alerts.filter(a => getAlertStatus(a) === 'escalated').length,
    silenced:     alerts.filter(a => getAlertStatus(a) === 'silenced').length,
  }), [alerts]);

  const canAcknowledge = hasPermission('acknowledge_alert');
  const canSilence     = hasPermission('silence_alert');
  const canViewAudit   = hasPermission('manage_users') || hasPermission('edit_settings');

  const panelTabs = [
    { key: 'live'    as PanelTab, label: 'Live',    icon: <Bell className="w-3 h-3" /> },
    { key: 'history' as PanelTab, label: 'History', icon: <History className="w-3 h-3" /> },
    ...(canViewAudit ? [{ key: 'audit' as PanelTab, label: 'Audit', icon: <ClipboardList className="w-3 h-3" /> }] : []),
  ];

  const renderAlertCard = (alert: SafetyAlert, showActions = true) => {
    const priority = getAlertPriority(alert);
    const status   = getAlertStatus(alert);
    const colors   = ALERT_COLORS[alert.type as AlertType] ?? ALERT_COLORS['co-movement'];
    const statusMeta = STATUS_BADGE[status] ?? STATUS_BADGE.active;
    const isExp    = expanded === alert.id;

    return (
      <div
        key={alert.id}
        className="group mx-3 mb-2 rounded-xl bg-card border border-border overflow-hidden transition-all duration-150 hover:shadow-md hover:-translate-y-px"
        style={{ boxShadow: '0 1px 4px hsl(0 0% 0% / 0.06)' }}
      >
        {/* Top accent bar — alert type color */}
        <div className="h-1 w-full" style={{ backgroundColor: colors.border }} />

        <div className="p-3">
          {/* Priority + type badge row */}
          <div className="flex items-start justify-between gap-1 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: colors.bg, color: colors.text }}
              >
                {LEVEL_LABEL[priority]} · {ALERT_LABELS[alert.type as AlertType] ?? alert.type}
              </span>
              {status !== 'active' && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                  style={{ backgroundColor: statusMeta.bg, color: statusMeta.text }}
                >
                  {status === 'escalated' && '🔺 '}{statusMeta.label}
                </span>
              )}
            </div>
            <button
              onClick={() => setExpanded(isExp ? null : alert.id)}
              className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0 transition-colors"
            >
              {isExp
                ? <ChevronUp className="w-3.5 h-3.5" />
                : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Device + title */}
          <p className="text-[11px] font-mono text-muted-foreground mb-0.5 break-all">{alert.deviceId}</p>
          <p className="text-xs font-semibold text-foreground leading-tight">{alert.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{alert.description}</p>

          {/* Expanded detail */}
          {isExp && (
            <div className="mt-2.5 space-y-1 text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5 border border-border/40">
              {alert.fenceName       && <p>📍 Zone: <span className="text-foreground font-medium">{alert.fenceName}</span></p>}
              {alert.relatedDeviceId && <p>🔗 Paired: <span className="text-foreground font-mono break-all">{alert.relatedDeviceId}</span></p>}
              {alert.acknowledgedBy  && <p>✅ Ack by: <span className="text-foreground font-medium">{alert.acknowledgedBy}</span></p>}
              {alert.silencedBy      && <p>🔕 Silenced by: <span className="text-foreground font-medium">{alert.silencedBy}</span></p>}
            </div>
          )}

          {/* Footer — time + actions */}
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
            </span>
            {showActions && (
              <div className="flex gap-1">
                {(status === 'active' || status === 'escalated') ? (
                  <>
                    {canAcknowledge && (
                      <Button variant="outline" size="sm"
                        className="h-6 px-2 text-[10px] text-green-700 border-green-300 hover:bg-green-50 dark:hover:bg-green-950 rounded-lg"
                        onClick={() => onAcknowledge(alert.id)}>
                        <CheckCheck className="w-3 h-3 mr-1" />Ack
                      </Button>
                    )}
                    {canSilence && (
                      <Button variant="outline" size="sm"
                        className="h-6 px-2 text-[10px] text-muted-foreground border-border hover:bg-muted rounded-lg"
                        onClick={() => onSilence(alert.id)}>
                        <BellOff className="w-3 h-3 mr-1" />Silence
                      </Button>
                    )}
                  </>
                ) : (
                  <Button variant="ghost" size="sm"
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground rounded-lg"
                    onClick={() => onClearAlert(alert.id)}>
                    <X className="w-3 h-3 mr-1" />Dismiss
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border w-full overflow-hidden">

      {/* ── Header — matches left panel header style ── */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0"
        style={{ boxShadow: '0 1px 0 hsl(var(--border)), 0 2px 12px hsl(0 0% 0% / 0.05)' }}
      >
        <div className="flex items-center gap-2.5">
          {/* Icon box — matches left panel fence/worker icon pattern */}
          <div className="h-8 w-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
            <Bell className="h-3.5 w-3.5 text-red-500" />
          </div>
          <div className="leading-none">
            <p className="text-[13px] font-bold text-foreground">Alerts</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {counts.active > 0
                ? `${counts.active} active${counts.escalated > 0 ? ` · ${counts.escalated} escalated` : ''}`
                : 'No active alerts'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {panelTab === 'live' && alerts.length > 0 && (
            <Button variant="ghost" size="sm"
              className="text-xs text-muted-foreground h-7 px-2 rounded-lg hover:text-destructive"
              onClick={onClearAll}>
              <Trash2 className="w-3 h-3 mr-1" />Clear all
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Panel Tabs — matches left panel tab style ── */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0 border-b border-border">
        <div
          className="flex rounded-xl p-1 gap-0.5"
          style={{ background: 'hsl(var(--muted))' }}
        >
          {panelTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setPanelTab(t.key)}
              className={[
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[13px] font-semibold rounded-lg transition-all duration-150',
                panelTab === t.key
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Live Tab ── */}
      {panelTab === 'live' && (
        <>
          {/* Filter row — section header + pills */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border flex-shrink-0 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mr-0.5 flex-shrink-0">
              Filter
            </span>
            {(['all','active','escalated','acknowledged','silenced'] as FilterTab[]).map(t => (
              <button key={t}
                onClick={() => setFilterTab(t)}
                className={[
                  'text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap transition-all duration-150 font-semibold',
                  filterTab === t
                    ? 'bg-foreground text-background shadow-sm'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {counts[t] > 0 && (
                  <span className="ml-1 opacity-60">({counts[t]})</span>
                )}
              </button>
            ))}
          </div>

          <ScrollArea className="flex-1">
            {filtered.length === 0 ? (
              <div className="mx-3 mt-4 py-10 flex flex-col items-center gap-3 bg-muted/40 rounded-2xl border border-dashed border-border">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                  <BellOff className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {filterTab === 'all' ? 'No active alerts' : `No ${filterTab} alerts`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Safety alerts will appear here</p>
                </div>
              </div>
            ) : (
              <div className="pt-2 pb-3">
                {filtered.map(alert => renderAlertCard(alert))}
              </div>
            )}
          </ScrollArea>
        </>
      )}

      {/* ── History Tab ── */}
      {panelTab === 'history' && (
        <>
          {/* Section header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Last 14 Days
              </span>
              <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                {history.length}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg"
              onClick={onRefreshHistory} disabled={historyLoading}>
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {historyLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <div className="mx-3 mt-4 py-10 flex flex-col items-center gap-3 bg-muted/40 rounded-2xl border border-dashed border-border">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                  <History className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">No alert history yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Past alerts will appear here</p>
                </div>
              </div>
            ) : (
              <div className="pt-2 pb-3">
                {history.map(alert => renderAlertCard(alert, false))}
              </div>
            )}
          </ScrollArea>
        </>
      )}

      {/* ── Audit Tab ── */}
      {panelTab === 'audit' && canViewAudit && (
        <>
          {/* Section header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Action Log
              </span>
              <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                {auditEntries.length}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg"
              onClick={onRefreshAudit} disabled={auditLoading}>
              <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {auditLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : auditEntries.length === 0 ? (
              <div className="mx-3 mt-4 py-10 flex flex-col items-center gap-3 bg-muted/40 rounded-2xl border border-dashed border-border">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                  <ClipboardList className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">No audit entries yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Manager actions will be logged here</p>
                </div>
              </div>
            ) : (
              <div className="pt-2 pb-3">
                {auditEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="group mx-3 mb-2 rounded-xl bg-card border border-border overflow-hidden transition-all duration-150 hover:shadow-md hover:-translate-y-px"
                    style={{ boxShadow: '0 1px 4px hsl(0 0% 0% / 0.06)' }}
                  >
                    {/* Top accent bar — role color */}
                    <div className="h-1 w-full bg-border" />

                    <div className="p-3">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className={`text-[11px] font-semibold truncate ${ROLE_COLORS[entry.actorRole] ?? 'text-foreground'}`}>
                          {entry.actorName}
                          <span className="text-muted-foreground font-normal ml-1 capitalize">({entry.actorRole})</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0 font-medium">
                          {format(entry.createdAt, 'dd MMM, HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-foreground">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </p>
                      {entry.targetLabel && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 break-all">
                          → {entry.targetLabel}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      )}
    </div>
  );
};
