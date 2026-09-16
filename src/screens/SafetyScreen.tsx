import React, { useState, useRef, useCallback } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  StatusBar, 
  Animated,
  SafeAreaView,
  Alert
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import * as SMS from "expo-sms";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";
import AuthService from "../services/authService";
import { useFocusEffect } from "@react-navigation/native";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const STORAGE_KEY = "strompulse_emergency_contacts";
const JOURNEY_KEY = "strompulse_journey_active";
const SETTINGS_KEY = "strompulse_security_settings";

const EMERGENCY_TYPES = [
  { id: "general", label: "General", icon: "alert-circle", color: "#64748B", bg: "#F1F5F9" },
  { id: "medical", label: "Medical", icon: "medical-bag", color: "#10B981", bg: "#D1FAE5" },
  { id: "fire", label: "Fire", icon: "fire", color: "#EF4444", bg: "#FEE2E2" },
  { id: "robbery", label: "Robbery", icon: "shield-alert", color: "#8B5CF6", bg: "#EDE9FE" },
  { id: "accident", label: "Accident", icon: "car-brake-alert", color: "#F59E0B", bg: "#FEF3C7" },
];

const SafetyScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);

  const [isJourneyActive, setIsJourneyActive] = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState<string | null>(null);
  
  const [currentLocation, setCurrentLocation] = useState("Locating...");
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [securitySettings, setSecuritySettings] = useState({ locationSharing: true, sendSms: true });
  const [user, setUser] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      const fetchRealtimeData = async () => {
        const session = await AuthService.getCurrentSession();
        if (session) setUser(session.user);

        // Load Privacy Settings
        const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
          setSecuritySettings(JSON.parse(savedSettings));
        }

        const journeyStatus = await AsyncStorage.getItem(JOURNEY_KEY);
        if (journeyStatus === "true" || route.params?.isJourneyActive) {
          setIsJourneyActive(true);
        } else {
          setIsJourneyActive(false);
        }

        const savedContacts = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedContacts) {
          const allContacts = JSON.parse(savedContacts);
          setEmergencyContacts(allContacts.filter((c: any) => c.isEmergency));
        }

        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          let response = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          if (response.length > 0) {
            setCurrentLocation(`${response[0].district || response[0].city}, ${response[0].region}`);
          } else {
            setCurrentLocation(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
          }
        } else {
          setCurrentLocation("Location Permission Denied");
        }
      };
      fetchRealtimeData();
    }, [route.params])
  );

  const handleStopJourney = async () => {
    setIsJourneyActive(false);
    await AsyncStorage.removeItem(JOURNEY_KEY);
    navigation.setParams({ isJourneyActive: false });
  };

  const holdProgress = useRef(new Animated.Value(0)).current;
  const CIRCLE_RADIUS = 75;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

  const strokeDashoffset = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCLE_CIRCUMFERENCE, 0],
  });

  const triggerEmergencyProtocol = async () => {
    if (emergencyContacts.length === 0) {
      Alert.alert("No Contacts", "Please go to My Contacts and add people to your Emergency Network first.");
      holdProgress.setValue(0);
      return;
    }

    setAlertSent(true);

    const typeLabel = selectedEmergency && selectedEmergency !== "general" 
      ? `${selectedEmergency.toUpperCase()} EMERGENCY` 
      : "GENERAL EMERGENCY";
      
    // Apply Location Sharing Privacy Logic
    let message = `SOS ALERT: I am in a ${typeLabel}.`;
    if (securitySettings.locationSharing) {
      message += ` My last known location is ${currentLocation}.`;
    }
    message += ` Please send help or check on me immediately.`;

   // --- SECURE LIVE SOS PUSH ---
    try {
      // Fetch exactly how ProfileScreen fetches it
      const userName = (user as any)?.full_name;
      const recipientPhonesArray = emergencyContacts.map(contact => contact.phone);

      await supabase.from("alerts").insert({
        user_id: user?.id, 
        type: "emergency",
        title: userName ? `SOS from ${userName}` : "SOS ALERT",
        message: message,
        recipient_phones: recipientPhonesArray
      });
    } catch (e) {
      console.warn("Silent in-app alert failed to push", e);
    }

    // Apply SMS Privacy Logic
    if (securitySettings.sendSms) {
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) {
        const phoneNumbers = emergencyContacts.map(c => c.phone);
        await SMS.sendSMSAsync(phoneNumbers, message);
      }
    }

    // WhatsApp DM Logic (Primary Contact)
    const primaryContact = emergencyContacts[0];
    let cleanPhone = primaryContact.phone.replace(/[^0-9]/g, '');
    
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '234' + cleanPhone.slice(1);
    } else if (cleanPhone.length <= 10) {
      cleanPhone = '234' + cleanPhone;
    }

    const waUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    Linking.openURL(waUrl).catch(() => Alert.alert("Error", "WhatsApp is not installed on your device."));
  };

  const handlePressIn = () => {
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: false, 
    }).start(({ finished }) => {
      if (finished) triggerEmergencyProtocol();
    });
  };

  const handlePressOut = () => {
    if (!alertSent) {
      holdProgress.stopAnimation();
      Animated.timing(holdProgress, {
        toValue: 0,
        duration: 200, 
        useNativeDriver: false,
      }).start();
    }
  };

  const resetSafety = () => {
    setAlertSent(false);
    holdProgress.setValue(0);
  };

  if (alertSent) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <LinearGradient colors={isDarkMode ? ["#0B0F0D", "#064E3B"] : ["#F8FAFC", "#D1FAE5"]} style={StyleSheet.absoluteFillObject} />

        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.header, { paddingHorizontal: 24 }]}>
            <TouchableOpacity style={styles.iconBtn} onPress={resetSafety}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.successHero}>
              <View style={styles.successPulseCircle}>
                <View style={styles.successInnerCircle}>
                  <MaterialCommunityIcons name="whatsapp" size={54} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.successTitle}>SOS Sent to Primary Contact</Text>
              <Text style={styles.successSub}>
                Your {securitySettings.locationSharing ? "live location and " : ""}emergency status have been forwarded via WhatsApp DM{securitySettings.sendSms ? " and SMS" : ""}. Other contacts have been notified in-app.
              </Text>
            </View>

            {securitySettings.locationSharing && (
              <View style={styles.currentLocationCard}>
                <Text style={styles.currentLocationLabel}>Broadcasting Location</Text>
                <Text style={styles.currentLocationText}>{currentLocation}</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>NOTIFIED CONTACTS</Text>
            <View style={{ paddingHorizontal: 24 }}>
              {emergencyContacts.map((contact) => (
                <View key={contact.id} style={styles.contactCardList}>
                  <View style={styles.contactLeft}>
                    <View style={[styles.avatar, { borderColor: contact.color, backgroundColor: isDarkMode ? contact.bgDark : contact.bg }]}>
                      <Text style={[styles.avatarText, { color: contact.color }]}>{contact.initial}</Text>
                    </View>
                    <View>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <Text style={styles.contactDetails}>{contact.role || "Emergency"} · {contact.phone}</Text>
                    </View>
                  </View>
                  <View style={styles.sentPill}>
                    <MaterialCommunityIcons name="check-all" size={16} color="#00C48A" />
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.cancelAlertBtn} onPress={resetSafety}>
              <Text style={styles.cancelAlertText}>Close Alert Interface</Text>
            </TouchableOpacity>

          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.shieldIconBox}>
              <MaterialCommunityIcons name="lightning-bolt" size={16} color="#FFF" />
            </View>
            <Text style={styles.headerTitle}>Strompulse Security</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("SafetySettingsScreen")}>
            <MaterialCommunityIcons name="cog-outline" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {isJourneyActive && (
            <View style={styles.activeBanner}>
              <View style={styles.bannerLeft}>
                <View style={styles.greenPulseDot} />
                <View>
                  <Text style={styles.bannerTitle}>Journey Share Active</Text>
                  <Text style={styles.bannerSub}>GPS Tracking via SMS</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.stopBtn} onPress={handleStopJourney}>
                <Text style={styles.stopBtnText}>End</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.sosSection}>
            <View style={[styles.sosConcentric, { width: 280, height: 280, borderColor: isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2" }]} />
            <View style={[styles.sosConcentric, { width: 200, height: 200, borderColor: isDarkMode ? "rgba(239,68,68,0.3)" : "#FECACA", backgroundColor: isDarkMode ? "rgba(239,68,68,0.05)" : "#FEF2F2" }]} />

            <Svg width="160" height="160" style={styles.svgRing}>
              <AnimatedCircle
                cx="80"
                cy="80"
                r={CIRCLE_RADIUS}
                stroke="#EF4444"
                strokeWidth="6"
                fill="none"
                strokeDasharray={CIRCLE_CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 80 80)"
              />
            </Svg>

            <TouchableOpacity 
              style={styles.sosButton}
              activeOpacity={0.9}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <LinearGradient colors={isDarkMode ? ["#7F1D1D", "#450A0A"] : ["#991B1B", "#450A0A"]} style={styles.sosRipple}>
                <Text style={styles.sosText}>SOS</Text>
                <Text style={styles.sosSubText}>HOLD TO SEND</Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.sosHelpText}>
              Hold 1.5s • sends {securitySettings.locationSharing ? "location + alert" : "alert"} to {emergencyContacts.length || "0"} contacts
            </Text>
          </View>

          <View style={styles.bentoGrid}>
            <TouchableOpacity style={[styles.bentoCard, { backgroundColor: isDarkMode ? "rgba(0,196,138,0.05)" : "#F0FDF4", borderColor: isDarkMode ? "rgba(0,196,138,0.2)" : "#D1FAE5" }]} onPress={() => navigation.navigate("JourneyShareScreen", { isJourneyActive })}>
              <View style={[styles.bentoIconBox, { backgroundColor: isDarkMode ? "rgba(0,196,138,0.15)" : "#D1FAE5" }]}>
                <MaterialCommunityIcons name="clock-outline" size={20} color="#059669" />
                <View style={[styles.bentoMiniDot, { backgroundColor: "#00C48A" }]} />
              </View>
              <Text style={[styles.bentoTitle, { color: "#059669" }]}>Journey Share</Text>
              <Text style={[styles.bentoSub, { color: isDarkMode ? "#6EE7B7" : "#047857" }]}>Let contacts follow you</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.bentoCard, { backgroundColor: isDarkMode ? "rgba(59,130,246,0.05)" : "#EFF6FF", borderColor: isDarkMode ? "rgba(59,130,246,0.2)" : "#DBEAFE" }]} onPress={() => navigation.navigate("ContactsScreen")}>
              <View style={[styles.bentoIconBox, { backgroundColor: isDarkMode ? "rgba(59,130,246,0.15)" : "#DBEAFE" }]}>
                <MaterialCommunityIcons name="account-group" size={20} color="#2563EB" />
              </View>
              <Text style={[styles.bentoTitle, { color: "#2563EB" }]}>My Contacts</Text>
              <Text style={[styles.bentoSub, { color: isDarkMode ? "#93C5FD" : "#1D4ED8" }]}>Manage and invite</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.contactSection}>
            <Text style={styles.sectionTitle}>ALERT CONTACTS</Text>
            {emergencyContacts.length > 0 ? (
              emergencyContacts.map((contact) => (
                <View key={contact.id} style={styles.contactCardList}>
                  <View style={styles.contactLeft}>
                    <View style={[styles.avatar, { backgroundColor: isDarkMode ? contact.bgDark : contact.bg, borderColor: isDarkMode ? contact.bgDark : contact.bg }]}>
                      <Text style={[styles.avatarText, { color: contact.color }]}>{contact.initial}</Text>
                    </View>
                    <View>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <Text style={styles.contactDetails}>{contact.role || "Emergency"} · {contact.phone}</Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={[styles.contactCardList, { justifyContent: "center", paddingVertical: 24 }]}>
                <Text style={styles.contactDetails}>No emergency contacts added.</Text>
              </View>
            )}
          </View>
          
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const getStyles = (theme: any, isDarkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#F4F6F8" },
  safeArea: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingTop: Platform.OS === 'android' ? 20 : 10, marginBottom: 10 },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  shieldIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#00C48A", justifyContent: "center", alignItems: "center", marginRight: 12 },
  headerTitle: { fontSize: 20, fontFamily: "Chirp-Heavy", color: theme.textPrimary },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, justifyContent: "center", alignItems: "center" },

  scrollContent: { paddingBottom: 40 },

  activeBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5", borderRadius: 20, padding: 16, marginHorizontal: 24, borderWidth: 1, borderColor: "#00C48A", marginBottom: 24 },
  bannerLeft: { flexDirection: "row", alignItems: "center" },
  greenPulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#00C48A", marginRight: 14, shadowColor: "#00C48A", shadowOpacity: 0.8, shadowRadius: 6, elevation: 4 },
  bannerTitle: { fontSize: 14, fontFamily: "Chirp-Bold", color: "#00C48A", marginBottom: 2 },
  bannerSub: { fontSize: 11, fontFamily: "Chirp-Medium", color: theme.textSecondary },
  stopBtn: { backgroundColor: "#EF4444", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  stopBtnText: { color: "#FFF", fontSize: 12, fontFamily: "Chirp-Bold" },

  sosSection: { alignItems: "center", justifyContent: "center", height: 380, width: "100%", marginBottom: 10 },
  sosConcentric: { position: "absolute", borderRadius: 200, borderWidth: 1 },
  svgRing: { position: "absolute", zIndex: 10 },
  sosButton: { width: 140, height: 140, borderRadius: 70, backgroundColor: isDarkMode ? "#450A0A" : "#991B1B", justifyContent: "center", alignItems: "center", zIndex: 20, shadowColor: "#EF4444", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 15 },
  sosRipple: { width: 140, height: 140, borderRadius: 70, justifyContent: "center", alignItems: "center" },
  sosText: { fontSize: 36, fontFamily: "Chirp-Heavy", color: "#FFFFFF", letterSpacing: 1 },
  sosSubText: { fontSize: 9, fontFamily: "Chirp-Bold", color: "rgba(255,255,255,0.7)", marginTop: 2, letterSpacing: 1 },
  sosHelpText: { position: "absolute", bottom: 20, fontSize: 11, fontFamily: "Chirp-Medium", color: theme.textSecondary },

  bentoGrid: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 24, marginBottom: 32 },
  bentoCard: { flex: 1, padding: 16, borderRadius: 20, marginHorizontal: 6, borderWidth: 1 },
  bentoIconBox: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", marginBottom: 12, position: "relative" },
  bentoMiniDot: { position: "absolute", bottom: -2, right: -2, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: isDarkMode ? "#1A221E" : "#F0FDF4" },
  bentoTitle: { fontSize: 13, fontFamily: "Chirp-Bold", marginBottom: 4 },
  bentoSub: { fontSize: 10, fontFamily: "Chirp-Medium" },

  contactSection: { paddingHorizontal: 24 },
  sectionTitle: { fontSize: 11, fontFamily: "Chirp-Bold", color: theme.textSecondary, letterSpacing: 1.5, marginBottom: 16, marginLeft: 4 },
  contactCardList: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: isDarkMode ? "#1F2E27" : "#E2E8F0" },
  contactLeft: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, justifyContent: "center", alignItems: "center", marginRight: 16 },
  avatarText: { fontSize: 18, fontFamily: "Chirp-Bold" },
  contactName: { fontSize: 15, fontFamily: "Chirp-Bold", color: theme.textPrimary, marginBottom: 4 },
  contactDetails: { fontSize: 11, fontFamily: "Chirp-Medium", color: theme.textSecondary },
  
  successHero: { alignItems: "center", marginTop: 40, marginBottom: 40, paddingHorizontal: 24 },
  successPulseCircle: { width: 140, height: 140, borderRadius: 70, backgroundColor: "#25D366", justifyContent: "center", alignItems: "center", marginBottom: 24, shadowColor: "#25D366", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10 },
  successInnerCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#128C7E", justifyContent: "center", alignItems: "center" },
  successTitle: { fontSize: 24, fontFamily: "Chirp-Heavy", color: theme.textPrimary, marginBottom: 12, textAlign: "center" },
  successSub: { fontSize: 14, fontFamily: "Chirp-Medium", color: theme.textSecondary, textAlign: "center", lineHeight: 22 },
  currentLocationCard: { backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", marginHorizontal: 24, borderRadius: 24, padding: 20, alignItems: "center", marginBottom: 40, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  currentLocationLabel: { fontSize: 11, fontFamily: "Chirp-Bold", color: theme.textSecondary, letterSpacing: 1, marginBottom: 8 },
  currentLocationText: { fontSize: 16, fontFamily: "Chirp-Bold", color: theme.textPrimary },
  sentPill: { width: 32, height: 32, borderRadius: 16, backgroundColor: isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5", justifyContent: "center", alignItems: "center" },
  cancelAlertBtn: { backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", marginHorizontal: 24, borderRadius: 20, paddingVertical: 20, alignItems: "center", marginTop: 32 },
  cancelAlertText: { fontSize: 15, fontFamily: "Chirp-Bold", color: theme.textSecondary },
});

export default SafetyScreen;