/**
 * Root App Component
 * Entry point for the Ibadan Power application
 * Manages authentication state and navigation
 */

import React, { useEffect, useState } from "react";
import { Text, TextInput, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";

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

// 2. GLOBAL FONT OVERRIDE
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

export default function App() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Get the native system color scheme for Tamagui
  const colorScheme = useColorScheme();

  // 3. Load the local custom fonts into memory (Aliasing Sora to Chirp)
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
    if (!fontsLoaded && !fontError) return;

    const bootstrapAsync = async () => {
      try {
        await SplashScreen.hideAsync();

        const [isAuthenticated] = await Promise.all([
          AuthService.isAuthenticated(),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);

        setIsSignedIn(isAuthenticated);
      } catch (err) {
        console.error("Error checking authentication:", err);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setIsSignedIn(!!session?.access_token);
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
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme === 'dark' ? 'dark' : 'light'}>
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