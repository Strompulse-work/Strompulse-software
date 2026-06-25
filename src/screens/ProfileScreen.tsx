/**
 * Profile Screen v2.0
 * Features: High-contrast UI, Stat Cards, Sectioned Menus, and Light/Dark Mode integration.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Platform,
  StatusBar,
} from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import AuthService from "../services/authService";
import { useTheme } from "../theme/ThemeContext";
import { Loading } from "../components/UIComponents";
import { User } from "../types";

const ProfileScreen = () => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
    return null;
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

      {/* Hero Avatar Section */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {user.full_name?.charAt(0).toUpperCase() || "A"}
          </Text>
        </View>
        
        <Text style={styles.userName}>{user.full_name || "Awoniyi"}</Text>
        <Text style={styles.userLocation}>Carlton Gate Estate, Ibadan</Text>
        
        <View style={styles.securityBadge}>
          <MaterialCommunityIcons name="shield-check-outline" size={14} color="#00C48A" />
          <Text style={styles.securityText}>Strompulse Security</Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsContainer}>
        <StatCard count="2" label="COMMUNITIES" theme={theme} />
        <StatCard count="3" label="ALERT CONTACTS" theme={theme} />
        <StatCard count="7" label="REPORTS" theme={theme} />
      </View>

      {/* Account Section */}
      <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>ACCOUNT</Text>
        <View style={styles.menuCard}>
          <MenuItem 
            iconName="user" 
            IconProvider={Feather} 
            label="Edit Profile" 
            color={theme.textSecondary} 
            theme={theme}
            onPress={handleChangePassword} 
          />
          <MenuItem 
            iconName="bell" 
            IconProvider={Feather} 
            label="My Subscriptions" 
            color="#EAB308" // Gold
            theme={theme}
            borderTop 
          />
          <MenuItem 
            iconName="link" 
            IconProvider={Feather} 
            label="Invite Friends" 
            color={theme.textSecondary} 
            theme={theme}
            borderTop 
          />
          <MenuItem 
            iconName="lock" 
            IconProvider={Feather} 
            label="Privacy Settings" 
            color="#EAB308" // Gold
            theme={theme}
            borderTop 
          />
        </View>
      </View>

      {/* Strompulse Section */}
      <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>STROMPULSE</Text>
        <View style={styles.menuCard}>
          <MenuItem 
            iconName="lightning-bolt" 
            IconProvider={MaterialCommunityIcons} 
            label="About Strompulse" 
            color="#EAB308" // Gold
            theme={theme}
          />
          <MenuItem 
            iconName="help-circle" 
            IconProvider={Feather} 
            label="Help & Support" 
            color="#EF4444" // Red
            theme={theme}
            borderTop 
          />
          <MenuItem 
            iconName="star" 
            IconProvider={Feather} 
            label="Rate the App" 
            color="#EAB308" // Gold
            theme={theme}
            borderTop 
          />
          {/* Preserved Logout Functionality */}
          <MenuItem 
            iconName="log-out" 
            IconProvider={Feather} 
            label="Log Out" 
            color="#EF4444" // Red
            theme={theme}
            borderTop 
            onPress={handleLogout}
          />
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footerContainer}>
        <Text style={styles.footerVersion}>Strompulse v1.0.0 • Real-time Power Visibility</Text>
        <View style={styles.statusIndicator}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>All systems normal</Text>
        </View>
      </View>
    </ScrollView>
  );
};

/**
 * Reusable Stat Card Component
 */
const StatCard = ({ count, label, theme }: { count: string, label: string, theme: any }) => {
  const styles = getStyles(theme);
  return (
    <View style={styles.statCard}>
      <Text style={styles.statNumber}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
};

/**
 * Reusable Menu Item Component
 */
const MenuItem = ({ iconName, IconProvider, label, color, borderTop, theme, onPress }: any) => {
  const styles = getStyles(theme);
  return (
    <TouchableOpacity 
      style={[styles.menuItem, borderTop && styles.borderTop]} 
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.menuItemLeft}>
        <IconProvider name={iconName} size={20} color={color} />
        <Text style={styles.menuItemText}>{label}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={theme.textTertiary || theme.border} />
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
    avatarSection: {
      alignItems: "center",
      marginTop: Platform.OS === "ios" ? 60 : 40,
    },
    avatarCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 2,
      borderColor: "#00C48A", // PRD Accent Green
      backgroundColor: theme.cardBg,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#00C48A",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 5,
    },
    avatarText: {
      fontSize: 32,
      fontWeight: "800",
      color: "#00C48A",
    },
    userName: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.textPrimary,
      marginTop: 16,
      letterSpacing: -0.5,
    },
    userLocation: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.textSecondary,
      marginTop: 4,
    },
    securityBadge: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(0, 196, 138, 0.3)",
      backgroundColor: "rgba(0, 196, 138, 0.05)",
    },
    securityText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#00C48A",
      marginLeft: 6,
    },
    statsContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginHorizontal: 20,
      marginTop: 32,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.cardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 16,
      alignItems: "center",
      marginHorizontal: 4,
    },
    statNumber: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.textPrimary,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.textSecondary,
      marginTop: 6,
      letterSpacing: 0.5,
    },
    menuSection: {
      marginHorizontal: 20,
      marginTop: 32,
    },
    menuSectionTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.textSecondary,
      marginBottom: 12,
      letterSpacing: 1,
      marginLeft: 4,
    },
    menuCard: {
      backgroundColor: theme.cardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    menuItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      backgroundColor: theme.cardBg,
    },
    menuItemLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    menuItemText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.textPrimary,
      marginLeft: 16,
    },
    borderTop: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    footerContainer: {
      alignItems: "center",
      marginTop: 40,
      opacity: 0.8,
    },
    footerVersion: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.textSecondary,
      marginBottom: 8,
    },
    statusIndicator: {
      flexDirection: "row",
      alignItems: "center",
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#00C48A",
      marginRight: 6,
    },
    statusText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#00C48A",
    },
  });

export default ProfileScreen;