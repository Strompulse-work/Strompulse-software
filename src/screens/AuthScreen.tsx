import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import AuthService from "../services/authService";
import { Colors, GlobalStyles, Spacing, Typography } from "../styles/theme";
import { isValidEmail, isValidPhoneNumber } from "../utils/helpers";

const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const result = await AuthService.loginWithEmail(email, password);
      setLoading(false);

      if (result.success) {
        // Navigation handled by auth state change
      } else {
        Alert.alert("Login Failed", result.error || "An error occurred");
      }
    } catch (error) {
      setLoading(false);
      Alert.alert("Error", "An unexpected error occurred");
    }
  };

  const handleSignup = async () => {
    if (!email || !password || !fullName) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const result = await AuthService.signupWithEmail(
        email,
        password,
        fullName,
      );
      setLoading(false);

      if (result.success) {
        Alert.alert(
          "Signup Successful",
          "Your account has been created. Please check your email to verify your account.",
        );
        // Navigation handled by auth state change
      } else {
        Alert.alert("Signup Failed", result.error || "An error occurred");
      }
    } catch (error) {
      setLoading(false);
      Alert.alert("Error", "An unexpected error occurred");
    }
  };

  const handleGuestLogin = async () => {
    // Demo login for testing
    const result = await AuthService.loginWithEmail(
      "demo@ibadanpower.com",
      "demo123456",
    );
    if (!result.success) {
      Alert.alert(
        "Demo Login",
        "Demo account not available. Please create an account.",
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={GlobalStyles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <MaterialIcons name="flash-on" size={48} color={Colors.primary} />
          </View>
          <Text style={[GlobalStyles.h1, { marginTop: Spacing.lg }]}>
            Ibadan Power
          </Text>
          <Text
            style={[
              GlobalStyles.bodySmall,
              { marginTop: Spacing.sm, color: Colors.text.secondary },
            ]}
          >
            Real-Time Electricity Monitoring
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {!isLogin && (
            <>
              <Text style={GlobalStyles.label}>Full Name</Text>
              <TextInput
                style={GlobalStyles.input}
                placeholder="Enter your full name"
                value={fullName}
                onChangeText={setFullName}
                placeholderTextColor={Colors.text.tertiary}
                editable={!loading}
              />
            </>
          )}

          <Text
            style={[
              GlobalStyles.label,
              { marginTop: isLogin ? 0 : Spacing.lg },
            ]}
          >
            Email Address
          </Text>
          <TextInput
            style={GlobalStyles.input}
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={Colors.text.tertiary}
            editable={!loading}
          />

          <Text style={[GlobalStyles.label, { marginTop: Spacing.lg }]}>
            Password
          </Text>
          <View style={styles.passwordInputContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder={isLogin ? "Enter password" : "At least 6 characters"}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor={Colors.text.tertiary}
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword(!showPassword)}
            >
              <MaterialIcons
                name={showPassword ? "visibility" : "visibility-off"}
                size={20}
                color={Colors.text.secondary}
              />
            </TouchableOpacity>
          </View>

          {/* Main Action Button */}
          <TouchableOpacity
            style={[
              GlobalStyles.buttonPrimary,
              { marginTop: Spacing.xl },
              loading && styles.disabled,
            ]}
            onPress={isLogin ? handleLogin : handleSignup}
            disabled={loading}
          >
            <Text
              style={{
                color: "white",
                fontWeight: "600",
                fontSize: Typography.fontSize.md,
              }}
            >
              {loading ? "Loading..." : isLogin ? "Login" : "Create Account"}
            </Text>
          </TouchableOpacity>

          {/* Toggle Login/Signup */}
          <View style={styles.toggleContainer}>
            <Text style={GlobalStyles.body}>
              {isLogin
                ? "Don't have an account? "
                : "Already have an account? "}
            </Text>
            <TouchableOpacity
              onPress={() => setIsLogin(!isLogin)}
              disabled={loading}
            >
              <Text
                style={[
                  GlobalStyles.body,
                  { color: Colors.primary, fontWeight: "600" },
                ]}
              >
                {isLogin ? "Sign up" : "Login"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Demo / Forgot Password */}
        <View style={styles.footer}>
          {isLogin && (
            <>
              <TouchableOpacity
                style={styles.footerLink}
                onPress={handleGuestLogin}
              >
                <Text
                  style={[GlobalStyles.bodySmall, { color: Colors.primary }]}
                >
                  Demo Login
                </Text>
              </TouchableOpacity>
              <Text style={GlobalStyles.caption}>•</Text>
            </>
          )}
          <TouchableOpacity>
            <Text style={[GlobalStyles.bodySmall, { color: Colors.primary }]}>
              {isLogin ? "Forgot password?" : "Privacy Policy"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xxxl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.backgroundDark,
    alignItems: "center",
    justifyContent: "center",
  },
  form: {
    marginVertical: Spacing.xl,
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.backgroundDark,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.md,
    color: Colors.text.primary,
  },
  passwordToggle: {
    padding: Spacing.sm,
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  footerLink: {
    padding: Spacing.xs,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default AuthScreen;
