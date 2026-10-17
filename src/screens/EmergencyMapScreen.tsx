import React, { useState, useEffect } from "react";
import { StatusBar, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, Alert, Linking } from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

const GOOGLE_API_KEY = Platform.OS === 'ios' ? "AIzaSyCeWigeIvMAGJ_X-qj8UqY6CoGTbzBSHfA" : "AIzaSyB76SNOlgP1dkPZXhlPPIU_650y45Cd1Mo";

const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const EmergencyMapScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode } = useTheme();
  const { userLat, userLng } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'hospital' | 'police'>('all');
  const [selectedPlace, setSelectedPlace] = useState<any | null>(null);

  useEffect(() => {
    if (!userLat || !userLng) {
      Alert.alert("Error", "User location not found. Please enable GPS.");
      navigation.goBack();
      return;
    }

    const fetchAllPlaces = async () => {
      try {
        const headers: any = {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.formattedAddress'
        };
        if (Platform.OS === 'ios') headers['X-Ios-Bundle-Identifier'] = 'com.strompulse.app';
        if (Platform.OS === 'android') headers['X-Android-Package'] = 'com.strompulse.app';

        const fetchPlaces = async (type: string) => {
          const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              includedTypes: [type],
              maxResultCount: 20,
              locationRestriction: {
                circle: {
                  center: { latitude: userLat, longitude: userLng },
                  radius: 8000.0
                }
              }
            })
          });
          const data = await res.json();
          return data.places || [];
        };

        const [hPlaces, pPlaces] = await Promise.all([
          fetchPlaces('hospital'),
          fetchPlaces('police')
        ]);

        const formattedPlaces: any[] = [];
        
        hPlaces.forEach((p: any) => {
          const lat = p.location?.latitude;
          const lng = p.location?.longitude;
          if (lat && lng) {
            const dist = getDistanceFromLatLonInKm(userLat, userLng, lat, lng);
            formattedPlaces.push({ id: p.id, type: 'hospital', name: p.displayName?.text || "Hospital", lat, lng, dist: dist.toFixed(1), time: Math.round(dist * 3), address: p.formattedAddress || "Address unavailable" });
          }
        });
        
        pPlaces.forEach((p: any) => {
          const lat = p.location?.latitude;
          const lng = p.location?.longitude;
          if (lat && lng) {
            const dist = getDistanceFromLatLonInKm(userLat, userLng, lat, lng);
            formattedPlaces.push({ id: p.id, type: 'police', name: p.displayName?.text || "Police Station", lat, lng, dist: dist.toFixed(1), time: Math.round(dist * 3), address: p.formattedAddress || "Address unavailable" });
          }
        });

        formattedPlaces.sort((a, b) => parseFloat(a.dist) - parseFloat(b.dist));
        setPlaces(formattedPlaces);
      } catch (err) {
        console.error("Map Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllPlaces();
  }, [userLat, userLng]);

  const filteredPlaces = activeFilter === 'all' ? places : places.filter(p => p.type === activeFilter);

  const getDirections = () => {
    if (!selectedPlace) return;
    const url = Platform.select({
      ios: `maps://app?saddr=${userLat},${userLng}&daddr=${selectedPlace.lat},${selectedPlace.lng}`,
      android: `google.navigation:q=${selectedPlace.lat},${selectedPlace.lng}`
    });
    Linking.openURL(url as string).catch(() => Alert.alert("Error", "Could not open maps application."));
  };

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <SafeAreaView style={{ flex: 1 }}>
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={16} zIndex={100}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Nearby Help</TText> 
            <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2} letterSpacing={1}>EMERGENCY FACILITIES</TText> 
          </YStack>
        </XStack>

        <YStack flex={1} position="relative">
          {loading ? (
            <YStack flex={1} justifyContent="center" alignItems="center">
              <ActivityIndicator size="large" color="#00C48A" />
              <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} marginTop={12}>Finding nearest facilities...</TText>
            </YStack>
          ) : (
            <MapView
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: userLat,
                longitude: userLng,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              }}
              showsUserLocation={true}
              showsMyLocationButton={false}
              userInterfaceStyle={isDarkMode ? "dark" : "light"}
            >
              {filteredPlaces.map(place => (
                <Marker 
                  key={place.id} 
                  coordinate={{ latitude: place.lat, longitude: place.lng }}
                  onPress={() => setSelectedPlace(place)}
                >
                  <YStack width={36} height={36} borderRadius={18} backgroundColor={place.type === 'hospital' ? "#EF4444" : "#3B82F6"} justifyContent="center" alignItems="center" borderWidth={3} borderColor="#FFF" shadowColor="#000" shadowOpacity={0.2} shadowRadius={5} shadowOffset={{width:0, height:3}}>
                    <Feather name={place.type === 'hospital' ? "plus" : "shield"} size={16} color="#FFF" />
                  </YStack>
                </Marker>
              ))}
            </MapView>
          )}

          <XStack position="absolute" top={16} left={24} right={24} gap={10}>
            {['all', 'hospital', 'police'].map((filter) => (
              <TouchableOpacity key={filter} style={{ flex: 1 }} onPress={() => { setActiveFilter(filter as any); setSelectedPlace(null); }}>
                <YStack backgroundColor={activeFilter === filter ? "#00C48A" : (isDarkMode ? "#1A221E" : "#FFFFFF")} paddingVertical={10} borderRadius={12} alignItems="center" borderWidth={1} borderColor={activeFilter === filter ? "#00C48A" : (isDarkMode ? "#2D3B34" : "#E2E8F0")} shadowColor="#000" shadowOpacity={0.1} shadowRadius={5} shadowOffset={{width:0, height:2}}>
                  <TText fontFamily="Chirp-Bold" fontSize={12} color={activeFilter === filter ? "#FFF" : theme.textSecondary} textTransform="capitalize">{filter}</TText>
                </YStack>
              </TouchableOpacity>
            ))}
          </XStack>

          {selectedPlace && (
            <YStack position="absolute" bottom={24} left={24} right={24} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} padding={20} shadowColor="#000" shadowOpacity={0.15} shadowRadius={20} shadowOffset={{width:0, height:10}} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
              <XStack justifyContent="space-between" alignItems="flex-start" marginBottom={16}>
                <XStack alignItems="center" flex={1} marginRight={12}>
                  <YStack width={48} height={48} borderRadius={24} backgroundColor={selectedPlace.type === 'hospital' ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)"} justifyContent="center" alignItems="center" marginRight={12}>
                    <Feather name={selectedPlace.type === 'hospital' ? "plus" : "shield"} size={20} color={selectedPlace.type === 'hospital' ? "#EF4444" : "#3B82F6"} />
                  </YStack>
                  <YStack flex={1}>
                    <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary} marginBottom={4}>{selectedPlace.name}</TText>
                    <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} numberOfLines={1}>{selectedPlace.address}</TText>
                  </YStack>
                </XStack>
                <TouchableOpacity onPress={() => setSelectedPlace(null)}>
                  <YStack width={30} height={30} borderRadius={15} backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} justifyContent="center" alignItems="center">
                    <Feather name="x" size={14} color={theme.textSecondary} />
                  </YStack>
                </TouchableOpacity>
              </XStack>

              <XStack backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} borderRadius={12} padding={12} alignItems="center" justifyContent="space-around" marginBottom={20}>
                <YStack alignItems="center">
                  <TText fontFamily="Chirp-Bold" fontSize={10} color={theme.textSecondary} letterSpacing={1} marginBottom={4}>DISTANCE</TText>
                  <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary}>{selectedPlace.dist} km</TText>
                </YStack>
                <YStack width={1} height="100%" backgroundColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} />
                <YStack alignItems="center">
                  <TText fontFamily="Chirp-Bold" fontSize={10} color={theme.textSecondary} letterSpacing={1} marginBottom={4}>ESTIMATED</TText>
                  <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary}>{selectedPlace.time} min</TText>
                </YStack>
              </XStack>

              <TouchableOpacity onPress={getDirections}>
                <YStack backgroundColor="#00C48A" borderRadius={16} paddingVertical={16} alignItems="center" justifyContent="center">
                  <TText fontSize={15} fontFamily="Chirp-Bold" color="#FFFFFF">Get Directions</TText>
                </YStack>
              </TouchableOpacity>
            </YStack>
          )}
        </YStack>
      </SafeAreaView>
    </YStack>
  );
};

export default EmergencyMapScreen;