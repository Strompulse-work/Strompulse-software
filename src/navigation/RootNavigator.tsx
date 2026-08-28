import React from "react";
import { View, Text, Platform, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

import AuthNavigator from "./AuthNavigator";

// --- TAB SCREENS (The New 5 Tabs) ---
import ElectricityScreen from "../screens/ElectricityScreen"; 
import SafetyScreen from "../screens/SafetyScreen";
import ExploreScreen from "../screens/ExploreScreen"; 
import AlertsScreen from "../screens/AlertsScreen"; 
import ProfileScreen from "../screens/ProfileScreen";

// --- STACK SCREENS (Screens that open over the tabs) ---
import JourneyShareScreen from "../screens/JourneyShareScreen";
import ContactsScreen from "../screens/ContactsScreen";
import SafetySettingsScreen from "../screens/SafetySettingsScreen";
import PlaceDetailScreen from "../screens/PlaceDetailScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import AboutScreen from "../screens/AboutScreen";
import RequestDeviceScreen from "../screens/RequestDeviceScreen";
import CommunityZonesScreen from "../screens/CommunityZonesScreen";
import PrivateDashboardScreen from "../screens/PrivateDashboardScreen"; 
import PrivateDashboardInternalScreen from "../screens/PrivateDashboardInternalScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/**
 * Custom Icon Renderer for the Floating Pill Effect with Light/Dark Support and Labels
 */
const TabIcon = ({ 
  focused, 
  activeIcon, 
  inactiveIcon, 
  isDarkMode,
  label
}: { 
  focused: boolean, 
  activeIcon: any, 
  inactiveIcon: any,
  isDarkMode: boolean,
  label: string
}) => {
  const color = focused 
    ? (isDarkMode ? "#00C48A" : "#00C48A") 
    : (isDarkMode ? "#8E92A4" : "#94A3B8");

  return (
    <View
      style={[
        styles.iconContainer,
        focused && {
          backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 196, 138, 0.1)",
          paddingHorizontal: 6, // Greatly reduced to prevent squeezing the text
        }
      ]}
    >
      <MaterialCommunityIcons
        name={focused ? activeIcon : inactiveIcon}
        size={22} // Slightly smaller icon to balance with the text below
        color={color}
      />
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

// 1. Floating Glassmorphism Bottom Tab Navigator (v3.0 Architecture)
const MainTabs = () => {
  const { isDarkMode } = useTheme();

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
          paddingHorizontal: 4, // Minimized side padding to give all 5 tabs maximum width
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
      {/* Tab 1: Electricity */}
      <Tab.Screen
        name="Electricity"
        component={ElectricityScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="lightning-bolt" inactiveIcon="lightning-bolt-outline" isDarkMode={isDarkMode} label="Electricity" />
          ),
        }}
      />
      {/* Tab 2: Safety */}
      <Tab.Screen
        name="Safety"
        component={SafetyScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="shield" inactiveIcon="shield-outline" isDarkMode={isDarkMode} label="Safety" />
          ),
        }}
      />
      {/* Tab 3: Explore */}
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="compass" inactiveIcon="compass-outline" isDarkMode={isDarkMode} label="Explore" />
          ),
        }}
      />
      {/* Tab 4: Alerts / Notifications */}
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="bell" inactiveIcon="bell-outline" isDarkMode={isDarkMode} label="Notifications" />
          ),
        }}
      />
      {/* Tab 5: Profile */}
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

// 2. The Root Navigator uses a Stack to hold the Tabs AND the full-screen overlays
const RootNavigator = ({ isSignedIn }: { isSignedIn: boolean }) => {
  if (!isSignedIn) {
    return <AuthNavigator />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* The main app with bottom tabs */}
      <Stack.Screen name="MainTabs" component={MainTabs} />
      
      {/* Safety Stack Screens */}
      <Stack.Screen name="JourneyShareScreen" component={JourneyShareScreen} />
      <Stack.Screen name="ContactsScreen" component={ContactsScreen} />
      <Stack.Screen name="SafetySettingsScreen" component={SafetySettingsScreen} />
      <Stack.Screen name="EditProfileScreen" component={EditProfileScreen} />
      <Stack.Screen name="AboutScreen" component={AboutScreen} />
      <Stack.Screen name="RequestDeviceScreen" component={RequestDeviceScreen} />
      <Stack.Screen 
        name="PrivateDashboard" 
        component={PrivateDashboardScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="PrivateDashboardInternal" 
        component={PrivateDashboardInternalScreen} 
        options={{ headerShown: false }} 
      />
      
      {/* Explore / Electricity Stack Screens */}
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
    width: "100%", // Ensures it uses available flex space gracefully
  },
  tabLabel: {
    fontSize: 8, // Sized down to fit longer words cleanly
    fontFamily: "Sora_600SemiBold", 
    fontWeight: "600",
    marginTop: 4,
    letterSpacing: -0.3, // Slight negative tracking to squeeze text perfectly
  }
});

export default RootNavigator;