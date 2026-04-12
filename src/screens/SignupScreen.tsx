/**
 * Signup Screen
 * Allows new users to create an account with email and password
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

type Props = NativeStackScreenProps<AuthStackParamList, "Signup">;

const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    // Validation
    if (!fullName.trim()) {
      Alert.alert("Validation Error", "Please enter your full name");
      return;
    }

    if (!email.trim()) {
      Alert.alert("Validation Error", "Please enter your email address");
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert("Validation Error", "Please enter a valid email address");
      return;
    }

    if (!password) {
      Alert.alert("Validation Error", "Please enter a password");
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "Validation Error",
        "Password must be at least 6 characters long",
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Validation Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const result = await AuthService.signupWithEmail(
        email.trim(),
        password,
        fullName.trim(),
      );

      // Handle error case
      if (!result.success) {
        Alert.alert("Signup Failed", result.error || "An error occurred");
        return;
      }

      // SUCCESS CASE 1: User was auto-logged in (no email verification required)
      if (result.success && result.data) {
        Alert.alert(
          "Account Created",
          "Welcome! Your account has been created successfully. You are now logged in.",
          [
            {
              text: "OK",
              onPress: () => {
                // Navigation will be handled by auth state change in RootNavigator
                // User will be automatically logged in
              },
            },
          ],
        );
        return;
      }

      // SUCCESS CASE 2: Email verification required (session is null)
      // result.success = true, but result.data = undefined
      if (result.success && !result.data) {
        Alert.alert(
          "Check Your Email!",
          "We sent you a verification link. Please check your inbox and click the link to confirm your email address before logging in.",
          [
            {
              text: "Got It",
              onPress: () => {
                // Navigate to Login screen after user acknowledges the message
                navigation.replace("Login");
              },
            },
          ],
        );
        return;
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
      console.error("Signup error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    navigation.navigate("Welcome");
  };

  const isFormValid =
    fullName.trim() &&
    email.trim() &&
    password &&
    confirmPassword &&
    password === confirmPassword &&
    password.length >= 6 &&
    isValidEmail(email);

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
            <Text style={styles.headerTitle}>Create Account</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.container}>
            {/* Subtitle */}
            <Text style={styles.subtitle}>
              Join Ibadan Power to monitor your electricity in real-time
            </Text>

            {/* Form inputs */}
            <View style={styles.formContainer}>
              {/* Full Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons
                    name="person"
                    size={20}
                    color="#717171"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="John Doe"
                    placeholderTextColor="#424242"
                    value={fullName}
                    onChangeText={setFullName}
                    editable={!loading}
                    maxLength={100}
                  />
                </View>
              </View>

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
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons
                    name="lock"
                    size={20}
                    color="#717171"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="At least 6 characters"
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

              {/* Confirm Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons
                    name="lock"
                    size={20}
                    color="#717171"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter your password"
                    placeholderTextColor="#424242"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    editable={!loading}
                    secureTextEntry={!showConfirmPassword}
                    maxLength={50}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialIcons
                      name={
                        showConfirmPassword ? "visibility" : "visibility-off"
                      }
                      size={20}
                      color="#717171"
                      style={styles.visibilityIcon}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Password match indicator */}
              {confirmPassword && password !== confirmPassword && (
                <View style={styles.errorIndicator}>
                  <MaterialIcons
                    name="error-outline"
                    size={16}
                    color="#EF5350"
                  />
                  <Text style={styles.errorText}>Passwords do not match</Text>
                </View>
              )}

              {password && password.length < 6 && (
                <View style={styles.errorIndicator}>
                  <MaterialIcons
                    name="error-outline"
                    size={16}
                    color="#FFA726"
                  />
                  <Text style={styles.warningText}>
                    Password must be at least 6 characters
                  </Text>
                </View>
              )}
            </View>

            {/* Create Account Button */}
            <TouchableOpacity
              style={[
                styles.createButton,
                !isFormValid && styles.createButtonDisabled,
              ]}
              onPress={handleSignup}
              disabled={!isFormValid || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={styles.buttonLoadingContainer}>
                  <ActivityIndicator size="small" color="#121212" />
                  <Text style={styles.createButtonText}>
                    Creating Account...
                  </Text>
                </View>
              ) : (
                <Text style={styles.createButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Sign In Link */}
            <View style={styles.signInContainer}>
              <Text style={styles.signInText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("Login")}
                disabled={loading}
              >
                <Text style={styles.signInLink}>Sign In</Text>
              </TouchableOpacity>
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
  },
  subtitle: {
    fontSize: 14,
    color: "#B0BEC5",
    marginBottom: 28,
    lineHeight: 20,
    fontWeight: "500",
  },
  formContainer: {
    marginBottom: 24,
    gap: 16,
  },
  inputGroup: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E0E0E0",
    marginBottom: 8,
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
  errorIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 83, 80, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    marginTop: -4,
  },
  errorText: {
    fontSize: 13,
    color: "#EF5350",
    fontWeight: "500",
  },
  warningText: {
    fontSize: 13,
    color: "#FFA726",
    fontWeight: "500",
  },
  createButton: {
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
  createButtonDisabled: {
    backgroundColor: "#757575",
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  createButtonText: {
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
  signInContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  signInText: {
    fontSize: 14,
    color: "#90A4AE",
    fontWeight: "500",
  },
  signInLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4CAF50",
  },
});

export default SignupScreen;
