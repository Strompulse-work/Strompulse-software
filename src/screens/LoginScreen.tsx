/**
 * Login Screen
 * Modern Cinematic Theme: Full-bleed background, glassy inputs, cursive header
 * Supports Email, Phone (Auto E.164 Formatting), and Google OAuth
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
  ImageBackground,
  StatusBar,
  Dimensions,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons, AntDesign } from "@expo/vector-icons";
import { AuthStackParamList } from "../navigation/AuthNavigator";
import AuthService from "../services/authService";
import { useFonts } from "expo-font";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

const { width, height } = Dimensions.get("window");

const THEME = {
  success: "#00E676",
  textPrimary: "#FFFFFF",
  textSecondary: "rgba(255, 255, 255, 0.7)",
  glassBg: "rgba(18, 20, 29, 0.75)",
  glassBorder: "rgba(255, 255, 255, 0.1)",
  error: "#FF3B30",
};

// Helper to auto-format Nigerian numbers for Twilio
const formatToE164 = (phone: string) => {
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("0") && cleaned.length === 11)
    return "+234" + cleaned.substring(1);
  if (cleaned.startsWith("234") && cleaned.length === 13) return "+" + cleaned;
  return "+" + cleaned;
};

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [fontsLoaded] = useFonts({
    Hiatus: require("../../assets/fonts/Hiatus.ttf"),
  });

  const isPhone = /^\d+$/.test(identifier.replace(/[\s\-\+]/g, ""));

  const handleLogin = async () => {
    if (!identifier.trim())
      return Alert.alert(
        "Validation",
        "Please enter your email or phone number",
      );
    if (!password)
      return Alert.alert("Validation", "Please enter your password");

    setLoading(true);
    try {
      const submitIdentifier = isPhone
        ? formatToE164(identifier.trim())
        : identifier.trim();

      const result = await AuthService.loginWithEmail(
        submitIdentifier,
        password,
      );

      if (!result.success) {
        const errorMessage = result.error || "Login failed. Please try again.";

        if (errorMessage.toLowerCase().includes("not confirmed")) {
          // Push them to the verify screen if they never verified!
          Alert.alert(
            "Account Not Verified",
            "Please verify your phone/email to continue.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Verify Now",
                onPress: () =>
                  navigation.navigate("Verify", {
                    identifier: submitIdentifier,
                  }),
              },
            ],
          );
        } else if (errorMessage.toLowerCase().includes("invalid")) {
          Alert.alert(
            "Login Failed",
            "Invalid credentials. Please check and try again.",
          );
        } else {
          Alert.alert("Login Failed", errorMessage);
        }
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    try {
      const result = await AuthService.loginWithGoogle();
      if (!result.success && result.error !== "Google sign-in was cancelled.") {
        Alert.alert(
          "Google Auth Error",
          result.error || "Could not connect to Google.",
        );
      }
    } catch (error) {
      Alert.alert("Google Auth Error", "An unexpected error occurred.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const isFormValid = identifier.trim() && password;

  if (!fontsLoaded)
    return <View style={{ flex: 1, backgroundColor: "#12141D" }} />;

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
      <View style={styles.overlay} />

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
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => navigation.navigate("Welcome")}
                style={styles.backButton}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <MaterialIcons
                  name="arrow-back-ios"
                  size={22}
                  color={THEME.textPrimary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.contentContainer}>
              <View style={styles.titleContainer}>
                <Text style={styles.cursiveTitle}>Welcome Back</Text>
                <Text style={styles.subtitle}>
                  Sign in to access your grid dashboard.
                </Text>
              </View>

              <View style={styles.formContainer}>
                <View style={styles.inputWrapper}>
                  <MaterialIcons
                    name={isPhone ? "phone" : "mail-outline"}
                    size={22}
                    color={THEME.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Email or Phone Number"
                    placeholderTextColor={THEME.textSecondary}
                    value={identifier}
                    onChangeText={(text) => setIdentifier(text.toLowerCase())}
                    editable={!loading}
                    keyboardType="default"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.passwordContainer}>
                  <View style={styles.inputWrapper}>
                    <MaterialIcons
                      name="lock-outline"
                      size={22}
                      color={THEME.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      placeholderTextColor={THEME.textSecondary}
                      value={password}
                      onChangeText={setPassword}
                      editable={!loading}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <MaterialIcons
                        name={showPassword ? "visibility" : "visibility-off"}
                        size={22}
                        color={THEME.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert("Forgot Password?", "Coming soon.")
                    }
                    style={styles.forgotPasswordLink}
                  >
                    <Text style={styles.forgotPasswordText}>
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.loginButton,
                  !isFormValid && styles.loginButtonDisabled,
                ]}
                onPress={handleLogin}
                disabled={!isFormValid || loading || googleLoading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.loginButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleAuth}
                disabled={loading || googleLoading}
                activeOpacity={0.8}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AntDesign
                      name="google"
                      size={20}
                      color="#FFFFFF"
                      style={{ marginRight: 12 }}
                    />
                    <Text style={styles.googleButtonText}>
                      Sign in with Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.signUpContainer}>
                <Text style={styles.signUpText}>Don't have an account? </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate("Signup")}
                  disabled={loading}
                >
                  <Text style={styles.signUpLink}>Create One</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width: width, height: height },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  safeArea: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  scrollContainer: { flexGrow: 1 },
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 10 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 6,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
    paddingBottom: 40,
  },
  titleContainer: { marginBottom: 40, alignItems: "flex-start" },
  cursiveTitle: {
    fontFamily: "Hiatus",
    fontSize: 72,
    color: THEME.textPrimary,
    letterSpacing: 1,
    marginBottom: -10,
  },
  subtitle: { fontSize: 15, color: THEME.textSecondary, fontWeight: "500" },
  formContainer: { gap: 16, marginBottom: 24 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.glassBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.glassBorder,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: THEME.textPrimary,
    padding: 0,
  },
  passwordContainer: { gap: 8 },
  forgotPasswordLink: { alignSelf: "flex-end", paddingHorizontal: 4 },
  forgotPasswordText: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: "500",
  },
  loginButton: {
    backgroundColor: THEME.success,
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: THEME.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loginButtonDisabled: {
    backgroundColor: "rgba(0, 230, 118, 0.4)",
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: { fontSize: 18, fontWeight: "bold", color: "#000000" },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: THEME.glassBorder },
  dividerText: {
    color: THEME.textSecondary,
    paddingHorizontal: 16,
    fontSize: 13,
    fontWeight: "600",
  },
  googleButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: THEME.glassBorder,
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: THEME.textPrimary,
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
  },
  signUpText: { fontSize: 15, color: THEME.textSecondary, fontWeight: "500" },
  signUpLink: { fontSize: 15, fontWeight: "bold", color: THEME.success },
});

export default LoginScreen;
