/**
 * Root App Component
 * Entry point for the Ibadan Power application
 * Manages authentication state and navigation
 */

import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { supabase } from "./src/config/supabase";
import AuthService from "./src/services/authService";
import { ThemeProvider } from "./src/theme/ThemeContext";
import RealtimeService from "./src/services/realtimeService";
import RootNavigator from "./src/navigation/RootNavigator";
import { Colors } from "./src/styles/theme";
import CustomSplashScreen from "./src/screens/CustomSplashScreen";

export default function App() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Prevent the native splash screen from auto-hiding immediately
    SplashScreen.preventAutoHideAsync();

    const bootstrapAsync = async () => {
      try {
        // 1. Instantly hide the native Expo splash screen so our Custom BYTES screen is visible
        await SplashScreen.hideAsync();

        // 2. Run the Auth check AND a 2-second timer at the exact same time.
        // This guarantees the splash screen stays visible for exactly 2 seconds, 
        // mimicking the professional WhatsApp/Instagram loading flow.
        const [isAuthenticated] = await Promise.all([
          AuthService.isAuthenticated(),
          new Promise((resolve) => setTimeout(resolve, 2000)), 
        ]);

        setIsSignedIn(isAuthenticated);
      } catch (err) {
        console.error("Error checking authentication:", err);
      } finally {
        // 3. After the 2 seconds are up, drop the splash screen and reveal the app!
        setIsLoading(false);
      }
    };

    bootstrapAsync();

    // Listen for auth state changes in real-time
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setIsSignedIn(!!session?.access_token);

      if (event === "SIGNED_IN") {
        console.log("User signed in");
      } else if (event === "SIGNED_OUT") {
        console.log("User signed out");
      }
    });

    return () => {
      subscription?.unsubscribe();
      RealtimeService.unsubscribeAll();
    };
  }, []);

  // Show the custom splash screen while the 2-second timer and auth check are running
  if (isLoading) {
    return <CustomSplashScreen />;
  }

  // Once loading is done, render the real app
  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer
          linking={{
            prefixes: ["ibadanpower://", "https://ibadanpower.app"],
            config: {
              screens: {
                index: "",
                auth: "auth",
                "(tabs)": "(tabs)",
                "(tabs)/communities": "communities",
                "(tabs)/feed": "feed",
                "(tabs)/map": "map",
                "(tabs)/insights": "insights",
                "(tabs)/profile": "profile",
                "community-details": "community/:communityId",
                "device-details": "device/:deviceId",
              },
            },
          }}
        >
          <RootNavigator isSignedIn={isSignedIn} />
        </NavigationContainer>
        <StatusBar style="light" backgroundColor={Colors.primary} />
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}