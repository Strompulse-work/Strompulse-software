// src/utils/sendAlert.ts
import { supabase } from "../config/supabase";
import { normalizePhone } from "./securityConfig";
import { getMyIdentity, phoneKey } from "./myIdentity";

export type AlertType = "emergency" | "journey_start" | "journey_end" | "location_share";

/** Optional structured info saved with the alert (only if your `alerts` table has a `data` jsonb column). */
export interface AlertExtra {
  lat?: number;
  lng?: number;
  senderName?: string;
  [key: string]: any;
}

// Cleans, converts to +234 format, removes duplicates/invalid numbers and the sender's own number
const prepareRecipients = (recipients: string | string[], myKey = "") => {
  const list = Array.isArray(recipients) ? recipients : [recipients];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of list) {
    if (typeof p !== "string" || p.replace(/[^0-9]/g, "").length < 7) continue;
    const n = normalizePhone(p);
    const k = phoneKey(n) || n;
    if (seen.has(k) || (myKey && k === myKey)) continue; // never alert yourself, never twice
    seen.add(k);
    out.push(n);
  }
  return out;
};

// getSession reads the saved login instantly (no network round-trip) — important for time-sensitive SOS.
const getSenderId = async (): Promise<string | null> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session?.user?.id) return sessionData.session.user.id;
  const { data: userData } = await supabase.auth.getUser();
  return userData?.user?.id ?? null;
};

/**
 * Inserts ONE row into `alerts`; your Supabase webhook then pushes it to `recipient_phones`.
 *
 * @param type        'emergency' | 'journey_start' | 'journey_end' | 'location_share'
 * @param title       Notification title, e.g. "SOS alert from Taiwo"
 * @param message     Notification body
 * @param recipients  One phone number or an array of them (any format — normalized to +234…)
 * @param extra       Optional structured data (coordinates, sender name)
 * @returns true if the alert was saved
 */
export async function sendPushAlert(
  type: AlertType,
  title: string,
  message: string,
  recipients: string | string[],
  extra?: AlertExtra
): Promise<boolean> {
  try {
    let myKey = "";
    try { myKey = (await getMyIdentity()).phoneKey; } catch {}
    const recipientPhones = prepareRecipients(recipients, myKey);
    if (recipientPhones.length === 0) {
      console.warn("[sendPushAlert] No valid recipient phone numbers — alert not sent.");
      return false;
    }

    const userId = await getSenderId();
    if (!userId) {
      console.error("[sendPushAlert] No user logged in to send alert.");
      return false;
    }

    const row: Record<string, any> = {
      type,
      title,
      message,
      user_id: userId, // sender's id — satisfies RLS and lets recipients open "Follow Their Journey"
      recipient_phones: recipientPhones,
    };
    if (extra && Object.keys(extra).length > 0) row.data = extra;

    let { error } = await supabase.from("alerts").insert([row]);

    // If the table has no `data` column, retry without it so the alert is never lost
    if (error && row.data && /data|column|schema cache/i.test(error.message)) {
      delete row.data;
      ({ error } = await supabase.from("alerts").insert([row]));
    }

    if (error) {
      console.error("[sendPushAlert] Failed to save alert:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[sendPushAlert] Unexpected error:", err);
    return false;
  }
}