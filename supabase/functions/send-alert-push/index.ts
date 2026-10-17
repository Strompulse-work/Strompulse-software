import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record; 

    // 1. Only care about emergency and journey_start
    if (record.type !== 'emergency' && record.type !== 'journey_start') {
      return new Response("Ignored: Not an SOS or Journey", { status: 200 });
    }

    const recipientPhones = record.recipient_phones || [];
    if (recipientPhones.length === 0) {
      return new Response("No phone numbers provided. SMS/WhatsApp handling only.", { status: 200 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Look up the user_ids for the provided phone numbers
    // Note: Ensure 'profiles' matches the name of the table where you store user phone numbers
    const { data: matchedProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, phone')
      .in('phone', recipientPhones);

    if (profileError || !matchedProfiles || matchedProfiles.length === 0) {
      return new Response("None of the contacts are registered Strompulse users", { status: 200 });
    }

    const targetUserIds = matchedProfiles.map(p => p.id);

    // 3. Fetch push tokens ONLY for those matched user_ids
    const { data: tokensData, error: tokenError } = await supabase
      .from('user_tokens')
      .select('push_token')
      .in('user_id', targetUserIds)
      .not('push_token', 'is', null);

    if (tokenError || !tokensData || tokensData.length === 0) {
      return new Response("Matched users do not have active push tokens", { status: 200 });
    }

    // 4. Build dynamic push notifications
    const expoMessages = tokensData.map((t) => {
      const isEmergency = record.type === 'emergency';
      const emoji = isEmergency ? "🚨 " : "📍 ";
      
      const displayTitle = record.title ? (emoji + record.title) : (emoji + (isEmergency ? "EMERGENCY SOS" : "Journey Started"));
      
      return {
        to: t.push_token,
        sound: "default",
        title: displayTitle,
        body: record.message || "Tap to open Strompulse and view live details.",
        data: { alertId: record.id, type: record.type },
      };
    });

    // 5. Send to Expo
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(expoMessages),
    });

    return new Response("Push notifications delivered successfully to contacts!", { status: 200 });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
});