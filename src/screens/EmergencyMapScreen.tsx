import React, { useState, useEffect, useRef } from "react";
import { StatusBar, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, ScrollView } from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useTheme } from "../theme/ThemeContext";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

const GOOGLE_API_KEY = Platform.OS === "ios" ? "AIzaSyCeWigeIvMAGJ_X-qj8UqY6CoGTbzBSHfA" : "AIzaSyB76SNOlgP1dkPZXhlPPIU_650y45Cd1Mo";
const RANK_LABELS = ["Closest", "Second closest", "Third closest"];

const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const EmergencyMapScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode } = useTheme();
  const mapRef = useRef<MapView>(null);
  const cardBg = isDarkMode ? "#121A16" : "#FFFFFF";
  const divider = isDarkMode ? "#2D3B34" : "#F1F5F9";

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    route.params?.userLat && route.params?.userLng ? { lat: route.params.userLat, lng: route.params.userLng } : null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [police, setPolice] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Get location here if it wasn't passed in
  useEffect(() => {
    if (coords) return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setError("Location permission is needed to find help near you."); setLoading(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  useEffect(() => {
    if (!coords) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const headers: any = {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_API_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress",
        };
        if (Platform.OS === "ios") headers["X-Ios-Bundle-Identifier"] = "com.strompulse.app";
        if (Platform.OS === "android") headers["X-Android-Package"] = "com.strompulse.app";

        const fetchTop3 = async (type: "hospital" | "police", fallback: string) => {
          const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
            method: "POST",
            headers,
            body: JSON.stringify({
              includedTypes: [type],
              maxResultCount: 10,
              rankPreference: "DISTANCE",
              locationRestriction: { circle: { center: { latitude: coords.lat, longitude: coords.lng }, radius: 8000.0 } },
            }),
          });
          const data = await res.json();
          return (data.places || [])
            .filter((p: any) => p.location)
            .map((p: any) => {
              const dist = getDistanceFromLatLonInKm(coords.lat, coords.lng, p.location.latitude, p.location.longitude);
              return {
                id: p.id, type, name: p.displayName?.text || fallback,
                lat: p.location.latitude, lng: p.location.longitude,
                distNum: dist, dist: dist.toFixed(1), time: Math.max(1, Math.round(dist * 3)),
                address: p.formattedAddress || "Address unavailable",
              };
            })
            .sort((a: any, b: any) => a.distNum - b.distNum)
            .slice(0, 3);
        };

        const [h, p] = await Promise.all([fetchTop3("hospital", "Hospital"), fetchTop3("police", "Police Station")]);
        setHospitals(h);
        setPolice(p);
      } catch (err) {
        setError("Couldn't load nearby facilities. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [coords]);

  const focusPlace = (p: any) => {
    setSelectedId(p.id);
    mapRef.current?.animateToRegion({ latitude: p.lat, longitude: p.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600);
  };

  const getDirections = (p: any) => {
    if (!coords) return;
    navigation.navigate("EmergencyDirectionsScreen", {
      userLat: coords.lat, userLng: coords.lng, destLat: p.lat, destLng: p.lng,
      destName: p.name, destAddress: p.address, destinationName: p.name, address: p.address,
    });
  };

  const renderSection = (title: string, icon: any, color: string, list: any[]) => (
    <YStack marginBottom={20}>
      <XStack alignItems="center" gap={8} marginBottom={10} marginLeft={4}>
        <YStack width={24} height={24} borderRadius={12} backgroundColor={`${color}22`} justifyContent="center" alignItems="center">
          <Feather name={icon} size={12} color={color} />
        </YStack>
        <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5}>{title}</TText>
      </XStack>
      <YStack backgroundColor={cardBg} borderRadius={20} borderWidth={1} borderColor={divider} overflow="hidden">
        {list.length === 0 ? (
          <TText padding={16} fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>None found within 8 km.</TText>
        ) : list.map((p, i) => (
          <TouchableOpacity key={p.id} activeOpacity={0.8} onPress={() => focusPlace(p)}>
            <XStack padding={16} alignItems="center" borderBottomWidth={i === list.length - 1 ? 0 : 1} borderBottomColor={divider} backgroundColor={selectedId === p.id ? (isDarkMode ? "rgba(0,196,138,0.06)" : "#F0FDF4") : "transparent"}>
              <YStack flex={1} paddingRight={10}>
                <TText fontFamily="Chirp-Bold" fontSize={9} color={color} letterSpacing={0.8} marginBottom={2}>{RANK_LABELS[i].toUpperCase()}</TText>
                <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary} numberOfLines={1}>{p.name}</TText>
                <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} numberOfLines={1} marginTop={2}>{p.address}</TText>
                <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textPrimary} marginTop={4}>{p.dist} km • ~{p.time} min</TText>
              </YStack>
              <TouchableOpacity onPress={() => getDirections(p)}>
                <XStack backgroundColor="#00C48A" borderRadius={14} paddingHorizontal={12} paddingVertical={8} alignItems="center" gap={6}>
                  <Feather name="navigation" size={12} color="#FFF" />
                  <TText fontFamily="Chirp-Bold" fontSize={11} color="#FFF">Directions</TText>
                </XStack>
              </TouchableOpacity>
            </XStack>
          </TouchableOpacity>
        ))}
      </YStack>
    </YStack>
  );

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={16}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Nearby Help</TText>
            <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2} letterSpacing={1}>HOSPITALS & POLICE STATIONS</TText>
          </YStack>
        </XStack>

        <YStack height={260} marginHorizontal={24} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} marginBottom={20}>
          {!coords ? (
            <YStack flex={1} justifyContent="center" alignItems="center"><ActivityIndicator color="#00C48A" /></YStack>
          ) : (
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              initialRegion={{ latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
              showsUserLocation
              showsMyLocationButton={false}
              userInterfaceStyle={isDarkMode ? "dark" : "light"}
            >
              {[...hospitals, ...police].map((p) => (
                <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} onPress={() => setSelectedId(p.id)} title={p.name}>
                  <YStack width={selectedId === p.id ? 40 : 32} height={selectedId === p.id ? 40 : 32} borderRadius={20} backgroundColor={p.type === "hospital" ? "#EF4444" : "#3B82F6"} justifyContent="center" alignItems="center" borderWidth={3} borderColor="#FFF">
                    <Feather name={p.type === "hospital" ? "plus" : "shield"} size={14} color="#FFF" />
                  </YStack>
                </Marker>
              ))}
            </MapView>
          )}
        </YStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          {loading ? (
            <YStack alignItems="center" marginTop={24}>
              <ActivityIndicator color="#00C48A" />
              <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} marginTop={12}>Finding nearest facilities...</TText>
            </YStack>
          ) : error ? (
            <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} textAlign="center" marginTop={24}>{error}</TText>
          ) : (
            <>
              {renderSection("HOSPITALS", "plus", "#EF4444", hospitals)}
              {renderSection("POLICE STATIONS", "shield", "#3B82F6", police)}
              <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} textAlign="center">Travel times are estimates. Directions shows live routing.</TText>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default EmergencyMapScreen;