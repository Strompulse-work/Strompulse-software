import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CitySelectorScreen from "../screens/CitySelectorScreen";
import CityDetailScreen from "../screens/CityDetailScreen";

const Stack = createNativeStackNavigator();

const PowerStatusNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CitySelector" component={CitySelectorScreen} />
      <Stack.Screen name="CityDetail" component={CityDetailScreen} />
    </Stack.Navigator>
  );
};

export default PowerStatusNavigator;
