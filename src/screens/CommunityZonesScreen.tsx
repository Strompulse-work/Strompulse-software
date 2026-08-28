import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  Platform, 
  StatusBar, 
  ScrollView, 
  Image, 
  Dimensions,
  ActivityIndicator
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { useAllGridDevices } from "../hooks/useDeviceData";
import { Loading } from "../components/UIComponents";

const { height, width } = Dimensions.get("window");
const HEADER_HEIGHT = height * 0.45;

const DEVICE_LOCATIONS: Record<string, { name: string; type: string; lat: number; lng: number; roads: string[] }> = {
  "STROM001": { name: "Jericho Quarters", type: "estate", lat: 7.3970, lng: 3.8650, roads: ["Kudeti", "Onireke", "Jericho GRA"] },
  "STROM002": { name: "Agodi GRA", type: "estate", lat: 7.4080, lng: 3.9050, roads: ["Parliament", "Secretariat", "Ikolaba"] },
  "STROM003": { name: "Bodija Estate", type: "estate", lat: 7.4100, lng: 3.9000, roads: ["Awolowo Road", "Osuntokun", "Housing Corp"] },
  "STROM004": { name: "Challenge", type: "area", lat: 7.3600, lng: 3.8800, roads: ["Ring Rd", "Lagos Ibadan Exp", "Molete"] },
  "STROM005": { name: "Mokola", type: "area", lat: 7.3950, lng: 3.8850, roads: ["Sabo", "Queen Elizabeth Road", "Oremeji"] },
  "STROM006": { name: "Oluyole Estate", type: "estate", lat: 7.3500, lng: 3.8650, roads: ["Mobil", "Adeoyo", "Ring Road"] },
  "STROM007": { name: "Ring Road Area", type: "area", lat: 7.3650, lng: 3.8600, roads: ["State Hospital", "Liberty Stadium", "Oni and Sons"] },
  "STROM008": { name: "UI Campus", type: "school", lat: 7.4420, lng: 3.9000, roads: ["Bello", "Tafawa Balewa Way", "Agbowa"] },
  "STROM009": { name: "Mapo Hall", type: "area", lat: 7.3750, lng: 3.8950, roads: ["Bere", "Oja Oba Market", "Oje"] },
  "STROM010": { name: "Eleyele", type: "area", lat: 7.4050, lng: 3.8550, roads: ["Waterworks", "Jericho Rd", "Polytechnic Rd"] },
  "STROM011": { name: "MONATAN", type: "area", lat: 7.3880, lng: 3.8750, roads: ["New Ife Road", "Old Ife Road"] },
  "STROM012": { name: "OKETEDO", type: "area", lat: 7.3780, lng: 3.9100, roads: ["Oyo Road", "Agbowo Road"] },
};

const MOCK_ZONES = [
  { id: 'A', name: 'Zone A', dir: 'NW', icon: 'arrow-top-left-bold-box', status: 'Live', color: '#00C48A' },
  { id: 'B', name: 'Zone B', dir: 'NE', icon: 'arrow-top-right-bold-box', status: 'Live', color: '#00C48A' },
  { id: 'C', name: 'Zone C', dir: 'SW', icon: 'arrow-bottom-left-bold-box', status: 'Partial', color: '#F59E0B' },
  { id: 'D', name: 'Zone D', dir: 'SE', icon: 'arrow-bottom-right-bold-box', status: 'Offline', color: '#EF4444' },
];

// NOTE: local timestamp parsing / staleness logic has been REMOVED from
// this screen — see ElectricityScreen.tsx for the same note. Online,
// offline, AND checking state all come straight from useAllGridDevices()
// (liveDevice.connectionState), which now uses a tracker SHARED across
// every screen in the app (fixed in hooks/useDeviceData.ts) — so a
// device confirmed online on the Communities list stays confirmed here
// too, instead of re-running its warm-up on every screen it's viewed on.

