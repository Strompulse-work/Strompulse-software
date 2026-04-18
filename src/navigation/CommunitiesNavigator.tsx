import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CitiesScreen from "../screens/CitiesScreen";
import CityCommunitiesScreen from "../screens/CityCommunitiesScreen";
import EstateDetailsScreen from "../screens/EstateDetailsScreen";

const Stack = createNativeStackNavigator();

const CommunitiesNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Cities" component={CitiesScreen} />
      <Stack.Screen name="CityCommunities" component={CityCommunitiesScreen} />
      <Stack.Screen name="EstateDetails" component={EstateDetailsScreen} />
    </Stack.Navigator>
  );
};

export default CommunitiesNavigator;
