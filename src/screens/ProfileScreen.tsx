/**
 * Profile Screen
 * Dynamically switches between Light and Dark mode using ThemeContext.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Switch,
  Platform,
  StatusBar,
} from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import AuthService from "../services/authService";
import { useUserDevices } from "../hooks/useDeviceData";
import { useTheme } from "../theme/ThemeContext";
import { Loading, ErrorMessage } from "../components/UIComponents";
import { User } from "../types";

const ProfileScreen: React.FC = () => {
  const { theme, isDarkMode, toggleDarkMode } = useTheme();
  const styles = getStyles(theme); // Generate styles dynamically based on the active theme

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Notification States
  const [outageAlerts, setOutageAlerts] = useState(true);
  const [restorationAlerts, setRestorationAlerts] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);

  // Fetch user info
  useEffect(() => {
    const getUser = async () => {
      try {
        const session = await AuthService.getCurrentSession();
        if (session) {
          setUser(session.user);
        }
      } catch (err) {
        console.error("Error fetching user:", err);
      } finally {
        setLoading(false);
      }
    };
    getUser();
  }, []);

  // Fetch user devices
  const { devices } = useUserDevices(user?.id || "");

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out of your account?",
      [
        { text: "Cancel", onPress: () => {}, style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            const result = await AuthService.logout();
            if (!result.success) {
              Alert.alert("Error", result.error || "Failed to logout");
            }
          },
        },
      ],
    );
  };

  const handleChangePassword = () => {
    Alert.prompt(
      "Change Password",
      "Enter your new password (min 6 characters)",
      async (password) => {
        if (password && password.length >= 6) {
          const result = await AuthService.changePassword(password);
          if (result.success) {
            Alert.alert("Success", "Your password has been securely updated.");
          } else {
            Alert.alert("Error", result.error || "Failed to change password.");
          }
        } else {
          Alert.alert("Error", "Password must be at least 6 characters long.");
        }
      },
      "secure-text",
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Loading />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.center]}>
        <ErrorMessage message="Unable to load user profile." />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 60 }}
    >
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />

      {/* Advanced Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* Premium User Info Card */}
      <View style={styles.userCard}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {user.full_name?.charAt(0).toUpperCase() || "U"}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.full_name || "User"}</Text>
          <Text style={styles.userEmail}>{user.email || user.phone}</Text>
          <View
            style={[
              styles.roleBadge,
              {
                backgroundColor:
                  user.role === "community_admin"
                    ? theme.primaryBg
                    : theme.successBg,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={
                user.role === "community_admin"
                  ? "shield-star-outline"
                  : "star-check-outline"
              }
              size={14}
              color={
                user.role === "community_admin" ? theme.primary : theme.success
              }
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.roleBadgeText,
                {
                  color:
                    user.role === "community_admin"
                      ? theme.primary
                      : theme.success,
                },
              ]}
            >
              {user.role === "community_admin"
                ? "Community Admin"
                : "Premium Member"}
            </Text>
          </View>
        </View>
      </View>

      {/* Linked Devices Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>LINKED HARDWARE</Text>
        <View style={styles.cardBlock}>
          {devices && devices.length > 0 ? (
            devices.map((device, index) => {
              const isOnline = device.status === "ON";
              return (
                <View
                  key={device.id}
                  style={[
                    styles.deviceRow,
                    index !== devices.length - 1 && styles.borderBottom,
                  ]}
                >
                  <View style={styles.deviceRowLeft}>
                    <View style={styles.iconBox}>
                      <MaterialCommunityIcons
                        name="router-wireless"
                        size={22}
                        color={theme.textSecondary}
                      />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.deviceTitle}>{device.device_id}</Text>
                      <Text style={styles.deviceSub}>
                        {device.address.split(",")[0]}
                      </Text>
                    </View>
                  </View>

                  {/* Advanced Status Pill */}
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: isOnline
                          ? theme.successBg
                          : theme.errorBg,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: isOnline
                            ? theme.success
                            : theme.error,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: isOnline ? theme.success : theme.error },
                      ]}
                    >
                      {isOnline ? "ONLINE" : "OFFLINE"}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={{ padding: 24, alignItems: "center" }}>
              <MaterialCommunityIcons
                name="hardware-chip"
                size={40}
                color={theme.border}
              />
              <Text
                style={{
                  color: theme.textSecondary,
                  marginTop: 12,
                  fontWeight: "500",
                }}
              >
                No hardware linked to this account.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* APP SETTINGS (Dark Mode Toggle) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>APP SETTINGS</Text>
        <View style={styles.cardBlock}>
          <View style={styles.actionRow}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.iconBox}>
                <Feather
                  name={isDarkMode ? "moon" : "sun"}
                  size={18}
                  color={theme.textPrimary}
                />
              </View>
              <Text style={styles.actionText}>Dark Mode</Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: theme.border, true: theme.success }}
              thumbColor={"#FFFFFF"}
              ios_backgroundColor={theme.border}
            />
          </View>
        </View>
      </View>

      {/* Notification Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
        <View style={styles.cardBlock}>
          <NotificationRow
            icon="bell"
            label="Outage Alerts"
            value={outageAlerts}
            onValueChange={setOutageAlerts}
            theme={theme}
          />
          <NotificationRow
            icon="zap"
            label="Restoration Alerts"
            value={restorationAlerts}
            onValueChange={setRestorationAlerts}
            borderTop
            theme={theme}
          />
          <NotificationRow
            icon="mail"
            label="Email Summaries"
            value={emailNotifications}
            onValueChange={setEmailNotifications}
            borderTop
            theme={theme}
          />
        </View>
      </View>

      {/* Account Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACCOUNT & SECURITY</Text>
        <View style={styles.cardBlock}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleChangePassword}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.iconBox}>
                <Feather name="lock" size={18} color={theme.textPrimary} />
              </View>
              <Text style={styles.actionText}>Change Password</Text>
            </View>
            <Feather
              name="chevron-right"
              size={20}
              color={theme.textTertiary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, styles.borderTop]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={[styles.iconBox, { backgroundColor: theme.errorBg }]}
              >
                <Feather name="log-out" size={18} color={theme.error} />
              </View>
              <Text style={[styles.actionText, { color: theme.error }]}>
                Log Out
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* App Info Footer */}
      <View style={styles.footerContainer}>
        <MaterialCommunityIcons
          name="lightning-bolt-circle"
          size={28}
          color={theme.textTertiary}
        />
        <Text style={styles.footerTitle}>STROMPULSE</Text>
        <Text style={styles.footerVersion}>Version 1.0.0 • Build 42</Text>
      </View>
    </ScrollView>
  );
};

