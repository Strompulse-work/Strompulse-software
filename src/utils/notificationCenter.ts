// src/utils/notificationCenter.ts
// One source of truth for the Notifications tab badge.
//  • Counts ONLY alerts addressed to me (never alerts sent to other people, never my own).
//  • Counts electricity events from the last 15 minutes.
//  • Opening the Notifications tab clears the badge (and the app-icon badge).
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { supabase } from "../config/supabase";
import { parseStromTimestamp } from "../hooks/useDeviceData";
import { getMyIdentity, isAlertForMe } from "./myIdentity";

export const READ_KEY = "strompulse_read_alerts";
export const DISMISSED_KEY = "strompulse_dismissed_alerts";
const SEEN_AT_KEY = "strompulse_notifications_seen_at";
const ELECTRICITY_WINDOW_MS = 15 * 60 * 1000;

const listeners = new Set<() => void>();
export const onNotificationsChanged = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
const emit = () => listeners.forEach((fn) => { try { fn(); } catch {} });

export async function getSeenAt(): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(SEEN_AT_KEY);
    if (v) return parseInt(v, 10) || 0;
    // First run on this phone: don't flood the badge with old history
    const start = Date.now() - 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem(SEEN_AT_KEY, String(start));
    return start;
  } catch {
    return 0;
  }
}

/** Call when the user views the Notifications tab → badge goes to 0. */
export async function markNotificationsSeen() {
  try { await AsyncStorage.setItem(SEEN_AT_KEY, String(Date.now())); } catch {}
  Notifications.setBadgeCountAsync(0).catch(() => {});
  emit();
}

/** Call after marking items read/dismissed so the badge updates immediately. */
export const notifyNotificationsChanged = () => emit();

async function computeUnread(devices: any[]): Promise<number> {
  const [seenAt, readRaw, dismissedRaw, me] = await Promise.all([
    getSeenAt(),
    AsyncStorage.getItem(READ_KEY),
    AsyncStorage.getItem(DISMISSED_KEY),
    getMyIdentity(),
  ]);
  const read = new Set<string>(readRaw ? JSON.parse(readRaw) : []);
  const dismissed = new Set<string>(dismissedRaw ? JSON.parse(dismissedRaw) : []);
  let count = 0;

  if (me.userId && me.phoneKey) {
    const { data } = await supabase
      .from("alerts")
      .select("id, user_id, recipient_phones, created_at")
      .gt("created_at", new Date(seenAt).toISOString())
      .order("created_at", { ascending: false })
      .limit(100);
    (data || []).forEach((a: any) => {
      if (isAlertForMe(a, me) && !read.has(a.id) && !dismissed.has(a.id)) count += 1;
    });
  }

  const now = Date.now();
  (devices || []).forEach((device: any) => {
    if (device.history) {
      Object.keys(device.history).forEach((key) => {
        const d = parseStromTimestamp(key);
        if (!d) return;
        const t = d.getTime();
        const id = `power-restored-${device.id}-${key}`;
        if (now - t < ELECTRICITY_WINDOW_MS && t > seenAt && !read.has(id) && !dismissed.has(id)) count += 1;
      });
    }
    if (!device.isOnline && device.connectionState === "offline") {
      const out = (parseStromTimestamp(device.updated_at) || new Date()).getTime() + 60000;
      const id = `outage-live-${device.id}-${device.updated_at}`;
      if (now - out < ELECTRICITY_WINDOW_MS && out > seenAt && !read.has(id) && !dismissed.has(id)) count += 1;
    }
  });
  return count;
}

/** Live unread count for the tab badge. */
export function useUnreadNotificationCount(devices: any[]) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    let channel: any = null;
    const refresh = () => {
      computeUnread(devices)
        .then((n) => {
          if (!mounted) return;
          setCount(n);
          Notifications.setBadgeCountAsync(n).catch(() => {});
        })
        .catch(() => {});
    };
    refresh();

    getMyIdentity().then((me) => {
      if (!mounted || !me.userId) return;
      channel = supabase
        .channel(`badge-${me.userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, (payload) => {
          if (isAlertForMe(payload.new, me)) refresh();
        })
        .subscribe();
    });

    const off = onNotificationsChanged(refresh);
    const timer = setInterval(refresh, 30000);
    const appSub = AppState.addEventListener("change", (s) => { if (s === "active") refresh(); });
    return () => {
      mounted = false;
      off();
      clearInterval(timer);
      appSub.remove();
      if (channel) supabase.removeChannel(channel);
    };
  }, [devices]);

  return count;
}