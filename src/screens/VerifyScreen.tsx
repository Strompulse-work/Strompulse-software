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
  ImageBackground,
  StatusBar,
  Dimensions,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import { AuthStackParamList } from "../navigation/AuthNavigator";
import AuthService from "../services/authService";
import { useFonts } from "expo-font";

type Props = NativeStackScreenProps<AuthStackParamList, "Verify">;

const { width, height } = Dimensions.get("window");

const THEME = {
  success: "#00E676",
  textPrimary: "#FFFFFF",
  textSecondary: "rgba(255, 255, 255, 0.7)",
  glassBg: "rgba(18, 20, 29, 0.75)",
  glassBorder: "rgba(255, 255, 255, 0.1)",
};

const VerifyScreen: React.FC<Props> = ({ route, navigation }) => {
  // We will pass the phone/email from the previous screen
  const { identifier } = route.params;
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({
    Hiatus: require("../../assets/fonts/Hiatus.ttf"),
  });

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
          { text: "Continue" }, // Your AuthNavigator will auto-redirect them if session is set!
        ]);
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

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
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
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
              <Text style={styles.cursiveTitle}>Verify</Text>
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
            >
              {loading ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify Account</Text>
              )}
            </TouchableOpacity>
          </View>
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
  header: { paddingHorizontal: 24, paddingTop: 20 },
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
    paddingBottom: 100,
  },
  titleContainer: { marginBottom: 40, alignItems: "flex-start" },
  cursiveTitle: {
    fontFamily: "Hiatus",
    fontSize: 72,
    color: THEME.textPrimary,
    letterSpacing: 1,
    marginBottom: -10,
  },
  subtitle: {
    fontSize: 15,
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
    fontSize: 24,
    letterSpacing: 8,
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
  },
  verifyButtonDisabled: { backgroundColor: "rgba(0, 230, 118, 0.4)" },
  verifyButtonText: { fontSize: 18, fontWeight: "bold", color: "#000000" },
});

export default VerifyScreen;
