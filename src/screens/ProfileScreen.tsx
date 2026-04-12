import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Switch,
  FlatList,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import AuthService from "../services/authService";

// Assuming these are your local imports based on the code
import { Colors, GlobalStyles, Spacing, Typography } from "../styles/theme";
import {
  Loading,
  ErrorMessage,
  SectionHeader,
  DeviceCard,
} from "../components/UIComponents";
import { useUserDevices } from "../hooks/useDeviceData";
import { User } from "../types"; // Adjust path if needed

const ProfileScreen: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [outageAlerts, setOutageAlerts] = useState(true);
  const [restorationAlerts, setRestorationAlerts] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
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
        onPress: async () => {
          const result = await AuthService.logout();
          if (result.success) {
            // Navigation will be handled by the auth state change
          } else {
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
      <View style={[GlobalStyles.container, GlobalStyles.center]}>
        <Loading />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={GlobalStyles.container}>
        <ErrorMessage message="Unable to load user profile" />
      </View>
    );
  }

  return (
    <ScrollView style={GlobalStyles.container}>
      {/* User Header */}
      <View style={styles.userHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.full_name?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={GlobalStyles.h2}>{user.full_name}</Text>
          <Text style={[GlobalStyles.bodySmall, { marginTop: Spacing.xs }]}>
            {user.email || user.phone || "No contact info"}
          </Text>
          <View
            style={[
              styles.roleBadge,
              {
                backgroundColor:
                  user.role === "community_admin"
                    ? Colors.primary
                    : Colors.info,
              },
            ]}
          >
            <Text style={styles.roleBadgeText}>
              {user.role === "community_admin"
                ? "Community Admin"
                : "Regular User"}
            </Text>
          </View>
        </View>
      </View>

      {/* Linked Devices */}
      <View style={styles.section}>
        <SectionHeader
          title="Linked Devices"
          subtitle={`${devices?.length || 0} devices`}
        />
        {devices && devices.length > 0 ? (
          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <DeviceCard
                deviceId={item.device_id}
                address={item.address}
                status={item.status}
                lastSeen={item.last_seen}
                additionalInfo={`Added ${new Date(item.created_at).toLocaleDateString()}`}
              />
            )}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={[GlobalStyles.body, { color: Colors.text.secondary }]}>
              No devices linked yet
            </Text>
          </View>
        )}
      </View>

      {/* Notification Preferences */}
      <View style={styles.section}>
        <SectionHeader title="Notifications" />
        <View
          style={[
            GlobalStyles.card,
            { marginHorizontal: Spacing.lg, marginVertical: Spacing.sm },
          ]}
        >
          <NotificationRow
            icon="notifications"
            label="Outage Alerts"
            description="Notify me when power goes off"
            value={outageAlerts}
            onValueChange={setOutageAlerts}
          />
          <NotificationRow
            icon="check-circle"
            label="Restoration Alerts"
            description="Notify me when power is restored"
            value={restorationAlerts}
            onValueChange={setRestorationAlerts}
            borderTop
          />
          <NotificationRow
            icon="mail"
            label="Email Notifications"
            description="Receive email updates"
            value={emailNotifications}
            onValueChange={setEmailNotifications}
            borderTop
          />
          <NotificationRow
            icon="notifications"
            label="Push Notifications"
            description="Receive app notifications"
            value={pushNotifications}
            onValueChange={setPushNotifications}
            borderTop
          />
        </View>
      </View>

      {/* Account Settings */}
      <View style={styles.section}>
        <SectionHeader title="Account" />
        <TouchableOpacity
          style={[
            GlobalStyles.card,
            { marginHorizontal: Spacing.lg, marginVertical: Spacing.sm },
          ]}
          onPress={handleChangePassword}
        >
          <View style={GlobalStyles.rowBetween}>
            <View style={GlobalStyles.rowCenter}>
              <MaterialIcons name="lock" size={20} color={Colors.primary} />
              <Text style={[GlobalStyles.body, { marginLeft: Spacing.md }]}>
                Change Password
              </Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={Colors.text.tertiary}
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <SectionHeader title="Actions" />
        <TouchableOpacity
          style={[
            GlobalStyles.card,
            { marginHorizontal: Spacing.lg, marginVertical: Spacing.sm },
            styles.logoutButton,
          ]}
          onPress={handleLogout}
        >
          <View style={GlobalStyles.center}>
            <MaterialIcons name="logout" size={20} color={Colors.error} />
            <Text
              style={[
                GlobalStyles.body,
                { color: Colors.error, marginTop: Spacing.xs },
              ]}
            >
              Logout
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <View
          style={[
            GlobalStyles.card,
            { marginHorizontal: Spacing.lg, marginVertical: Spacing.sm },
          ]}
        >
          <View style={GlobalStyles.center}>
            <Text style={[GlobalStyles.label, { color: Colors.primary }]}>
              Ibadan Power v1.0.0
            </Text>
            <Text style={[GlobalStyles.caption, { marginTop: Spacing.xs }]}>
              Real-Time Electricity Monitoring Platform
            </Text>
          </View>
        </View>
      </View>

      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
};

/**
 * Notification row component
 */
interface NotificationRowProps {
  icon: string;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  borderTop?: boolean;
}

const NotificationRow: React.FC<NotificationRowProps> = ({
  icon,
  label,
  description,
  value,
  onValueChange,
  borderTop,
}) => {
  return (
    <View
      style={[
        GlobalStyles.rowBetween,
        { paddingVertical: Spacing.md },
        borderTop && {
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          paddingTop: Spacing.md,
        },
      ]}
    >
      <View style={GlobalStyles.rowCenter}>
        {/* Type assertion needed for dynamic icon names in older @expo/vector-icons */}
        <MaterialIcons name={icon as any} size={20} color={Colors.primary} />
        <View style={{ marginLeft: Spacing.md, flex: 1 }}>
          <Text style={GlobalStyles.body}>{label}</Text>
          <Text style={[GlobalStyles.caption, { marginTop: Spacing.xs }]}>
            {description}
          </Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor={value ? Colors.primary : Colors.text.tertiary}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.lg,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
  },
  userInfo: {
    flex: 1,
  },
  roleBadge: {
    marginTop: Spacing.md,
    alignSelf: "flex-start",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  section: {
    marginTop: Spacing.md,
  },
  emptyState: {
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButton: {
    borderColor: Colors.error,
    borderWidth: 1,
  },
});

export default ProfileScreen;
