/**
 * Welcome Screen
 * Matches Aspen App Reference: Full-screen background, cursive top header,
 * left-aligned bottom typography, and a single wide button.
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../navigation/AuthNavigator";
import { useFonts } from "expo-font";

type Props = NativeStackScreenProps<AuthStackParamList, "Welcome">;

const { width, height } = Dimensions.get("window");

// Exact SRD Dark Theme Colors
const THEME = {
  success: "#00E676", // Bright Green for the main button
  textPrimary: "#FFFFFF",
};

const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  // Load ONLY the custom cursive font
  const [fontsLoaded] = useFonts({
    Hiatus: require("../../assets/fonts/Hiatus.ttf"),
  });

  const handleGetStarted = () => {
    navigation.navigate("Signup");
  };

  const handleLogIn = () => {
    navigation.navigate("Login");
  };

  // Wait for fonts to load before rendering to prevent visual glitches
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: "#12141D" }} />;
  }

  return (
    <ImageBackground
      source={require("../../assets/images/welcome-bg.png")}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Dark gradient/overlay so white text is readable over any background */}
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safeArea}>
        {/* TOP SECTION: Massive Cursive Title (Like "Aspen") */}
        <View style={styles.topSection}>
          <Text style={styles.cursiveTitle}>Ibadan</Text>
          <Text style={styles.cursiveTitle}> Power</Text>
        </View>

        {/* BOTTOM SECTION: Left-aligned text & button */}
        <View style={styles.bottomSection}>
          <Text style={styles.subTextLight}>monitor your</Text>
          <Text style={styles.subTextBold}>Real-Time Grid</Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>

          {/* Minimalist Login Link */}
          <TouchableOpacity onPress={handleLogIn} style={styles.loginLink}>
            <Text style={styles.loginText}>
              Already have an account? Log in
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: width,
    height: height,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.35)", // Darkens the image slightly for text contrast
  },
  safeArea: {
    flex: 1,
    justifyContent: "space-between", // Pushes title up, button down
  },
  topSection: {
    alignItems: "center",
    marginTop: height * 0.1, // Pushes it down a bit from the very top edge
  },
  cursiveTitle: {
    fontFamily: "Hiatus",
    fontSize: 90, // Massive size to match the "Aspen" script
    color: THEME.textPrimary,
    letterSpacing: 2,
  },
  bottomSection: {
    paddingHorizontal: 32,
    paddingBottom: 40,
    alignItems: "flex-start", // Left-aligns the text like the reference
  },
  subTextLight: {
    fontSize: 24,
    color: THEME.textPrimary,
    marginBottom: 4,
    opacity: 0.9,
  },
  subTextBold: {
    fontSize: 36,
    color: THEME.textPrimary,
    fontWeight: "bold",
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: THEME.success,
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16, // Smooth rounded corners
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: THEME.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000000", // Dark text on the bright button
  },
  loginLink: {
    alignSelf: "center",
    padding: 10,
  },
  loginText: {
    fontSize: 14,
    color: THEME.textPrimary,
    opacity: 0.8,
    fontWeight: "500",
  },
});

export default WelcomeScreen;
