import React, { useState, useEffect } from "react";
import { StatusBar, TouchableOpacity, SafeAreaView, Platform } from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import CustomMapView from "../components/CustomMapView";

const LiveTrackingScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode } = useTheme();
  
  // Defaulting to Ile-Ife coordinates for accuracy if none are provided
  const { senderName = "Contact", initialLat = 7.5186, initialLng = 4.5266 } = route.params || {};

  // 1. Live coordinates state (Updates every few seconds)
  const [liveCoords, setLiveCoords] = useState({ lat: initialLat, lng: initialLng });
  
  // 2. Stable Map Region state (Only updates when the component mounts OR when recenter is clicked)
  const [mapRegion, setMapRegion] = useState({
    latitude: initialLat,
    longitude: initialLng,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });

  useEffect(() => {
    // Subtle real-time coordinate updates to simulate live tracking movement
    const interval = setInterval(() => {
      setLiveCoords(prev => ({
        lat: prev.lat + (Math.random() * 0.0002 - 0.0001),
        lng: prev.lng + (Math.random() * 0.0002 - 0.0001),
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Function to snap the map back to the moving marker if the user pans away
  const handleRecenter = () => {
    setMapRegion({
      latitude: liveCoords.lat,
      longitude: liveCoords.lng,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    });
  };

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* --- HEADER --- */}
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={16}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Live Tracking</TText>
            <TText fontFamily="Chirp-Medium" fontSize={11} color="#EF4444" marginTop={2} textTransform="uppercase">
              ACTIVE TRACKING: {senderName.toUpperCase()}
            </TText>
          </YStack>
        </XStack>

        {/* --- LIVE MAP AREA --- */}
        <YStack flex={1} marginHorizontal={24} marginBottom={24} borderRadius={32} overflow="hidden" borderWidth={3} borderColor="#EF4444" position="relative">
          
          <CustomMapView 
            style={{ width: "100%", height: "100%" }}
            showCoverage={false}
            showLegend={false}
            region={mapRegion} // Passes the stable state so it doesn't auto-snap
            markers={[{
              id: "tracked_user",
              title: senderName,
              latitude: liveCoords.lat, // Marker coordinates update live!
              longitude: liveCoords.lng,
              connectionState: "offline" // Forces the CustomMapView to use the Red Danger Color
            }]}
          />

          {/* Floating Re-Center Button */}
          <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={handleRecenter}
            style={{ position: "absolute", bottom: 100, right: 20, zIndex: 10 }}
          >
            <YStack width={44} height={44} borderRadius={22} backgroundColor={isDarkMode ? "#1A221E" : "#FFFFFF"} justifyContent="center" alignItems="center" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} shadowColor="#000" shadowOpacity={0.15} shadowRadius={10} shadowOffset={{ width: 0, height: 4 }}>
              <MaterialIcons name="my-location" size={20} color={theme.textPrimary} />
            </YStack>
          </TouchableOpacity>

          {/* Floating Tracking Info Card */}
          <YStack position="absolute" bottom={20} left={20} right={20} backgroundColor={isDarkMode ? "rgba(18,26,22,0.95)" : "rgba(255,255,255,0.95)"} borderRadius={24} padding={16} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} shadowColor="#000" shadowOpacity={0.1} shadowRadius={10} shadowOffset={{ width: 0, height: 4 }}>
            <XStack alignItems="center">
              <YStack width={12} height={12} borderRadius={6} backgroundColor="#EF4444" marginRight={12} />
              <YStack flex={1}>
                <TText fontFamily="Chirp-Bold" fontSize={14} color={theme.textPrimary}>Locating {senderName}...</TText>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} marginTop={2}>Coordinates updating in real-time</TText>
              </YStack>
            </XStack>
          </YStack>
        </YStack>

      </SafeAreaView>
    </YStack>
  );
};

export default LiveTrackingScreen;