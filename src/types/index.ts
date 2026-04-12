/**
 * Core Type Definitions for Ibadan Power Monitoring Platform
 * Production-grade TypeScript interfaces for all data models
 */

export type PowerStatus = "ON" | "OFF" | "OFFLINE";
export type UserRole = "user" | "community_admin" | "installer";

// ============ AUTHENTICATION ============
export interface User {
  id: string;
  email?: string;
  phone?: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  user: User;
  access_token: string;
  refresh_token: string;
}

// ============ DEVICES ============
export interface Device {
  id: string;
  device_id: string; // IoT device identifier
  owner_user_id: string;
  community_id?: string;
  address: string;
  latitude: number;
  longitude: number;
  status: PowerStatus;
  last_seen: string; // ISO timestamp
  current_event_id?: string;
  metadata?: {
    device_type?: string;
    installation_date?: string;
    serial_number?: string;
  };
  created_at: string;
  updated_at: string;
}

// ============ EVENTS ============
export interface PowerEvent {
  id: string;
  device_id: string;
  status: "ON" | "OFF";
  timestamp: string; // ISO timestamp
  duration_seconds?: number; // Calculate duration from next event
  created_at: string;
}

export interface Outage {
  id: string;
  device_id: string;
  started_at: string; // ISO timestamp
  ended_at?: string; // ISO timestamp (null if ongoing)
  duration_minutes: number;
  is_active: boolean;
  reason?: string;
  created_at: string;
  updated_at: string;
}

// ============ COMMUNITIES ============
export interface Community {
  id: string;
  name: string;
  state: string; // e.g., "Oyo"
  city: string; // e.g., "Ibadan"
  type: "residential" | "commercial" | "industrial" | "mixed";
  description?: string;
  latitude: number;
  longitude: number;
  device_count: number;
  created_at: string;
  updated_at: string;
}

export interface CommunityStats {
  community_id: string;
  total_devices: number;
  devices_online: number;
  devices_offline: number;
  current_outage_count: number;
  uptime_percentage: number;
  avg_outage_duration_minutes: number;
  last_outage_time?: string;
  status_indicator: "healthy" | "warning" | "critical";
}

// ============ ANALYTICS ============
export interface DailyStats {
  date: string;
  device_id: string;
  total_events: number;
  outage_count: number;
  total_outage_minutes: number;
  uptime_percentage: number;
}

export interface InsightsSummary {
  week_total_outage_hours: number;
  longest_outage_minutes: number;
  avg_daily_uptime_percentage: number;
  stability_score: number; // 0-100
  total_devices: number;
  devices_online: number;
}

export interface ChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
}

// ============ REAL-TIME SUBSCRIPTIONS ============
export interface RealtimePayload<T> {
  new: T;
  old?: T;
  eventType: "INSERT" | "UPDATE" | "DELETE";
}

export interface DeviceStatusUpdate {
  device_id: string;
  status: PowerStatus;
  last_seen: string;
  timestamp: string;
}

// ============ NOTIFICATION PREFERENCES ============
export interface NotificationPreferences {
  user_id: string;
  outage_alerts_enabled: boolean;
  restoration_alerts_enabled: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
}

// ============ API RESPONSES ============
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============ NAVIGATION ============
export type RootStackParamList = {
  index: undefined;
  auth: undefined;
  "auth/login": undefined;
  "auth/signup": undefined;
  "(tabs)": undefined;
  "(tabs)/feed": undefined;
  "(tabs)/map": undefined;
  "(tabs)/communities": undefined;
  "(tabs)/insights": undefined;
  "(tabs)/profile": undefined;
  "community-details": { communityId: string };
  "device-details": { deviceId: string };
};

// ============ LOCAL STORAGE ============
export interface StorageData {
  authToken?: string;
  refreshToken?: string;
  user?: User;
  lastSyncTime?: number;
}
