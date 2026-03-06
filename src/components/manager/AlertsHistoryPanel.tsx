import { useState, useMemo } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  X, BellOff, CheckCheck, ChevronDown, ChevronUp,
  Trash2, History, ClipboardList, RefreshCw,
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

const LEVEL_LABEL: Record<1|2|3|4|5|6, string> = {
  1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4', 5: 'L5', 6: 'L6',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active:       { label: 'Active',       className: 'bg-red-100 text-red-700 border-red-200'          },
  acknowledged: { label: 'Acknowledged', className: 'bg-green-100 text-green-700 border-green-200'    },
  escalated:    { label: 'Escalated',    className: 'bg-orange-100 text-orange-700 border-orange-200' },
  silenced:     { label: 'Silenced',     className: 'bg-muted text-muted-foreground border-border'     },
};

const ROLE_COLORS: Record<string, string> = {
  admin:      'text-red-600',
  manager:    'text-blue-600',
  supervisor: 'text-green-600',
  worker:     'text-muted-foreground',
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

  const renderAlertCard = (alert: SafetyAlert, showActions = true) => {
    const priority = getAlertPriority(alert);
    const status   = getAlertStatus(alert);
    const colors   = ALERT_COLORS[alert.type as AlertType] ?? ALERT_COLORS['co-movement'];
    const isExp    = expanded === alert.id;

    return (
      <div
        key={alert.id}
        className="px-3 py-2.5 hover:bg-muted/30 transition-colors"
        style={{ borderLeft: `3px solid ${colors.border}` }}
      >
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border"
              style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
            >
              {LEVEL_LABEL[priority]} · {ALERT_LABELS[alert.type as AlertType] ?? alert.type}
            </span>
            {status !== 'active' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${STATUS_BADGE[status]?.className}`}>
                {STATUS_BADGE[status]?.label}
              </span>
            )}
            {status === 'escalated' && <span className="text-[10px]">🔺</span>}
          </div>
          <button
            onClick={() => setExpanded(isExp ? null : alert.id)}
            className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0 transition-colors"
          >
            {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Device ID — full, no truncation */}
        <p className="text-[11px] font-mono text-muted-foreground mb-0.5 break-all">{alert.deviceId}</p>
        <p className="text-xs font-semibold text-foreground leading-tight">{alert.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{alert.description}</p>

        {isExp && (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2 border border-border/40">
            {alert.fenceName       && <p>📍 Zone: <span className="text-foreground">{alert.fenceName}</span></p>}
            {alert.relatedDeviceId && <p>🔗 Paired: <span className="text-foreground font-mono break-all">{alert.relatedDeviceId}</span></p>}
            {alert.acknowledgedBy  && <p>✅ Ack by: <span className="text-foreground">{alert.acknowledgedBy}</span></p>}
            {alert.silencedBy      && <p>🔕 Silenced by: <span className="text-foreground">{alert.silencedBy}</span></p>}
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
          </span>
          {showActions && (
            <div className="flex gap-1">
              {(status === 'active' || status === 'escalated') ? (
                <>
                  {canAcknowledge && (
                    <Button variant="outline" size="sm"
                      className="h-6 px-2 text-[10px] text-green-700 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                      onClick={() => onAcknowledge(alert.id)}>
                      <CheckCheck className="w-3 h-3 mr-1" />Ack
                    </Button>
                  )}
                  {canSilence && (
                    <Button variant="outline" size="sm"
                      className="h-6 px-2 text-[10px] text-muted-foreground border-border hover:bg-muted"
                      onClick={() => onSilence(alert.id)}>
                      <BellOff className="w-3 h-3 mr-1" />Silence
                    </Button>
                  )}
                </>
              ) : (
                <Button variant="ghost" size="sm"
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => onClearAlert(alert.id)}>
                  <X className="w-3 h-3 mr-1" />Dismiss
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border w-full panel-shadow-l overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-card to-muted/20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Alerts</span>
          {counts.active > 0 && (
            <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {counts.active}
            </span>
          )}
          {counts.escalated > 0 && (
            <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              🔺{counts.escalated}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {panelTab === 'live' && alerts.length > 0 && (
            <Button variant="ghost" size="sm"
              className="text-xs text-muted-foreground h-7 px-2 hover:text-destructive"
              onClick={onClearAll}>
              <Trash2 className="w-3 h-3 mr-1" />Clear all
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Panel Tabs ── */}
      <div className="flex border-b border-border flex-shrink-0">
        {([
          { key: 'live',    label: 'Live',    icon: null },
          { key: 'history', label: 'History', icon: <History className="w-3 h-3" /> },
          ...(canViewAudit ? [{ key: 'audit', label: 'Audit', icon: <ClipboardList className="w-3 h-3" /> }] : []),
        ] as { key: PanelTab; label: string; icon: React.ReactNode }[]).map(t => (
          <button key={t.key} onClick={() => setPanelTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              panelTab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Live Tab ── */}
      {panelTab === 'live' && (
        <>
          {/* Filter tabs */}
          <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto flex-shrink-0">
            {(['all','active','escalated','acknowledged','silenced'] as FilterTab[]).map(t => (
              <button key={t} onClick={() => setFilterTab(t)}
                className={`text-[11px] px-2 py-1 rounded-full whitespace-nowrap transition-colors font-medium ${
                  filterTab === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {counts[t] > 0 && <span className="ml-1 opacity-70">({counts[t]})</span>}
              </button>
            ))}
          </div>

          <ScrollArea className="flex-1">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center px-4 py-8">
                <BellOff className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {filterTab === 'all' ? 'No active alerts' : `No ${filterTab} alerts`}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">Safety alerts will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {filtered.map(alert => renderAlertCard(alert))}
              </div>
            )}
          </ScrollArea>
        </>
      )}

      {/* ── History Tab ── */}
      {panelTab === 'history' && (
        <>
          <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
            <span className="text-xs text-muted-foreground">Last 14 days · {history.length} records</span>
            <Button variant="ghost" size="icon" className="h-7 w-7"
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
              <div className="flex flex-col items-center justify-center h-40 px-4 py-8 text-center">
                <History className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No alert history yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {history.map(alert => renderAlertCard(alert, false))}
              </div>
            )}
          </ScrollArea>
        </>
      )}

      {/* ── Audit Tab ── */}
      {panelTab === 'audit' && canViewAudit && (
        <>
          <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
            <span className="text-xs text-muted-foreground">{auditEntries.length} actions logged</span>
            <Button variant="ghost" size="icon" className="h-7 w-7"
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
              <div className="flex flex-col items-center justify-center h-40 px-4 py-8 text-center">
                <ClipboardList className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No audit entries yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {auditEntries.map(entry => (
                  <div key={entry.id} className="px-3 py-2.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between mb-0.5 gap-2">
                      <span className={`text-[10px] font-semibold capitalize truncate ${ROLE_COLORS[entry.actorRole] ?? 'text-foreground'}`}>
                        {entry.actorName}
                        <span className="text-muted-foreground font-normal ml-1">({entry.actorRole})</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {format(entry.createdAt, 'dd MMM, HH:mm')}
                      </span>
                    </div>
                    <p className="text-xs text-foreground font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</p>
                    {entry.targetLabel && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 break-all">→ {entry.targetLabel}</p>
                    )}
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
