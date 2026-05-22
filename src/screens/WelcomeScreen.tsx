/**
 * Welcome Screen
 * Clean white background with centered logo, left-aligned typography,
 * and a single wide button to match the new mockup.
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  Platform,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../navigation/AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "Welcome">;

// Updated Theme Colors for the Light UI
const THEME = {
  success: "#10C55B", // Exact green from your mockup button
  textPrimary: "#1A1A1A", // Dark charcoal for readability on white
  background: "#FFFFFF",
};

const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  const handleGetStarted = () => {
    navigation.navigate("Signup");
  };

  const handleLogIn = () => {
    navigation.navigate("Login");
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content" // Dark icons for the white background
        backgroundColor="transparent"
        translucent
      />

      <SafeAreaView style={styles.safeArea}>
        {/* CENTER SECTION: Sized-down Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/images/strompulselogo.png")} // Make sure the image is in this folder!
            style={styles.logo}
          />
        </View>

        {/* BOTTOM SECTION: Left-aligned text & button */}
        <View style={styles.bottomSection}>
          <Text style={styles.subTextLight}>Monitor your</Text>
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
              Already have an account? <Text style={{ fontWeight: "bold" }}>Log in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  safeArea: {
    flex: 1,
    justifyContent: "space-between",
  },
  logoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 180, // Restricts the size so it is not overwhelmingly large
    height: 180,
    resizeMode: "contain",
  },
  bottomSection: {
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === "ios" ? 40 : 32, 
    alignItems: "flex-start", 
  },
  subTextLight: {
    fontSize: 26,
    color: THEME.textPrimary,
    fontWeight: "600",
    marginBottom: -2, 
  },
  subTextBold: {
    fontSize: 38,
    color: THEME.textPrimary,
    fontWeight: "900", // Heavy bold to match the mockup
    marginBottom: 32,
    letterSpacing: -0.5,
  },
  primaryButton: {
    backgroundColor: THEME.success,
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16, 
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    // Subtle shadow for the button
    shadowColor: THEME.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF", // White text on the green button
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