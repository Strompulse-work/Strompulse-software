/**
 * Alerts Screen v3.0
 * Features: Segmented filter tabs, Urgent SOS Banner, Dynamic Notification Cards
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

// --- Mock Data based on PRD v3.0 ---
const MOCK_NOTIFICATIONS = [
  {
    id: "1",
    type: "sos",
    category: "security",
    title: "SOS from Tunde",
    body: "Tunde triggered an emergency alert. Last known location: Challenge, Ibadan.",
    time: "2 min ago",
    isUnread: true,
    userInitial: "T",
    tag: "EMERGENCY",
  },
  {
    id: "2",
    type: "journey",
    category: "security",
    title: "Sola started a journey",
    body: "Sola is heading to Dugbe Market. Estimated arrival in 30 mins.",
    time: "34 min ago",
    isUnread: true,
    userInitial: "S",
  },
  {
    id: "3",
    type: "outage",
    category: "power",
    title: "Power outage • Bodija",
    body: "Sensors confirmed a power cut in Bodija. 847 units affected.",
    time: "8 min ago",
    isUnread: true,
    tag: "Bodija",
  },
  {
    id: "4",
    type: "arrived",
    category: "security",
    title: "Mum arrived safely",
    body: "Mum's journey to UI Teaching Hospital ended 4 minutes early.",
    time: "1 hr ago",
    isUnread: false,
    userInitial: "M",
  },
  {
    id: "5",
    type: "restored",
    category: "power",
    title: "Power restored • Agodi GRA",
    body: "Supply returned after 4h 22m.",
    time: "Yesterday",
    isUnread: false,
    tag: "Agodi GRA",
  },
];

const AlertsScreen = () => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme);

  const [activeTab, setActiveTab] = useState<"all" | "security" | "power">("all");
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  // Filter logic
  const filteredData = notifications.filter((item) => {
    if (activeTab === "all") return true;
    return item.category === activeTab;
  });

  const unreadCount = notifications.filter((n) => n.isUnread).length;

  const markAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, isUnread: false })));
  };

  const dismissAlert = (id: string) => {
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  // --- Render Filter Tabs ---
  const renderFilterTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === "all" && styles.tabButtonActive]}
        onPress={() => setActiveTab("all")}
      >
        <MaterialCommunityIcons
          name="grid-large"
          size={20}
          color={activeTab === "all" ? "#00C48A" : theme.textSecondary}
        />
        <Text style={[styles.tabText, activeTab === "all" && styles.tabTextActive]}>All</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabButton, activeTab === "security" && styles.tabButtonActive]}
        onPress={() => setActiveTab("security")}
      >
        <MaterialCommunityIcons
          name="shield-outline"
          size={20}
          color={activeTab === "security" ? "#00C48A" : theme.textSecondary}
        />
        <Text style={[styles.tabText, activeTab === "security" && styles.tabTextActive]}>
          Security
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabButton, activeTab === "power" && styles.tabButtonActive]}
        onPress={() => setActiveTab("power")}
      >
        <MaterialCommunityIcons
          name="lightning-bolt-outline"
          size={20}
          color={activeTab === "power" ? "#00C48A" : theme.textSecondary}
        />
        <Text style={[styles.tabText, activeTab === "power" && styles.tabTextActive]}>Power</Text>
      </TouchableOpacity>
    </View>
  );

  // --- Render Individual Notification Card ---
  const renderItem = ({ item }: { item: typeof MOCK_NOTIFICATIONS[0] }) => {
    // 1. Urgent SOS Banner
    if (item.type === "sos") {
      return (
        <View style={styles.sosCard}>
          <View style={styles.sosHeader}>
            <View style={styles.avatarContainer}>
              <View style={[styles.avatarCircle, { backgroundColor: "#F1F5F9" }]}>
                <Text style={[styles.avatarText, { color: "#3B82F6" }]}>{item.userInitial}</Text>
              </View>
              <View style={styles.sosBadgeSmall}>
                <Text style={styles.sosBadgeSmallText}>SOS</Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.rowBetween}>
                <View style={styles.emergencyTag}>
                  <View style={styles.redDot} />
                  <Text style={styles.emergencyTagText}>{item.tag}</Text>
                </View>
                <Text style={styles.timeText}>{item.time}</Text>
              </View>
              <Text style={styles.titleText}>{item.title}</Text>
            </View>
          </View>
          <Text style={styles.bodyText}>{item.body}</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.btnPrimaryRed}>
              <MaterialCommunityIcons name="map-marker" size={16} color="#FFF" />
              <Text style={styles.btnPrimaryRedText}>View Location</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => dismissAlert(item.id)}>
              <Text style={styles.btnSecondaryText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // 2. Standard Notifications (Journey, Outage, Restored, Arrived)
    return (
      <View style={[styles.standardCard, item.isUnread && styles.unreadBackground]}>
        {item.isUnread && (
          <View
            style={[
              styles.unreadIndicator,
              item.category === "power" ? { backgroundColor: "#F59E0B" } : { backgroundColor: "#00C48A" },
            ]}
          />
        )}
        
        <View style={styles.standardHeader}>
          {/* Icon / Avatar Box */}
          {item.category === "power" ? (
            <View style={[styles.iconBox, item.type === "outage" ? styles.iconBoxAmber : styles.iconBoxGreen]}>
              <MaterialCommunityIcons
                name={item.type === "outage" ? "lightning-bolt" : "lightbulb-outline"}
                size={24}
                color={item.type === "outage" ? "#F59E0B" : "#00C48A"}
              />
            </View>
          ) : (
            <View style={styles.avatarContainer}>
              <View style={[styles.avatarCircle, { backgroundColor: "#F3E8FF" }]}>
                <Text style={[styles.avatarText, { color: "#8B5CF6" }]}>{item.userInitial}</Text>
              </View>
              <View style={[styles.smallBadge, item.type === "arrived" ? { backgroundColor: "#00C48A" } : { backgroundColor: "#EF4444" }]}>
                <MaterialCommunityIcons
                  name={item.type === "arrived" ? "check" : "map-marker"}
                  size={10}
                  color="#FFF"
                />
              </View>
            </View>
          )}

          {/* Content Area */}
          <View style={styles.cardContent}>
            <View style={styles.rowBetween}>
              {item.tag && item.category === "power" ? (
                <View style={[styles.powerTag, item.type === "outage" ? styles.powerTagAmber : styles.powerTagGreen]}>
                  <Text style={[styles.powerTagText, item.type === "outage" ? { color: "#D97706" } : { color: "#059669" }]}>
                    {item.tag}
                  </Text>
                </View>
              ) : (
                <Text style={styles.titleText}>{item.title}</Text>
              )}
              <Text style={styles.timeText}>{item.time}</Text>
            </View>
            {item.category === "power" && <Text style={styles.titleText}>{item.title}</Text>}
            <Text style={styles.bodyText}>{item.body}</Text>
            
            {/* CTA Buttons */}
            {item.type === "journey" && (
              <TouchableOpacity style={styles.pillBtnGreen}>
                <Text style={styles.pillBtnGreenText}>Track Journey</Text>
              </TouchableOpacity>
            )}
            {item.type === "outage" && (
              <TouchableOpacity style={styles.pillBtnAmber}>
                <Text style={styles.pillBtnAmberText}>View Status</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badgeCircle}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markReadBtn} onPress={markAllRead}>
            <Text style={styles.markReadText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={{ paddingHorizontal: 20 }}>{renderFilterTabs()}</View>

      {/* List */}
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

// Styles
const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: Platform.OS === "ios" ? 60 : 40,
      paddingBottom: 20,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 28,
      fontFamily: "Sora_800ExtraBold",
      color: theme.textPrimary,
      marginRight: 10,
    },
    badgeCircle: {
      backgroundColor: "#EF4444",
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: "center",
      alignItems: "center",
    },
    badgeText: {
      color: "#FFF",
      fontSize: 12,
      fontFamily: "Sora_700Bold",
    },
    markReadBtn: {
      backgroundColor: "rgba(0, 196, 138, 0.1)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    markReadText: {
      color: "#00C48A",
      fontSize: 12,
      fontFamily: "Sora_600SemiBold",
    },
    tabContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    tabButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.cardBg,
      paddingVertical: 12,
      marginHorizontal: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tabButtonActive: {
      backgroundColor: "rgba(0, 196, 138, 0.1)",
      borderColor: "rgba(0, 196, 138, 0.3)",
    },
    tabText: {
      fontSize: 14,
      fontFamily: "Sora_600SemiBold",
      color: theme.textSecondary,
      marginLeft: 6,
    },
    tabTextActive: {
      color: "#00C48A",
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    rowBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    timeText: {
      fontSize: 11,
      color: "#94A3B8",
      fontFamily: "Sora_400Regular",
    },
    titleText: {
      fontSize: 15,
      fontFamily: "Sora_700Bold",
      color: theme.textPrimary,
      marginBottom: 4,
    },
    bodyText: {
      fontSize: 13,
      fontFamily: "Sora_400Regular",
      color: theme.textSecondary,
      lineHeight: 20,
      marginBottom: 12,
    },
    avatarContainer: {
      position: "relative",
      marginRight: 12,
    },
    avatarCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      fontSize: 20,
      fontFamily: "Sora_700Bold",
    },
    smallBadge: {
      position: "absolute",
      bottom: -2,
      right: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme.cardBg,
    },

    // SOS Card Styles
    sosCard: {
      backgroundColor: "#FEF2F2",
      borderWidth: 1,
      borderColor: "#FECACA",
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    sosHeader: {
      flexDirection: "row",
      marginBottom: 8,
    },
    sosBadgeSmall: {
      position: "absolute",
      bottom: -4,
      right: -8,
      backgroundColor: "#EF4444",
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: "#FEF2F2",
    },
    sosBadgeSmallText: {
      color: "#FFF",
      fontSize: 8,
      fontFamily: "Sora_800ExtraBold",
    },
    emergencyTag: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#FEE2E2",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    redDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#EF4444",
      marginRight: 4,
    },
    emergencyTagText: {
      color: "#EF4444",
      fontSize: 10,
      fontFamily: "Sora_700Bold",
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    btnPrimaryRed: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#EF4444",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      marginRight: 12,
      flex: 1,
      justifyContent: "center",
    },
    btnPrimaryRedText: {
      color: "#FFF",
      fontSize: 14,
      fontFamily: "Sora_700Bold",
      marginLeft: 6,
    },
    btnSecondary: {
      backgroundColor: "#F1F5F9",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
    },
    btnSecondaryText: {
      color: "#64748B",
      fontSize: 14,
      fontFamily: "Sora_600SemiBold",
    },

    // Standard Card Styles
    standardCard: {
      backgroundColor: theme.cardBg,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      position: "relative",
    },
    unreadBackground: {
      backgroundColor: "rgba(0, 196, 138, 0.03)",
    },
    unreadIndicator: {
      position: "absolute",
      left: 6,
      top: 36,
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    standardHeader: {
      flexDirection: "row",
    },
    iconBox: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    iconBoxAmber: { backgroundColor: "#FEF3C7" },
    iconBoxGreen: { backgroundColor: "#D1FAE5" },
    cardContent: {
      flex: 1,
    },
    powerTag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
    },
    powerTagAmber: { backgroundColor: "#FEF3C7" },
    powerTagGreen: { backgroundColor: "#D1FAE5" },
    powerTagText: {
      fontSize: 10,
      fontFamily: "Sora_700Bold",
    },
    pillBtnGreen: {
      alignSelf: "flex-start",
      backgroundColor: "#D1FAE5",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    pillBtnGreenText: {
      color: "#059669",
      fontSize: 12,
      fontFamily: "Sora_600SemiBold",
    },
    pillBtnAmber: {
      alignSelf: "flex-start",
      backgroundColor: "#FEF3C7",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    pillBtnAmberText: {
      color: "#D97706",
      fontSize: 12,
      fontFamily: "Sora_600SemiBold",
    },
  });

export default AlertsScreen;