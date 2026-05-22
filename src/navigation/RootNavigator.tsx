import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

// Import Auth Navigator
import AuthNavigator from "./AuthNavigator";

// Screens
import FeedScreen from "../screens/FeedScreen";
import MapScreen from "../screens/MapScreen";
import CommunitiesNavigator from "./CommunitiesNavigator";
import InsightsScreen from "../screens/InsightsScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();

// 1. Accept the isSignedIn prop from App.tsx
const RootNavigator = ({ isSignedIn }: { isSignedIn: boolean }) => {
  const { theme, isDarkMode } = useTheme();

  // 2. THE MAGIC: If they are not signed in, show the Welcome/Auth screens.
  // When they log out, React Navigation instantly destroys the tabs and shows this instead.
  if (!isSignedIn) {
    return <AuthNavigator />;
  }

  // 3. If they are signed in, show the main app tabs
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.cardBg,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarActiveTintColor: theme.success,
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
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="city-variant-outline" size={26} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Feather name="map" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="view-dashboard" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="chart-bar" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Feather name="user" size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default RootNavigator;