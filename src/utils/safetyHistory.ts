// src/utils/safetyHistory.ts
// A small on-device log of the user's safety activity (journeys, SOS, location shares, groups),
// used by Safety Analytics together with the alerts stored in Supabase.
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SafetyEventType = "sos" | "sos_cancelled" | "journey" | "location_share" | "delay_alert";
export type SafetyEvent = {
  id: string;
  type: SafetyEventType;
  at: number; // ms
  endedAt?: number;
  purpose?: string;
  destination?: string;
  arrived?: boolean;
  recipients?: { name: string; phone: string }[];
  groupNames?: string[];
  channels?: string[];
};

const KEY = "strompulse_safety_history_v1";
const MAX = 500;

export async function getSafetyHistory(): Promise<SafetyEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function logSafetyEvent(e: Omit<SafetyEvent, "id"> & { id?: string }) {
  try {
    const list = await getSafetyHistory();
    const id = e.id || `${e.type}-${e.at}`;
    const next = [{ ...e, id }, ...list.filter((x) => x.id !== id)].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return id;
  } catch {
    return null;
  }
}

export async function updateSafetyEvent(id: string, patch: Partial<SafetyEvent>) {
  try {
    const list = await getSafetyHistory();
    await AsyncStorage.setItem(KEY, JSON.stringify(list.map((x) => (x.id === id ? { ...x, ...patch } : x))));
  } catch {}
}