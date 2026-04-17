/**
 * Insights Screen
 * Modern Light Mode Theme: Premium analytics dashboard.
 * Features: Wavy line charts, rich stat widgets with icons, and crisp typography.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
  Platform,
  StatusBar,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import AuthService from "../services/authService";
import { useUserDevices, useInsights } from "../hooks/useDeviceData";
import { Loading, ErrorMessage } from "../components/UIComponents";

const { width: screenWidth } = Dimensions.get("window");

// Premium Light Theme Palette (Slate, Emerald, Rose)
const THEME = {
  background: "#F4F6F8",
  cardBg: "#FFFFFF",
  textPrimary: "#0F172A", // Deep Slate
  textSecondary: "#64748B", // Medium Slate
  textTertiary: "#94A3B8", // Light Slate
  success: "#059669", // Emerald Green
  successBg: "#D1FAE5",
  error: "#E11D48", // Rose Red
  errorBg: "#FFE4E6",
  warning: "#D97706", // Amber
  warningBg: "#FEF3C7",
  border: "#E2E8F0",
};

const InsightsScreen: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Get User
  useEffect(() => {
    const getUser = async () => {
      const session = await AuthService.getCurrentSession();
      if (session) setUserId(session.user.id);
    };
    getUser();
  }, []);

  // 2. Get Devices
  const { devices, loading: devicesLoading } = useUserDevices(userId || "");
  const mainDeviceId = devices.length > 0 ? devices[0].id : "";

  // 3. Get Real-Time Analytics
  const {
    insights,
    loading: insightsLoading,
    error,
  } = useInsights(mainDeviceId);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (devicesLoading || insightsLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Loading />
      </View>
    );
  }

  if (error && !insights) {
    return (
      <View style={[styles.container, styles.center]}>
        <ErrorMessage message="Unable to load analytics at this time." />
      </View>
    );
  }

  // --- Chart Data (Using mock trend data to match UI) ---
  const uptimeChartData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [{ data: [18, 22, 14, 20, 24, 19, 23] }],
  };

  const outageChartData = {
    labels: ["Wk 1", "Wk 2", "Wk 3", "Wk 4"],
    datasets: [{ data: [12, 5, 18, 8] }],
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={THEME.success}
        />
      }
    >
      <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />

      {/* Modern Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Analytics</Text>
        <Text style={styles.headerSubtitle}>Weekly grid performance</Text>
      </View>

      {/* Advanced Stats Grid */}
      <View style={styles.statsGrid}>
        {/* Total Outages Widget */}
        <View style={styles.statCard}>
          <View style={[styles.iconBox, { backgroundColor: THEME.errorBg }]}>
            <MaterialCommunityIcons
              name="power-plug-off"
              size={20}
              color={THEME.error}
            />
          </View>
          <Text style={styles.statLabel}>TOTAL OUTAGES</Text>
          <Text style={styles.statValue}>
            {insights?.week_total_outage_hours || 0}{" "}
            <Text style={styles.statUnit}>hrs</Text>
          </Text>
        </View>

        {/* Longest Outage Widget */}
        <View style={styles.statCard}>
          <View style={[styles.iconBox, { backgroundColor: THEME.warningBg }]}>
            <MaterialCommunityIcons
              name="clock-alert-outline"
              size={20}
              color={THEME.warning}
            />
          </View>
          <Text style={styles.statLabel}>LONGEST DOWNTIME</Text>
          <Text style={styles.statValue}>
            {insights?.longest_outage_minutes || 0}{" "}
            <Text style={styles.statUnit}>mins</Text>
          </Text>
        </View>

        {/* Avg Daily Power Widget */}
        <View style={styles.statCard}>
          <View style={[styles.iconBox, { backgroundColor: THEME.successBg }]}>
            <MaterialCommunityIcons
              name="lightning-bolt"
              size={20}
              color={THEME.success}
            />
          </View>
          <Text style={styles.statLabel}>AVG DAILY POWER</Text>
          <Text style={[styles.statValue, { color: THEME.success }]}>
            {insights?.avg_daily_uptime_percentage || 100}%
          </Text>
        </View>

        {/* Stability Score Widget */}
        <View style={[styles.statCard, { backgroundColor: THEME.textPrimary }]}>
          <View
            style={[
              styles.iconBox,
              { backgroundColor: "rgba(255,255,255,0.15)" },
            ]}
          >
            <MaterialCommunityIcons
              name="shield-check"
              size={20}
              color="#FFFFFF"
            />
          </View>
          <Text style={[styles.statLabel, { color: THEME.textTertiary }]}>
            STABILITY SCORE
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text style={[styles.statValue, { color: "#FFFFFF" }]}>
              {insights?.stability_score || 100}
            </Text>
            <Text
              style={[
                styles.statUnit,
                { color: THEME.textTertiary, marginLeft: 2 },
              ]}
            >
              /100
            </Text>
          </View>
        </View>
      </View>

      {/* Chart 1: Daily Hours of Power */}
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.chartTitle}>Daily Hours of Power</Text>
            <Text style={styles.chartDateRange}>This Week</Text>
          </View>
          <View
            style={[styles.trendBadge, { backgroundColor: THEME.successBg }]}
          >
            <Ionicons name="trending-up" size={14} color={THEME.success} />
            <Text style={[styles.trendText, { color: THEME.success }]}>
              +5%
            </Text>
          </View>
        </View>

        <LineChart
          data={uptimeChartData}
          width={screenWidth - 48} // 24 padding on each side of container
          height={180}
          chartConfig={{
            backgroundColor: THEME.cardBg,
            backgroundGradientFrom: THEME.cardBg,
            backgroundGradientTo: THEME.cardBg,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`, // Emerald
            labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`, // Slate
            style: { borderRadius: 16 },
            propsForDots: { r: "5", strokeWidth: "2", stroke: THEME.cardBg },
            propsForBackgroundLines: {
              stroke: THEME.border,
              strokeDasharray: "4",
            },
          }}
          bezier // Smooth wavy line
          style={styles.chartStyle}
          withVerticalLines={false}
          withHorizontalLines={true}
        />
      </View>

      {/* Chart 2: Outage Events */}
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.chartTitle}>Outage Events</Text>
            <Text style={styles.chartDateRange}>Last 30 Days</Text>
          </View>
          <View style={[styles.trendBadge, { backgroundColor: THEME.errorBg }]}>
            <Ionicons name="trending-up" size={14} color={THEME.error} />
            <Text style={[styles.trendText, { color: THEME.error }]}>+12%</Text>
          </View>
        </View>

        <LineChart
          data={outageChartData}
          width={screenWidth - 48}
          height={180}
          chartConfig={{
            backgroundColor: THEME.cardBg,
            backgroundGradientFrom: THEME.cardBg,
            backgroundGradientTo: THEME.cardBg,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(225, 29, 72, ${opacity})`, // Rose
            labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: { r: "5", strokeWidth: "2", stroke: THEME.cardBg },
            propsForBackgroundLines: {
              stroke: THEME.border,
              strokeDasharray: "4",
            },
          }}
          bezier
          style={styles.chartStyle}
          withVerticalLines={false}
          withHorizontalLines={true}
        />
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  headerContainer: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 50 : 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: THEME.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: THEME.textSecondary,
    fontWeight: "500",
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statCard: {
    width: "48%",
    backgroundColor: THEME.cardBg,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    ...Platform.select({
      ios: {
        shadowColor: "#64748B",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statLabel: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    color: THEME.textPrimary,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statUnit: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME.textSecondary,
  },
  chartContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: THEME.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingVertical: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#64748B",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  chartTitle: {
    color: THEME.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  chartDateRange: {
    color: THEME.textTertiary,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendText: {
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
  },
  chartStyle: {
    borderRadius: 16,
    paddingRight: 20,
  },
});

export default InsightsScreen;
