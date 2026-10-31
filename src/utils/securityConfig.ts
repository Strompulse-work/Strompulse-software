// src/utils/securityConfig.ts
// Shared Security settings, SMS SOS quota, phone formatting and auto-location-sharing helpers.
import AsyncStorage from "@react-native-async-storage/async-storage";

export const SETTINGS_KEY = "strompulse_security_settings";
export const CONTACTS_KEY = "strompulse_emergency_contacts";
const SMS_QUOTA_KEY = "strompulse_sms_sos_quota";
const AUTO_SHARE_LOG_KEY = "strompulse_auto_share_log";

export const SMS_SOS_MONTHLY_LIMIT = 5;
export const DEFAULT_EMERGENCY_NUMBER = "112";

export type AutoShareFrequency = 0 | 1 | 2 | 3;

export interface SecuritySettings {
  locationSharing: boolean;
  notifyInApp: boolean;     // StromPulse in-app alert to contacts registered on StromPulse
  notifyWhatsApp: boolean;  // WhatsApp when internet is available
  notifySms: boolean;       // SMS when offline (max 5 SOS per month)
  customMessage: string;
  fakeCallName: string;
  policeNumber: string;
  ambulanceNumber: string;
  favoriteContactName: string;
  favoriteContactPhone: string;
  autoShareFrequency: AutoShareFrequency;
  backgroundTrigger: boolean;
  autoAlertEnabled: boolean;
  autoAlertDelay: string;
}

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  locationSharing: true,
  notifyInApp: true,
  notifyWhatsApp: true,
  notifySms: true,
  customMessage: "",
  fakeCallName: "Mum",
  policeNumber: DEFAULT_EMERGENCY_NUMBER,
  ambulanceNumber: DEFAULT_EMERGENCY_NUMBER,
  favoriteContactName: "",
  favoriteContactPhone: "",
  autoShareFrequency: 0,
  backgroundTrigger: false,
  autoAlertEnabled: true,
  autoAlertDelay: "30 min",
};

export const loadSecuritySettings = async (): Promise<SecuritySettings> => {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SECURITY_SETTINGS };
    const p = JSON.parse(raw);
    return {
      ...DEFAULT_SECURITY_SETTINGS,
      ...p,
      // migrate older keys
      notifySms: p.notifySms ?? p.sendSms ?? true,
      autoAlertEnabled: p.autoAlertEnabled ?? p.autoAlert ?? true,
      policeNumber: p.policeNumber || DEFAULT_EMERGENCY_NUMBER,
      ambulanceNumber: p.ambulanceNumber || DEFAULT_EMERGENCY_NUMBER,
      fakeCallName: p.fakeCallName || "Mum",
      autoShareFrequency: ([0, 1, 2, 3].includes(p.autoShareFrequency) ? p.autoShareFrequency : 0) as AutoShareFrequency,
    };
  } catch {
    return { ...DEFAULT_SECURITY_SETTINGS };
  }
};

export const saveSecuritySettings = async (patch: Partial<SecuritySettings>): Promise<SecuritySettings> => {
  const current = await loadSecuritySettings();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
};

// ---------- SMS SOS monthly quota (resets automatically each calendar month) ----------
// NOTE: This is the on-device counter used for display and gating. For a tamper-proof
// limit, mirror it on the backend (see notes).
const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export interface SmsQuota { used: number; remaining: number; limit: number; }

export const getSmsSosQuota = async (): Promise<SmsQuota> => {
  let used = 0;
  try {
    const raw = await AsyncStorage.getItem(SMS_QUOTA_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p.month === currentMonthKey()) used = p.used || 0;
    }
  } catch {}
  return { used, limit: SMS_SOS_MONTHLY_LIMIT, remaining: Math.max(0, SMS_SOS_MONTHLY_LIMIT - used) };
};

export const consumeSmsSosQuota = async (): Promise<SmsQuota> => {
  const q = await getSmsSosQuota();
  const used = Math.min(SMS_SOS_MONTHLY_LIMIT, q.used + 1);
  await AsyncStorage.setItem(SMS_QUOTA_KEY, JSON.stringify({ month: currentMonthKey(), used }));
  return { used, limit: SMS_SOS_MONTHLY_LIMIT, remaining: SMS_SOS_MONTHLY_LIMIT - used };
};

// ---------- Phone helpers ----------
export const normalizePhone = (phone: string, withPlus = true) => {
  let d = (phone || "").replace(/[^0-9+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "234" + d.slice(1);
  else if (d.length <= 10) d = "234" + d;
  d = d.replace(/[^0-9]/g, "");
  return withPlus ? `+${d}` : d;
};

export const isValidPhone = (phone: string) => {
  const digits = (phone || "").replace(/[^0-9]/g, "");
  return digits.length >= 3 && digits.length <= 15;
};

export const googleMapsLink = (lat: number, lng: number) =>
  `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

// ---------- Automatic location sharing (1, 2 or 3 times daily) ----------
export const AUTO_SHARE_HOURS: Record<number, number[]> = { 1: [9], 2: [9, 18], 3: [8, 14, 20] };

export const formatHour = (h: number) => `${h % 12 || 12}:00 ${h < 12 ? "AM" : "PM"}`;

export const getAutoShareDescription = (f: AutoShareFrequency) =>
  f === 0 ? "Off" : `${f}× daily · ${AUTO_SHARE_HOURS[f].map(formatHour).join(", ")}`;

/** Returns the id of the most recent scheduled slot that has passed today and hasn't been shared yet. */
export const getDueAutoShareSlot = async (frequency: AutoShareFrequency): Promise<string | null> => {
  if (!frequency) return null;
  const now = new Date();
  const hours = AUTO_SHARE_HOURS[frequency] || [];
  const due = [...hours].reverse().find((h) => now.getHours() >= h);
  if (due === undefined) return null;
  const slotId = `${now.toDateString()}-${due}`;
  try {
    const raw = await AsyncStorage.getItem(AUTO_SHARE_LOG_KEY);
    const log: string[] = raw ? JSON.parse(raw) : [];
    return log.includes(slotId) ? null : slotId;
  } catch {
    return slotId;
  }
};

export const markAutoShareSlot = async (slotId: string) => {
  try {
    const raw = await AsyncStorage.getItem(AUTO_SHARE_LOG_KEY);
    const log: string[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(AUTO_SHARE_LOG_KEY, JSON.stringify([...log, slotId].slice(-12)));
  } catch {}
};