/**
 * Profile Screen
 * Matches SRD Dark Theme: User settings, linked devices, and notification preferences
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
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import AuthService from "../services/authService";
import { useUserDevices } from "../hooks/useDeviceData";
import { Loading, ErrorMessage } from "../components/UIComponents";
import { User } from "../types";

// Exact SRD Dark Theme Colors
const THEME = {
  background: "#12141D",
  cardBg: "#1E202B",
  textPrimary: "#FFFFFF",
  textSecondary: "#8E92A4",
  success: "#00E676",
  error: "#FF3B30",
  warning: "#FFCC00",
  border: "#2C2F3F",
  primary: "#00E676", // Using the bright green as the primary accent
};

const ProfileScreen: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Notification States
  const [outageAlerts, setOutageAlerts] = useState(true);
  const [restorationAlerts, setRestorationAlerts] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);

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
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", onPress: () => {}, style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          const result = await AuthService.logout();
          if (!result.success) {
            Alert.alert("Error", result.error || "Failed to logout");
          }
        },
      },
    ]);
  };

  const handleChangePassword = () => {
    Alert.prompt(
      "Change Password",
      "Enter your new password",
      async (password) => {
        if (password && password.length >= 6) {
          const result = await AuthService.changePassword(password);
          if (result.success) {
            Alert.alert("Success", "Password changed successfully");
          } else {
            Alert.alert("Error", result.error || "Failed to change password");
          }
        } else {
          Alert.alert("Error", "Password must be at least 6 characters");
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
        <ErrorMessage message="Unable to load user profile" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
      </View>

      {/* User Info Card */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.full_name?.charAt(0).toUpperCase() || "U"}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.full_name || "User"}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {user.role === "community_admin"
                ? "Community Admin"
                : "Premium Member"}
            </Text>
          </View>
        </View>
      </View>

      {/* Linked Devices Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>LINKED DEVICES</Text>
        <View style={styles.cardBlock}>
          {devices && devices.length > 0 ? (
            devices.map((device, index) => (
              <View
                key={device.id}
                style={[
                  styles.deviceRow,
                  index !== devices.length - 1 && styles.borderBottom,
                ]}
              >
                <View style={styles.deviceRowLeft}>
                  <MaterialIcons
                    name="router"
                    size={24}
                    color={THEME.textPrimary}
                  />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.deviceTitle}>{device.device_id}</Text>
                    <Text style={styles.deviceSub}>
                      {device.address.split(",")[0]}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        device.status === "ON" ? THEME.success : THEME.error,
                    },
                  ]}
                />
              </View>
            ))
          ) : (
            <View style={{ padding: 16, alignItems: "center" }}>
              <Text style={{ color: THEME.textSecondary }}>
                No devices linked yet
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
            icon="notifications-active"
            label="Outage Alerts"
            value={outageAlerts}
            onValueChange={setOutageAlerts}
          />
          <NotificationRow
            icon="power"
            label="Restoration Alerts"
            value={restorationAlerts}
            onValueChange={setRestorationAlerts}
            borderTop
          />
          <NotificationRow
            icon="email"
            label="Email Summaries"
            value={emailNotifications}
            onValueChange={setEmailNotifications}
            borderTop
          />
        </View>
      </View>

      {/* Account Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.cardBlock}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleChangePassword}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MaterialIcons
                name="lock-outline"
                size={22}
                color={THEME.textPrimary}
              />
              <Text style={styles.actionText}>Change Password</Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={THEME.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, styles.borderTop]}
            onPress={handleLogout}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MaterialIcons name="logout" size={22} color={THEME.error} />
              <Text style={[styles.actionText, { color: THEME.error }]}>
                Log Out
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* App Info */}
      <View style={{ alignItems: "center", marginTop: 32 }}>
        <Text
          style={{
            color: THEME.textSecondary,
            fontSize: 12,
            fontWeight: "bold",
          }}
        >
          BYTES POWER MONITOR
        </Text>
        <Text
          style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 4 }}
        >
          Version 1.0.0
        </Text>
      </View>
    </ScrollView>
  );
};

/**
 * Custom Notification Row Component
 */
interface NotificationRowProps {
  icon: string;
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
        <MaterialIcons name={icon as any} size={22} color={THEME.textPrimary} />
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
  header: {
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  headerTitle: {
    color: THEME.textPrimary,
    fontSize: 18,
    fontWeight: "bold",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.cardBg,
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0, 230, 118, 0.2)", // Light green tint
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: THEME.success,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "bold",
    color: THEME.success,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: THEME.textPrimary,
    fontSize: 20,
    fontWeight: "bold",
  },
  userEmail: {
    color: THEME.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  roleBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: THEME.border,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  roleBadgeText: {
    color: THEME.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: THEME.textSecondary,
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 8,
  },
  cardBlock: {
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: "hidden",
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
  deviceTitle: {
    color: THEME.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  deviceSub: {
    color: THEME.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
    fontWeight: "500",
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
    fontWeight: "500",
    marginLeft: 12,
  },
});

export default ProfileScreen;
