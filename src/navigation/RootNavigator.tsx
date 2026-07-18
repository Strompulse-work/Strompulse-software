import React from "react";
import { View, Platform, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

import AuthNavigator from "./AuthNavigator";
import PowerStatusNavigator from "./PowerStatusNavigator";
import SafetyScreen from "../screens/SafetyScreen";
import FeedTabScreen from "../screens/FeedTabScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import ProfileScreen from "../screens/ProfileScreen"; // Updated import for ProfileScreen

// Import your new screens!
import JourneyShareScreen from "../screens/JourneyShareScreen";
import ContactsScreen from "../screens/ContactsScreen";
import SafetySettingsScreen from "../screens/SafetySettingsScreen";
import CommunitiesNavigator from "./CommunitiesNavigator";
import MapScreen from "../screens/MapScreen";
import InsightsScreen from "../screens/InsightsScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/**
 * Custom Icon Renderer for the Floating Pill Effect with Light/Dark Support
 */
const TabIcon = ({ 
  focused, 
  activeIcon, 
  inactiveIcon, 
  isDarkMode 
}: { 
  focused: boolean, 
  activeIcon: any, 
  inactiveIcon: any,
  isDarkMode: boolean 
}) => {
  return (
    <View
      style={[
        styles.iconContainer,
        focused && {
          // Dynamic frosted pill background for active tab
          backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.08)",
          paddingHorizontal: 22, // Expands the pill width horizontally
        }
      ]}
    >
      <MaterialCommunityIcons
        name={focused ? activeIcon : inactiveIcon}
        size={26}
        color={
          focused 
            ? (isDarkMode ? "#FFFFFF" : "#0F172A") // Active color
            : (isDarkMode ? "#8E92A4" : "#94A3B8") // Inactive color
        }
      />
    </View>
  );
};

// 1. Floating Glassmorphism Bottom Tab Navigator
const MainTabs = () => {
  const { isDarkMode } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Feed"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, // Hides text to maintain the clean pill look
        tabBarStyle: {
          position: "absolute",
          bottom: Platform.OS === "ios" ? 34 : 24,
          left: 20,
          right: 20,
          // Translucent background for Glassmorphism
          backgroundColor: isDarkMode ? "rgba(26, 26, 26, 0.85)" : "rgba(255, 255, 255, 0.85)", 
          borderRadius: 40,
          height: 70,
          // Subtle border to enhance the glass edge effect
          borderWidth: 1,
          borderColor: isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)",
          borderTopWidth: 1, // Overrides default RN border
          elevation: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: isDarkMode ? 0.3 : 0.1,
          shadowRadius: 20,
          paddingHorizontal: 8,
          // THE FIX: Overrides React Navigation's default safe area padding
          paddingBottom: 0, 
          paddingTop: 0,
        },
        tabBarItemStyle: {
          justifyContent: "center", // Perfect vertical center
          alignItems: "center",     // Perfect horizontal center
          height: "100%",
        },
      }}
    >
      <Tab.Screen
        name="Communities"
        component={CommunitiesNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="office-building" inactiveIcon="office-building-outline" isDarkMode={isDarkMode} />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="map" inactiveIcon="map-outline" isDarkMode={isDarkMode} />
          ),
        }}
      />
      <Tab.Screen
        name="Feed"
        component={FeedTabScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="home" inactiveIcon="home-outline" isDarkMode={isDarkMode} />
          ),
        }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="chart-box" inactiveIcon="chart-box-outline" isDarkMode={isDarkMode} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} activeIcon="account" inactiveIcon="account-outline" isDarkMode={isDarkMode} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// 2. The Root Navigator uses a Stack to hold the Tabs AND the new screens
const RootNavigator = ({ isSignedIn }: { isSignedIn: boolean }) => {
  if (!isSignedIn) {
    return <AuthNavigator />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* The main app with bottom tabs */}
      <Stack.Screen name="MainTabs" component={MainTabs} />
      
      {/* The new screens that open over the tabs */}
      <Stack.Screen name="JourneyShareScreen" component={JourneyShareScreen} />
      <Stack.Screen name="ContactsScreen" component={ContactsScreen} />
      <Stack.Screen name="SafetySettingsScreen" component={SafetySettingsScreen} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
  },
});

export default RootNavigator;