/**
 * Login Screen
 * Allows existing users to sign in with email and password
 * Form validation, error handling, and loading states included
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import { AuthStackParamList } from "../navigation/AuthNavigator";
import AuthService from "../services/authService";
import { isValidEmail } from "../utils/helpers";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // Validation
    if (!email.trim()) {
      Alert.alert("Validation Error", "Please enter your email address");
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert("Validation Error", "Please enter a valid email address");
      return;
    }

    if (!password) {
      Alert.alert("Validation Error", "Please enter your password");
      return;
    }

    setLoading(true);
    try {
      const result = await AuthService.loginWithEmail(email.trim(), password);

      if (result.success) {
        // Navigation will be handled by auth state change in RootNavigator
        // User will be automatically routed to main app
      } else {
        // Show user-friendly error messages
        let errorMessage = result.error || "Login failed. Please try again.";
        let errorTitle = "Login Failed";

        if (
          errorMessage.toLowerCase().includes("email not confirmed") ||
          errorMessage.toLowerCase().includes("not confirmed")
        ) {
          errorTitle = "Email Not Verified";
          errorMessage =
            "Please verify your email address first. Check your inbox for a verification link from us.";
        } else if (
          errorMessage.includes("Invalid login credentials") ||
          errorMessage.toLowerCase().includes("invalid")
        ) {
          errorMessage =
            "Invalid email or password. Please check and try again.";
        }

        Alert.alert(errorTitle, errorMessage);
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    navigation.navigate("Welcome");
  };

  const isFormValid = email.trim() && password && isValidEmail(email);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header with back button */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBackPress}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="arrow-back" size={24} color="#4CAF50" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Sign In</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.container}>
            {/* Welcome message */}
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeTitle}>Welcome Back</Text>
              <Text style={styles.welcomeSubtitle}>
                Sign in to access your electricity monitoring dashboard
              </Text>
            </View>

            {/* Form inputs */}
            <View style={styles.formContainer}>
              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons
                    name="email"
                    size={20}
                    color="#717171"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor="#424242"
                    value={email}
                    onChangeText={(text) => setEmail(text.toLowerCase())}
                    editable={!loading}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    maxLength={100}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Password</Text>
                  <TouchableOpacity
                    onPress={() => {
                      // TODO: Implement forgot password flow
                      Alert.alert(
                        "Forgot Password?",
                        "Password recovery feature coming soon.",
                      );
                    }}
                  >
                    <Text style={styles.forgotPasswordLink}>Forgot?</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputWrapper}>
                  <MaterialIcons
                    name="lock"
                    size={20}
                    color="#717171"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor="#424242"
                    value={password}
                    onChangeText={setPassword}
                    editable={!loading}
                    secureTextEntry={!showPassword}
                    maxLength={50}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialIcons
                      name={showPassword ? "visibility" : "visibility-off"}
                      size={20}
                      color="#717171"
                      style={styles.visibilityIcon}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                !isFormValid && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={!isFormValid || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={styles.buttonLoadingContainer}>
                  <ActivityIndicator size="small" color="#121212" />
                  <Text style={styles.loginButtonText}>Signing In...</Text>
                </View>
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("Signup")}
                disabled={loading}
              >
                <Text style={styles.signUpLink}>Create One</Text>
              </TouchableOpacity>
            </View>

            {/* Demo credentials hint */}
            <View style={styles.demoHintContainer}>
              <MaterialIcons name="info" size={16} color="#81C784" />
              <Text style={styles.demoHintText}>
                Demo account: demo@ibadanpower.com / demo123456
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#121212",
    borderBottomWidth: 1,
    borderBottomColor: "#242424",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: "space-between",
  },
  welcomeSection: {
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: "#B0BEC5",
    lineHeight: 20,
    fontWeight: "400",
  },
  formContainer: {
    marginBottom: 24,
    gap: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E0E0E0",
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  forgotPasswordLink: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4CAF50",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#303030",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
    padding: 0,
  },
  visibilityIcon: {
    marginLeft: 10,
  },
  loginButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loginButtonDisabled: {
    backgroundColor: "#757575",
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#121212",
    letterSpacing: 0.5,
  },
  buttonLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  signUpText: {
    fontSize: 14,
    color: "#90A4AE",
    fontWeight: "500",
  },
  signUpLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4CAF50",
  },
  demoHintContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(129, 199, 132, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 20,
    gap: 8,
  },
  demoHintText: {
    fontSize: 12,
    color: "#81C784",
    fontWeight: "500",
    flex: 1,
  },
});

export default LoginScreen;
