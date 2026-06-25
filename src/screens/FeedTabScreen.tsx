/**
 * Feed Screen - Main Dashboard
 * Dynamically switches between Light and Dark mode using ThemeContext.
 * Features auto-ticking relative timestamps and active sorting.
 * Upgraded for Hybrid Backend (Supabase + Firebase Realtime).
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

// Advanced Relative Time formatter that relies on an actively ticking 'now' state
const getRelativeTime = (dateString: string | number, nowTime: number) => {
  if (!dateString) return "Unknown";
  
  const past = new Date(dateString).getTime();
  if (isNaN(past)) return "Unknown";

  const diffInMinutes = Math.floor((nowTime - past) / 60000);

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
};

// Safely grabs the most recent timestamp to sort by
const getLatestTimestamp = (device: any) => {
  const lastSeen = new Date(device.last_seen || 0).getTime();
  const updatedAt = new Date(device.updated_at || 0).getTime();
  return Math.max(lastSeen, updatedAt);
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
  const styles = getStyles(theme); 

  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // 1. Fetch user session
  useEffect(() => {
    const getUser = async () => {
      const session = await AuthService.getCurrentSession();
      if (session) setUser(session.user);
    };
    getUser();
  }, []);

  // 2. Ticking Clock: Forces the UI to re-render every 60 seconds so "1m ago" stays accurate
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
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

  // Actively sort items so the most recently updated device jumps to the top
  const feedItems = [...devices]
    .filter((device) => device.id === "STROM001") // <--- THIS LINE REMOVES THE 7 DUMMIES
    .sort((a, b) => getLatestTimestamp(b) - getLatestTimestamp(a));

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
          extraData={feedItems} // <--- ADD THIS LINE: Forces the list to redraw when status changes
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.success}
            />
          }
          renderItem={({ item }) => <FeedCard device={item} currentTime={currentTime} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

/**
 * Advanced Widget Card
 */
const FeedCard: React.FC<{ device: any; currentTime: number }> = ({ device, currentTime }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  
  // THE BULLETPROOF FIX: Convert whatever Firebase sends to a string and check it.
  // This will catch 1, "1", true, "true", or "ON"
  const rawStatus = String(device.status).toLowerCase().trim();
  const isOnline = rawStatus === "1" || rawStatus === "true" || rawStatus === "on";
  
  const displayTime = device.updated_at || device.last_seen || Date.now();

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
        
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.timestampText}>
            {getRelativeTime(displayTime, currentTime)}
          </Text>
          {/* TEMPORARY DEBUG TEXT: See exactly what Firebase is sending */}
          <Text style={{ fontSize: 9, color: theme.textTertiary, marginTop: 2 }}>
            Raw Firebase Status: {rawStatus}
          </Text>
        </View>
      </View>

      {/* Middle Row: Location Focus */}
      <View style={styles.locationRow}>
        <Ionicons
          name="location-sharp"
          size={20}
          color={theme.textPrimary}
          style={{ marginRight: 6, marginTop: 2 }}
        />
        <Text style={styles.locationTitle}>{device.id} </Text>
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
          <Text style={styles.badgeText}>
            {device.uptime !== undefined ? `${device.uptime}%` : "100%"} Uptime
          </Text>
        </View>
        
        {device.voltage !== undefined && (
          <View style={styles.badge}>
            <MaterialCommunityIcons
              name="flash"
              size={14}
              color={theme.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.badgeText}>
              {device.voltage}V
            </Text>
          </View>
        )}
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