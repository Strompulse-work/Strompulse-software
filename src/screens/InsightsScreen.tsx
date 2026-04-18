/**
 * Insights Screen
 * Dynamically switches between Light and Dark mode using ThemeContext.
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
import { useTheme } from "../theme/ThemeContext";
import { Loading, ErrorMessage } from "../components/UIComponents";

const { width: screenWidth } = Dimensions.get("window");

const InsightsScreen: React.FC = () => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme);

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
          tintColor={theme.success}
        />
      }
    >
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />

      {/* Modern Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Analytics</Text>
        <Text style={styles.headerSubtitle}>Weekly grid performance</Text>
      </View>

      {/* Advanced Stats Grid */}
      <View style={styles.statsGrid}>
        {/* Total Outages Widget */}
        <View style={styles.statCard}>
          <View style={[styles.iconBox, { backgroundColor: theme.errorBg }]}>
            <MaterialCommunityIcons
              name="power-plug-off"
              size={20}
              color={theme.error}
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
          <View style={[styles.iconBox, { backgroundColor: theme.warningBg }]}>
            <MaterialCommunityIcons
              name="clock-alert-outline"
              size={20}
              color={theme.warning}
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
          <View style={[styles.iconBox, { backgroundColor: theme.successBg }]}>
            <MaterialCommunityIcons
              name="lightning-bolt"
              size={20}
              color={theme.success}
            />
          </View>
          <Text style={styles.statLabel}>AVG DAILY POWER</Text>
          <Text style={[styles.statValue, { color: theme.success }]}>
            {insights?.avg_daily_uptime_percentage || 100}%
          </Text>
        </View>

        {/* Stability Score Widget */}
        <View style={[styles.statCard, { backgroundColor: theme.textPrimary }]}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: isDarkMode
                  ? "rgba(0,0,0,0.2)"
                  : "rgba(255,255,255,0.15)",
              },
            ]}
          >
            <MaterialCommunityIcons
              name="shield-check"
              size={20}
              color={theme.background}
            />
          </View>
          <Text
            style={[
              styles.statLabel,
              { color: theme.background, opacity: 0.8 },
            ]}
          >
            STABILITY SCORE
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text style={[styles.statValue, { color: theme.background }]}>
              {insights?.stability_score || 100}
            </Text>
            <Text
              style={[
                styles.statUnit,
                { color: theme.background, marginLeft: 2, opacity: 0.8 },
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
            style={[styles.trendBadge, { backgroundColor: theme.successBg }]}
          >
            <Ionicons name="trending-up" size={14} color={theme.success} />
            <Text style={[styles.trendText, { color: theme.success }]}>
              +5%
            </Text>
          </View>
        </View>

        <LineChart
          data={uptimeChartData}
          width={screenWidth - 48} // 24 padding on each side of container
          height={180}
          chartConfig={{
            backgroundColor: theme.cardBg,
            backgroundGradientFrom: theme.cardBg,
            backgroundGradientTo: theme.cardBg,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`, // Emerald
            labelColor: () => theme.textSecondary,
            style: { borderRadius: 16 },
            propsForDots: { r: "5", strokeWidth: "2", stroke: theme.cardBg },
            propsForBackgroundLines: {
              stroke: theme.border,
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
          <View style={[styles.trendBadge, { backgroundColor: theme.errorBg }]}>
            <Ionicons name="trending-down" size={14} color={theme.error} />
            <Text style={[styles.trendText, { color: theme.error }]}>-12%</Text>
          </View>
        </View>

        <LineChart
          data={outageChartData}
          width={screenWidth - 48}
          height={180}
          chartConfig={{
            backgroundColor: theme.cardBg,
            backgroundGradientFrom: theme.cardBg,
            backgroundGradientTo: theme.cardBg,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(225, 29, 72, ${opacity})`, // Rose
            labelColor: () => theme.textSecondary,
            style: { borderRadius: 16 },
            propsForDots: { r: "5", strokeWidth: "2", stroke: theme.cardBg },
            propsForBackgroundLines: {
              stroke: theme.border,
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

// Generate styles dynamically based on the injected theme
const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
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
      color: theme.textPrimary,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 15,
      color: theme.textSecondary,
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
      backgroundColor: theme.cardBg,
      borderRadius: 20,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
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
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    statValue: {
      color: theme.textPrimary,
      fontSize: 26,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    statUnit: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    chartContainer: {
      marginHorizontal: 20,
      marginBottom: 20,
      backgroundColor: theme.cardBg,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 20,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
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
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "700",
      letterSpacing: -0.2,
    },
    chartDateRange: {
      color: theme.textTertiary,
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
