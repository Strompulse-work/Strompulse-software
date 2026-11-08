// src/utils/sosLiveLocation.ts
// Shares the sender's LIVE location for a while after an SOS, so contacts who tap
// "View Location" on the SOS notification see them move in real time.
// Uses the same `journey_locations` row as Share My Journey, but its own `sos_*` columns,
// so an SOS never pretends to be a journey (and vice-versa).
import * as Location from "expo-location";
import { supabase } from "../config/supabase";

const SOS_SHARE_DURATION_MS = 60 * 60 * 1000; // keep sharing for 1 hour after SOS
const UPLOAD_EVERY_MS = 15 * 1000;

let watchSub: Location.LocationSubscription | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let lastUpload = 0;
let sosColumnsAvailable = true;
let sosPhones: string[] = []; // ONLY these people (the sender's emergency contacts) may see the live SOS location

const getUserId = async () => {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
};

const writeLocation = async (userId: string, senderName: string, lat: number, lng: number, sosActive: boolean, startedAt?: string) => {
  const now = new Date().toISOString();
  const base: any = { lat, lng, updated_at: now, sender_name: senderName };
  const sosFields: any = sosColumnsAvailable
    ? { sos_active: sosActive, sos_phones: sosPhones, ...(startedAt ? { sos_started_at: startedAt } : {}) }
    : {};

  // 1) Update the existing row (keeps any journey destination intact)
  let { data, error } = await supabase.from("journey_locations").update({ ...base, ...sosFields }).eq("user_id", userId).select("user_id");
  if (error && /sos_/.test(error.message || "")) {
    // SQL for the sos_* columns hasn't been run yet — still share the location
    sosColumnsAvailable = false;
    ({ data, error } = await supabase.from("journey_locations").update(base).eq("user_id", userId).select("user_id"));
  }
  // 2) No row yet → create one that is NOT marked as an active journey
  if (!error && (!data || data.length === 0)) {
    await supabase.from("journey_locations").insert({ user_id: userId, ...base, is_active: false, ...(sosColumnsAvailable ? { sos_active: sosActive, sos_phones: sosPhones, sos_started_at: startedAt || now } : {}) });
  }
};

export const isSosLiveSharing = () => !!watchSub;

/** @param phones the sender's emergency contacts (normalized +234… numbers) */
export async function startSosLiveSharing(senderName: string, first?: { lat: number; lng: number }, phones: string[] = []) {
  const userId = await getUserId();
  if (!userId) return false;
  sosPhones = phones;
  const startedAt = new Date().toISOString();

  try {
    if (first) {
      lastUpload = Date.now();
      await writeLocation(userId, senderName, first.lat, first.lng, true, startedAt);
    }
  } catch {}

  if (watchSub) return true;
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") return false;
    watchSub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: UPLOAD_EVERY_MS, distanceInterval: 10 },
      (loc) => {
        if (Date.now() - lastUpload < UPLOAD_EVERY_MS) return;
        lastUpload = Date.now();
        writeLocation(userId, senderName, loc.coords.latitude, loc.coords.longitude, true).catch(() => {});
      }
    );
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = setTimeout(() => { stopSosLiveSharing().catch(() => {}); }, SOS_SHARE_DURATION_MS);
    return true;
  } catch {
    return false;
  }
}

export async function stopSosLiveSharing() {
  if (watchSub) watchSub.remove();
  watchSub = null;
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = null;
  try {
    const userId = await getUserId();
    // Turn off sharing AND remove the contacts' access to the location
    if (userId && sosColumnsAvailable) await supabase.from("journey_locations").update({ sos_active: false, sos_phones: [], updated_at: new Date().toISOString() }).eq("user_id", userId);
  } catch {}
}