/**
 * Root Navigation Setup
 * Configures the bottom tab navigation structure
 */

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import { RootStackParamList } from "../types";
import { Colors } from "../styles/theme";

// Import screens and navigators
import FeedScreen from "../screens/FeedScreen";
import MapScreen from "../screens/MapScreen";
import CommunitiesScreen from "../screens/CommunitiesScreen";
import InsightsScreen from "../screens/InsightsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import AuthNavigator from "./AuthNavigator";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootStackParamList>();

/**
 * Bottom Tab Navigator with 5 main screens
 */
export const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: "white",
        headerTitleStyle: {
          fontWeight: "600",
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
          paddingBottom: 5,
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof MaterialIcons.glyphMap;

          switch (route.name) {
            case "(tabs)/feed":
              iconName = "dashboard";
              break;
            case "(tabs)/map":
              iconName = "map";
              break;
            case "(tabs)/communities":
              iconName = "location-city";
              break;
            case "(tabs)/insights":
              iconName = "analytics";
              break;
            case "(tabs)/profile":
              iconName = "person";
              break;
            default:
              iconName = "help";
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="(tabs)/feed"
        component={FeedScreen}
        options={{
          title: "Feed",
          tabBarLabel: "Feed",
        }}
      />
      <Tab.Screen
        name="(tabs)/map"
        component={MapScreen}
        options={{
          title: "Map",
          tabBarLabel: "Map",
        }}
      />
      <Tab.Screen
        name="(tabs)/communities"
        component={CommunitiesScreen}
        options={{
          title: "Communities",
          tabBarLabel: "Communities",
        }}
      />
      <Tab.Screen
        name="(tabs)/insights"
        component={InsightsScreen}
        options={{
          title: "Insights",
          tabBarLabel: "Insights",
        }}
      />
      <Tab.Screen
        name="(tabs)/profile"
        component={ProfileScreen}
        options={{
          title: "Profile",
          tabBarLabel: "Profile",
        }}
      />
    </Tab.Navigator>
  );
};

/**
 * Root Stack Navigator - handles authentication flow
 */
export const RootNavigator: React.FC<{ isSignedIn: boolean }> = ({
  isSignedIn,
}) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: "none",
      }}
    >
      {isSignedIn ? (
        <Stack.Group>
          <Stack.Screen name="(tabs)" component={TabNavigator} />
        </Stack.Group>
      ) : (
        <Stack.Group
          screenOptions={{
            animation: "none",
          }}
        >
          <Stack.Screen name="auth" component={AuthNavigator} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;
