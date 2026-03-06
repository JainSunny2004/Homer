export interface ManagerSettings {
  // Device Monitoring
  deviceTimeoutSeconds: number;
  outOfZoneAlertDelaySeconds: number;

  // Work Schedule
  breakDurationValue: number;
  breakDurationUnit: "minutes" | "hours";
  breakStartTime: string;

  // Safety Alerts — Sprint 3
  inactivityThresholdMinutes: number;
  inactivityBreakExtendMinutes: number;
  silenceAlertMinutes: number;
  coMovementThresholdMeters: number;
  coMovementDurationSeconds: number;
  shiftChangeTime: string;
  shiftChangeWindowMinutes: number;

  // Advanced Alerts — Sprint 4
  batteryAlertThreshold: number; // % below which battery-low fires
  escalationMinutes: number; // minutes before unacknowledged alert escalates

  // Notifications — Sprint 5
  notifyOnL1: boolean; // geo-fence breach
  notifyOnL2: boolean; // impact
  notifyOnL3: boolean; // inactivity
  notifyOnL4: boolean; // battery low
  notifyOnL5: boolean; // silence
  notifyOnL6: boolean; // co-movement
  whatsappNumbers: string; // comma-separated phone numbers e.g. "+919876543210,+911234567890"
  whatsappEnabled: boolean;

  // Display Preferences
  autoRefreshIntervalSeconds: number;
  defaultMapZoom: number;
  showOfflineDevices: boolean;
}

export const DEFAULT_SETTINGS: ManagerSettings = {
  deviceTimeoutSeconds: 60,
  outOfZoneAlertDelaySeconds: 30,
  breakDurationValue: 15,
  breakDurationUnit: "minutes",
  breakStartTime: "13:00",
  inactivityThresholdMinutes: 10,
  inactivityBreakExtendMinutes: 15,
  silenceAlertMinutes: 5,
  coMovementThresholdMeters: 10,
  coMovementDurationSeconds: 60,
  shiftChangeTime: "17:00",
  shiftChangeWindowMinutes: 10,
  batteryAlertThreshold: 20,
  escalationMinutes: 5,
  notifyOnL1: true,
  notifyOnL2: true,
  notifyOnL3: false,
  notifyOnL4: false,
  notifyOnL5: true,
  notifyOnL6: false,
  whatsappNumbers: "",
  whatsappEnabled: false,
  autoRefreshIntervalSeconds: 5,
  defaultMapZoom: 16,
  showOfflineDevices: true,
};

export const SETTINGS_STORAGE_KEY = "homer-manager-settings";
