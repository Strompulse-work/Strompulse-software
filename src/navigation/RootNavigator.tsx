import React, { useState, useEffect } from "react";
import { Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { XStack, YStack, Text as TText } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";
import { useAllGridDevices, parseStromTimestamp } from "../hooks/useDeviceData";

import AuthNavigator from "./AuthNavigator";

// --- TAB SCREENS ---
import SafetyScreen from "../screens/SafetyScreen";
import ElectricityScreen from "../screens/ElectricityScreen"; 
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
import LiveTrackingScreen from "../screens/LiveTrackingScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TabIcon = ({ 
  focused, 
  iconOutline,
  iconFilled, 
  isDarkMode,
  label,
  badgeCount
}: { 
  focused: boolean, 
  iconOutline: any,
  iconFilled: any, 
  isDarkMode: boolean,
  label: string,
  badgeCount?: number
}) => {
  const color = focused 
    ? "#00C48A" 
    : (isDarkMode ? "#64748B" : "#94A3B8");

  const formattedBadge = badgeCount && badgeCount > 99 ? "99+" : `${badgeCount}`;

  return (
    <YStack alignItems="center" justifyContent="center" width="100%" paddingVertical={4}>
      <YStack position="relative" alignItems="center" justifyContent="center">
        <Ionicons
          name={focused ? iconFilled : iconOutline}
          size={22} 
          color={color}
        />
        {badgeCount !== undefined && badgeCount > 0 && (
          <YStack
            position="absolute"
            top={-4}
            right={-8}
            minWidth={16}
            height={16}
            borderRadius={8}
            backgroundColor="#EF4444"
            justifyContent="center"
            alignItems="center"
            paddingHorizontal={3}
            borderWidth={1.5}
            borderColor={isDarkMode ? "#1A221E" : "#FFFFFF"}
          >
            <TText color="#FFFFFF" fontSize={8} fontFamily="Chirp-Heavy">
              {formattedBadge}
            </TText>
          </YStack>
        )}
      </YStack>
      <TText 
        fontFamily={focused ? "Chirp-Heavy" : "Chirp-Bold"} 
        fontSize={9} 
        color={color} 
        marginTop={4}
        letterSpacing={-0.3}
      >
        {label}
      </TText>
    </YStack>
  );
};

const MainTabs = () => {
  const { isDarkMode } = useTheme();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const { devices } = useAllGridDevices();

  // Handle immediate Supabase badge updates via a dedicated listener
  useEffect(() => {
    let isMounted = true;
    
    const alertSubscription = supabase
      .channel('public:alerts:badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, payload => {
        if (isMounted) {
          // Instantly increment unread count to prevent delay!
          setUnreadCount(prev => prev + 1);
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(alertSubscription);
    };
  }, []);

  // Handle background sync for Grid Outages & Storage
  useEffect(() => {
    let isMounted = true;

    const computeUnread = async () => {
      try {
        const readData = await AsyncStorage.getItem("strompulse_read_alerts");
        const dismissedData = await AsyncStorage.getItem("strompulse_dismissed_alerts");
        const readSet = new Set(readData ? JSON.parse(readData) : []);
        const dismissedSet = new Set(dismissedData ? JSON.parse(dismissedData) : []);

        const { data: alerts } = await supabase
          .from("alerts")
          .select("id, created_at")
          .order("created_at", { ascending: false })
          .limit(30);

        let unread = 0;

        (alerts || []).forEach((item: any) => {
          if (!dismissedSet.has(item.id) && !readSet.has(item.id)) {
            unread += 1;
          }
        });

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
              const outId = `outage-live-${device.id}-${device.updated_at}`;
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
    const interval = setInterval(computeUnread, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [devices]);

  return (
    <Tab.Navigator
      initialRouteName="Safety" 
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, 
        tabBarStyle: {
          position: "absolute",
          bottom: Platform.OS === "ios" ? 36 : 24,
          left: 20,
          right: 20,
          backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", 
          borderRadius: 36,
          height: 72, 
          borderWidth: 1,
          borderColor: isDarkMode ? "#2D3B34" : "#F1F5F9",
          elevation: 15,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: isDarkMode ? 0.4 : 0.08,
          shadowRadius: 24,
          paddingHorizontal: 6, 
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
        name="Safety"
        component={SafetyScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconOutline="shield-checkmark-outline" iconFilled="shield-checkmark" isDarkMode={isDarkMode} label="Security" />
          ),
        }}
      />
      <Tab.Screen
        name="Electricity"
        component={ElectricityScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconOutline="flash-outline" iconFilled="flash" isDarkMode={isDarkMode} label="Electricity" />
          ),
        }}
      />
      <Tab.Screen
        name="Stromer"
        component={PrivateDashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconOutline="hardware-chip-outline" iconFilled="hardware-chip" isDarkMode={isDarkMode} label="Stromer" />
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconOutline="notifications-outline" iconFilled="notifications" isDarkMode={isDarkMode} label="Notifications" badgeCount={unreadCount} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconOutline="person-outline" iconFilled="person" isDarkMode={isDarkMode} label="Profile" />
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
      <Stack.Screen name="LiveTrackingScreen" component={LiveTrackingScreen} />
    </Stack.Navigator>
  );
};

export default RootNavigator;