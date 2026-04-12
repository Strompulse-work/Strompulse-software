/**
 * Feed Screen - Main Dashboard
 * Shows real-time power status with live duration counter and recent outage history
 */

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  FlatList,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import AuthService from "../services/authService";
import {
  useUserDevices,
  useDeviceOutages,
  useDeviceStatusPolling,
} from "../hooks/useDeviceData";
import {
  PowerStatusIndicator,
  DeviceCard,
  Loading,
  ErrorMessage,
  OutageEventItem,
  SectionHeader,
} from "../components/UIComponents";
import { Colors, GlobalStyles, Spacing } from "../styles/theme";
import {
  formatDuration,
  formatTimestamp,
  getRelativeTime,
} from "../utils/helpers";
import { Device, Outage } from "../types";

const { width: screenWidth } = Dimensions.get("screen");

const FeedScreen: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [outageStartTime, setOutageStartTime] = useState<string | null>(null);
  const [durationText, setDurationText] = useState("");
  const durationInterval = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial user
  useEffect(() => {
    const getUser = async () => {
      const session = await AuthService.getCurrentSession();
      if (session) {
        setUserId(session.user.id);
      }
    };
    getUser();
  }, []);

  // Fetch user devices
  const {
    devices,
    loading: devicesLoading,
    error: devicesError,
  } = useUserDevices(userId || "");

  // Set initial selected device
  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      setSelectedDevice(devices[0]);
    }
  }, [devices, selectedDevice]);

  // Fetch outages and status for selected device
  const { outages, loading: outagesLoading } = useDeviceOutages(
    selectedDevice?.id || "",
    5,
  );

  // Directly grab the real-time updated device from our live devices array
  const currentDevice =
    devices.find((d) => d.id === selectedDevice?.id) || selectedDevice;

  // Calculate duration for active outage
  useEffect(() => {
    if (currentDevice?.status === "OFF") {
      const calculateDuration = () => {
        if (!outageStartTime) {
          // Get start time from last outage
          const lastOutage = outages?.[0];
          if (lastOutage) {
            setOutageStartTime(lastOutage.started_at);
          }
        }

        if (outageStartTime) {
          const startDate = new Date(outageStartTime);
          const now = new Date();
          const diffMs = now.getTime() - startDate.getTime();
          const diffMinutes = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMinutes / 60);
          const diffDays = Math.floor(diffHours / 24);

          let text = "";
          if (diffDays > 0) {
            text = `Power has been OFF for ${diffDays}d ${diffHours % 24}h`;
          } else if (diffHours > 0) {
            text = `Power has been OFF for ${diffHours}h ${diffMinutes % 60}m`;
          } else {
            text = `Power has been OFF for ${diffMinutes}m`;
          }

          setDurationText(text);
        }
      };

      calculateDuration();
      durationInterval.current = setInterval(calculateDuration, 60000); // Update every minute

      return () => {
        if (durationInterval.current) {
          clearInterval(durationInterval.current);
        }
      };
    } else {
      setDurationText("");
      setOutageStartTime(null);
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    }
  }, [currentDevice?.status, outages, outageStartTime]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Trigger data refetch
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
        <MaterialIcons name="devices" size={64} color={Colors.text.tertiary} />
        <Text
          style={[
            GlobalStyles.h3,
            { marginTop: Spacing.lg, color: Colors.text.secondary },
          ]}
        >
          No Devices Found
        </Text>
        <Text
          style={[
            GlobalStyles.body,
            { color: Colors.text.tertiary, marginTop: Spacing.md },
          ]}
        >
          Add a device to get started monitoring your electricity status
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={GlobalStyles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Main Status Display */}
      <View style={styles.statusSection}>
        <View style={styles.statusCard}>
          <PowerStatusIndicator
            status={currentDevice?.status || "OFFLINE"}
            size="large"
            showLabel={true}
          />

          {durationText && (
            <Text style={[styles.durationText, { marginTop: Spacing.lg }]}>
              {durationText}
            </Text>
          )}

          {currentDevice?.last_seen && (
            <Text style={[GlobalStyles.caption, { marginTop: Spacing.md }]}>
              Last seen {getRelativeTime(currentDevice.last_seen)}
            </Text>
          )}
        </View>
      </View>

      {/* Device Selection */}
      {devices.length > 1 && (
        <View style={styles.deviceSelectionSection}>
          <SectionHeader title="Your Devices" />
          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            horizontal
            scrollEnabled={false}
            contentContainerStyle={{ paddingHorizontal: Spacing.lg }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.deviceSelector,
                  selectedDevice?.id === item.id && styles.deviceSelectorActive,
                ]}
                onPress={() => {
                  setSelectedDevice(item);
                  setOutageStartTime(null);
                }}
              >
                <Text
                  style={[
                    styles.deviceSelectorText,
                    selectedDevice?.id === item.id &&
                      styles.deviceSelectorTextActive,
                  ]}
                >
                  {item.device_id}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Recent Outages */}
      <View style={styles.outagesSection}>
        <SectionHeader title="Recent Outages" />
        {outagesLoading ? (
          <Loading size={40} />
        ) : outages.length > 0 ? (
          <FlatList
            data={outages}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <OutageEventItem
                duration={formatDuration(item.duration_minutes)}
                startTime={formatTimestamp(item.started_at, "MMM dd, HH:mm")}
                endTime={
                  item.ended_at
                    ? formatTimestamp(item.ended_at, "MMM dd, HH:mm")
                    : "Ongoing"
                }
              />
            )}
          />
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons
              name="check-circle"
              size={40}
              color={Colors.success}
            />
            <Text
              style={[
                GlobalStyles.body,
                { color: Colors.text.secondary, marginTop: Spacing.md },
              ]}
            >
              No recent outages - Great!
            </Text>
          </View>
        )}
      </View>

      {/* Device Info */}
      {currentDevice && (
        <View style={styles.infoSection}>
          <SectionHeader title="Device Information" />
          <View style={[GlobalStyles.card, { marginHorizontal: Spacing.lg }]}>
            <View style={GlobalStyles.rowBetween}>
              <Text style={GlobalStyles.label}>Device ID</Text>
              <Text style={GlobalStyles.body}>{currentDevice.device_id}</Text>
            </View>
            <View
              style={[
                GlobalStyles.rowBetween,
                {
                  marginTop: Spacing.md,
                  borderTopWidth: 1,
                  borderTopColor: Colors.border,
                  paddingTop: Spacing.md,
                },
              ]}
            >
              <Text style={GlobalStyles.label}>Address</Text>
              <Text
                style={[
                  GlobalStyles.body,
                  { flex: 1, textAlign: "right", marginLeft: Spacing.md },
                ]}
              >
                {currentDevice.address}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  statusSection: {
    paddingVertical: Spacing.xxl,
    alignItems: "center",
  },
  statusCard: {
    alignItems: "center",
  },
  durationText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.error,
    textAlign: "center",
  },
  deviceSelectionSection: {
    marginVertical: Spacing.xl,
  },
  deviceSelector: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.md,
    borderRadius: 20,
    backgroundColor: Colors.backgroundDark,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  deviceSelectorActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  deviceSelectorText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.text.primary,
  },
  deviceSelectorTextActive: {
    color: "white",
  },
  outagesSection: {
    marginVertical: Spacing.xl,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
  },
  infoSection: {
    marginVertical: Spacing.xl,
  },
});

export default FeedScreen;
