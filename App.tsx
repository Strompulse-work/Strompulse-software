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

export default function App() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Prevent splash screen from auto-hiding
    SplashScreen.preventAutoHideAsync();

    // Check if user is authenticated on app startup
    const bootstrapAsync = async () => {
      try {
        const isAuthenticated = await AuthService.isAuthenticated();
        setIsSignedIn(isAuthenticated);
      } catch (err) {
        console.error("Error checking authentication:", err);
      } finally {
        setIsLoading(false);
        // Hide splash screen after auth check
        await SplashScreen.hideAsync();
      }
    };

    bootstrapAsync();

    // Listen for auth state changes in real-time
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Update signed-in state based on auth state changes
      setIsSignedIn(!!session?.access_token);

      // Handle different auth events
      if (event === "SIGNED_IN") {
        console.log("User signed in");
      } else if (event === "SIGNED_OUT") {
        console.log("User signed out");
      } else if (event === "TOKEN_REFRESHED") {
        console.log("Token refreshed");
      }
    });

    // Cleanup real-time subscriptions on app unmount
    return () => {
      subscription?.unsubscribe();
      RealtimeService.unsubscribeAll();
    };
  }, []);

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
