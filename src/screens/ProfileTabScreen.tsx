/**
 * Profile Screen v2.0
 * Features: High-fidelity layout, Toggle switches, Real-time Linked Devices, and Theme integration.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Switch,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AuthService from "../services/authService";
import { useTheme } from "../theme/ThemeContext";
import { useUserDevices } from "../hooks/useDeviceData";
import { Loading } from "../components/UIComponents";
import { User } from "../types";

const ProfileScreen = () => {
  const { theme, isDarkMode, toggleDarkMode } = useTheme();
  const styles = getStyles(theme);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Notification Toggles State
  const [outageAlerts, setOutageAlerts] = useState(true);
  const [restorationAlerts, setRestorationAlerts] = useState(true);
  const [emailSummaries, setEmailSummaries] = useState(false);

  // Fetch user session
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

  // Fetch real-time devices for this user
  const { devices, loading: devicesLoading } = useUserDevices(user?.id || "");

  // Filter to show ONLY STROM001
  const linkedDevices = devices.filter((device) => device.id === "STROM001");

  if (loading || (devicesLoading && devices.length === 0)) {
    return (
      <View style={[styles.container, styles.center]}>
        <Loading />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />
      
      {/* Header Area */}
      <View style={styles.headerArea}>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {user?.full_name?.charAt(0).toUpperCase() || "T"}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.full_name || "Taiwo Afolabi"}</Text>
            <Text style={styles.userEmail}>{user?.email || "taiwoafolabi609@gmail.com"}</Text>
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumText}>PREMIUM MEMBER</Text>
            </View>
          </View>
        </View>

        {/* Linked Devices Section */}
        <Text style={styles.sectionHeader}>LINKED DEVICES</Text>
        <View style={styles.cardBlock}>
          {linkedDevices.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: theme.textSecondary }}>No active devices found.</Text>
            </View>
          ) : (
            linkedDevices.map((device, index) => {
              // Bulletproof real-time status check
              const rawStatus = String(device.status).toLowerCase().trim();
              const isOnline = rawStatus === "1" || rawStatus === "true" || rawStatus === "on";

              return (
                <View key={device.id}>
                  <View style={styles.deviceRow}>
                    <View style={styles.deviceRowLeft}>
                      <MaterialCommunityIcons 
                        name="router-wireless" 
                        size={24} 
                        color={theme.textPrimary} 
                        style={styles.deviceIcon} 
                      />
                      <View>
                        <Text style={styles.deviceName}>{device.id}</Text>
                        <Text style={styles.deviceLocation}>{device.address || "Jericho Quarters"}</Text>
                      </View>
                    </View>
                    <View style={styles.statusIndicator}>
                      <View 
                        style={[
                          styles.statusDot, 
                          { backgroundColor: isOnline ? "#00C48A" : "#EF4444" }
                        ]} 
                      />
                      <Text style={[
                        styles.statusText, 
                        { color: isOnline ? "#00C48A" : "#EF4444" }
                      ]}>
                        {isOnline ? "ONLINE" : "OFFLINE"}
                      </Text>
                    </View>
                  </View>
                  {index < linkedDevices.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })
          )}
        </View>

        {/* App Settings Section */}
        <Text style={styles.sectionHeader}>APP SETTINGS</Text>
        <View style={styles.cardBlock}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleRowLeft}>
              <MaterialCommunityIcons name="moon-waning-crescent" size={22} color={theme.textPrimary} />
              <Text style={styles.toggleLabel}>Dark Mode</Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={() => toggleDarkMode()} // Explicit function call prevents boolean argument errors
              trackColor={{ false: theme.border, true: "#00C48A" }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Notifications Section */}
        <Text style={styles.sectionHeader}>NOTIFICATIONS</Text>
        <View style={styles.cardBlock}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleRowLeft}>
              <MaterialCommunityIcons name="bell-outline" size={22} color={theme.textPrimary} />
              <Text style={styles.toggleLabel}>Outage Alerts</Text>
            </View>
            <Switch
              value={outageAlerts}
              onValueChange={setOutageAlerts}
              trackColor={{ false: theme.border, true: "#00C48A" }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.divider} />
          
          <View style={styles.toggleRow}>
            <View style={styles.toggleRowLeft}>
              <MaterialCommunityIcons name="lightning-bolt-outline" size={22} color={theme.textPrimary} />
              <Text style={styles.toggleLabel}>Restoration Alerts</Text>
            </View>
            <Switch
              value={restorationAlerts}
              onValueChange={setRestorationAlerts}
              trackColor={{ false: theme.border, true: "#00C48A" }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleRowLeft}>
              <MaterialCommunityIcons name="email-outline" size={22} color={theme.textPrimary} />
              <Text style={styles.toggleLabel}>Email Summaries</Text>
            </View>
            <Switch
              value={emailSummaries}
              onValueChange={setEmailSummaries}
              trackColor={{ false: theme.border, true: "#00C48A" }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Log Out Button mapped as a card */}
        <View style={[styles.cardBlock, { marginTop: 12 }]}>
           <TouchableOpacity 
             style={styles.toggleRow}
             onPress={async () => {
                await AuthService.logout();
             }}
           >
              <View style={styles.toggleRowLeft}>
                <MaterialCommunityIcons name="logout" size={22} color="#EF4444" />
                <Text style={[styles.toggleLabel, { color: "#EF4444" }]}>Log Out</Text>
              </View>
           </TouchableOpacity>
        </View>

      </ScrollView>
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
    headerArea: {
      alignItems: "center",
      paddingTop: Platform.OS === "ios" ? 60 : 40,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.textPrimary,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 100,
      paddingTop: 24,
    },
    userCard: {
      flexDirection: "row",
      backgroundColor: theme.cardBg,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      marginBottom: 32,
    },
    avatarCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: "rgba(0, 196, 138, 0.15)",
      borderWidth: 1,
      borderColor: "#00C48A",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
    },
    avatarText: {
      fontSize: 24,
      fontWeight: "800",
      color: "#00C48A",
    },
    userInfo: {
      flex: 1,
      justifyContent: "center",
    },
    userName: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.textPrimary,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 8,
    },
    premiumBadge: {
      alignSelf: "flex-start",
      backgroundColor: "rgba(139, 92, 246, 0.15)", // Subtle purple tint
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    premiumText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#8B5CF6",
      letterSpacing: 0.5,
    },
    sectionHeader: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.textSecondary,
      letterSpacing: 1,
      marginBottom: 12,
      marginLeft: 4,
    },
    cardBlock: {
      backgroundColor: theme.cardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
      marginBottom: 32,
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
    deviceIcon: {
      marginRight: 16,
    },
    deviceName: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.textPrimary,
      marginBottom: 4,
    },
    deviceLocation: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    statusIndicator: {
      flexDirection: "row",
      alignItems: "center",
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
    },
    statusText: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    toggleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
    },
    toggleRowLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    toggleLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.textPrimary,
      marginLeft: 16,
    },
    divider: {
      height: 1,
      backgroundColor: theme.border,
      marginLeft: 54, // Aligns divider with text, skips icons
    },
  });

export default ProfileScreen;