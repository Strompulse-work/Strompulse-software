/**
 * Feed Screen - Main Dashboard
 * Dynamically switches between Light and Dark mode using ThemeContext.
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
import { useTheme } from "../theme/ThemeContext";
import { Loading, ErrorMessage } from "../components/UIComponents";

const { width } = Dimensions.get("window");

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
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme); // Generate styles dynamically

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
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />

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
            <Feather name="search" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons
              name="options-outline"
              size={22}
              color={theme.textPrimary}
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
            color={theme.textTertiary}
          />
          <Text
            style={{ color: theme.textSecondary, marginTop: 16, fontSize: 16 }}
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
              tintColor={theme.success}
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
 */
const FeedCard: React.FC<{ device: any }> = ({ device }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const isOnline = device.status === "ON";

  // Configuration mapping based on IoT status and active theme
  const config = isOnline
    ? {
        color: theme.success,
        bgColor: theme.successBg,
        icon: "lightning-bolt",
        statusText: "POWER RESTORED",
      }
    : {
        color: theme.error,
        bgColor: theme.errorBg,
        icon: "power-plug-off",
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
          color={theme.textPrimary}
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
            color={theme.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text style={styles.badgeText}>98% Uptime</Text>
        </View>
      </View>
    </TouchableOpacity>
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
      color: theme.textSecondary,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    userNameText: {
      fontSize: 28,
      color: theme.textPrimary,
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
      backgroundColor: theme.cardBg,
      justifyContent: "center",
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        android: { elevation: 2 },
      }),
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
      color: theme.textPrimary,
      marginRight: 8,
    },
    pulseIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.success,
    },
    listContainer: {
      paddingHorizontal: 20,
      paddingBottom: 120,
    },
    card: {
      backgroundColor: theme.cardBg,
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        android: {
          elevation: 3,
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
      color: theme.textTertiary,
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
      color: theme.textPrimary,
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
      backgroundColor: theme.background,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
    },
    badgeText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: "600",
    },
  });

export default FeedScreen;
