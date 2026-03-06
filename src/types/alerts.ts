export type AlertType =
  | 'out-of-zone'   // Level 1 — Geo-fence breach
  | 'impact'        // Level 2 — High-velocity impact  ← NEW
  | 'inactivity'    // Level 3 — No movement
  | 'battery-low'   // Level 4 — Battery below threshold ← NEW
  | 'silence'       // Level 5 — Tracker stopped pinging
  | 'co-movement';  // Level 6 — Two trackers together

export type AlertStatus =
  | 'active'        // Firing, unacknowledged
  | 'acknowledged'  // Seen and acknowledged by a user
  | 'escalated'     // Unacknowledged past escalation threshold
  | 'silenced';     // Manually silenced by supervisor

export interface SafetyAlert {
  id:          string;
  deviceId:    string;
  type:        AlertType;
  title:       string;
  description: string;
  timestamp:   Date;

  // Priority (derived from type, stored for sorting)
  priority:    1 | 2 | 3 | 4 | 5 | 6;

  // Status lifecycle — Sprint 4
  status:           AlertStatus;
  acknowledgedBy?:  string;   // user name/email who acknowledged
  acknowledgedAt?:  Date;
  silencedBy?:      string;
  silencedAt?:      Date;
  escalatedAt?:     Date;

  // Optional context
  fenceId?:         string;
  fenceName?:       string;
  relatedDeviceId?: string;   // co-movement: the second device
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const ALERT_PRIORITY: Record<AlertType, 1 | 2 | 3 | 4 | 5 | 6> = {
  'out-of-zone':  1,
  'impact':       2,
  'inactivity':   3,
  'battery-low':  4,
  'silence':      5,
  'co-movement':  6,
};

export const ALERT_LABELS: Record<AlertType, string> = {
  'out-of-zone':  'Geo-fence Breach',
  'impact':       'Impact / Fall',
  'inactivity':   'No Movement',
  'battery-low':  'Battery Low',
  'silence':      'Tracker Silence',
  'co-movement':  'Co-movement',
};

export const ALERT_COLORS: Record<AlertType, { bg: string; text: string; border: string }> = {
  'out-of-zone':  { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  'impact':       { bg: '#fff7ed', text: '#ea580c', border: '#fdba74' },
  'inactivity':   { bg: '#fffbeb', text: '#d97706', border: '#fcd34d' },
  'battery-low':  { bg: '#fefce8', text: '#ca8a04', border: '#fde047' },
  'silence':      { bg: '#faf5ff', text: '#9333ea', border: '#d8b4fe' },
  'co-movement':  { bg: '#eff6ff', text: '#2563eb', border: '#93c5fd' },
};
