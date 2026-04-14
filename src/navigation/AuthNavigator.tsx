/**
 * Authentication Stack Navigator
 * Manages Welcome, Login, Signup, and Verify screens for unauthenticated users
 * Hides default headers for custom, clean UI
 */

import React from "react";
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from "@react-navigation/native-stack";

// Import auth screens
import WelcomeScreen from "../screens/WelcomeScreen";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import VerifyScreen from "../screens/VerifyScreen";

// Type definitions for auth stack
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  Verify: { identifier: string }; // Required to pass the phone/email to the verify screen
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * AuthNavigator Component
 * Provides a native stack for authentication flow screens
 */
export const AuthNavigator: React.FC = () => {
  const screenOptions: NativeStackNavigationOptions = {
    headerShown: false,
  };

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Verify" component={VerifyScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
