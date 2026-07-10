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

// Helper to parse both standard dates AND the custom IoT hardware format (DDMMYYYYHHMMSS)
const parseDeviceTime = (dateInput: string | number) => {
  if (!dateInput) return 0;
  const tsStr = String(dateInput);
  
  // If it's the exact 14-digit hardware string (e.g., "09072026152759")
  if (tsStr.length === 14 && /^\d+$/.test(tsStr)) {
    const day = parseInt(tsStr.substring(0, 2), 10);
    const month = parseInt(tsStr.substring(2, 4), 10) - 1; // JS months are 0-11
    const year = parseInt(tsStr.substring(4, 8), 10);
    const hour = parseInt(tsStr.substring(8, 10), 10);
    const minute = parseInt(tsStr.substring(10, 12), 10);
    const second = parseInt(tsStr.substring(12, 14), 10);
    return new Date(year, month, day, hour, minute, second).getTime();
  }
  
  // Fallback for standard ISO strings or epoch numbers
  return new Date(dateInput).getTime() || 0;
};

// Advanced Relative Time formatter with seconds, minutes, hours, days, weeks, years support
const getRelativeTime = (dateInput: string | number, nowTime: number, isOnline: boolean) => {
  const past = parseDeviceTime(dateInput);
  if (!past || isNaN(past)) return "Unknown";

  // Calculate difference in seconds
  const diffInSeconds = Math.floor(Math.max(nowTime - past, 0) / 1000);
  let timeString = "";

  if (diffInSeconds < 60) timeString = `${diffInSeconds}s ago`;
  else if (diffInSeconds < 3600) timeString = `${Math.floor(diffInSeconds / 60)}m ago`;
  else if (diffInSeconds < 86400) timeString = `${Math.floor(diffInSeconds / 3600)}h ago`;
  else if (diffInSeconds < 604800) timeString = `${Math.floor(diffInSeconds / 86400)}d ago`;
  else if (diffInSeconds < 31536000) timeString = `${Math.floor(diffInSeconds / 604800)}w ago`;
  else timeString = `${Math.floor(diffInSeconds / 31536000)}y ago`;

  const prefix = isOnline ? "Power Restored:" : "Power Outage:";
  return `(${prefix} ${timeString})`;
};

// Safely grabs the most recent timestamp to sort by using the custom parser
const getLatestTimestamp = (device: any) => {
  const timestamp = parseDeviceTime(device.timestamp);
  const lastSeen = parseDeviceTime(device.last_seen);
  const updatedAt = parseDeviceTime(device.updated_at);
  return Math.max(timestamp, lastSeen, updatedAt, 0);
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

  // 2. Ticking Clock: Forces the UI to re-render every 1 second so "s ago" updates live
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
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
    .filter((device) => device.id === "STROM001")
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
          extraData={feedItems} // Forces the list to redraw when status changes
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
  const rawStatus = String(device.status).toLowerCase().trim();
  const isOnline = rawStatus === "1" || rawStatus === "true" || rawStatus === "on";
  
  // FIXED: Explicitly look for the 'timestamp' key sent by the hardware engineer
  const displayTime = device.timestamp || device.updated_at || device.last_seen || Date.now();

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
          <Text style={[styles.timestampText, { color: config.color }]}>
            {getRelativeTime(displayTime, currentTime, isOnline)}
          </Text>
          
          {/* Reference Point Indicator */}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            <MaterialCommunityIcons 
              name="map-marker-radius-outline" 
              size={12} 
              color={theme.textTertiary} 
            />
            <Text style={{ fontSize: 10, color: theme.textTertiary, fontWeight: "600", marginLeft: 2, letterSpacing: 0.3 }}>
              Ref: Gate/Entrance Area
            </Text>
          </View>
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
        <Text style={styles.locationTitle}>Jericho Quarters</Text>
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