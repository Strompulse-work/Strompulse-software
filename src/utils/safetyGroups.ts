// src/utils/safetyGroups.ts
// "Communities": groups of friends/family the user creates (like WhatsApp groups).
// Journey shares and SOS alerts can be sent to a whole group at once, and every member
// can see who else is in the group. Stored in Supabase (table: safety_groups) so members
// on other phones can see the group too; cached locally for offline use.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";
import { normalizePhone } from "./securityConfig";
import { getMyIdentity, phoneKey } from "./myIdentity";

export type GroupMember = { name: string; phone: string };
export type SafetyGroup = {
  id: string;
  owner_id: string;
  owner_name?: string | null;
  name: string;
  emoji?: string | null;
  members: GroupMember[];
  member_phones: string[];
  alert_on_sos: boolean;
  created_at?: string;
  updated_at?: string;
};

const CACHE_KEY = "strompulse_safety_groups_cache";
export const GROUP_EMOJIS = ["👨‍👩‍👧", "🏠", "💼", "🎓", "⛪", "🕌", "⚽", "❤️", "🚗", "⭐"];

const clean = (members: GroupMember[]) => {
  const seen = new Set<string>();
  const out: GroupMember[] = [];
  for (const m of members) {
    const phone = normalizePhone(m.phone || "");
    const key = phoneKey(phone);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ name: (m.name || "").trim() || phone, phone });
  }
  return out;
};

const toRow = (g: SafetyGroup): SafetyGroup => ({
  ...g,
  members: Array.isArray(g.members) ? g.members : [],
  member_phones: Array.isArray(g.member_phones) ? g.member_phones : [],
  alert_on_sos: !!g.alert_on_sos,
});

/** Groups I created + groups I've been added to (by my verified phone number). */
export async function loadGroups(): Promise<{ mine: SafetyGroup[]; memberOf: SafetyGroup[]; offline: boolean }> {
  const me = await getMyIdentity();
  try {
    // RLS only returns groups I own or am a member of
    const { data, error } = await supabase.from("safety_groups").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    const rows = (data || []).map(toRow);
    const mine = rows.filter((g) => g.owner_id === me.userId);
    const memberOf = rows.filter((g) => g.owner_id !== me.userId);
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ userId: me.userId, mine, memberOf })).catch(() => {});
    return { mine, memberOf, offline: false };
  } catch {
    try {
      const cached = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) || "null");
      if (cached && cached.userId === me.userId) return { mine: cached.mine || [], memberOf: cached.memberOf || [], offline: true };
    } catch {}
    return { mine: [], memberOf: [], offline: true };
  }
}

export async function saveGroup(input: { id?: string; name: string; emoji?: string; members: GroupMember[]; alert_on_sos: boolean }, ownerName: string) {
  const me = await getMyIdentity(); // also restores the Supabase login if it went missing
  if (!me.userId) throw Object.assign(new Error("not authenticated"), { code: "42501" });
  const members = clean(input.members);
  const row: any = {
    name: input.name.trim(),
    emoji: input.emoji || null,
    members,
    member_phones: members.map((m) => m.phone),
    alert_on_sos: input.alert_on_sos,
    owner_name: ownerName,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { data, error } = await supabase.from("safety_groups").update(row).eq("id", input.id).select().single();
    if (error) throw error;
    return toRow(data);
  }
  const { data, error } = await supabase.from("safety_groups").insert({ ...row, owner_id: me.userId }).select().single();
  if (error) throw error;
  return toRow(data);
}

export async function deleteGroup(id: string) {
  const { error } = await supabase.from("safety_groups").delete().eq("id", id);
  if (error) throw error;
}

/** Leave a group someone else created (removes my number from it). */
export async function leaveGroup(id: string) {
  const { error } = await supabase.rpc("leave_safety_group", { p_group_id: id });
  if (error) throw error;
}

/** Merge contacts + groups into one de-duplicated recipient list (normalized phones + names). */
export function buildRecipients(contacts: { name: string; phone: string }[], groups: SafetyGroup[], myKey = "") {
  const seen = new Set<string>();
  const list: GroupMember[] = [];
  const add = (name: string, phone: string) => {
    const p = normalizePhone(phone || "");
    const k = phoneKey(p);
    if (!k || seen.has(k) || (myKey && k === myKey)) return;
    seen.add(k);
    list.push({ name, phone: p });
  };
  contacts.forEach((c) => add(c.name, c.phone));
  groups.forEach((g) => g.members.forEach((m) => add(m.name, m.phone)));
  return list;
}