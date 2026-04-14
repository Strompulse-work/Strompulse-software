/**
 * Insights Screen
 * Matches SRD Dark Theme: Analytics dashboard with wavy line charts and stability scores
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import AuthService from "../services/authService";
import { useUserDevices, useInsights } from "../hooks/useDeviceData";
import { Loading, ErrorMessage } from "../components/UIComponents";

const { width: screenWidth } = Dimensions.get("window");

// Exact SRD Dark Theme Colors
const THEME = {
  background: "#12141D",
  cardBg: "#1E202B",
  textPrimary: "#FFFFFF",
  textSecondary: "#8E92A4",
  success: "#00E676",
  error: "#FF3B30",
  border: "#2C2F3F",
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

  // 2. Get Devices (We will use the first device for the global insights view)
  const { devices, loading: devicesLoading } = useUserDevices(userId || "");
  const mainDeviceId = devices.length > 0 ? devices[0].id : "";

  // 3. Get Real-Time Analytics from our Supabase Function
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

  // --- Chart Data (Using mock trend data to match the UI since 7-day history doesn't exist yet!) ---
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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={THEME.success}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Insights</Text>
      </View>

      {/* Top Stats Grid */}
      <View style={styles.statsGrid}>
        {/* Total Outages */}
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TOTAL OUTAGES</Text>
          <Text style={styles.statValue}>
            {insights?.week_total_outage_hours || 0}{" "}
            <Text style={styles.statUnit}>hrs</Text>
          </Text>
        </View>

        {/* Longest Outage */}
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>LONGEST OUTAGE</Text>
          <Text style={styles.statValue}>
            {insights?.longest_outage_minutes || 0}{" "}
            <Text style={styles.statUnit}>mins</Text>
          </Text>
        </View>

        {/* Avg Daily Power */}
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>AVG DAILY POWER</Text>
          <Text style={[styles.statValue, { color: THEME.success }]}>
            {insights?.avg_daily_uptime_percentage || 100}%
          </Text>
        </View>

        {/* Stability Score */}
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>STABILITY</Text>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>
              {insights?.stability_score || 100}
            </Text>
          </View>
        </View>
      </View>

      {/* Chart 1: Daily Hours of Power */}
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Daily Hours of Power</Text>
          <Text style={styles.chartSubtitle}>This Week</Text>
        </View>
        <LineChart
          data={uptimeChartData}
          width={screenWidth - 32} // padding
          height={180}
          chartConfig={{
            backgroundColor: THEME.cardBg,
            backgroundGradientFrom: THEME.cardBg,
            backgroundGradientTo: THEME.cardBg,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 230, 118, ${opacity})`, // THEME.success
            labelColor: (opacity = 1) => `rgba(142, 146, 164, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: { r: "4", strokeWidth: "2", stroke: THEME.cardBg },
          }}
          bezier // Makes the line wavy!
          style={styles.chartStyle}
          withVerticalLines={false}
          withHorizontalLines={false}
        />
      </View>

      {/* Chart 2: Outage Events */}
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Outage Events - 30 Days</Text>
          <Text style={[styles.chartSubtitle, { color: THEME.error }]}>
            ↑ 12%
          </Text>
        </View>
        <LineChart
          data={outageChartData}
          width={screenWidth - 32}
          height={180}
          chartConfig={{
            backgroundColor: THEME.cardBg,
            backgroundGradientFrom: THEME.cardBg,
            backgroundGradientTo: THEME.cardBg,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(255, 59, 48, ${opacity})`, // THEME.error
            labelColor: (opacity = 1) => `rgba(142, 146, 164, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: { r: "4", strokeWidth: "2", stroke: THEME.cardBg },
          }}
          bezier // Wavy line
          style={styles.chartStyle}
          withVerticalLines={false}
          withHorizontalLines={false}
        />
      </View>

      <View style={{ height: 40 }} />
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
  header: {
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  headerTitle: {
    color: THEME.textPrimary,
    fontSize: 18,
    fontWeight: "bold",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    justifyContent: "space-between",
  },
  statCard: {
    width: "48%",
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  statLabel: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 8,
  },
  statValue: {
    color: THEME.textPrimary,
    fontSize: 24,
    fontWeight: "bold",
  },
  statUnit: {
    fontSize: 14,
    fontWeight: "normal",
    color: THEME.textSecondary,
  },
  scoreBadge: {
    backgroundColor: THEME.success,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  scoreText: {
    color: THEME.cardBg,
    fontSize: 20,
    fontWeight: "bold",
  },
  chartContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingTop: 16,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  chartTitle: {
    color: THEME.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  chartSubtitle: {
    color: THEME.success,
    fontSize: 13,
    fontWeight: "500",
  },
  chartStyle: {
    borderRadius: 16,
    paddingRight: 16,
  },
});

export default InsightsScreen;
