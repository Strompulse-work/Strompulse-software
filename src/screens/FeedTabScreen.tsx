/**
 * Feed Screen - Main Dashboard
 * Dynamically switches between Light and Dark mode using ThemeContext.
 * Features auto-ticking relative timestamps and active sorting.
 * Global Grid Version: Shows all 10 locations to all users.
 * Integrated with 60-second heartbeat Online/Offline logic.
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
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import AuthService from "../services/authService";
import { useAllGridDevices, checkIsDeviceOnline, parseStromTimestamp } from "../hooks/useDeviceData"; 
import { useTheme } from "../theme/ThemeContext";
import { Loading, ErrorMessage } from "../components/UIComponents";

const { width } = Dimensions.get("window");

// --- HARDWARE TO LOCATION MAPPING ---
const DEVICE_LOCATIONS: Record<string, string> = {
  "STROM001": "Jericho Quarters",
  "STROM002": "Agodi GRA",
  "STROM003": "Bodija Estate",
  "STROM004": "Challenge",
  "STROM005": "Mokola",
  "STROM006": "Oluyole Estate",
  "STROM007": "Ring Road Area",
  "STROM008": "UI Campus",
  "STROM009": "Mapo Hall",
  "STROM010": "Eleyele",
};

// Helper to convert the parsed Date into raw milliseconds for sorting and math
const getTimestampMs = (dateInput: string | number | undefined) => {
  const d = parseStromTimestamp(dateInput);
  return d ? d.getTime() : 0;
};

// Advanced Relative Time formatter
const getRelativeTime = (dateInput: string | number, nowTime: number, isOnline: boolean) => {
  const past = getTimestampMs(dateInput);
  if (!past) return "Unknown";

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

// Safely grabs the most recent timestamp to sort by
const getLatestTimestamp = (device: any) => {
  const timestamp = getTimestampMs(device.timestamp);
  const lastSeen = getTimestampMs(device.last_seen);
  const updatedAt = getTimestampMs(device.updated_at);
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

  // 2. Ticking Clock (Forces re-renders to evaluate offline threshold smoothly)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. GLOBAL FETCH
  const {
    devices,
    loading: devicesLoading,
    error: devicesError,
  } = useAllGridDevices();

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

  // 4. MAP ALL 10 LOCATIONS
  const feedItems = Object.keys(DEVICE_LOCATIONS)
    .map((id) => {
      const liveData = devices.find((d) => d.id === id);
      return liveData || { 
        id, 
        status: "0", 
        timestamp: Date.now(), 
        address: DEVICE_LOCATIONS[id] 
      };
    })
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
            style={{ color: theme.textSecondary, marginTop: 16, fontSize: 16, fontFamily: "Sora_400Regular" }}
          >
            Grid is quiet. No recent updates.
          </Text>
        </View>
      ) : (
        <FlatList
          data={feedItems}
          extraData={{ feedItems, currentTime }} // Ensure updates happen when clock ticks
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
  
  const displayTime = device.timestamp || device.updated_at || device.last_seen || Date.now();

  // Evaluates device status dynamically on every second tick using the 60-second rule.
  // If the device loses connection, it will automatically switch to offline without needing a Firebase update.
  const isOnline = checkIsDeviceOnline({ status: device.status, timestamp: displayTime }, 60);

  const locationName = DEVICE_LOCATIONS[device.id] || `Unknown Grid (${device.id})`;

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
          
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            <MaterialCommunityIcons 
              name="map-marker-radius-outline" 
              size={12} 
              color={theme.textTertiary} 
            />
            <Text style={{ fontSize: 10, color: theme.textTertiary, fontFamily: "Sora_600SemiBold", marginLeft: 2, letterSpacing: 0.3 }}>
              Ref: Local Transformer
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.locationRow}>
        <Ionicons
          name="location-sharp"
          size={20}
          color={theme.textPrimary}
          style={{ marginRight: 6, marginTop: 2 }}
        />
        <Text style={styles.locationTitle}>{locationName}</Text>
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
      fontFamily: "Sora_600SemiBold",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    userNameText: {
      fontSize: 28,
      color: theme.textPrimary,
      fontFamily: "Sora_800ExtraBold",
      letterSpacing: -0.5,
    },
    feedTitleContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 24,
      marginBottom: 16,
    },
    feedTitle: {
      fontSize: 18,
      fontFamily: "Sora_700Bold",
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
      fontFamily: "Sora_800ExtraBold",
      letterSpacing: 0.5,
    },
    timestampText: {
      fontSize: 13,
      fontFamily: "Sora_500Medium",
    },
    locationRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 16,
    },
    locationTitle: {
      fontSize: 20,
      fontFamily: "Sora_700Bold",
      color: theme.textPrimary,
      flex: 1,
      letterSpacing: -0.3,
    },
  });

export default FeedScreen;