/**
 * Custom Notification Row Component
 */
interface NotificationRowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  borderTop?: boolean;
  theme: any;
}

const NotificationRow: React.FC<NotificationRowProps> = ({
  icon,
  label,
  value,
  onValueChange,
  borderTop,
  theme,
}) => {
  const styles = getStyles(theme);
  return (
    <View style={[styles.notificationRow, borderTop && styles.borderTop]}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={styles.iconBox}>
          <Feather name={icon} size={18} color={theme.textPrimary} />
        </View>
        <Text style={styles.notificationText}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.success }}
        thumbColor={"#FFFFFF"}
        ios_backgroundColor={theme.border}
      />
    </View>
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
      paddingBottom: 12,
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: "800",
      color: theme.textPrimary,
      letterSpacing: -0.5,
    },
    userCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.cardBg,
      marginHorizontal: 20,
      marginTop: 8,
      padding: 20,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000", // Darkened shadow for better dark mode compatibility
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
        },
        android: { elevation: 4 },
      }),
    },
    avatarContainer: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: theme.textPrimary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 16,
    },
    avatarText: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.background, // Inverts based on theme
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      color: theme.textPrimary,
      fontSize: 20,
      fontWeight: "700",
      letterSpacing: -0.2,
    },
    userEmail: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: "500",
      marginTop: 2,
    },
    roleBadge: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      alignSelf: "flex-start",
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    roleBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    section: {
      marginTop: 28,
      paddingHorizontal: 20,
    },
    sectionTitle: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1,
      marginBottom: 10,
      marginLeft: 8,
    },
    cardBlock: {
      backgroundColor: theme.cardBg,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        android: { elevation: 2 },
      }),
    },
    borderTop: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    borderBottom: {
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    deviceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
    },
    deviceRowLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.background,
      justifyContent: "center",
      alignItems: "center",
    },
    deviceTitle: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    deviceSub: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "500",
      marginTop: 2,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 6,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    notificationRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
    },
    notificationText: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "600",
      marginLeft: 12,
    },
    actionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
    },
    actionText: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "600",
      marginLeft: 12,
    },
    footerContainer: {
      alignItems: "center",
      marginTop: 40,
      opacity: 0.8,
    },
    footerTitle: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 2,
      marginTop: 8,
    },
    footerVersion: {
      color: theme.textTertiary,
      fontSize: 12,
      fontWeight: "500",
      marginTop: 4,
    },
  });

export default ProfileScreen;
