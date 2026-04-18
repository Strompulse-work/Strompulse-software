import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

// Screens
import FeedScreen from "../screens/FeedScreen";
import MapScreen from "../screens/MapScreen";
import CommunitiesScreen from "../screens/CommunitiesScreen";
import CommunitiesNavigator from "./CommunitiesNavigator";
import InsightsScreen from "../screens/InsightsScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();

const RootNavigator = () => {
  const { theme, isDarkMode } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false, // Hides the default top header since we built custom ones
        tabBarStyle: {
          backgroundColor: theme.cardBg, // This makes the background switch instantly
          borderTopColor: theme.border, // Darkens the separator line in dark mode
          borderTopWidth: 1,
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 0,
        },
        // The active icon color (using the deep green success color)
        tabBarActiveTintColor: theme.success,
        // The inactive icon color
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tab.Screen
        name="Communities"
        component={CommunitiesNavigator}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="city-variant-outline"
              size={26}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Feather name="map" size={22} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="view-dashboard"
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-bar" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default RootNavigator;
