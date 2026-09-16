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
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Circle as SvgCircle, Rect } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";
import { useAllGridDevices, computeHistoryAnalytics, formatDurationShort } from "../hooks/useDeviceData";
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

const CHECKING_COLOR = "#F59E0B";

const CommunityZonesScreen = ({ route, navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  
  const [activeTab, setActiveTab] = useState<"overview" | "analytics">("overview");

  // Pull both areaId and the specific areaName (street/search result) from navigation
  const { areaId, areaName } = route.params || {};
  const areaData = DEVICE_LOCATIONS[areaId] || { name: "Unknown Area", type: "area" };
  
  // Use the exact street name if provided, otherwise fallback to the parent area node name
  const displayTitle = areaName || areaData.name;

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

  // FIX: real per-device analytics for THIS area's own graph — same
  // computeHistoryAnalytics used generally, applied to just this device's
  // history. hasAnyData tells us whether to show the real graph or a
  // "no data — device down" placeholder (currently true only for
  // STROM008 / UI Campus, since it's the only device with live power).
  const historyAnalytics = computeHistoryAnalytics(liveDevice?.history, 'Today', isOnline);

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
            <Text style={styles.areaTitle} numberOfLines={1}>{displayTitle}</Text>
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
                {displayTitle} is a key residential node in the Ibadan electricity grid. 
                Currently showing signs of {finalStatusText.toLowerCase()}, this area has logged {hoursOn} hours of power today. Keep notifications enabled to receive real-time alerts on grid shifts.
              </Text>

              {/* FIX: "Today's insights" moved here, under Overview, per
                  explicit instruction — was previously only reachable from
                  the Analytics tab on the general screen. */}
              <Text style={styles.sectionHeaderInline}>Today's insights</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.insightsScroll}>
                {historyAnalytics.currentStreakMs !== null ? (
                  <View style={[styles.insightCard, { backgroundColor: isDarkMode ? "#1A221E" : "#ECFDF5" }]}>
                    <View style={[styles.insightIconBox, { backgroundColor: isDarkMode ? "rgba(0,196,138,0.15)" : "#D1FAE5" }]}><MaterialCommunityIcons name="lightning-bolt" size={18} color="#00C48A" /></View>
                    <Text style={[styles.insightCardTitle, { color: "#00C48A" }]}>Current streak</Text>
                    <Text style={styles.insightCardDesc}>Stable for {formatDurationShort(historyAnalytics.currentStreakMs)} since last restoration.</Text>
                  </View>
                ) : (
                  <View style={[styles.insightCard, { backgroundColor: isDarkMode ? "#1A221E" : "#FEE2E2" }]}>
                    <View style={[styles.insightIconBox, { backgroundColor: isDarkMode ? "rgba(239,68,68,0.15)" : "#FECACA" }]}><MaterialCommunityIcons name="power-plug-off" size={18} color="#EF4444" /></View>
                    <Text style={[styles.insightCardTitle, { color: "#EF4444" }]}>Currently down</Text>
                    <Text style={styles.insightCardDesc}>
                      {historyAnalytics.latestRestorationAt
                        ? `Last restored ${historyAnalytics.latestRestorationAt.toLocaleString()}.`
                        : "No restoration events recorded yet."}
                    </Text>
                  </View>
                )}
                <View style={[styles.insightCard, { backgroundColor: isDarkMode ? "#1A221E" : "#F5F3FF" }]}>
                  <View style={[styles.insightIconBox, { backgroundColor: isDarkMode ? "rgba(139,92,246,0.15)" : "#EDE9FE" }]}><MaterialCommunityIcons name="restart" size={18} color={isDarkMode ? "#A78BFA" : "#8B5CF6"} /></View>
                  <Text style={[styles.insightCardTitle, { color: isDarkMode ? "#A78BFA" : "#8B5CF6" }]}>Restorations today</Text>
                  <Text style={styles.insightCardDesc}>{historyAnalytics.totalRestorationsInRange} power-restoration event{historyAnalytics.totalRestorationsInRange === 1 ? '' : 's'} recorded — each implies a prior outage.</Text>
                </View>
                <View style={[styles.insightCard, { backgroundColor: isDarkMode ? "#1A221E" : "#F0F9FF", marginRight: 20 }]}>
                  <View style={[styles.insightIconBox, { backgroundColor: isDarkMode ? "rgba(2,132,199,0.15)" : "#E0F2FE" }]}><MaterialCommunityIcons name="chart-bar" size={18} color={isDarkMode ? "#38BDF8" : "#0284C7"} /></View>
                  <Text style={[styles.insightCardTitle, { color: isDarkMode ? "#38BDF8" : "#0284C7" }]}>Least stable window</Text>
                  <Text style={styles.insightCardDesc}>
                    {historyAnalytics.buckets.some(b => b.restorationCount > 0)
                      ? `${historyAnalytics.buckets.reduce((worst, b) => b.restorationCount > worst.restorationCount ? b : worst).label} had the most restorations.`
                      : "No instability detected in this period."}
                  </Text>
                </View>
              </ScrollView>
            </View>
          ) : (
            <View>
              {/* FIX: this device's own Power Flow graph, placed ABOVE the
                  Performance card. Now a single unified line-graph path
                  for every device — a device with no history correctly
                  scores 0 in every bucket at the data level, so its line
                  is naturally pinned to the bottom, all red, with no
                  special-casing needed in the UI. */}
              <View style={styles.curvedChartContainer}>
                <View style={styles.chartTopRow}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={styles.chartIconBox}>
                      <MaterialCommunityIcons name="chart-line" size={18} color="#00C48A" />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.chartTitleText}>{displayTitle} Power Flow</Text>
                      <Text style={styles.chartSubtitleText}>Today's on/off pattern</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.svgContainer}>
                  {(() => {
                    // FIX: genuine step function — flat while stable,
                    // instant vertical jump the moment power changes, flat
                    // again at the new level. Uses bucket.isStable
                    // (binary), not an interpolated score. Future buckets
                    // (time slots that haven't happened yet) render as a
                    // neutral dashed line, never colored red or green.
                    const buckets = historyAnalytics.buckets;
                    const chartTop = 30;
                    const chartBottom = 120;
                    const midY = (chartTop + chartBottom) / 2;
                    const slotWidth = 320 / buckets.length;
                    const futureColor = isDarkMode ? "#2D3B34" : "#E2E8F0";
                    const levelFor = (stable: boolean) => (stable ? chartTop : chartBottom);
                    const colorFor = (stable: boolean) => (stable ? "#00C48A" : "#EF4444");

                    type Seg = { x1: number; y1: number; x2: number; y2: number; color: string; dashed?: boolean };
                    const segments: Seg[] = [];
                    buckets.forEach((bucket, i) => {
                      const x1 = slotWidth * i;
                      const x2 = slotWidth * (i + 1);

                      if (bucket.isFuture) {
                        segments.push({ x1, y1: midY, x2, y2: midY, color: futureColor, dashed: true });
                        return;
                      }

                      const y = levelFor(bucket.isStable);
                      segments.push({ x1, y1: y, x2, y2: y, color: colorFor(bucket.isStable) });

                      if (i > 0 && !buckets[i - 1].isFuture) {
                        const prevY = levelFor(buckets[i - 1].isStable);
                        if (prevY !== y) {
                          segments.push({ x1, y1: prevY, x2: x1, y2: y, color: colorFor(bucket.isStable) });
                        }
                      }
                    });

                    return (
                      <Svg width="100%" height="150" viewBox="0 0 320 150">
                        <Rect x={0} y={chartTop} width={320} height={1} fill={isDarkMode ? "#22302A" : "#F1F5F9"} />
                        <Rect x={0} y={chartBottom} width={320} height={1.5} fill={isDarkMode ? "#2D3B34" : "#E2E8F0"} />
                        {segments.map((seg, i) => (
                          <Path
                            key={i}
                            d={`M ${seg.x1} ${seg.y1} L ${seg.x2} ${seg.y2}`}
                            stroke={seg.color}
                            strokeWidth={seg.dashed ? "2" : "4"}
                            strokeLinecap="round"
                            strokeDasharray={seg.dashed ? "4,4" : undefined}
                          />
                        ))}
                      </Svg>
                    );
                  })()}
                  <View style={styles.chartXAxis}>
                    {historyAnalytics.bucketLabels.map((label, index) => <Text key={index} style={styles.chartXText}>{label}</Text>)}
                  </View>
                  {!historyAnalytics.hasAnyData && (
                    <Text style={styles.noDataText}>No restoration data ever recorded — device currently down.</Text>
                  )}
                </View>
              </View>

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
    marginBottom: 24,
  },
  sectionHeaderInline: {
    fontSize: 13,
    fontFamily: "Sora_800ExtraBold",
    marginBottom: 16,
    color: isDarkMode ? "#E2E8F0" : "#475569",
  },
  insightsScroll: { marginBottom: 8, marginHorizontal: -24 },
  insightCard: { width: 160, borderRadius: 20, padding: 16, marginRight: 12, marginLeft: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", backgroundColor: isDarkMode ? "#1A221E" : "#F8FAFC" },
  insightIconBox: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  insightCardTitle: { fontSize: 12, fontFamily: "Sora_700Bold", marginBottom: 6 },
  insightCardDesc: { fontSize: 10, fontFamily: "Sora_500Medium", lineHeight: 15, color: isDarkMode ? "#94A3B8" : "#64748B" },

  curvedChartContainer: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 3,
    borderWidth: 1,
    backgroundColor: isDarkMode ? "#1A221E" : "#F8FAFC",
    borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0",
  },
  chartTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  chartIconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: "center", alignItems: "center", backgroundColor: isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5" },
  chartTitleText: { fontSize: 14, fontFamily: "Sora_700Bold", color: theme.textPrimary },
  chartSubtitleText: { fontSize: 10, fontFamily: "Sora_500Medium", marginTop: 2, color: theme.textSecondary },
  svgContainer: { height: 160, width: "100%" },
  chartXAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingHorizontal: 4 },
  chartXText: { fontSize: 9, fontFamily: "Sora_600SemiBold", color: isDarkMode ? "#64748B" : "#94A3B8" },
  noDataText: { fontSize: 12, fontFamily: "Sora_500Medium", color: isDarkMode ? "#64748B" : "#94A3B8", textAlign: "center", paddingHorizontal: 20, marginTop: 8 },

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