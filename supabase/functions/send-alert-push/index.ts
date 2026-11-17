// supabase/functions/send-alert-push/index.ts
// Triggered by a Database Webhook on INSERT into public.alerts.
// Sends an Expo push notification ONLY to the people listed in alerts.recipient_phones
// (matched against their verified phone number), never to the sender, never to anyone else.
//
// Deploy:  npx supabase functions deploy send-alert-push
import { createClient } from "npm:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const stripLinks = (s: string) => (s || "").replace(/\s*https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();

const channelFor = (type: string) => (type === "emergency" ? "sos" : "default");

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload?.record ?? payload;
    if (!record?.id) return new Response(JSON.stringify({ skipped: "no record" }), { status: 200 });

    const phones: string[] = Array.isArray(record.recipient_phones)
      ? record.recipient_phones
      : typeof record.recipient_phones === "string"
      ? record.recipient_phones.replace(/[{}"\[\] ]/g, "").split(",").filter(Boolean)
      : [];
    if (phones.length === 0) return new Response(JSON.stringify({ sent: 0, reason: "no recipients" }), { status: 200 });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: targets, error } = await supabase.rpc("push_targets", { p_phones: phones, p_sender: record.user_id ?? null });
    if (error) throw error;

    const tokens = Array.from(new Set((targets || []).map((t: any) => t.push_token).filter((t: string) => t?.startsWith("ExponentPushToken") || t?.startsWith("ExpoPushToken"))));
    if (tokens.length === 0) return new Response(JSON.stringify({ sent: 0, reason: "recipients have no app / push token" }), { status: 200 });

    const data = record.data || {};
    const type: string = record.type || "general";
    const messages = tokens.map((to) => ({
      to,
      sound: "default",
      priority: "high",
      channelId: channelFor(type),
      title: record.title || "StromPulse",
      body: stripLinks(record.message).slice(0, 178),
      data: {
        alertId: record.id,
        type,
        senderId: record.user_id ?? null,
        senderName: data.senderName ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        groupName: data.groupName ?? null,
        kind: data.kind ?? null,
        createdAt: record.created_at ?? null,
      },
    }));

    let sent = 0;
    const dead: string[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      const json = await res.json().catch(() => ({}));
      (json?.data || []).forEach((r: any, idx: number) => {
        if (r?.status === "ok") sent += 1;
        else if (r?.details?.error === "DeviceNotRegistered") dead.push(chunk[idx].to);
      });
    }
    // Remove tokens of uninstalled apps so they stop failing
    if (dead.length) await supabase.from("user_tokens").delete().in("push_token", dead);

    return new Response(JSON.stringify({ sent, removed: dead.length }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[send-alert-push]", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  }
});