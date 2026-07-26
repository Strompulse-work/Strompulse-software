// src/utils/deviceUtils.ts

export interface StromDeviceData {
  id?: string;
  status: number | string;
  timestamp: string; // e.g., "19072026090254" or "DD-MM-YYYY HH:mm:ss"
  voltage?: number;
  latitude?: string | number;
  longitude?: string | number;
}

/**
 * Parses STROM DDMMYYYYHHMMSS timestamp string into a JavaScript Date object
 */
export const parseStromTimestamp = (tsStr: string): Date | null => {
  if (!tsStr || typeof tsStr !== "string") return null;

  // Handle DDMMYYYYHHMMSS format (14 digits)
  if (tsStr.length === 14 && /^\d+$/.test(tsStr)) {
    const day = parseInt(tsStr.substring(0, 2), 10);
    const month = parseInt(tsStr.substring(2, 4), 10) - 1; // JS Months are 0-indexed
    const year = parseInt(tsStr.substring(4, 8), 10);
    const hours = parseInt(tsStr.substring(8, 10), 10);
    const minutes = parseInt(tsStr.substring(10, 12), 10);
    const seconds = parseInt(tsStr.substring(12, 14), 10);

    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  }

  // Fallback for standard ISO or date string formats
  const fallbackDate = new Date(tsStr);
  return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
};

/**
 * Calculates whether a STROM device is Online or Offline
 * @param device The device realtime payload from Firebase
 * @param thresholdSeconds Heartbeat timeout (default: 60s)
 */
export const checkIsDeviceOnline = (
  device: StromDeviceData | null | undefined,
  thresholdSeconds: number = 60
): boolean => {
  if (!device) return false;

  // 1. Check reported status field first
  const rawStatus = String(device.status).trim();
  const reportedActive = rawStatus === "1" || rawStatus.toLowerCase() === "true" || rawStatus.toLowerCase() === "on";
  if (!reportedActive) return false;

  // 2. Perform Heartbeat / Time Difference check
  const lastPingDate = parseStromTimestamp(device.timestamp);
  if (!lastPingDate) return false;

  const now = new Date();
  const diffInSeconds = Math.abs((now.getTime() - lastPingDate.getTime()) / 1000);

  // Device is ONLINE only if it pinged within the threshold
  return diffInSeconds <= thresholdSeconds;
};