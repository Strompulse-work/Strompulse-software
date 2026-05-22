import React from "react";
import { View, Text, StyleSheet, Image, Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

const CustomSplashScreen = () => {
  return (
    <View style={styles.container}>
      {/* Center Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require("../../assets/images/strompulselogo.png")}
          style={styles.logo}
        />
      </View>

      {/* WhatsApp-style Bottom Branding */}
      <View style={styles.brandingContainer}>
        <Text style={styles.fromText}>from</Text>
        <Text style={styles.brandText}>BYTES</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF", // Keep it white to match your new auth themes
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 120, // Nice and crisp
    height: 120,
    resizeMode: "contain",
  },
  brandingContainer: {
    paddingBottom: 50, // Pushes it up from the very bottom of the screen
    alignItems: "center",
  },
  fromText: {
    fontSize: 14,
    color: "#666666",
    fontWeight: "500",
    marginBottom: 2,
  },
  brandText: {
    fontSize: 22,
    color: "#10C55B", // Your signature Strompulse green
    fontWeight: "900",
    letterSpacing: 2,
  },
});

export default CustomSplashScreen;