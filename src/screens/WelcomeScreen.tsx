/**
 * Welcome Screen
 * First screen unauthenticated users see - landing page with app branding
 * Routes to Login or Signup
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Dimensions,
  ScrollView,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import { AuthStackParamList } from "../navigation/AuthNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "Welcome">;

const { width, height } = Dimensions.get("window");

const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  const handleGetStarted = () => {
    navigation.navigate("Signup");
  };

  const handleLogIn = () => {
    navigation.navigate("Login");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Header spacer */}
          <View style={styles.headerSpacer} />

          {/* Logo section */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <MaterialIcons name="flash-on" size={64} color="#4CAF50" />
            </View>
            <Text style={styles.appTitle}>Ibadan Power</Text>
            <Text style={styles.tagline}>Real-Time Electricity Monitoring</Text>
          </View>

          {/* Feature descriptions */}
          <View style={styles.featuresContainer}>
            <FeatureCard
              icon="trending-up"
              title="Live Monitoring"
              description="Track power consumption in real-time with precision"
            />
            <FeatureCard
              icon="location-on"
              title="Community Insights"
              description="Compare usage patterns with your community"
            />
            <FeatureCard
              icon="security"
              title="Secure & Private"
              description="Your data is encrypted and fully protected"
            />
          </View>

          {/* Buttons section */}
          <View style={styles.buttonsContainer}>
            {/* Primary button - Get Started */}
            <TouchableOpacity
              style={styles.buttonPrimary}
              onPress={handleGetStarted}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonTextPrimary}>Get Started</Text>
              <MaterialIcons
                name="arrow-forward"
                size={20}
                color="#121212"
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>

            {/* Secondary button - Log In */}
            <TouchableOpacity
              style={styles.buttonSecondary}
              onPress={handleLogIn}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonTextSecondary}>Log In</Text>
            </TouchableOpacity>
          </View>

          {/* Footer text */}
          <Text style={styles.footerText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * Feature Card Component
 * Reusable card for displaying app features
 */
interface FeatureCardProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
}) => (
  <View style={styles.featureCard}>
    <View style={styles.featureIconContainer}>
      <MaterialIcons name={icon} size={24} color="#4CAF50" />
    </View>
    <View style={styles.featureTextContainer}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: "space-between",
    minHeight: height * 0.95,
  },
  headerSpacer: {
    height: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#4CAF50",
  },
  appTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 16,
    color: "#B0BEC5",
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  featuresContainer: {
    marginVertical: 30,
    gap: 16,
  },
  featureCard: {
    flexDirection: "row",
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 16,
    alignItems: "flex-start",
    borderLeftWidth: 3,
    borderLeftColor: "#4CAF50",
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    color: "#90A4AE",
    lineHeight: 18,
  },
  buttonsContainer: {
    gap: 12,
    marginVertical: 20,
  },
  buttonPrimary: {
    backgroundColor: "#4CAF50",
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonTextPrimary: {
    fontSize: 16,
    fontWeight: "700",
    color: "#121212",
    letterSpacing: 0.5,
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonTextSecondary: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4CAF50",
    letterSpacing: 0.5,
  },
  footerText: {
    fontSize: 11,
    color: "#616161",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 16,
    fontWeight: "500",
  },
});

export default WelcomeScreen;
