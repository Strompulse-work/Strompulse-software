/**
 * Root App Component
 * Entry point for the Ibadan Power application
 * Manages authentication state and navigation
 */

import React, { useEffect, useState } from "react";
// 1. Import React Native components needed for the global override
import { Text, TextInput } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";

// 2. Import the Sora fonts
import {
  useFonts,
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from "@expo-google-fonts/sora";

import { supabase } from "./src/config/supabase";
import AuthService from "./src/services/authService";
import { ThemeProvider } from "./src/theme/ThemeContext";
import RealtimeService from "./src/services/realtimeService";
import RootNavigator from "./src/navigation/RootNavigator";
import { Colors } from "./src/styles/theme";
import CustomSplashScreen from "./src/screens/CustomSplashScreen";

// Prevent the native splash screen from auto-hiding before fonts are ready
SplashScreen.preventAutoHideAsync();

// 3. GLOBAL FONT OVERRIDE
// This forces every Text and TextInput component to use Sora by default
const customTextProps = {
  style: {
    fontFamily: "Sora_400Regular",
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


export default function App() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 4. Load the fonts into memory
  const [fontsLoaded, fontError] = useFonts({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
  });

  useEffect(() => {
    // Wait until fonts are successfully loaded or failed before running your boot sequence
    if (!fontsLoaded && !fontError) return;

    const bootstrapAsync = async () => {
      try {
        // 1. Instantly hide the native Expo splash screen so our Custom BYTES screen is visible
        await SplashScreen.hideAsync();

        // 2. Run the Auth check AND a 2-second timer at the exact same time.
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
  }, [fontsLoaded, fontError]); // Re-run this effect when font status changes

  // Keep the native splash screen locked until fonts are ready so we don't get a flash of missing fonts
  if (!fontsLoaded && !fontError) {
    return null;
  }

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
  );
}