const CommunityZonesScreen = ({ route, navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  
  const [activeTab, setActiveTab] = useState<"overview" | "analytics">("overview");

  const { areaId } = route.params || {};
  const areaData = DEVICE_LOCATIONS[areaId] || { name: "Unknown Area", type: "area" };

  const { devices, loading } = useAllGridDevices();
  
  const liveDevice = devices.find((d) => 
    d.id === areaId || 
    d.id?.toUpperCase() === areaId?.toUpperCase()
  );

  if (loading && !liveDevice) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Loading />
      </View>
    );
  }

  // FIX: connectionState ('online' | 'offline' | 'checking') comes
  // straight from the hook — one shared source of truth across the app.
  const connectionState: 'online' | 'offline' | 'checking' = liveDevice
    ? (liveDevice.connectionState || (liveDevice.isOnline ? 'online' : 'offline'))
    : 'offline';
  const isOnline = connectionState === 'online';
  const isChecking = connectionState === 'checking';

  const realUptime = liveDevice?.uptime !== undefined ? liveDevice.uptime : (isOnline ? 100 : 0);
  
  const hoursOn = ((realUptime / 100) * 24).toFixed(1);
  const hoursOff = (24 - parseFloat(hoursOn)).toFixed(1);
  const daytimePerf = realUptime === 0 ? 0 : Math.min(100, realUptime + 2);
  const weeklyPerf = realUptime === 0 ? 0 : Math.max(0, realUptime - 1);
  const mainColor = isChecking ? "#F59E0B" : isOnline ? "#00C48A" : "#EF4444";
  
  const outOfCoverage = !liveDevice;
  const isPartial = isOnline && realUptime > 0 && realUptime < 100;
  let finalStatusText = outOfCoverage
    ? "Out of Coverage"
    : isChecking
    ? "Checking Status"
    : isOnline
    ? "Presently Stable"
    : "Power Outage";
  if (isPartial) finalStatusText = "Partial Stability";

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* 1. Fixed Background Image */}
      <Image 
        source={require("../../assets/images/gridstrom.png")} 
        style={styles.bgImage} 
        resizeMode="cover"
      />

      {/* 2. Floating Top Header */}
      <SafeAreaView style={styles.floatingHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
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
          {/* Overlapping Status Badge */}
          <View style={styles.statusBadgeCard}>
            <View style={[styles.statusIconBox, { backgroundColor: isChecking ? "#FEF3C7" : isOnline ? "#D1FAE5" : "#FEE2E2" }]}>
              {isChecking ? (
                <ActivityIndicator size="small" color="#F59E0B" />
              ) : (
                <MaterialCommunityIcons 
                  name={isOnline ? "lightning-bolt" : "power-plug-off"} 
                  size={18} 
                  color={isOnline ? "#00C48A" : "#EF4444"} 
                />
              )}
            </View>
            <Text style={[styles.statusBadgeText, { color: mainColor }]}>
              {isChecking ? "CHECKING STATUS" : isOnline ? "POWER RESTORED" : "POWER OUTAGE"}
            </Text>
          </View>

          {/* Title & Uptime Row */}
          <View style={styles.titleRow}>
            <Text style={styles.areaTitle} numberOfLines={1}>{areaData.name}</Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.uptimeHighlight}>{realUptime}%</Text>
              <Text style={styles.uptimeSub}>uptime</Text>
            </View>
          </View>

          {/* Location Row */}
          <View style={styles.locationRow}>
            <View style={styles.locationLeft}>
              <MaterialCommunityIcons name="map-marker" size={14} color="#064E3B" />
              <Text style={styles.locationText}>Ibadan, Nigeria</Text>
            </View>
          </View>

          {/* Interactive Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab("overview")}>
              <Text style={activeTab === "overview" ? styles.tabActive : styles.tabInactive}>Overview</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab("analytics")}>
              <Text style={activeTab === "analytics" ? styles.tabActive : styles.tabInactive}>Analytics</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === "overview" ? (
            <View>
              <Text style={styles.descriptionText}>
                {areaData.name} is a key residential node in the Ibadan electricity grid. 
                Currently showing signs of {finalStatusText.toLowerCase()}, this area has logged {hoursOn} hours of power today. Keep notifications enabled to receive real-time alerts on grid shifts.
              </Text>

              <View style={styles.zoneMapContainer}>
                <Text style={styles.zoneMapLabel}>ZONE MAP</Text>
                <View style={styles.zoneGrid}>
                  {MOCK_ZONES.map((zone) => {
                    const bgOpacity = isDarkMode ? "0.08" : "0.1";
                    const borderOpacity = isDarkMode ? "0.2" : "0.3";
                    const rgbaBase = zone.color === '#00C48A' ? '0, 196, 138' : zone.color === '#F59E0B' ? '245, 158, 11' : '239, 68, 68';
                    
                    return (
                      <View key={zone.id} style={[styles.zoneCard, { backgroundColor: `rgba(${rgbaBase}, ${bgOpacity})`, borderColor: `rgba(${rgbaBase}, ${borderOpacity})` }]}>
                        <View style={[styles.statusDot, { backgroundColor: zone.color }]} />
                        <View style={styles.zoneCardContent}>
                          <View style={styles.dirRow}>
                            <MaterialCommunityIcons name={zone.icon as any} size={14} color={zone.color} />
                            <Text style={[styles.dirText, { color: zone.color }]}>{zone.dir}</Text>
                          </View>
                          <Text style={styles.zoneName}>{zone.name}</Text>
                          <Text style={styles.zoneStatus}>{zone.status}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.analyticsDetailCard}>
                <View style={styles.analyticsDetailHeader}>
                  <Text style={styles.analyticsDetailTitle}>Performance</Text>
                  <View style={[styles.statusPillSmall, { backgroundColor: isChecking ? "#FEF9C3" : isOnline ? "#ECFDF5" : "#FEF2F2" }]}>
                    <Text style={[styles.statusPillTextSmall, { color: mainColor }]}>{isChecking ? "CHECKING" : isOnline ? "ONLINE" : "OUTAGE"}</Text>
                  </View>
                </View>

                <View style={styles.analyticsMetricsRow}>
                  <View style={styles.metricBlock}>
                    <Text style={styles.metricValue}>{realUptime}{"%"}</Text>
                    <Text style={styles.metricLabel}>{"Avg Uptime"}</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricBlock}>
                    <Text style={[styles.metricValue, { color: realUptime === 0 ? "#EF4444" : "#00C48A" }]}>{hoursOn}{"h"}</Text>
                    <Text style={styles.metricLabel}>{"Hours ON"}</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricBlock}>
                    <Text style={[styles.metricValue, { color: realUptime === 0 ? "#EF4444" : "#F59E0B" }]}>{hoursOff}{"h"}</Text>
                    <Text style={styles.metricLabel}>{"Hours OFF"}</Text>
                  </View>
                </View>

                <View style={styles.performanceBars}>
                  <View style={styles.perfBarRow}>
                    <Text style={styles.perfBarLabel}>{"Daytime (6AM - 6PM)"}</Text>
                    <Text style={styles.perfBarValue}>{daytimePerf}{"%"}</Text>
                  </View>
                  <View style={styles.perfBarTrack}>
                    <View style={[styles.perfBarFill, { width: `${daytimePerf}%`, backgroundColor: daytimePerf > 0 ? "#3B82F6" : "#EF4444" }]} />
                  </View>
                  <View style={styles.perfBarRow}>
                    <Text style={styles.perfBarLabel}>{"Weekly Average"}</Text>
                    <Text style={styles.perfBarValue}>{weeklyPerf}{"%"}</Text>
                  </View>
                  <View style={styles.perfBarTrack}>
                    <View style={[styles.perfBarFill, { width: `${weeklyPerf}%`, backgroundColor: weeklyPerf > 0 ? "#8B5CF6" : "#EF4444" }]} />
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
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
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
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
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 24,
    paddingTop: 40, 
    paddingBottom: 40,
    minHeight: height - HEADER_HEIGHT + 40,
  },
  statusBadgeCard: {
    position: "absolute",
    top: -24, 
    left: 24,
    backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  statusIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  statusBadgeText: {
    fontSize: 13,
    fontFamily: "Sora_700Bold",
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 24,
    marginBottom: 8,
  },
  areaTitle: {
    flex: 1,
    fontSize: 26,
    fontFamily: "Sora_800ExtraBold",
    color: theme.textPrimary,
    marginRight: 16,
  },
  uptimeHighlight: {
    fontSize: 20,
    fontFamily: "Sora_800ExtraBold",
    color: "#00C48A",
  },
  uptimeSub: {
    fontSize: 10,
    fontFamily: "Sora_600SemiBold",
    color: theme.textSecondary,
    marginTop: -2,
  },
  locationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  locationLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    fontSize: 13,
    fontFamily: "Sora_600SemiBold",
    color: theme.textSecondary,
    marginLeft: 4,
  },
  tabsRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  tabButton: {
    marginRight: 24,
  },
  tabActive: {
    fontSize: 14,
    fontFamily: "Sora_700Bold",
    color: theme.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: "#00C48A",
    paddingBottom: 4,
  },
  tabInactive: {
    fontSize: 14,
    fontFamily: "Sora_600SemiBold",
    color: theme.textSecondary,
    paddingBottom: 4,
  },
  descriptionText: {
    fontSize: 13,
    fontFamily: "Sora_400Regular",
    color: theme.textSecondary,
    lineHeight: 22,
    marginBottom: 32,
  },
  zoneMapContainer: {
    marginBottom: 24,
  },
  zoneMapLabel: {
    fontSize: 11,
    fontFamily: "Sora_700Bold",
    color: theme.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  zoneGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  zoneCard: {
    width: "48%",
    aspectRatio: 1.3,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  statusDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  zoneCardContent: {
    alignItems: "center",
  },
  dirRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  dirText: {
    fontSize: 10,
    fontFamily: "Sora_700Bold",
    marginLeft: 4,
  },
  zoneName: {
    fontSize: 14,
    fontFamily: "Sora_700Bold",
    color: theme.textPrimary,
    marginBottom: 4,
  },
  zoneStatus: {
    fontSize: 10,
    fontFamily: "Sora_500Medium",
    color: theme.textSecondary,
  },
  analyticsDetailCard: { 
    backgroundColor: isDarkMode ? "#1A221E" : "#F8FAFC", 
    borderRadius: 20, 
    padding: 20, 
    marginBottom: 32 
  },
  analyticsDetailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  analyticsDetailTitle: { fontSize: 16, fontFamily: "Sora_700Bold", color: theme.textPrimary },
  statusPillSmall: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusPillTextSmall: { fontSize: 9, fontFamily: "Sora_800ExtraBold" },
  analyticsMetricsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  metricBlock: { alignItems: "center", flex: 1 },
  metricValue: { fontSize: 18, fontFamily: "Sora_800ExtraBold", color: theme.textPrimary },
  metricLabel: { fontSize: 10, fontFamily: "Sora_600SemiBold", color: theme.textSecondary, marginTop: 4 },
  metricDivider: { width: 1, height: 24, backgroundColor: theme.border },
  performanceBars: { marginTop: 4 },
  perfBarRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  perfBarLabel: { fontSize: 11, fontFamily: "Sora_600SemiBold", color: theme.textSecondary },
  perfBarValue: { fontSize: 11, fontFamily: "Sora_700Bold", color: theme.textPrimary },
  perfBarTrack: { height: 6, backgroundColor: isDarkMode ? "#2D3B34" : "#E2E8F0", borderRadius: 3, marginBottom: 16 },
  perfBarFill: { height: "100%", borderRadius: 3 },
});

export default CommunityZonesScreen;