import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack"; // <-- Added Stack
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

import AuthNavigator from "./AuthNavigator";
import PowerStatusNavigator from "./PowerStatusNavigator";
import SafetyScreen from "../screens/SafetyScreen";
import FeedTabScreen from "../screens/FeedTabScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import ProfileTabScreen from "../screens/ProfileTabScreen";

// Import your new screens!
import JourneyShareScreen from "../screens/JourneyShareScreen";
import ContactsScreen from "../screens/ContactsScreen";
import SafetySettingsScreen from "../screens/SafetySettingsScreen";
import CommunitiesNavigator from "./CommunitiesNavigator";
import MapScreen from "../screens/MapScreen";
import InsightsScreen from "../screens/NotificationsScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator(); // <-- Initialize Stack

// 1. We move your exact Tab Navigator into its own component
const MainTabs = () => {
  return (
    <Tab.Navigator
      initialRouteName="Power Status"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#12141D",
          borderTopColor: "#1D1F28",
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 8,
          paddingTop: 6,
          elevation: 0,
        },
        tabBarActiveTintColor: "#00C48A",
        tabBarInactiveTintColor: "#8E92A4",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          fontFamily: "Arial",
        },
      }}
    >
      <Tab.Screen
        name="Communities"
        component={CommunitiesNavigator}
        options={{
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="city" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="flag" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Feed"
        component={FeedTabScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="view-dashboard-outline" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Feather name="bar-chart-2" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileTabScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Feather name="user" size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// 2. The Root Navigator now uses a Stack to hold the Tabs AND the new screens
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

export default RootNavigator;