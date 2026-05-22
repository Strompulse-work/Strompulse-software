/**
 * Verify Screen
 * Clean Light Theme: Solid white background, light gray inputs, heavy dark headers.
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
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar,
  Image,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import { AuthStackParamList } from "../navigation/AuthNavigator";
import AuthService from "../services/authService";

type Props = NativeStackScreenProps<AuthStackParamList, "Verify">;

// Updated Theme Colors for Light UI
const THEME = {
  success: "#10C55B",
  textPrimary: "#1A1A1A",
  textSecondary: "#666666",
  background: "#FFFFFF",
  inputBg: "#F7F7F9",
  border: "#E5E5EA",
  error: "#FF3B30",
};

const VerifyScreen: React.FC<Props> = ({ route, navigation }) => {
  // We pass the phone/email from the previous screen
  const { identifier } = route.params;
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) {
      return Alert.alert("Invalid Code", "Please enter the 6-digit code.");
    }

    setLoading(true);
    try {
      const result = await AuthService.verifyOTP(identifier, code);

      if (!result.success) {
        Alert.alert(
          "Verification Failed",
          result.error || "Invalid code. Try again.",
        );
      } else {
        Alert.alert("Success!", "Your account is verified.", [
          { text: "Continue" }, // AuthNavigator will auto-redirect if session is set!
        ]);
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

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
          {/* UPDATED HEADER: Houses back button and the logo */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
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
              <Text style={styles.title}>Verify</Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit code sent to
              </Text>
              <Text style={styles.highlightText}>{identifier}</Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputWrapper}>
                <MaterialIcons
                  name="dialpad"
                  size={22}
                  color={THEME.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="123456"
                  placeholderTextColor={THEME.textSecondary}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loading}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.verifyButton,
                code.length !== 6 && styles.verifyButtonDisabled,
              ]}
              onPress={handleVerify}
              disabled={code.length !== 6 || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify Account</Text>
              )}
            </TouchableOpacity>
          </View>
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
    paddingBottom: 100,
  },
  titleContainer: { marginBottom: 40, alignItems: "flex-start" },
  title: {
    fontSize: 38,
    fontWeight: "900",
    color: THEME.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: THEME.textSecondary,
    fontWeight: "500",
    marginTop: 10,
  },
  highlightText: {
    fontSize: 16,
    color: THEME.success,
    fontWeight: "bold",
    marginTop: 4,
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
    fontSize: 28, // Slightly larger for code emphasis
    letterSpacing: 10,
    fontWeight: "bold",
    color: THEME.textPrimary,
    padding: 0,
    textAlign: "center",
  },
  verifyButton: {
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
  verifyButtonDisabled: {
    backgroundColor: "#A7F3D0",
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyButtonText: { 
    fontSize: 18, 
    fontWeight: "bold", 
    color: "#FFFFFF" 
  },
});

export default VerifyScreen;