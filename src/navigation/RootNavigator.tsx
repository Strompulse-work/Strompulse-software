import React, { useState, useEffect } from "react";
import { Platform, Alert } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { XStack, YStack, Text as TText } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import * as Notifications from "expo-notifications";
import { useNavigation } from "@react-navigation/native";
import { useAllGridDevices } from "../hooks/useDeviceData";
import { useUnreadNotificationCount } from "../utils/notificationCenter";
import { ensureSupabaseSession } from "../utils/sessionGuard";
import AuthService from "../services/authService";

import AuthNavigator from "./AuthNavigator";

// --- PUSH NOTIFICATIONS ---
import { registerForPushNotificationsAsync } from "../utils/pushRegistration";

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
import EmergencyMapScreen from "../screens/EmergencyMapScreen";
import EmergencyDirectionScreen from "../screens/EmergencyDirectionScreen";

// --- NEW SAFETY SUB-SCREENS ---
import SafetyToolsScreen from "../screens/SafetyToolsScreen";
import SafetyTipsScreen from "../screens/SafetyTipsScreen";
import CommunitiesScreen from "../screens/CommunitiesScreen";
import SafetyAnalyticsScreen from "../screens/SafetyAnalyticsScreen";

// --- NEW PROFILE SUB-SCREENS ---
import MyActivityScreen from "../screens/MyActivityScreen";
import MySubscriptionsScreen from "../screens/MySubscriptionsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import PrivacySecurityScreen from "../screens/PrivacySecurityScreen";
import HelpSupportScreen from "../screens/HelpSupportScreen";

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
  // Unselected items are pure black (#000000) in light mode, and slate (#64748B) in dark mode
  const color = focused 
    ? "#00C48A" 
    : (isDarkMode ? "#64748B" : "#000000");

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

// Push notifications already opened in this app session (so a cold-start tap isn't replayed)
const handledPushIds = new Set<string>();

const MainTabs = () => {
  const { isDarkMode } = useTheme();
  const { devices } = useAllGridDevices();
  const navigation = useNavigation<any>();

  // Real unread count: only alerts addressed to me + recent electricity events; cleared when the tab is opened
  const unreadCount = useUnreadNotificationCount(devices);

  // Make sure Supabase's own login is present (restores it from the saved login if it went missing),
  // then register for push notifications
  useEffect(() => {
    ensureSupabaseSession().then((session) => {
      if (session) {
        registerForPushNotificationsAsync(session.user.id);
        return;
      }
      Alert.alert(
        "Please sign in again",
        "Your login has expired, so SOS and journey alerts can't be sent or received. Sign out and sign back in to fix this.",
        [
          { text: "Later", style: "cancel" },
          { text: "Sign out", style: "destructive", onPress: () => { AuthService.logout().catch(() => {}); } },
        ]
      );
    });
  }, []);

  // Android notification channels + open the right screen when a push notification is tapped
  useEffect(() => {
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("sos", {
        name: "SOS & safety alerts",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 500, 250, 500],
      }).catch(() => {});
      Notifications.setNotificationChannelAsync("default", {
        name: "General",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
      }).catch(() => {});
    }

    const openFromPush = (data: any) => {
      if (!data) return;
      const id = data.alertId || `${data.type}-${data.createdAt}`;
      if (handledPushIds.has(id)) return;
      handledPushIds.add(id);
      const type = String(data.type || "");
      const mode =
        type === "emergency" ? (data.kind === "delay" ? "journey" : "sos")
        : type.startsWith("journey") ? "journey"
        : type.includes("location") ? "location"
        : null;
      if (!mode || !data.senderId) {
        navigation.navigate("MainTabs", { screen: "Notifications" });
        return;
      }
      navigation.navigate("LiveTrackingScreen", {
        mode,
        senderId: data.senderId,
        senderName: data.senderName || "Contact",
        initialLat: typeof data.lat === "number" ? data.lat : undefined,
        initialLng: typeof data.lng === "number" ? data.lng : undefined,
        alertTime: data.createdAt || undefined,
        groupName: data.groupName || undefined,
      });
    };

    Notifications.getLastNotificationResponseAsync()
      .then((res) => { if (res) openFromPush(res.notification.request.content.data); })
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener((res) => openFromPush(res.notification.request.content.data));
    return () => sub.remove();
  }, []);

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
      <Stack.Screen name="SafetyToolsScreen" component={SafetyToolsScreen} />
      <Stack.Screen name="SafetyTipsScreen" component={SafetyTipsScreen} />
      <Stack.Screen name="CommunitiesScreen" component={CommunitiesScreen} />
      <Stack.Screen name="SafetyAnalyticsScreen" component={SafetyAnalyticsScreen} />
      <Stack.Screen name="EditProfileScreen" component={EditProfileScreen} />
      <Stack.Screen name="AboutScreen" component={AboutScreen} />
      <Stack.Screen name="RequestDeviceScreen" component={RequestDeviceScreen} />
      <Stack.Screen name="LinkPhone" component={LinkPhoneScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PrivateDashboardInternal" component={PrivateDashboardInternalScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PlaceDetailScreen" component={PlaceDetailScreen} />
      <Stack.Screen name="CommunityZonesScreen" component={CommunityZonesScreen} />
      <Stack.Screen name="LiveTrackingScreen" component={LiveTrackingScreen} />
      <Stack.Screen name="EmergencyMapScreen" component={EmergencyMapScreen} />
      <Stack.Screen name="EmergencyDirectionScreen" component={EmergencyDirectionScreen} />
      {/* Alias so any older "EmergencyDirectionsScreen" link still works */}
      <Stack.Screen name="EmergencyDirectionsScreen" component={EmergencyDirectionScreen} />
      
      {/* --- NEW PROFILE SUB-SCREENS --- */}
      <Stack.Screen name="MyActivityScreen" component={MyActivityScreen} />
      <Stack.Screen name="MySubscriptionsScreen" component={MySubscriptionsScreen} />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen name="PrivacySecurityScreen" component={PrivacySecurityScreen} />
      <Stack.Screen name="HelpSupportScreen" component={HelpSupportScreen} />
    </Stack.Navigator>
  );
};

export default RootNavigator;