/**
 * Root App Component
 * Entry point for the Strompulse / Ibadan Power application
 * Manages authentication state, notification setup, and navigation
 */

import React, { useEffect, useState, useRef } from "react";
import { Text, TextInput, useColorScheme, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

// Tamagui Imports
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "./tamagui.config";

// 1. Import the local font loader from Expo
import { useFonts } from "expo-font";

// Real Sora font, used only where we explicitly want the true Sora look (e.g. the app title)
import { Sora_700Bold as SoraTitleFont } from "@expo-google-fonts/sora";

import { supabase } from "./src/config/supabase";
import AuthService from "./src/services/authService";
import { ThemeProvider } from "./src/theme/ThemeContext";
import RealtimeService from "./src/services/realtimeService";
import RootNavigator from "./src/navigation/RootNavigator";
import { Colors } from "./src/styles/theme";
import CustomSplashScreen from "./src/screens/CustomSplashScreen";

SplashScreen.preventAutoHideAsync();

// 2. Configure foreground notification presentation
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
  } as any),
});

// 3. GLOBAL FONT OVERRIDE
// This forces every Text and TextInput component to use Chirp by default
const customTextProps = {
  style: {
    fontFamily: "Chirp-Regular",
  },
};

// @ts-ignore
Text.defaultProps = Text.defaultProps || {};
// @ts-ignore
Text.defaultProps.style = { ...(Text.defaultProps.style || {}), ...customTextProps.style };

// @ts-ignore
TextInput.defaultProps = TextInput.defaultProps || {};
// @ts-ignore
TextInput.defaultProps.style = { ...(TextInput.defaultProps.style || {}), ...customTextProps.style };

// Helper to register push notifications and create Android channels
async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === "android") {
    // Channel for critical SOS & Journey emergency alerts (Max importance for heads-up drop-downs)
    await Notifications.setNotificationChannelAsync("emergency_alerts", {
      name: "Emergency Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#EF4444",
      sound: "default",
    });

    // Channel for regular power grid updates
    await Notifications.setNotificationChannelAsync("grid_updates", {
      name: "Grid Updates",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Failed to get push token: permission not granted.");
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    try {
      const pushTokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      token = pushTokenData.data;
      console.log("EXPO PUSH TOKEN:", token);
    } catch (e) {
      console.warn("Error retrieving Expo Push Token:", e);
    }
  } else {
    console.log("Physical device required for Push Notifications.");
  }

  return token;
}

export default function App() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  // Get the native system color scheme for Tamagui
  const colorScheme = useColorScheme();

  // 4. Load the local custom fonts into memory (Aliasing Sora to Chirp)
  const [fontsLoaded, fontError] = useFonts({
    // Keep custom Chirp keys for newly built screens
    "Chirp-Regular": require("./assets/fonts/Chirp-Regular.ttf"),
    "Chirp-Medium": require("./assets/fonts/Chirp-Medium.ttf"),
    "Chirp-Bold": require("./assets/fonts/Chirp-Bold.ttf"),
    "Chirp-Heavy": require("./assets/fonts/Chirp-Heavy.ttf"),

    // Alias the old Sora keys directly to Chirp so old screens update instantly
    "Sora_400Regular": require("./assets/fonts/Chirp-Regular.ttf"),
    "Sora_500Medium": require("./assets/fonts/Chirp-Medium.ttf"),
    "Sora_600SemiBold": require("./assets/fonts/Chirp-Bold.ttf"),
    "Sora_700Bold": require("./assets/fonts/Chirp-Bold.ttf"),
    "Sora_800ExtraBold": require("./assets/fonts/Chirp-Heavy.ttf"),

    // Real Sora, used only where we explicitly want the true Sora look (e.g. the app title)
    "SoraTitle-Bold": SoraTitleFont,
  });

  useEffect(() => {
    // Clear app icon badges on app open
    Notifications.setBadgeCountAsync(0).catch(() => {});

    // Listen for incoming notifications while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log("Notification received in foreground:", notification);
    });

    // Listen for interaction when user taps a notification banner
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Notification interacted with:", response);
      Notifications.setBadgeCountAsync(0).catch(() => {});
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;

    const bootstrapAsync = async () => {
      try {
        await SplashScreen.hideAsync();

        const [isAuthenticated] = await Promise.all([
          AuthService.isAuthenticated(),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);

        setIsSignedIn(isAuthenticated);

        // Register push token and sync with current user in Supabase
        const token = await registerForPushNotificationsAsync();
        if (token) {
          const session = await AuthService.getCurrentSession();
          if (session?.user?.id) {
            await supabase
              .from("profiles")
              .update({ push_token: token })
              .eq("id", session.user.id);
          }
        }
      } catch (err) {
        console.error("Error checking authentication or push registration:", err);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const loggedIn = !!session?.access_token;
      setIsSignedIn(loggedIn);

      // Re-sync push token on login using async/await with try-catch
      if (loggedIn && session?.user?.id) {
        registerForPushNotificationsAsync().then(async (token) => {
          if (token) {
            try {
              await supabase
                .from("profiles")
                .update({ push_token: token })
                .eq("id", session.user.id);
            } catch (err) {
              console.warn("Failed to update profile push token:", err);
            }
          }
        });
      }
    });

    return () => {
      subscription?.unsubscribe();
      RealtimeService.unsubscribeAll();
    };
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (isLoading) {
    return <CustomSplashScreen />;
  }

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme === "dark" ? "dark" : "light"}>
      <ThemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <NavigationContainer
            linking={{
              prefixes: ["ibadanpower://", "https://ibadanpower.app"],
              config: {
                screens: {
                  index: "",
                  auth: "auth",
                  "Power Status": {
                    path: "power-status",
                    screens: {
                      CitySelector: "selector",
                      CityDetail: "details",
                    },
                  },
                  Safety: "safety",
                  Feed: "feed",
                  Notifications: "notifications",
                  Profile: "profile",
                },
              } as any,
            }}
          >
            <RootNavigator isSignedIn={isSignedIn} />
          </NavigationContainer>
          <StatusBar style="light" backgroundColor={Colors.primary} />
        </GestureHandlerRootView>
      </ThemeProvider>
    </TamaguiProvider>
  );
}