/**
 * Login Screen
 * Clean Light Theme: Solid white background, light gray inputs, heavy dark headers.
 * Supports Email and Google OAuth with automatic phone-linking interception.
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
  StatusBar,
  Image,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons, AntDesign } from "@expo/vector-icons";
import { AuthStackParamList } from "../navigation/AuthNavigator";
import AuthService from "../services/authService";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

const THEME = {
  success: "#10C55B",
  textPrimary: "#1A1A1A",
  textSecondary: "#666666",
  background: "#FFFFFF",
  inputBg: "#F7F7F9",
  border: "#E5E5EA",
  error: "#FF3B30",
};

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim())
      return Alert.alert(
        "Validation",
        "Please enter your email address",
      );
    if (!password)
      return Alert.alert("Validation", "Please enter your password");

    setLoading(true);
    try {
      const submitEmail = email.trim();

      const result = await AuthService.loginWithEmail(
        submitEmail,
        password,
      );

      if (!result.success) {
        const errorMessage = result.error || "Login failed. Please try again.";

        if (errorMessage.toLowerCase().includes("not confirmed")) {
          Alert.alert(
            "Account Not Verified",
            "Please verify your email to continue.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Verify Now",
                onPress: () =>
                  navigation.navigate("Verify", {
                    identifier: submitEmail,
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
      } else {
        // --- PHONE INTERCEPTION CHECK ---
        const session = await AuthService.getCurrentSession();
        const currentUser = session?.user;

        if (!currentUser?.phone) {
          (navigation.replace as any)("LinkPhone");
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
      } else if (result.success) {
        // --- PHONE INTERCEPTION CHECK FOR GOOGLE ---
        const session = await AuthService.getCurrentSession();
        const currentUser = session?.user;

        if (!currentUser?.phone) {
          (navigation.replace as any)("LinkPhone");
        }
      }
    } catch (error) {
      Alert.alert("Google Auth Error", "An unexpected error occurred.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const isFormValid = email.trim() && password;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

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
                  size={20}
                  color={THEME.textPrimary}
                />
              </TouchableOpacity>
              
              <Image 
                source={require("../../assets/images/strompulselogo.png")} 
                style={styles.headerLogo} 
              />
            </View>

            <View style={styles.contentContainer}>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>
                  Sign in to access your grid dashboard.
                </Text>
              </View>

              <View style={styles.formContainer}>
                <View style={styles.inputWrapper}>
                  <MaterialIcons
                    name="mail-outline"
                    size={22}
                    color={THEME.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Email Address"
                    placeholderTextColor={THEME.textSecondary}
                    value={email}
                    onChangeText={(text) => setEmail(text.toLowerCase())}
                    editable={!loading}
                    keyboardType="email-address"
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
                  <ActivityIndicator size="small" color="#FFFFFF" />
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
                  <ActivityIndicator size="small" color={THEME.textPrimary} />
                ) : (
                  <>
                    <AntDesign
                      name="google"
                      size={20}
                      color={THEME.textPrimary}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  safeArea: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  scrollContainer: { flexGrow: 1 },
  header: { 
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24, 
    paddingTop: Platform.OS === "ios" ? 10 : 30, 
    paddingBottom: 10 
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.inputBg,
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 6, 
  },
  headerLogo: {
    width: 44, 
    height: 44,
    resizeMode: "contain",
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
    paddingBottom: 40,
  },
  titleContainer: { marginBottom: 40, alignItems: "flex-start" },
  title: {
    fontSize: 38,
    fontFamily: "Sora_800ExtraBold",
    color: THEME.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: { 
    fontSize: 16, 
    color: THEME.textSecondary, 
    fontFamily: "Sora_500Medium" 
  },
  formContainer: { gap: 16, marginBottom: 24 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.inputBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Sora_500Medium",
    color: THEME.textPrimary,
    padding: 0,
  },
  passwordContainer: { gap: 8 },
  forgotPasswordLink: { alignSelf: "flex-end", paddingHorizontal: 4 },
  forgotPasswordText: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontFamily: "Sora_600SemiBold",
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
    elevation: 4,
  },
  loginButtonDisabled: {
    backgroundColor: "#A7F3D0",
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: { 
    fontSize: 18, 
    fontFamily: "Sora_700Bold", 
    color: "#FFFFFF" 
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: THEME.border },
  dividerText: {
    color: THEME.textSecondary,
    paddingHorizontal: 16,
    fontSize: 13,
    fontFamily: "Sora_600SemiBold",
  },
  googleButton: {
    backgroundColor: THEME.background,
    borderWidth: 1,
    borderColor: THEME.border,
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: "Sora_700Bold",
    color: THEME.textPrimary,
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
  },
  signUpText: { 
    fontSize: 15, 
    color: THEME.textSecondary, 
    fontFamily: "Sora_500Medium" 
  },
  signUpLink: { 
    fontSize: 15, 
    fontFamily: "Sora_700Bold", 
    color: THEME.success 
  },
});

export default LoginScreen;