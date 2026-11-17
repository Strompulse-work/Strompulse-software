// src/utils/sessionGuard.ts
// The app keeps its own copy of the login (AuthService → SecureStore "user_data"), but every
// Supabase request (alerts, communities, live location) needs Supabase's OWN session.
// If that one went missing (e.g. it was too large to save, or the app was updated), the app
// still looks logged in but Supabase treats you as "no user" → "No user logged in to send alert",
// and saving a community is refused. This restores Supabase's session from the saved tokens.
import * as SecureStore from "expo-secure-store";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../config/supabase";

const AUTH_TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";

let inflight: Promise<Session | null> | null = null;

const saveTokens = async (s: Session) => {
  try {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, s.access_token);
    if (s.refresh_token) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, s.refresh_token);
  } catch {}
};

/** Returns a valid Supabase session, restoring it from the app's saved tokens if needed. */
export function ensureSupabaseSession(): Promise<Session | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) return data.session;

      const refresh = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refresh) return null;
      const access = (await SecureStore.getItemAsync(AUTH_TOKEN_KEY)) || "";

      // setSession refreshes automatically when the access token has expired
      let { data: restored, error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
      if (error || !restored.session) {
        ({ data: restored, error } = await supabase.auth.refreshSession({ refresh_token: refresh }) as any);
      }
      if (restored?.session) {
        await saveTokens(restored.session);
        return restored.session;
      }
      return null;
    } catch {
      return null;
    } finally {
      setTimeout(() => { inflight = null; }, 0);
    }
  })();
  return inflight;
}

/** Keep the app's saved tokens in step with Supabase (Supabase rotates them on every refresh). */
let listening = false;
export function keepTokensInSync() {
  if (listening) return;
  listening = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) saveTokens(session);
  });
}