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
  Dimensions,
  Linking,
  Alert
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";

const { height, width } = Dimensions.get("window");
const HEADER_HEIGHT = height * 0.45;

const RequestDeviceScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);

  // Solid action color matching your other screens
  const solidActionBg = isDarkMode ? "#FFFFFF" : "#000000";
  const solidActionIcon = isDarkMode ? "#000000" : "#FFFFFF";

  const myNodes = [
    { id: 1, name: "Home Node", status: "Presently Stable", voltage: "224V", isOnline: true },
    { id: 2, name: "Shop Node", status: "Power Outage", voltage: null, isOnline: false },
    { id: 3, name: "Parents Node", status: "Presently Stable", voltage: "218V", isOnline: true },
  ];

  const features = [
    { icon: "zap", title: "Instant Outage Alerts", desc: "Know the exact second your power goes off." },
    { icon: "zap-off", title: "Restoration Notifications", desc: "Get alerted the moment electricity comes back." },
    { icon: "bar-chart-2", title: "Daily Usage History", desc: "Track hours of power received per day or week." },
    { icon: "dollar-sign", title: "Cost Estimator", desc: "Estimate spending based on real uptime data." },
    { icon: "globe", title: "Monitor From Anywhere", desc: "Check all your nodes remotely without phone calls." },
    { icon: "cpu", title: "Zero Installation", desc: "Plug into any socket and connect in 60 seconds." },
  ];

  const badges = [
    "🚚 Free Nationwide Delivery",
    "🔌 Plug & Play Setup",
    "📱 Live App-Connected",
    "🔋 Outage-Proof Tracking",
    "✅ Zero Monthly Fees",
    "🌍 Remote Access Anywhere"
  ];

  const handleRequestNode = () => {
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent("Hello Strompulse, I want to request a personal hardware node (₦50,000). Please guide me through delivery.")}`).catch(() => Alert.alert("WhatsApp not found", "Please install WhatsApp to complete your node request."));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* 1. Fixed Parallax Background Image */}
      <Image 
        source={require("../../assets/images/gridstrom2.png")} 
        style={styles.bgImage} 
        resizeMode="cover"
      />

      {/* 2. Floating Top Header */}
      <SafeAreaView style={styles.floatingHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* 3. The Scrollable Bottom Sheet */}
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ flexGrow: 1 }}
        bounces={false}
      >
        <View style={{ height: HEADER_HEIGHT }} />

        <View style={styles.sheetContent}>
          
          {/* Premium Pricing & Availability Hero Card */}
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

          {/* Your Nodes Section (Grouped List Style) */}
          <View style={styles.devicesHeaderRow}>
            <Text style={styles.sectionTravelHeader}>Your Installed Nodes</Text>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlinePillText}>2 online</Text>
            </View>
          </View>

          <View style={styles.listContainer}>
            {myNodes.map((node, index) => (
              <View 
                key={node.id} 
                style={[
                  styles.listRow, 
                  index === myNodes.length - 1 && { borderBottomWidth: 0 }
                ]}
              >
                <View style={[styles.listIconBox, { backgroundColor: node.isOnline ? (isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5") : (isDarkMode ? "rgba(239,68,68,0.1)" : "#FEE2E2") }]}>
                  <MaterialCommunityIcons name={node.isOnline ? "lightning-bolt" : "power-plug-off"} size={18} color={node.isOnline ? "#00C48A" : "#EF4444"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listRowTitle}>{node.name}</Text>
                  <Text style={styles.listRowSubtitle}>
                    {node.voltage ? `${node.voltage} • ` : ""}{node.status}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color={theme.textSecondary} />
              </View>
            ))}
          </View>

          {/* Why Get a Node (Grouped Features List Style) */}
          <Text style={styles.sectionTravelHeader}>Hardware Capabilities</Text>
          <View style={styles.listContainer}>
            {features.map((item, index) => (
              <View 
                key={index} 
                style={[
                  styles.listRow, 
                  index === features.length - 1 && { borderBottomWidth: 0 }
                ]}
              >
                <View style={[styles.listIconBox, { backgroundColor: isDarkMode ? "#1A221E" : "#F8FAFC" }]}>
                  <MaterialCommunityIcons name={item.icon as any} size={18} color="#00C48A" />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.listRowTitle}>{item.title}</Text>
                  <Text style={styles.listRowSubtitle}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Summary Badges Chips */}
          <Text style={styles.sectionTravelHeader}>Package Highlights</Text>
          <View style={styles.badgesContainer}>
            {badges.map((badgeText, index) => (
              <View key={index} style={styles.badgeChip}>
                <Text style={styles.badgeText}>{badgeText}</Text>
              </View>
            ))}
          </View>

        </View>
      </ScrollView>

      {/* Sticky Bottom CTA */}
      <View style={styles.footer}>
        <TouchableOpacity activeOpacity={0.8} onPress={handleRequestNode} style={[styles.footerBtn, { backgroundColor: solidActionBg }]}>
          <Text style={[styles.footerBtnText, { color: solidActionIcon }]}>Request Node • ₦50,000</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color={solidActionIcon} style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getStyles = (theme: any, isDarkMode: boolean) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: isDarkMode ? "#0B0F0D" : "#1E293B",
  },
  
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: HEADER_HEIGHT + 60,
  },
  
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
    width: 42, 
    height: 42, 
    borderRadius: 21, 
    backgroundColor: isDarkMode ? "rgba(18,26,22,0.85)" : "#FFFFFF", 
    borderWidth: 1, 
    borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", 
    justifyContent: "center", 
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  
  sheetContent: {
    backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingTop: 0, 
    paddingBottom: 40,
    minHeight: height - HEADER_HEIGHT + 40,
  },

  premiumHeroCard: {
    marginHorizontal: 20,
    borderRadius: 28,
    padding: 24,
    marginBottom: 24,
    marginTop: -50,
    overflow: "hidden",
    shadowColor: "#00C48A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  premiumCardContent: { flexDirection: "row", alignItems: "center", position: "relative" },
  flagBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.2)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: "flex-start", marginBottom: 16 },
  flagEmoji: { fontSize: 12, marginRight: 6 },
  flagText: { color: "#FFF", fontSize: 11, fontFamily: "Sora_700Bold", letterSpacing: 0.5 },
  pricingAmount: { fontSize: 34, fontFamily: "Sora_800ExtraBold", color: "#FFF", marginBottom: 8 },
  pricingDesc: { fontSize: 12, fontFamily: "Sora_500Medium", color: "rgba(255,255,255,0.85)", lineHeight: 18 },
  bgHeroIcon: { position: "absolute", right: -30, bottom: -40, transform: [{ rotate: "-20deg" }] },

  heroSection: { paddingHorizontal: 24, marginBottom: 20 },
  heroTitle: { fontSize: 26, fontFamily: "Sora_800ExtraBold", color: theme.textPrimary, letterSpacing: -0.5, lineHeight: 34 },

  devicesHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, marginBottom: 12 },
  sectionTravelHeader: { fontSize: 12, fontFamily: "Sora_700Bold", color: theme.textSecondary, marginLeft: 24, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1.5 },
  onlinePill: { flexDirection: "row", alignItems: "center", backgroundColor: isDarkMode ? "#064E3B" : "#ECFDF5", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#047857" : "#A7F3D0" },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#00C48A", marginRight: 6 },
  onlinePillText: { fontSize: 11, fontFamily: "Sora_700Bold", color: isDarkMode ? "#A7F3D0" : "#064E3B" },
  
  // Profile List Group Containers
  listContainer: {
    marginHorizontal: 24,
    backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: isDarkMode ? "#2D3B34" : "#F1F5F9",
    overflow: "hidden",
    marginBottom: 24,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? "#2D3B34" : "#F1F5F9",
  },
  listIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  listRowTitle: {
    fontSize: 14,
    fontFamily: "Sora_700Bold",
    color: theme.textPrimary,
    marginBottom: 2,
  },
  listRowSubtitle: {
    fontSize: 11,
    fontFamily: "Sora_500Medium",
    color: theme.textSecondary,
    lineHeight: 16,
  },

  badgesContainer: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 24, gap: 8, marginBottom: 30 },
  badgeChip: { flexDirection: "row", alignItems: "center", backgroundColor: isDarkMode ? "#1A221E" : "#F8FAFC", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#F1F5F9" },
  badgeText: { fontSize: 11, fontFamily: "Sora_600SemiBold", color: theme.textPrimary },

  footer: { paddingHorizontal: 20, paddingVertical: Platform.OS === "ios" ? 24 : 16, backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderTopWidth: 1, borderTopColor: isDarkMode ? "#1F2E27" : "#E2E8F0" },
  footerBtn: { flexDirection: "row", borderRadius: 20, paddingVertical: 18, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5 },
  footerBtnText: { fontSize: 15, fontFamily: "Sora_700Bold" },
});

export default RequestDeviceScreen;