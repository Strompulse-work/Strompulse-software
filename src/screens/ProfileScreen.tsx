/**
 * Profile Screen
 * Modern Light Mode Theme: Premium user settings and preferences.
 * Features: Floating cards, rich status pills, and crisp line icons.
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
import { MaterialCommunityIcons, Feather, Ionicons } from "@expo/vector-icons";
import AuthService from "../services/authService";
import { useUserDevices } from "../hooks/useDeviceData";
import { Loading, ErrorMessage } from "../components/UIComponents";
import { User } from "../types";

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
  warning: "#D97706",
  border: "#E2E8F0",
  primary: "#0EA5E9", // Sky Blue for premium user badges
  primaryBg: "#E0F2FE",
};

const ProfileScreen: React.FC = () => {
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
      <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />

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
                    ? THEME.primaryBg
                    : THEME.successBg,
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
                user.role === "community_admin" ? THEME.primary : THEME.success
              }
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.roleBadgeText,
                {
                  color:
                    user.role === "community_admin"
                      ? THEME.primary
                      : THEME.success,
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
                    <View
                      style={[
                        styles.iconBox,
                        { backgroundColor: THEME.background },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="router-wireless"
                        size={22}
                        color={THEME.textSecondary}
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
                          ? THEME.successBg
                          : THEME.errorBg,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: isOnline
                            ? THEME.success
                            : THEME.error,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: isOnline ? THEME.success : THEME.error },
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
                color={THEME.border}
              />
              <Text
                style={{
                  color: THEME.textSecondary,
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

      {/* Notification Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
        <View style={styles.cardBlock}>
          <NotificationRow
            icon="bell"
            label="Outage Alerts"
            value={outageAlerts}
            onValueChange={setOutageAlerts}
          />
          <NotificationRow
            icon="zap"
            label="Restoration Alerts"
            value={restorationAlerts}
            onValueChange={setRestorationAlerts}
            borderTop
          />
          <NotificationRow
            icon="mail"
            label="Email Summaries"
            value={emailNotifications}
            onValueChange={setEmailNotifications}
            borderTop
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
              <View
                style={[styles.iconBox, { backgroundColor: THEME.background }]}
              >
                <Feather name="lock" size={18} color={THEME.textPrimary} />
              </View>
              <Text style={styles.actionText}>Change Password</Text>
            </View>
            <Feather
              name="chevron-right"
              size={20}
              color={THEME.textTertiary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, styles.borderTop]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={[styles.iconBox, { backgroundColor: THEME.errorBg }]}
              >
                <Feather name="log-out" size={18} color={THEME.error} />
              </View>
              <Text style={[styles.actionText, { color: THEME.error }]}>
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
          color={THEME.textTertiary}
        />
        <Text style={styles.footerTitle}>STROMPULSE</Text>
        <Text style={styles.footerVersion}>Version 1.0.0 • Build 42</Text>
      </View>
    </ScrollView>
  );
};

/**
 * Custom Notification Row Component using Feather Icons
 */
interface NotificationRowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  borderTop?: boolean;
}

const NotificationRow: React.FC<NotificationRowProps> = ({
  icon,
  label,
  value,
  onValueChange,
  borderTop,
}) => {
  return (
    <View style={[styles.notificationRow, borderTop && styles.borderTop]}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={[styles.iconBox, { backgroundColor: THEME.background }]}>
          <Feather name={icon} size={18} color={THEME.textPrimary} />
        </View>
        <Text style={styles.notificationText}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: THEME.border, true: THEME.success }}
        thumbColor={"#FFFFFF"}
        ios_backgroundColor={THEME.border}
      />
    </View>
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
  headerContainer: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 50 : 24,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: THEME.textPrimary,
    letterSpacing: -0.5,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.cardBg,
    marginHorizontal: 20,
    marginTop: 8,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: THEME.border,
    ...Platform.select({
      ios: {
        shadowColor: "#64748B",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  avatarContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: THEME.textPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: THEME.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  userEmail: {
    color: THEME.textSecondary,
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
    color: THEME.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 8,
  },
  cardBlock: {
    backgroundColor: THEME.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#64748B",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
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
    justifyContent: "center",
    alignItems: "center",
  },
  deviceTitle: {
    color: THEME.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  deviceSub: {
    color: THEME.textSecondary,
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
    color: THEME.textPrimary,
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
    color: THEME.textPrimary,
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
    color: THEME.textSecondary,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 8,
  },
  footerVersion: {
    color: THEME.textTertiary,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },
});

export default ProfileScreen;
