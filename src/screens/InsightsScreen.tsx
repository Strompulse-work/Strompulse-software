/**
 * Insights Screen - Analytics and Visualizations
 * Shows charts with outage statistics and uptime data
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  RefreshControl,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  VictoryLine,
  VictoryChart,
  VictoryAxis,
  VictoryBar,
} from "victory-native";
import AuthService from "../services/authService";
import { useUserDevices, useInsights } from "../hooks/useDeviceData";
import {
  StatCard,
  Loading,
  ErrorMessage,
  SectionHeader,
} from "../components/UIComponents";
import { Colors, GlobalStyles, Spacing } from "../styles/theme";
import { generateMockOutages } from "../utils/helpers";

const { width: screenWidth } = Dimensions.get("screen");
const chartWidth = screenWidth - Spacing.lg * 2;

const InsightsScreen: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch user
  useEffect(() => {
    const getUser = async () => {
      const session = await AuthService.getCurrentSession();
      if (session) {
        setUserId(session.user.id);
      }
    };
    getUser();
  }, []);

  // Fetch devices
  const {
    devices,
    loading: devicesLoading,
    error: devicesError,
  } = useUserDevices(userId || "");

  // Set first device as selected
  useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  // Fetch insights for selected device
  const { insights, loading: insightsLoading } = useInsights(
    selectedDeviceId || "",
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (!userId) {
    return (
      <View style={[GlobalStyles.container, GlobalStyles.center]}>
        <Loading />
      </View>
    );
  }

  if (devicesLoading) {
    return (
      <View style={[GlobalStyles.container, GlobalStyles.center]}>
        <Loading />
      </View>
    );
  }

  if (devicesError) {
    return (
      <View style={GlobalStyles.container}>
        <ErrorMessage message={devicesError} />
      </View>
    );
  }

  if (devices.length === 0) {
    return (
      <View style={[GlobalStyles.container, GlobalStyles.center]}>
        <MaterialIcons
          name="analytics"
          size={64}
          color={Colors.text.tertiary}
        />
        <Text
          style={[
            GlobalStyles.h3,
            { marginTop: Spacing.lg, color: Colors.text.secondary },
          ]}
        >
          No Data Available
        </Text>
      </View>
    );
  }

  // Generate mock chart data for visualization (in production, fetch from Supabase)
  const sevenDayUptimeData = Array.from({ length: 7 }).map((_, i) => ({
    x: i + 1,
    y: 85 + Math.random() * 15,
  }));

  const thirtyDayOutageData = Array.from({ length: 30 }).map((_, i) => ({
    x: i + 1,
    y: Math.floor(Math.random() * 4),
  }));

  const lastSevenDaysOutages = generateMockOutages(7);

  return (
    <ScrollView
      style={GlobalStyles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Device Selection */}
      {devices.length > 1 && (
        <View style={styles.deviceSelectionSection}>
          <SectionHeader title="Select Device" />
          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            horizontal
            scrollEnabled={false}
            contentContainerStyle={{ paddingHorizontal: Spacing.lg }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.deviceButton,
                  selectedDeviceId === item.id && styles.deviceButtonActive,
                ]}
                onPress={() => setSelectedDeviceId(item.id)}
              >
                <Text
                  style={[
                    styles.deviceButtonText,
                    selectedDeviceId === item.id &&
                      styles.deviceButtonTextActive,
                  ]}
                >
                  {item.device_id}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Summary Stats */}
      {insightsLoading ? (
        <View style={[GlobalStyles.center, { paddingVertical: Spacing.xxl }]}>
          <Loading size={40} />
        </View>
      ) : insights ? (
        <>
          <SectionHeader title="This Week" />
          <View style={styles.statsGrid}>
            <StatCard
              label="Total Outage"
              value={insights.week_total_outage_hours}
              unit="hrs"
              icon="timer-off"
              color={Colors.error}
            />
            <StatCard
              label="Longest Outage"
              value={
                insights.longest_outage_minutes < 60
                  ? Math.round(insights.longest_outage_minutes)
                  : (insights.longest_outage_minutes / 60).toFixed(1)
              }
              unit={insights.longest_outage_minutes < 60 ? "min" : "hrs"}
              icon="trending-up"
              color={Colors.warning}
            />
          </View>

          <View style={styles.statsGrid}>
            <StatCard
              label="Avg Uptime"
              value={insights.avg_daily_uptime_percentage}
              unit="%"
              icon="check-circle"
              color={Colors.success}
            />
            <StatCard
              label="Stability"
              value={insights.stability_score}
              unit="/100"
              icon="star"
              color={Colors.primary}
            />
          </View>
        </>
      ) : (
        <Text
          style={[
            GlobalStyles.body,
            { color: Colors.text.secondary, margin: Spacing.lg },
          ]}
        >
          No insights available
        </Text>
      )}

      {/* 7-Day Uptime Chart */}
      <View style={styles.chartSection}>
        <SectionHeader title="7-Day Uptime Trend" />
        <View style={styles.chartContainer}>
          <VictoryChart
            width={chartWidth}
            height={250}
            domain={{ y: [0, 100] }}
            domainPadding={20}
          >
            <VictoryAxis
              tickCount={8}
              style={{
                tickLabels: { fontSize: 10, fill: Colors.text.secondary },
                grid: { stroke: Colors.border },
              }}
            />
            <VictoryAxis
              dependentAxis
              tickCount={5}
              style={{
                tickLabels: { fontSize: 10, fill: Colors.text.secondary },
              }}
            />
            <VictoryLine
              data={sevenDayUptimeData}
              style={{
                data: { stroke: Colors.success, strokeWidth: 2 },
              }}
              interpolation="natural"
            />
          </VictoryChart>
        </View>
        <Text
          style={[
            GlobalStyles.caption,
            { marginLeft: Spacing.lg, marginTop: Spacing.sm },
          ]}
        >
          Power availability percentage over the last 7 days
        </Text>
      </View>

      {/* 30-Day Outage Frequency Chart */}
      <View style={styles.chartSection}>
        <SectionHeader title="30-Day Outage Frequency" />
        <View style={styles.chartContainer}>
          <VictoryChart
            width={chartWidth}
            height={250}
            domain={{ y: [0, 5] }}
            domainPadding={20}
          >
            <VictoryAxis
              tickCount={8}
              style={{
                tickLabels: { fontSize: 8, fill: Colors.text.secondary },
                grid: { stroke: Colors.border },
              }}
            />
            <VictoryAxis
              dependentAxis
              tickFormat={(d) => `${d}`}
              style={{
                tickLabels: { fontSize: 10, fill: Colors.text.secondary },
              }}
            />
            <VictoryBar
              data={thirtyDayOutageData}
              style={{
                data: { fill: Colors.error },
              }}
            />
          </VictoryChart>
        </View>
        <Text
          style={[
            GlobalStyles.caption,
            { marginLeft: Spacing.lg, marginTop: Spacing.sm },
          ]}
        >
          Number of outage events per day over the last 30 days
        </Text>
      </View>

      {/* Outage Timeline */}
      <View style={styles.timelineSection}>
        <SectionHeader title="Recent Outages" />
        <FlatList
          data={lastSevenDaysOutages}
          keyExtractor={(item, index) => index.toString()}
          scrollEnabled={false}
          renderItem={({ item, index }) => (
            <View
              key={item.id}
              style={[
                styles.timelineItem,
                index !== lastSevenDaysOutages.length - 1 &&
                  styles.timelineItemBorder,
              ]}
            >
              <View style={styles.timelineMarker}>
                <View style={styles.timelineMarkerDot} />
                {index !== lastSevenDaysOutages.length - 1 && (
                  <View style={styles.timelineMarkerLine} />
                )}
              </View>
              <View style={styles.timelineContent}>
                <Text style={GlobalStyles.label}>
                  {new Date(item.started_at).toLocaleDateString()}
                </Text>
                <Text style={[GlobalStyles.body, { marginTop: Spacing.xs }]}>
                  Duration: {Math.round(item.duration_minutes)} minutes
                </Text>
              </View>
            </View>
          )}
        />
      </View>

      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  deviceSelectionSection: {
    marginVertical: Spacing.lg,
  },
  deviceButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.md,
    borderRadius: 20,
    backgroundColor: Colors.backgroundDark,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  deviceButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  deviceButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.text.primary,
  },
  deviceButtonTextActive: {
    color: "white",
  },
  statsGrid: {
    flexDirection: "row",
    paddingHorizontal: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  chartSection: {
    marginVertical: Spacing.xl,
  },
  chartContainer: {
    backgroundColor: Colors.backgroundDark,
    borderRadius: 12,
    marginHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  timelineSection: {
    marginVertical: Spacing.xl,
  },
  timelineItem: {
    flexDirection: "row",
    marginHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  timelineItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  timelineMarker: {
    width: 40,
    alignItems: "center",
  },
  timelineMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  timelineMarkerLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginTop: -20,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: Spacing.md,
    justifyContent: "center",
  },
});

export default InsightsScreen;
