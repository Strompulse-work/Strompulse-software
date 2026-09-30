import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Platform, Switch, Alert } from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as LocalAuthentication from "expo-local-authentication";

const SETTINGS_KEY = "strompulse_security_settings";

const PrivacySecurityScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  
  const [biometrics, setBiometrics] = useState(false);
  const [locationSharing, setLocationSharing] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [backgroundTrigger, setBackgroundTrigger] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadSettings = async () => {
        const saved = await AsyncStorage.getItem(SETTINGS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setBiometrics(parsed.biometrics ?? false);
          setLocationSharing(parsed.locationSharing ?? true);
          setSendSms(parsed.sendSms ?? true);
          setBackgroundTrigger(parsed.backgroundTrigger ?? false);
        }
      };
      loadSettings();
    }, [])
  );

  const updateSetting = async (key: string, value: boolean) => {
    // Update local state instantly for UI responsiveness
    if (key === 'biometrics') setBiometrics(value);
    if (key === 'locationSharing') setLocationSharing(value);
    if (key === 'sendSms') setSendSms(value);
    if (key === 'backgroundTrigger') setBackgroundTrigger(value);

    // Merge with existing storage to prevent overwriting customMessage from the other screen
    const saved = await AsyncStorage.getItem(SETTINGS_KEY);
    const currentSettings = saved ? JSON.parse(saved) : {};
    
    const newSettings = { ...currentSettings, [key]: value };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  const handleBiometricToggle = async (newValue: boolean) => {
    if (newValue) {
      // Trying to turn ON App Lock
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert("Unsupported", "Your device does not support or have biometrics set up.");
        return;
      }

      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: "Verify your identity to enable App Lock",
        fallbackLabel: "Use Passcode",
      });

      if (authResult.success) {
        updateSetting('biometrics', true);
      } else {
        setBiometrics(false); // Revert switch if they fail/cancel
      }
    } else {
      // Trying to turn OFF App Lock (require verification to disable)
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: "Verify your identity to disable App Lock",
      });

      if (authResult.success) {
        updateSetting('biometrics', false);
      } else {
        setBiometrics(true); // Revert switch if they fail/cancel
      }
    }
  };

  const ToggleRow = ({ icon, title, desc, value, onValueChange, isDanger = false }: any) => (
    <View style={[styles.row, { borderBottomColor: isDarkMode ? "#1F2E27" : "#F1F5F9" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 16 }}>
        <MaterialCommunityIcons name={icon} size={22} color={isDanger ? "#EF4444" : theme.textPrimary} style={{ marginRight: 16 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: isDanger ? "#EF4444" : theme.textPrimary }]}>{title}</Text>
          <Text style={[styles.desc, { color: theme.textSecondary }]}>{desc}</Text>
        </View>
      </View>
      <Switch 
        value={value} 
        onValueChange={onValueChange} 
        trackColor={{ false: isDarkMode ? "#2D3B34" : "#E2E8F0", true: isDanger ? "#EF4444" : "#00C48A" }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#F4F6F8" }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Privacy & Security</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>APP SECURITY</Text>
        <View style={[styles.card, { backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderColor: isDarkMode ? "#2D3B34" : "#F1F5F9" }]}>
          <ToggleRow 
            icon="fingerprint" 
            title="App Lock" 
            desc="Require Face ID / Fingerprint to open app" 
            value={biometrics} 
            onValueChange={handleBiometricToggle} 
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 12 }]}>EMERGENCY TRIGGERS (SYNCED)</Text>
        <View style={[styles.card, { backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderColor: isDarkMode ? "#2D3B34" : "#F1F5F9", marginBottom: 0 }]}>
          <ToggleRow 
            icon="map-marker-outline" 
            title="Location Sharing" 
            desc="Share live location during SOS & journeys" 
            value={locationSharing} 
            onValueChange={(val: boolean) => updateSetting('locationSharing', val)} 
          />
          <ToggleRow 
            icon="message-text-outline" 
            title="Also Send via SMS" 
            desc="Emergency contacts will receive a text" 
            value={sendSms} 
            onValueChange={(val: boolean) => updateSetting('sendSms', val)} 
          />
          <ToggleRow 
            icon="cellphone-sound" 
            title="Background Trigger" 
            desc="Activate SOS without opening the app" 
            value={backgroundTrigger} 
            onValueChange={(val: boolean) => updateSetting('backgroundTrigger', val)} 
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 20 : 10, paddingBottom: 10 },
  iconBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "SoraTitle-Bold" },
  sectionTitle: { fontSize: 11, fontFamily: "Chirp-Bold", letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  card: { borderRadius: 24, paddingHorizontal: 20, overflow: "hidden", marginBottom: 24, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 18, borderBottomWidth: 1 },
  title: { fontSize: 14, fontFamily: "Chirp-Bold", marginBottom: 4 },
  desc: { fontSize: 12, fontFamily: "Chirp-Medium", lineHeight: 16 }
});

export default PrivacySecurityScreen;