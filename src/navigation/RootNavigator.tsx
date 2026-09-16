import React, { useState, useEffect } from "react";
import { View, Text, Platform, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";
import { useAllGridDevices, parseStromTimestamp } from "../hooks/useDeviceData";

import AuthNavigator from "./AuthNavigator";

// --- TAB SCREENS ---
import ElectricityScreen from "../screens/ElectricityScreen"; 
import SafetyScreen from "../screens/SafetyScreen";
import PrivateDashboardScreen from "../screens/PrivateDashboardScreen"; 
import NotificationsScreen from "../screens/NotificationsScreen"; 
import ProfileScreen from "../screens/ProfileScreen";

// --- STACK SCREENS ---
import JourneyShareScreen from "../screens/JourneyShareScreen";
import ContactsScreen from "../screens/ContactsScreen";
import SafetySettingsScreen from "../screens/SafetySettingsScreen";
import PlaceDetailScreen from "../screens/PlaceDetailScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import AboutScreen from "../screens/AboutScreen";
import RequestDeviceScreen from "../screens/RequestDeviceScreen";
import CommunityZonesScreen from "../screens/CommunityZonesScreen";
import PrivateDashboardInternalScreen from "../screens/PrivateDashboardInternalScreen";
import LinkPhoneScreen from "../screens/LinkPhoneScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/**
 * Custom Icon Renderer with badge support
 */
const TabIcon = ({ 
  focused, 
  activeIcon, 
  inactiveIcon, 
  isDarkMode,
  label,
  badgeCount
}: { 
  focused: boolean, 
  activeIcon: any, 
  inactiveIcon: any,
  isDarkMode: boolean,
  label: string,
  badgeCount?: number
}) => {
  const color = focused 
    ? "#00C48A" 
    : (isDarkMode ? "#8E92A4" : "#94A3B8");

  const formattedBadge = badgeCount && badgeCount > 99 ? "99+" : `${badgeCount}`;

  return (
    <View
      style={[
        styles.iconContainer,
        focused && {
          backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 196, 138, 0.1)",
          paddingHorizontal: 6, 
        }
      ]}
    >
      <View style={styles.iconWrapper}>
        <MaterialCommunityIcons
          name={focused ? activeIcon : inactiveIcon}
          size={22} 
          color={color}
        />
        {badgeCount !== undefined && badgeCount > 0 && (
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{formattedBadge}</Text>
          </View>
        )}
      </View>
      <Text 
        style={[styles.tabLabel, { color }]} 
        numberOfLines={1} 
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </View>
  );
};

// Floating Bottom Tab Navigator
const MainTabs = () => {
  const { isDarkMode } = useTheme();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const { devices } = useAllGridDevices();

  // Compute unread count in real-time across database alerts & power state
  useEffect(() => {
    let isMounted = true;

    const computeUnread = async () => {
      try {
        const readData = await AsyncStorage.getItem("strompulse_read_alerts");
        const dismissedData = await AsyncStorage.getItem("strompulse_dismissed_alerts");
        const readSet = new Set(readData ? JSON.parse(readData) : []);
        const dismissedSet = new Set(dismissedData ? JSON.parse(dismissedData) : []);

        // Fetch Supabase Security/SOS alerts
        const { data: alerts } = await supabase
          .from("alerts")
          .select("id")
          .limit(30);

        let unread = 0;

        (alerts || []).forEach((item: any) => {
          if (!dismissedSet.has(item.id) && !readSet.has(item.id)) {
            unread += 1;
          }
        });

        // Compute power alerts count
        const now = Date.now();
        (devices || []).forEach((device) => {
          if (device.history) {
            Object.keys(device.history).forEach((key) => {
              const resDate = parseStromTimestamp(key);
              if (resDate && (now - resDate.getTime()) < 15 * 60 * 1000) {
                const resId = `power-restored-${device.id}-${key}`;
                if (!dismissedSet.has(resId) && !readSet.has(resId)) unread += 1;
              }
            });
          }

          if (!device.isOnline && device.connectionState !== "checking") {
            const outDate = parseStromTimestamp(device.updated_at) || new Date();
            const outTime = new Date(outDate.getTime() + 60000);
            if ((now - outTime.getTime()) < 15 * 60 * 1000) {
              const outId = `power-outage-live-${device.id}-${device.updated_at}`;
              if (!dismissedSet.has(outId) && !readSet.has(outId)) unread += 1;
            }
          }
        });

        if (isMounted) setUnreadCount(unread);
      } catch (err) {
        console.error("Error computing unread count:", err);
      }
    };

    computeUnread();
    const interval = setInterval(computeUnread, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [devices]);

  return (
    <Tab.Navigator
      initialRouteName="Electricity" 
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, 
        tabBarStyle: {
          position: "absolute",
          bottom: Platform.OS === "ios" ? 34 : 24,
          left: 20,
          right: 20,
          backgroundColor: isDarkMode ? "rgba(26, 26, 26, 0.95)" : "rgba(255, 255, 255, 0.95)", 
          borderRadius: 40,
          height: 70, 
          borderWidth: 1,
          borderColor: isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)",
          borderTopWidth: 1, 
          elevation: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: isDarkMode ? 0.3 : 0.1,
          shadowRadius: 20,
          paddingHorizontal: 4, 
          paddingBottom: 0, 
          paddingTop: 0,
        },
        tabBarItemStyle: {
          justifyContent: "center",
          alignItems: "center", 
          height: "100%",
        },
      }}
    >
      <Tab.Screen
        name="Electricity"
        component={ElectricityScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="lightning-bolt" inactiveIcon="lightning-bolt-outline" isDarkMode={isDarkMode} label="Electricity" />
          ),
        }}
      />
      <Tab.Screen
        name="Safety"
        component={SafetyScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="shield" inactiveIcon="shield-outline" isDarkMode={isDarkMode} label="Safety" />
          ),
        }}
      />
      <Tab.Screen
        name="Stromer"
        component={PrivateDashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="lock" inactiveIcon="lock-outline" isDarkMode={isDarkMode} label="Stromer" />
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="bell" inactiveIcon="bell-outline" isDarkMode={isDarkMode} label="Notifications" badgeCount={unreadCount} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="account" inactiveIcon="account-outline" isDarkMode={isDarkMode} label="Profile" />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const RootNavigator = ({ isSignedIn }: { isSignedIn: boolean }) => {
  if (!isSignedIn) {
    return <AuthNavigator />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="JourneyShareScreen" component={JourneyShareScreen} />
      <Stack.Screen name="ContactsScreen" component={ContactsScreen} />
      <Stack.Screen name="SafetySettingsScreen" component={SafetySettingsScreen} />
      <Stack.Screen name="EditProfileScreen" component={EditProfileScreen} />
      <Stack.Screen name="AboutScreen" component={AboutScreen} />
      <Stack.Screen name="RequestDeviceScreen" component={RequestDeviceScreen} />
      <Stack.Screen name="LinkPhone" component={LinkPhoneScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PrivateDashboardInternal" component={PrivateDashboardInternalScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PlaceDetailScreen" component={PlaceDetailScreen} />
      <Stack.Screen name="CommunityZonesScreen" component={CommunityZonesScreen} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 2, 
    borderRadius: 20,
    width: "100%", 
  },
  iconWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 8, 
    fontFamily: "Chirp-Bold", 
    fontWeight: "600",
    marginTop: 4,
    letterSpacing: -0.3, 
  },
  tabBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  tabBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontFamily: "Chirp-Heavy",
    fontWeight: "800",
  },
});

export default RootNavigator;