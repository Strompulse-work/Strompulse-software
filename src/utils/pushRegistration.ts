import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "../config/supabase";

// How notifications behave while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false, // the in-app badge logic sets the icon badge itself
  }),
});

const getProjectId = () =>
  Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

let lastToken: string | null = null;

async function getToken(): Promise<string | null> {
  if (lastToken) return lastToken;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: getProjectId() });
  lastToken = data;
  return data;
}

// Accept an explicit userId so we can call this immediately AFTER login
export async function registerForPushNotificationsAsync(explicitUserId?: string) {
  // Android channels first, so the very first push already has a channel to use
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "General",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#00C48A",
    }).catch(() => {});
    Notifications.setNotificationChannelAsync("sos", {
      name: "SOS & safety alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: "#EF4444",
      sound: "default",
    }).catch(() => {});
  }

  if (!Device.isDevice) {
    console.log("Must use a physical device for push notifications");
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.log("Push notification permission not granted");
    return;
  }

  try {
    const pushToken = await getToken();
    if (!pushToken) return;

    let userId = explicitUserId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }
    if (!userId) {
      console.log("No user logged in yet, skipping token save. Will save upon login.");
      return;
    }

    // Give this phone's token to the logged-in account only (removes it from any previous account)
    const { error } = await supabase.rpc("claim_push_token", { p_token: pushToken, p_platform: Platform.OS });
    if (error) {
      // Fallback if push_tokens_fix.sql hasn't been run yet
      const { error: upsertError } = await supabase
        .from("user_tokens")
        .upsert({ user_id: userId, push_token: pushToken, platform: Platform.OS }, { onConflict: "user_id" });
      if (upsertError) console.error("Error saving push token to Supabase:", upsertError);
    } else {
      console.log("Push token saved for user:", userId);
    }
  } catch (error) {
    console.error("Error getting push token:", error);
  }
}

/** Call BEFORE signing out, so this phone stops receiving the old account's alerts. */
export async function unregisterPushTokenAsync() {
  try {
    if (!Device.isDevice) return;
    const token = await getToken();
    if (token) await supabase.rpc("release_push_token", { p_token: token });
  } catch {}
  try { await Notifications.setBadgeCountAsync(0); } catch {}
  lastToken = null;
}