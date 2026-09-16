import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { supabase } from "../config/supabase";

const LinkPhoneScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSavePhone = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert("Invalid Number", "Please enter a valid phone number.");
      return;
    }

    setLoading(true);

    try {
      // 1. Clean and format to E.164 (+234...)
      let formattedPhone = phone.replace(/[^0-9+]/g, "");
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "+234" + formattedPhone.slice(1);
      } else if (formattedPhone.startsWith("234")) {
        formattedPhone = "+" + formattedPhone;
      } else if (!formattedPhone.startsWith("+")) {
        formattedPhone = "+234" + formattedPhone;
      }

      // 2. Push to Supabase Auth Database
      const { data, error } = await supabase.auth.updateUser({
        phone: formattedPhone,
      });

      if (error) throw error;

      Alert.alert(
        "Secure Link Complete", 
        "Your phone number is now linked to your Strompulse Security profile.",
        [{ text: "Continue", onPress: () => navigation.replace("MainTabs") }] // Update with your actual next screen
      );

    } catch (error: any) {
      Alert.alert("Link Failed", error.message || "Failed to link phone number.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.background} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="shield-lock" size={48} color="#00C48A" />
          </View>
          
          <Text style={styles.title}>Secure Your Profile</Text>
          <Text style={styles.subtitle}>
            To ensure your SOS alerts and Live Journeys reach your emergency contacts, Strompulse needs to link your phone number to your secure profile.
          </Text>

          <View style={styles.inputContainer}>
            <View style={styles.prefixBox}>
              <Text style={styles.prefixText}>NG (+234)</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="090 1234 5678"
              placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={11}
            />
          </View>
          
          <View style={styles.infoBox}>
            <MaterialCommunityIcons name="information" size={16} color="#00C48A" />
            <Text style={styles.infoText}>This number is strictly used for emergency routing and is hidden from public view.</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.btnPrimary, (!phone || loading) && styles.btnDisabled]} 
            onPress={handleSavePhone}
            disabled={!phone || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.btnPrimaryText}>Link Phone Number</Text>
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const getStyles = (theme: any, isDarkMode: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#F4F6F8" },
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5", justifyContent: "center", alignItems: "center", marginBottom: 24, alignSelf: "center", borderWidth: 1, borderColor: "rgba(0,196,138,0.3)" },
  title: { fontSize: 24, fontFamily: "Sora_800ExtraBold", color: theme.textPrimary, textAlign: "center", marginBottom: 12 },
  subtitle: { fontSize: 13, fontFamily: "Sora_500Medium", color: theme.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 40, paddingHorizontal: 10 },
  
  inputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", height: 60, marginBottom: 16, overflow: "hidden" },
  prefixBox: { backgroundColor: isDarkMode ? "#1A221E" : "#F1F5F9", paddingHorizontal: 16, height: "100%", justifyContent: "center", borderRightWidth: 1, borderRightColor: isDarkMode ? "#2D3B34" : "#E2E8F0" },
  prefixText: { fontSize: 14, fontFamily: "Sora_700Bold", color: theme.textPrimary },
  input: { flex: 1, height: "100%", paddingHorizontal: 16, fontSize: 16, fontFamily: "Sora_600SemiBold", color: theme.textPrimary },
  
  infoBox: { flexDirection: "row", backgroundColor: isDarkMode ? "rgba(0,196,138,0.05)" : "#F0FDF4", padding: 12, borderRadius: 12, alignItems: "center" },
  infoText: { flex: 1, fontSize: 11, fontFamily: "Sora_500Medium", color: isDarkMode ? "#A7F3D0" : "#047857", marginLeft: 8, lineHeight: 16 },

  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === "ios" ? 34 : 24 },
  btnPrimary: { backgroundColor: "#00C48A", height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center", shadowColor: "#00C48A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5 },
  btnDisabled: { opacity: 0.6, shadowOpacity: 0, elevation: 0 },
  btnPrimaryText: { color: "#FFF", fontSize: 16, fontFamily: "Sora_700Bold" },
});

export default LinkPhoneScreen;