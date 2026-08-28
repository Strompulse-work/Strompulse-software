import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Platform, 
  StatusBar,
  SafeAreaView,
  Image,
  Dimensions
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";

const { height, width } = Dimensions.get("window");
const HEADER_HEIGHT = height * 0.45; // Sets the background image to cover 45% of the screen

const RequestDeviceScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);

  const myDevices = [
    { id: 1, name: "Home", status: "ON", voltage: "224V", emoji: "🏠", color: "#00C48A" },
    { id: 2, name: "Shop", status: "Power Outage", voltage: null, emoji: "🏪", color: "#EF4444" },
    { id: 3, name: "Parents", status: "ON", voltage: "218V", emoji: "🏡", color: "#00C48A" },
  ];

  const features = [
    { icon: "lightning-bolt", iconColor: "#F59E0B", bg: isDarkMode ? "#451A03" : "#FEF3C7", title: "Instant Outage Alerts", desc: "Know the exact second your power goes off — with notifications wherever you are." },
    { icon: "lightbulb-on", iconColor: "#D97706", bg: isDarkMode ? "#422006" : "#FFEDD5", title: "Power Restored Notification", desc: "Get alerted the moment electricity comes back. No more guessing." },
    { icon: "chart-bar", iconColor: "#3B82F6", bg: isDarkMode ? "#172554" : "#DBEAFE", title: "Daily Usage History", desc: "Track how many hours of power you receive per day, week or month." },
    { icon: "currency-ngn", iconColor: "#10B981", bg: isDarkMode ? "#064E3B" : "#D1FAE5", title: "Cost Estimator", desc: "Estimate monthly spending based on real uptime data and your appliances." },
    { icon: "earth", iconColor: "#6366F1", bg: isDarkMode ? "#312E81" : "#E0E7FF", title: "Monitor From Anywhere", desc: "Check your home, shop or parents' house from anywhere — no phone calls needed." },
    { icon: "power-plug", iconColor: "#475569", bg: isDarkMode ? "#1E293B" : "#F1F5F9", title: "Zero Installation", desc: "Plug into any socket. The device appears in the app within about 60 seconds." },
  ];

  const badges = [
    "🚚 We deliver",
    "🔌 Plug & play",
    "📱 App-connected",
    "🔋 Outage-proof",
    "✅ No monthly fee",
    "🌍 Remote access"
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* 1. Fixed Parallax Background Image */}
      <Image 
        source={require("../../assets/images/gridstrom2.png")} 
        style={styles.bgImage} 
        resizeMode="cover"
      />

      {/* 2. Floating Top Header (Stays in place) */}
      <SafeAreaView style={styles.floatingHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* 3. The Scrollable Bottom Sheet */}
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ flexGrow: 1 }}
        bounces={false}
      >
        {/* Transparent Placeholder to reveal the image underneath */}
        <View style={{ height: HEADER_HEIGHT }} />

        {/* The sliding white/dark card */}
        <View style={styles.sheetContent}>
          
          {/* Premium Pricing & Availability Hero Card (Overlaps the image slightly) */}
          <LinearGradient 
            colors={isDarkMode ? ["#064E3B", "#022C22"] : ["#00C48A", "#047857"]} 
            style={styles.premiumHeroCard}
          >
            <View style={styles.premiumCardContent}>
              <View style={{ flex: 1 }}>
                <View style={styles.flagBadge}>
                  <Text style={styles.flagEmoji}>🇳🇬</Text>
                  <Text style={styles.flagText}>Available Nationwide</Text>
                </View>
                <Text style={styles.pricingAmount}>₦50,000</Text>
                <Text style={styles.pricingDesc}>One-time payment. Free delivery.{"\n"}Zero monthly subscription fees.</Text>
              </View>
              <MaterialCommunityIcons name="lightning-bolt-circle" size={120} color="rgba(255,255,255,0.1)" style={styles.bgHeroIcon} />
            </View>
          </LinearGradient>

          {/* Massive Hero Title */}
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Power your peace of mind.</Text>
          </View>

          {/* Your Devices Section (Modern Horizontal Scroll) */}
          <View style={styles.devicesHeaderRow}>
            <Text style={styles.sectionTravelHeader}>Your Nodes</Text>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlinePillText}>2 online</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deviceScroll} contentContainerStyle={styles.deviceScrollContent}>
            {myDevices.map((device) => (
              <View key={device.id} style={styles.modernDeviceCard}>
                <View style={styles.deviceCardTop}>
                  <View style={styles.deviceIconWrapper}>
                    <Text style={styles.deviceEmoji}>{device.emoji}</Text>
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: device.color }]} />
                </View>
                <View style={styles.deviceCardBottom}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <View style={[styles.deviceStatusPill, { backgroundColor: `${device.color}15` }]}>
                    <Text style={[styles.deviceStatusText, { color: device.color }]}>
                      {device.voltage ? `${device.voltage} • ` : ""}{device.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* What You Get Section */}
          <Text style={styles.sectionTravelHeader}>Why get a node?</Text>
          <View style={styles.featuresContainer}>
            {features.map((item, index) => (
              <View key={index} style={styles.modernFeatureRow}>
                <View style={[styles.featureIconBox, { backgroundColor: item.bg }]}>
                  <MaterialCommunityIcons name={item.icon as any} size={24} color={item.iconColor} />
                </View>
                <View style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                  <Text style={styles.featureDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Summary Badges Grid */}
          <View style={styles.badgesContainer}>
            {badges.map((badgeText, index) => (
              <View key={index} style={styles.badgeChip}>
                <Text style={styles.badgeText}>{badgeText}</Text>
              </View>
            ))}
          </View>

        </View>
      </ScrollView>

      {/* Sticky Bottom CTA (Travel Style) */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerBtn}>
          <Text style={styles.footerBtnText}>Request Node • ₦50,000</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color="#FFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getStyles = (theme: any, isDarkMode: boolean) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: isDarkMode ? "#0B0F0D" : "#1E293B", // Dark backdrop behind image
  },
  
  // Parallax Background Image
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: HEADER_HEIGHT + 60, // Extends below the curved cut
  },
  
  // Floating Header
  floatingHeader: {
    position: "absolute",
    top: Platform.OS === 'android' ? StatusBar.currentHeight : 20,
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  backButton: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: "#FFFFFF", 
    borderWidth: 1, 
    borderColor: "#E2E8F0", 
    justifyContent: "center", 
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  
  // Sliding Bottom Sheet
  sheetContent: {
    backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 0, 
    paddingBottom: 40,
    minHeight: height - HEADER_HEIGHT + 40,
  },

  // Premium Pricing Hero Card (Overlaps top of sheet)
  premiumHeroCard: {
    marginHorizontal: 20,
    borderRadius: 32,
    padding: 24,
    marginBottom: 24,
    marginTop: -50, // Pulls the card up to overlap the background image
    overflow: "hidden",
    shadowColor: "#00C48A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  premiumCardContent: { flexDirection: "row", alignItems: "center", position: "relative" },
  flagBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.2)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: "flex-start", marginBottom: 16 },
  flagEmoji: { fontSize: 12, marginRight: 6 },
  flagText: { color: "#FFF", fontSize: 11, fontFamily: "Sora_700Bold", letterSpacing: 0.5 },
  pricingAmount: { fontSize: 36, fontFamily: "Sora_800ExtraBold", color: "#FFF", marginBottom: 8 },
  pricingDesc: { fontSize: 12, fontFamily: "Sora_500Medium", color: "rgba(255,255,255,0.85)", lineHeight: 18 },
  bgHeroIcon: { position: "absolute", right: -30, bottom: -40, transform: [{ rotate: "-20deg" }] },

  heroSection: { paddingHorizontal: 24, marginBottom: 24 },
  heroTitle: { fontSize: 32, fontFamily: "Sora_800ExtraBold", color: theme.textPrimary, letterSpacing: -1, lineHeight: 40 },

  // Your Devices Section
  devicesHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, marginBottom: 12 },
  sectionTravelHeader: { fontSize: 20, fontFamily: "Sora_800ExtraBold", color: theme.textPrimary, marginLeft: 24, marginBottom: 16 },
  onlinePill: { flexDirection: "row", alignItems: "center", backgroundColor: "#ECFDF5", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: "#A7F3D0" },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#00C48A", marginRight: 4 },
  onlinePillText: { fontSize: 11, fontFamily: "Sora_700Bold", color: "#064E3B" },
  
  deviceScroll: { marginBottom: 32 },
  deviceScrollContent: { paddingLeft: 24, paddingRight: 8 },
  
  // Modern Device Cards (Travel Style)
  modernDeviceCard: { width: 140, backgroundColor: isDarkMode ? "#1A221E" : "#F8FAFC", borderRadius: 24, padding: 16, marginRight: 16, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, elevation: 1, justifyContent: "space-between", minHeight: 150 },
  deviceCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  deviceIconWrapper: { width: 44, height: 44, borderRadius: 16, backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", justifyContent: "center", alignItems: "center" },
  deviceEmoji: { fontSize: 22 },
  statusDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: isDarkMode ? "#1A221E" : "#F8FAFC" },
  deviceCardBottom: { marginTop: 16 },
  deviceName: { fontSize: 16, fontFamily: "Sora_700Bold", color: theme.textPrimary, marginBottom: 8 },
  deviceStatusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, alignSelf: "flex-start" },
  deviceStatusText: { fontSize: 10, fontFamily: "Sora_700Bold" },

  // What You Get (Features)
  featuresContainer: { paddingHorizontal: 24, marginBottom: 16 },
  modernFeatureRow: { flexDirection: "row", backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 24, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  featureIconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: "center", alignItems: "center", marginRight: 16 },
  featureTextContainer: { flex: 1, justifyContent: "center" },
  featureTitle: { fontSize: 14, fontFamily: "Sora_700Bold", color: theme.textPrimary, marginBottom: 4 },
  featureDesc: { fontSize: 11, fontFamily: "Sora_500Medium", color: theme.textSecondary, lineHeight: 18 },

  // Summary Badges
  badgesContainer: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 24, gap: 10, marginTop: 10 },
  badgeChip: { flexDirection: "row", alignItems: "center", backgroundColor: isDarkMode ? "#1A221E" : "#F8FAFC", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" },
  badgeText: { fontSize: 12, fontFamily: "Sora_600SemiBold", color: theme.textPrimary },

  // Sticky Footer CTA
  footer: { paddingHorizontal: 20, paddingVertical: Platform.OS === "ios" ? 24 : 16, backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderTopWidth: 1, borderTopColor: isDarkMode ? "#1F2E27" : "#E2E8F0" },
  footerBtn: { flexDirection: "row", backgroundColor: "#064E3B", borderRadius: 20, paddingVertical: 20, alignItems: "center", justifyContent: "center", shadowColor: "#064E3B", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 6 },
  footerBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Sora_700Bold" },
});

export default RequestDeviceScreen;