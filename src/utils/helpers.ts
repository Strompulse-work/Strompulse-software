/**
 * Common Utility Functions
 * Helper functions for date formatting, calculations, and device status
 */

import { formatDistanceToNow, format, parse } from "date-fns";
import { PowerStatus } from "../types";

/**
 * Format ISO timestamp to readable format
 */
export const formatTimestamp = (
  isoString: string,
  formatStr: string = "MMM dd, HH:mm",
) => {
  try {
    return format(new Date(isoString), formatStr);
  } catch (error) {
    console.warn("Invalid timestamp:", isoString);
    return "N/A";
  }
};

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export const getRelativeTime = (isoString: string) => {
  try {
    return formatDistanceToNow(new Date(isoString), { addSuffix: true });
  } catch (error) {
    return "Unknown";
  }
};

/**
 * Calculate outage duration in human readable format
 */
export const formatDuration = (minutes: number): string => {
  if (minutes < 1) return "Less than 1 minute";
  if (minutes < 60)
    return `${Math.round(minutes)} minute${minutes !== 1 ? "s" : ""}`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours < 24) {
    return `${hours}h ${mins}m`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return `${days}d ${remainingHours}h`;
};

/**
 * Calculate uptime percentage
 */
export const calculateUptime = (
  totalMinutes: number,
  outageMinutes: number,
): number => {
  if (totalMinutes === 0) return 100;
  const uptime = ((totalMinutes - outageMinutes) / totalMinutes) * 100;
  return Math.max(0, Math.min(100, Math.round(uptime * 10) / 10));
};

/**
 * Get color based on power status
 */
export const getStatusColor = (status: PowerStatus): string => {
  switch (status) {
    case "ON":
      return "#10B981"; // Green
    case "OFF":
      return "#EF4444"; // Red
    case "OFFLINE":
      return "#9CA3AF"; // Grey
    default:
      return "#6B7280"; // Default grey
  }
};

/**
 * Get status indicator icon name
 */
export const getStatusIcon = (status: PowerStatus): string => {
  switch (status) {
    case "ON":
      return "check-circle";
    case "OFF":
      return "alert-circle";
    case "OFFLINE":
      return "wifi-off";
    default:
      return "help-circle";
  }
};

/**
 * Check if device is offline (no signal in 15+ minutes)
 */
export const isDeviceOffline = (lastSeenIso: string): boolean => {
  const lastSeen = new Date(lastSeenIso);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
  return diffMinutes > 15;
};

/**
 * Format address for display
 */
export const formatAddress = (address: string): string => {
  if (!address) return "Unknown Location";
  return address.split(", ").slice(0, 2).join(", ");
};

/**
 * Generate mock device data for development
 */
export const generateMockDevice = (index: number) => {
  const statuses: PowerStatus[] = ["ON", "OFF", "OFFLINE"];
  return {
    id: `device-${index}`,
    device_id: `IOT-${String(index).padStart(4, "0")}`,
    owner_user_id: "demo-user",
    address: `${index * 10} Awolowo Road, Ibadan, Oyo State`,
    latitude: 7.3775 + (Math.random() - 0.5) * 0.05,
    longitude: 3.9465 + (Math.random() - 0.5) * 0.05,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    last_seen: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};

/**
 * Generate mock outage events
 */
export const generateMockOutages = (count: number = 5) => {
  return Array.from({ length: count }).map((_, i) => {
    const started = new Date(Date.now() - (24 - i * 4) * 3600000);
    const ended = new Date(started.getTime() + Math.random() * 120 * 60000);
    const duration = Math.round((ended.getTime() - started.getTime()) / 60000);

    return {
      id: `outage-${i}`,
      device_id: "device-0",
      started_at: started.toISOString(),
      ended_at: ended.toISOString(),
      duration_minutes: duration,
      is_active: false,
      created_at: started.toISOString(),
      updated_at: ended.toISOString(),
    };
  });
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (Nigerian format)
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^(\+234|0)[0-9]{10}$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
};
