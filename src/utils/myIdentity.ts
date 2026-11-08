// src/utils/myIdentity.ts
// Who is the signed-in user, and what is their phone number?
// Alerts (SOS, journey, location) are addressed to PHONE NUMBERS, so every screen that shows or
// sends an alert uses this to make sure the right person gets it — and nobody else.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";

// Change these if your users' phone numbers live somewhere else
const PROFILE_TABLE = "profiles";
const PROFILE_ID_COLUMN = "id";
const PROFILE_PHONE_COLUMN = "phone";
const CACHE_KEY = "strompulse_my_phone_key";

/** Last 10 digits — the same key the database uses, so "0803…", "+234803…" and "234803…" all match. */
export const phoneKey = (phone?: string | null): string => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
};

/** True when `recipients` (array, JSON string or Postgres array text) contains `key`. */
export const recipientsInclude = (recipients: any, key: string): boolean => {
  if (!key) return false;
  let list: any[] = [];
  if (Array.isArray(recipients)) list = recipients;
  else if (typeof recipients === "string") {
    try { const parsed = JSON.parse(recipients); list = Array.isArray(parsed) ? parsed : [recipients]; }
    catch { list = recipients.replace(/[{}"]/g, "").split(","); }
  }
  return list.some((p) => phoneKey(String(p)) === key);
};

let memo: { userId: string | null; phoneKey: string } | null = null;

export const clearMyIdentityCache = async () => {
  memo = null;
  try { await AsyncStorage.removeItem(CACHE_KEY); } catch {}
};

export async function getMyIdentity(force = false): Promise<{ userId: string | null; phoneKey: string }> {
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;
  const userId = user?.id ?? null;
  if (!userId) return { userId: null, phoneKey: "" };
  if (!force && memo && memo.userId === userId && memo.phoneKey) return memo;

  // 1) Supabase Auth phone (Authentication → Users → Phone) / metadata
  const meta: any = user?.user_metadata || {};
  let key = phoneKey(user?.phone || meta.phone || meta.phone_number || meta.phoneNumber);

  // 2) profiles table
  if (!key) {
    try {
      const { data: prof } = await supabase.from(PROFILE_TABLE).select(PROFILE_PHONE_COLUMN).eq(PROFILE_ID_COLUMN, userId).maybeSingle();
      key = phoneKey((prof as any)?.[PROFILE_PHONE_COLUMN]);
    } catch {}
  }

  // 3) last known value for this user (offline)
  if (!key) {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const c = JSON.parse(cached);
        if (c.userId === userId) key = c.phoneKey || "";
      }
    } catch {}
  }

  memo = { userId, phoneKey: key };
  if (key) AsyncStorage.setItem(CACHE_KEY, JSON.stringify(memo)).catch(() => {});
  return memo;
}

/** Is this alert row meant for me? (I'm a recipient, and I'm not the sender.) */
export const isAlertForMe = (row: any, me: { userId: string | null; phoneKey: string }) => {
  if (!row || !me.phoneKey) return false;
  if (me.userId && row.user_id === me.userId) return false;
  return recipientsInclude(row.recipient_phones, me.phoneKey);
};