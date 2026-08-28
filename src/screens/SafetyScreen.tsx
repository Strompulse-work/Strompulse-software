import React, { useState, useRef, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  StatusBar, 
  Animated,
  SafeAreaView
} from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const MOCK_CONTACTS = [
  { id: "1", name: "Mum", relation: "Family", phone: "+234 803 111 2233", initial: "M", color: "#F59E0B", bgLight: "#FEF3C7", bgDark: "rgba(245, 158, 11, 0.15)" },
  { id: "2", name: "Tunde", relation: "Friend", phone: "+234 812 445 6677", initial: "T", color: "#3B82F6", bgLight: "#DBEAFE", bgDark: "rgba(59, 130, 246, 0.15)" },
  { id: "3", name: "Sola", relation: "Neighbour", phone: "+234 705 889 0011", initial: "S", color: "#8B5CF6", bgLight: "#F3E8FF", bgDark: "rgba(139, 92, 246, 0.15)" },
];

const EMERGENCY_TYPES = [
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

  useEffect(() => {
    if (route.params?.isJourneyActive !== undefined) {
      setIsJourneyActive(route.params.isJourneyActive);
    }
  }, [route.params?.isJourneyActive, route.params?.timestamp]);

  const handleStopJourney = () => {
    setIsJourneyActive(false);
    navigation.setParams({ isJourneyActive: false });
  };

  const holdProgress = useRef(new Animated.Value(0)).current;
  const CIRCLE_RADIUS = 85;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

  const strokeDashoffset = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCLE_CIRCUMFERENCE, 0],
  });

  const handlePressIn = () => {
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: false, 
    }).start(({ finished }) => {
      if (finished) setAlertSent(true);
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
    setSelectedEmergency(null);
    holdProgress.setValue(0);
  };

  // --- SUCCESS STATE (ALERT SENT) ---
  if (alertSent) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <LinearGradient colors={isDarkMode ? ["#0B0F0D", "#064E3B"] : ["#F8FAFC", "#D1FAE5"]} style={StyleSheet.absoluteFillObject} />

        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.iconBtn} onPress={resetSafety}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            <View style={styles.successHero}>
              <View style={styles.successPulseCircle}>
                <View style={styles.successInnerCircle}>
                  <MaterialCommunityIcons name="shield-check" size={54} color="#00C48A" />
                </View>
              </View>
              <Text style={styles.successTitle}>Help is on the way!</Text>
              <Text style={styles.successSub}>
                Your live location and emergency status have been broadcasted to your emergency network. Hang on and stay safe.
              </Text>
            </View>

            <View style={styles.currentLocationCard}>
              <Text style={styles.currentLocationLabel}>Broadcasting Location</Text>
              <Text style={styles.currentLocationText}>Carlton Gate Estate, Ibadan</Text>
            </View>

            <Text style={styles.sectionTitle}>NOTIFIED CONTACTS</Text>
            {MOCK_CONTACTS.map((contact) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactLeft}>
                  <View style={[styles.avatar, { borderColor: contact.color, backgroundColor: isDarkMode ? contact.bgDark : contact.bgLight }]}>
                    <Text style={[styles.avatarText, { color: contact.color }]}>{contact.initial}</Text>
                  </View>
                  <View>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactDetails}>{contact.relation}</Text>
                  </View>
                </View>
                <View style={styles.sentPill}>
                  <MaterialCommunityIcons name="check-all" size={16} color="#00C48A" />
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.cancelAlertBtn} onPress={resetSafety}>
              <Text style={styles.cancelAlertText}>Cancel Alert (I am safe)</Text>
            </TouchableOpacity>

          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // --- DEFAULT SOS STATE ---
  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={styles.locationHeaderPill}>
            <MaterialCommunityIcons name="crosshairs-gps" size={14} color="#EF4444" />
            <Text style={styles.locationHeaderText}>Ibadan, Oyo</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("SafetySettingsScreen")}>
            <MaterialCommunityIcons name="cog" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* Active Journey Banner */}
          {isJourneyActive && (
            <View style={styles.activeBanner}>
              <View style={styles.bannerLeft}>
                <View style={styles.greenPulseDot} />
                <View>
                  <Text style={styles.bannerTitle}>Journey Share Active</Text>
                  <Text style={styles.bannerSub}>3 contacts tracking you</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.stopBtn} onPress={handleStopJourney}>
                <Text style={styles.stopBtnText}>End</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Are you in an emergency?</Text>
            <Text style={styles.heroDesc}>
              Press and hold the SOS button. Your live location will be shared with the nearest help center and your emergency contacts.
            </Text>
          </View>

          {/* Emergency Type Selector (Like Figma Ref) */}
          <Text style={styles.subTitleCenter}>What's your emergency?</Text>
          <View style={styles.emergencyTypeGrid}>
            {EMERGENCY_TYPES.map((type) => (
              <TouchableOpacity 
                key={type.id}
                style={[
                  styles.emergencyTypePill, 
                  selectedEmergency === type.id && { borderColor: type.color, backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : type.bg }
                ]}
                onPress={() => setSelectedEmergency(type.id === selectedEmergency ? null : type.id)}
              >
                <MaterialCommunityIcons name={type.icon as any} size={16} color={type.color} style={{ marginRight: 6 }} />
                <Text style={[styles.emergencyTypeText, selectedEmergency === type.id && { color: type.color }]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Massive SOS Button Area */}
          <View style={styles.sosContainer}>
            <View style={[styles.concentricCircle, { width: 320, height: 320, backgroundColor: isDarkMode ? "rgba(239,68,68,0.05)" : "#FEF2F2" }]} />
            <View style={[styles.concentricCircle, { width: 240, height: 240, backgroundColor: isDarkMode ? "rgba(239,68,68,0.1)" : "#FEE2E2" }]} />

            <Svg width="180" height="180" style={styles.svgRing}>
              <AnimatedCircle
                cx="90"
                cy="90"
                r={CIRCLE_RADIUS}
                stroke="#DC2626"
                strokeWidth="8"
                fill="none"
                strokeDasharray={CIRCLE_CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 90 90)"
              />
            </Svg>

            <TouchableOpacity 
              style={styles.sosButton}
              activeOpacity={0.9}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <LinearGradient colors={["#EF4444", "#991B1B"]} style={styles.sosRipple}>
                <Text style={styles.sosText}>SOS</Text>
                <Text style={styles.sosSubText}>HOLD 1.5S</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Quick Actions Grid */}
          <View style={styles.bentoGrid}>
            <TouchableOpacity 
              style={styles.bentoCard} 
              onPress={() => navigation.navigate("JourneyShareScreen", { isJourneyActive })}
            >
              <View style={[styles.bentoIconBox, { backgroundColor: isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5" }]}>
                <MaterialCommunityIcons name="map-marker-path" size={24} color="#00C48A" />
              </View>
              <Text style={styles.bentoTitle}>Journey Share</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.bentoCard} 
              onPress={() => navigation.navigate("ContactsScreen")}
            >
              <View style={[styles.bentoIconBox, { backgroundColor: isDarkMode ? "rgba(59,130,246,0.15)" : "#EFF6FF" }]}>
                <MaterialCommunityIcons name="shield-account" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.bentoTitle}>My Contacts</Text>
            </TouchableOpacity>
          </View>
          
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const getStyles = (theme: any, isDarkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#F4F6F8" },
  safeArea: { flex: 1 },
  
  header: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    marginBottom: 20 
  },
  iconBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", 
    borderWidth: 1, 
    borderColor: isDarkMode ? "#1F2E27" : "#E2E8F0", 
    justifyContent: "center", 
    alignItems: "center" 
  },
  locationHeaderPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDarkMode ? "#1F2E27" : "#E2E8F0",
  },
  locationHeaderText: { fontSize: 13, fontFamily: "Sora_600SemiBold", color: theme.textPrimary, marginLeft: 6 },

  scrollContent: { paddingBottom: 40 },

  activeBanner: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    backgroundColor: isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5", 
    borderRadius: 20, 
    padding: 16, 
    marginHorizontal: 20,
    borderWidth: 1, 
    borderColor: "#00C48A", 
    marginBottom: 24 
  },
  bannerLeft: { flexDirection: "row", alignItems: "center" },
  greenPulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#00C48A", marginRight: 14, shadowColor: "#00C48A", shadowOpacity: 0.8, shadowRadius: 6, elevation: 4 },
  bannerTitle: { fontSize: 14, fontFamily: "Sora_700Bold", color: "#00C48A", marginBottom: 2 },
  bannerSub: { fontSize: 11, fontFamily: "Sora_500Medium", color: theme.textSecondary },
  stopBtn: { backgroundColor: "#EF4444", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  stopBtnText: { color: "#FFF", fontSize: 12, fontFamily: "Sora_700Bold" },

  heroSection: { paddingHorizontal: 24, marginBottom: 24, alignItems: "center" },
  heroTitle: { fontSize: 28, fontFamily: "Sora_800ExtraBold", color: theme.textPrimary, textAlign: "center", marginBottom: 12 },
  heroDesc: { fontSize: 13, fontFamily: "Sora_400Regular", color: theme.textSecondary, textAlign: "center", lineHeight: 22 },

  subTitleCenter: { fontSize: 13, fontFamily: "Sora_700Bold", color: theme.textPrimary, textAlign: "center", marginBottom: 16 },
  
  emergencyTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginBottom: 40,
    gap: 10,
  },
  emergencyTypePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDarkMode ? "#1F2E27" : "#E2E8F0",
  },
  emergencyTypeText: {
    fontSize: 12,
    fontFamily: "Sora_600SemiBold",
    color: theme.textSecondary,
  },

  // Epic SOS Card
  sosContainer: { alignItems: "center", justifyContent: "center", height: 340, width: "100%", marginBottom: 20 },
  concentricCircle: { position: "absolute", borderRadius: 200 },
  svgRing: { position: "absolute", zIndex: 10 },
  sosButton: { width: 160, height: 160, borderRadius: 80, backgroundColor: isDarkMode ? "#1A221E" : "#FFF", justifyContent: "center", alignItems: "center", zIndex: 20, shadowColor: "#EF4444", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 15 },
  sosRipple: { width: 140, height: 140, borderRadius: 70, justifyContent: "center", alignItems: "center" },
  sosText: { fontSize: 42, fontFamily: "Sora_800ExtraBold", color: "#FFFFFF", letterSpacing: 2 },
  sosSubText: { fontSize: 10, fontFamily: "Sora_700Bold", color: "rgba(255,255,255,0.8)", marginTop: 2, letterSpacing: 1 },

  // Bento Grid
  bentoGrid: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, marginTop: 10 },
  bentoCard: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", padding: 16, borderRadius: 24, marginHorizontal: 6, borderWidth: 1, borderColor: isDarkMode ? "#1F2E27" : "#E2E8F0", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, elevation: 1 },
  bentoIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 12 },
  bentoTitle: { flex: 1, fontSize: 13, fontFamily: "Sora_700Bold", color: theme.textPrimary },

  // Success State
  successHero: { alignItems: "center", marginTop: 40, marginBottom: 40, paddingHorizontal: 24 },
  successPulseCircle: { width: 140, height: 140, borderRadius: 70, backgroundColor: isDarkMode ? "rgba(0,196,138,0.1)" : "#D1FAE5", justifyContent: "center", alignItems: "center", marginBottom: 24 },
  successInnerCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: isDarkMode ? "rgba(0,196,138,0.2)" : "#A7F3D0", justifyContent: "center", alignItems: "center", shadowColor: "#00C48A", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10 },
  successTitle: { fontSize: 28, fontFamily: "Sora_800ExtraBold", color: theme.textPrimary, marginBottom: 12, textAlign: "center" },
  successSub: { fontSize: 14, fontFamily: "Sora_500Medium", color: theme.textSecondary, textAlign: "center", lineHeight: 22 },
  
  currentLocationCard: { backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", marginHorizontal: 20, borderRadius: 24, padding: 20, alignItems: "center", marginBottom: 40, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  currentLocationLabel: { fontSize: 11, fontFamily: "Sora_600SemiBold", color: theme.textSecondary, letterSpacing: 1, marginBottom: 8 },
  currentLocationText: { fontSize: 16, fontFamily: "Sora_700Bold", color: theme.textPrimary },

  sectionTitle: { fontSize: 12, fontFamily: "Sora_800ExtraBold", color: theme.textSecondary, letterSpacing: 1.5, marginBottom: 16, marginLeft: 24 },
  contactCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", padding: 16, marginHorizontal: 20, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: isDarkMode ? "#1F2E27" : "#E2E8F0" },
  contactLeft: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, justifyContent: "center", alignItems: "center", marginRight: 16 },
  avatarText: { fontSize: 18, fontFamily: "Sora_700Bold" },
  contactName: { fontSize: 15, fontFamily: "Sora_700Bold", color: theme.textPrimary, marginBottom: 4 },
  contactDetails: { fontSize: 12, fontFamily: "Sora_500Medium", color: theme.textSecondary },
  sentPill: { width: 32, height: 32, borderRadius: 16, backgroundColor: isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5", justifyContent: "center", alignItems: "center" },

  cancelAlertBtn: { backgroundColor: "#EF4444", marginHorizontal: 20, borderRadius: 20, paddingVertical: 20, alignItems: "center", marginTop: 32, shadowColor: "#EF4444", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  cancelAlertText: { fontSize: 15, fontFamily: "Sora_700Bold", color: "#FFFFFF" },
});
export default SafetyScreen;