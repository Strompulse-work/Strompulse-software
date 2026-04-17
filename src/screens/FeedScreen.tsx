/**
 * Feed Screen - Main Dashboard (Advanced Light Mode)
 * Features: Rich data widgets, status pills, dynamic greeting, and fixed icons.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import { MaterialCommunityIcons, Feather, Ionicons } from "@expo/vector-icons";
import AuthService from "../services/authService";
import { useUserDevices } from "../hooks/useDeviceData";
import { Loading, ErrorMessage } from "../components/UIComponents";

const { width } = Dimensions.get("window");

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
  border: "#E2E8F0",
  iconMuted: "#CBD5E1",
};

// Formats "mins ago"
const getRelativeTime = (dateString: string) => {
  const now = new Date();
  const past = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - past.getTime()) / 60000);

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return "1d ago";
};

// Gets greeting based on device time
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const FeedScreen: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const session = await AuthService.getCurrentSession();
      if (session) setUser(session.user);
    };
    getUser();
  }, []);

  const {
    devices,
    loading: devicesLoading,
    error: devicesError,
  } = useUserDevices(user?.id || "");

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (devicesLoading && devices.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Loading />
      </View>
    );
  }

  if (devicesError) {
    return (
      <View style={[styles.container, styles.center]}>
        <ErrorMessage message={devicesError} />
      </View>
    );
  }

  const feedItems = [...devices].sort(
    (a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime(),
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />

      {/* Advanced Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greetingText}>{getGreeting()},</Text>
          <Text style={styles.userNameText}>
            {user?.full_name?.split(" ")[0] || "User"}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton}>
            <Feather name="search" size={20} color={THEME.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons
              name="options-outline"
              size={22}
              color={THEME.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.feedTitleContainer}>
        <Text style={styles.feedTitle}>Live Activity Feed</Text>
        <View style={styles.pulseIndicator} />
      </View>

      {feedItems.length === 0 ? (
        <View style={[styles.container, styles.center]}>
          <MaterialCommunityIcons
            name="timeline-alert-outline"
            size={64}
            color={THEME.textTertiary}
          />
          <Text
            style={{ color: THEME.textSecondary, marginTop: 16, fontSize: 16 }}
          >
            Grid is quiet. No recent updates.
          </Text>
        </View>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={THEME.success}
            />
          }
          renderItem={({ item }) => <FeedCard device={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

/**
 * Advanced Widget Card
 * Replaces question marks with precise MaterialCommunityIcons.
 */
const FeedCard: React.FC<{ device: any }> = ({ device }) => {
  const isOnline = device.status === "ON";

  // Configuration mapping based on IoT status
  const config = isOnline
    ? {
        color: THEME.success,
        bgColor: THEME.successBg,
        icon: "lightning-bolt", // Fix: Real lightning icon
        statusText: "POWER RESTORED",
      }
    : {
        color: THEME.error,
        bgColor: THEME.errorBg,
        icon: "power-plug-off", // Fix: Real unplugged icon
        statusText: "POWER OUTAGE",
      };

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7}>
      {/* Top Row: Status Pill & Timestamp */}
      <View style={styles.cardTopRow}>
        <View style={[styles.statusPill, { backgroundColor: config.bgColor }]}>
          <MaterialCommunityIcons
            name={config.icon as any}
            size={14}
            color={config.color}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.statusPillText, { color: config.color }]}>
            {config.statusText}
          </Text>
        </View>
        <Text style={styles.timestampText}>
          {getRelativeTime(device.last_seen)}
        </Text>
      </View>

      {/* Middle Row: Location Focus */}
      <View style={styles.locationRow}>
        <Ionicons
          name="location-sharp"
          size={20}
          color={THEME.textPrimary}
          style={{ marginRight: 6, marginTop: 2 }}
        />
        <Text style={styles.locationTitle}>{device.address}</Text>
      </View>

      {/* Bottom Row: Advanced Metadata Badges */}
      <View style={styles.metadataRow}>
        <View style={styles.badge}>
          <MaterialCommunityIcons
            name="target"
            size={14}
            color={THEME.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text style={styles.badgeText}>98% Uptime</Text>
        </View>
        {/* <View style={styles.badge}>
          <MaterialCommunityIcons
            name="memory"
            size={14}
            color={THEME.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text style={styles.badgeText}>
            Node #{device.id.substring(0, 4)}
          </Text>
        </View> */}
      </View>
    </TouchableOpacity>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 50 : 24,
    paddingBottom: 20,
  },
  greetingText: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  userNameText: {
    fontSize: 28,
    color: THEME.textPrimary,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.cardBg,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  feedTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  feedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: THEME.textPrimary,
    marginRight: 8,
  },
  pulseIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.success,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: THEME.cardBg,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    ...Platform.select({
      ios: {
        shadowColor: "#64748B",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  timestampText: {
    fontSize: 13,
    color: THEME.textTertiary,
    fontWeight: "500",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  locationTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: THEME.textPrimary,
    flex: 1,
    letterSpacing: -0.3,
  },
  metadataRow: {
    flexDirection: "row",
    gap: 12,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.background,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontWeight: "600",
  },
});

export default FeedScreen;
