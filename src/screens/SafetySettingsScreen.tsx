import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  Platform, 
  StatusBar, 
  ScrollView,
  Switch
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS_KEY = "strompulse_security_settings";

const SafetySettingsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);

  // States matching the Figma toggles
  const [locationSharing, setLocationSharing] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [backgroundTrigger, setBackgroundTrigger] = useState(false);

  // Load saved preferences
  useEffect(() => {
    const loadSettings = async () => {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setLocationSharing(parsed.locationSharing ?? true);
        setSendSms(parsed.sendSms ?? true);
        setBackgroundTrigger(parsed.backgroundTrigger ?? false);
      }
    };
    loadSettings();
  }, []);

  const toggleSetting = async (key: string, value: boolean) => {
    if (key === 'location') setLocationSharing(value);
    if (key === 'sms') setSendSms(value);
    if (key === 'background') setBackgroundTrigger(value);

    const newSettings = {
      locationSharing: key === 'location' ? value : locationSharing,
      sendSms: key === 'sms' ? value : sendSms,
      backgroundTrigger: key === 'background' ? value : backgroundTrigger
    };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.headerTitle}>Security Settings</Text>
            <Text style={styles.headerSub}>TRIGGERS & PRIVACY</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          <Text style={styles.sectionLabel}>PRIVACY</Text>
          <View style={styles.settingCard}>
            <View style={[styles.iconBox, { backgroundColor: isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5" }]}>
              <MaterialCommunityIcons name="map-marker-outline" size={20} color="#00C48A" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.settingTitle}>Location Sharing</Text>
              <Text style={styles.settingSub}>Shared during SOS & journey</Text>
            </View>
            <Switch 
              trackColor={{ false: isDarkMode ? "#2D3B34" : "#E2E8F0", true: "#00C48A" }}
              thumbColor={"#FFFFFF"}
              ios_backgroundColor={isDarkMode ? "#2D3B34" : "#E2E8F0"}
              onValueChange={(val) => toggleSetting('location', val)}
              value={locationSharing}
            />
          </View>

          <Text style={styles.sectionLabel}>ALERT DELIVERY</Text>
          <View style={styles.settingCard}>
            <View style={[styles.iconBox, { backgroundColor: isDarkMode ? "rgba(59,130,246,0.15)" : "#EFF6FF" }]}>
              <MaterialCommunityIcons name="cellphone" size={20} color="#2563EB" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.settingTitle}>Also Send via SMS</Text>
              <Text style={styles.settingSub}>Contacts also get a text message</Text>
            </View>
            <Switch 
              trackColor={{ false: isDarkMode ? "#2D3B34" : "#E2E8F0", true: "#2563EB" }}
              thumbColor={"#FFFFFF"}
              ios_backgroundColor={isDarkMode ? "#2D3B34" : "#E2E8F0"}
              onValueChange={(val) => toggleSetting('sms', val)}
              value={sendSms}
            />
          </View>

          <Text style={styles.sectionLabel}>BACKGROUND TRIGGER</Text>
          <View style={styles.settingCard}>
            <View style={[styles.iconBox, { backgroundColor: isDarkMode ? "rgba(245,158,11,0.15)" : "#FEF3C7" }]}>
              <MaterialCommunityIcons name="lock" size={20} color="#F59E0B" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.settingTitle}>Trigger Without App Open</Text>
              <Text style={styles.settingSub}>Activate SOS from background</Text>
            </View>
            <Switch 
              trackColor={{ false: isDarkMode ? "#2D3B34" : "#E2E8F0", true: "#F59E0B" }}
              thumbColor={"#FFFFFF"}
              ios_backgroundColor={isDarkMode ? "#2D3B34" : "#E2E8F0"}
              onValueChange={(val) => toggleSetting('background', val)}
              value={backgroundTrigger}
            />
          </View>

          <View style={styles.infoBox}>
            <MaterialCommunityIcons name="information" size={16} color="#2563EB" style={{ marginTop: 2, marginRight: 8 }} />
            <Text style={styles.infoText}>
              Background trigger is Android-first for v2.0. iOS support coming in v2.1.
            </Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const getStyles = (theme: any, isDarkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#F4F6F8" },
  safeArea: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingTop: Platform.OS === 'android' ? 20 : 10, marginBottom: 32 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Chirp-Heavy", color: theme.textPrimary },
  headerSub: { fontSize: 10, fontFamily: "Chirp-Bold", color: theme.textSecondary, letterSpacing: 1.5, marginTop: 2 },
  
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontFamily: "Chirp-Bold", color: theme.textSecondary, letterSpacing: 1.5, marginBottom: 12, marginLeft: 4, marginTop: 8 },
  
  settingCard: { flexDirection: "row", alignItems: "center", backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", padding: 16, borderRadius: 20, borderWidth: 1, borderColor: isDarkMode ? "#1F2E27" : "#E2E8F0", marginBottom: 24 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 },
  textContainer: { flex: 1, paddingRight: 10 },
  settingTitle: { fontSize: 15, fontFamily: "Chirp-Bold", color: theme.textPrimary, marginBottom: 4 },
  settingSub: { fontSize: 11, fontFamily: "Chirp-Medium", color: theme.textSecondary },

  infoBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: isDarkMode ? "rgba(59,130,246,0.1)" : "#EFF6FF", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? "rgba(59,130,246,0.2)" : "#DBEAFE" },
  infoText: { flex: 1, fontSize: 11, fontFamily: "Chirp-Medium", color: isDarkMode ? "#93C5FD" : "#1D4ED8", lineHeight: 18 },
});

export default SafetySettingsScreen;