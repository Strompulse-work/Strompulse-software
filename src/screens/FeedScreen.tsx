/**
 * Feed Screen - Main Dashboard
 * Matches SRD Dark Theme: Global Activity Feed of power events across Ibadan
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import AuthService from "../services/authService";
import { useUserDevices } from "../hooks/useDeviceData";
import { Loading, ErrorMessage } from "../components/UIComponents";

// Extracted exact colors from your SRD image
const THEME = {
  background: "#12141D",
  cardBg: "#1E202B",
  textPrimary: "#FFFFFF",
  textSecondary: "#8E92A4",
  success: "#00E676", // Bright Green
  error: "#FF3B30", // Bright Red
  warning: "#FFCC00", // Yellow
  border: "#2C2F3F",
};

// Quick helper to format "mins ago"
const getRelativeTime = (dateString: string) => {
  const now = new Date();
  const past = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - past.getTime()) / 60000);

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hrs ago`;
  return "1 day ago";
};

const FeedScreen: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  // Fetch all devices for the user
  const {
    devices,
    loading: devicesLoading,
    error: devicesError,
  } = useUserDevices(userId || "");

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

  // Sort devices by who was "last seen" to make it act like a chronological timeline feed
  const feedItems = [...devices].sort(
    (a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime(),
  );

  return (
    <View style={styles.container}>
      {/* Header Area to match SRD Top Navigation vibe */}
      <View style={styles.header}>
        <View style={styles.headerIndicator} />
        <Text style={styles.headerTitle}>Live Feed</Text>
      </View>

      {feedItems.length === 0 ? (
        <View style={[styles.container, styles.center]}>
          <MaterialIcons
            name="notifications-none"
            size={64}
            color={THEME.textSecondary}
          />
          <Text style={{ color: THEME.textSecondary, marginTop: 16 }}>
            No recent activity.
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
        />
      )}
    </View>
  );
};

/**
 * Individual Activity Notification Card
 */
const FeedCard: React.FC<{ device: any }> = ({ device }) => {
  const isOnline = device.status === "ON";

  // Dynamic styling based on power status
  const cardConfig = isOnline
    ? {
        color: THEME.success,
        bgColor: "rgba(0, 230, 118, 0.1)",
        icon: "power",
        title: `Power Restored in ${device.address}`,
        subtitle: `Power is back in ${device.address}. Confidence: 98%`,
      }
    : {
        color: THEME.error,
        bgColor: "rgba(255, 59, 48, 0.1)",
        icon: "power-off",
        title: `Outage in ${device.address}`,
        subtitle: `Power outage detected in ${device.address}. Confidence: 95%`,
      };

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8}>
      {/* Left Icon */}
      <View
        style={[styles.iconContainer, { backgroundColor: cardConfig.bgColor }]}
      >
        <MaterialIcons
          name={cardConfig.icon as any}
          size={24}
          color={cardConfig.color}
        />
      </View>

      {/* Right Content */}
      <View style={styles.contentContainer}>
        <Text style={[styles.title, { color: cardConfig.color }]}>
          {cardConfig.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {cardConfig.subtitle}
        </Text>
        <Text style={styles.timestamp}>
          {getRelativeTime(device.last_seen)}
        </Text>
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
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  headerIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: THEME.success,
    marginRight: 12,
  },
  headerTitle: {
    color: THEME.textPrimary,
    fontSize: 20,
    fontWeight: "bold",
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    flexDirection: "row",
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  subtitle: {
    color: THEME.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  timestamp: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: "500",
  },
});

export default FeedScreen;
