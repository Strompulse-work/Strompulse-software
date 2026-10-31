import React, { useState, useEffect, useRef } from "react";
import { StatusBar, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, ScrollView, Linking } from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useTheme } from "../theme/ThemeContext";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { getDrivingRoute } from "../utils/routing";

const ROUTE_REFRESH_MS = 45 * 1000;

const EmergencyDirectionScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode } = useTheme();
  const mapRef = useRef<MapView>(null);
  const lastFetchRef = useRef(0);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  const p = route.params || {};
  const destLat: number = p.destLat;
  const destLng: number = p.destLng;
  const destinationName: string = p.destinationName || p.destName || "Destination";
  const address: string = p.address || p.destAddress || "";

  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(p.userLat && p.userLng ? { lat: p.userLat, lng: p.userLng } : null);
  const [loading, setLoading] = useState(true);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [etaText, setEtaText] = useState("--");
  const [distanceText, setDistanceText] = useState("--");
  const [steps, setSteps] = useState<{ text: string; distance: string }[]>([]);
  const [showSteps, setShowSteps] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const fetchDirections = async (oLat: number, oLng: number, fit: boolean) => {
    lastFetchRef.current = Date.now();
    try {
      const r = await getDrivingRoute({ lat: oLat, lng: oLng }, { lat: destLat, lng: destLng }, true);
      setRouteCoords(r.isEstimate ? [] : r.points);
      setEtaText(r.durationText);
      setDistanceText(r.distanceText);
      setSteps(r.steps);
      setRouteError(r.isEstimate ? "Live route unavailable — showing an estimate. Use Google Maps below for turn-by-turn." : null);
      if (fit && mapRef.current) {
        const pts = r.points.length > 1 ? r.points : [{ latitude: oLat, longitude: oLng }, { latitude: destLat, longitude: destLng }];
        mapRef.current.fitToCoordinates(pts, { edgePadding: { top: 80, right: 50, bottom: 300, left: 50 }, animated: true });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      let start = userPos;
      if (!start) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") { setRouteError("Location permission is needed for directions."); setLoading(false); return; }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        start = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        if (mounted) setUserPos(start);
      }
      if (destLat && destLng) await fetchDirections(start.lat, start.lng, true);

      // live position → refresh the route as the user moves
      subRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 25 },
        (loc) => {
          const pos = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          setUserPos(pos);
          if (Date.now() - lastFetchRef.current > ROUTE_REFRESH_MS) fetchDirections(pos.lat, pos.lng, false);
        }
      );
    })();
    return () => { mounted = false; subRef.current?.remove(); };
  }, [destLat, destLng]);

  const recenter = () => {
    if (routeCoords.length && mapRef.current) mapRef.current.fitToCoordinates(routeCoords, { edgePadding: { top: 80, right: 50, bottom: 300, left: 50 }, animated: true });
  };

  const openExternal = () => {
    const origin = userPos ? `&origin=${userPos.lat},${userPos.lng}` : "";
    Linking.openURL(`https://www.google.com/maps/dir/?api=1${origin}&destination=${destLat},${destLng}&travelmode=driving`).catch(() => {});
  };

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={16} zIndex={100}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16} flex={1}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary} numberOfLines={1}>{destinationName}</TText>
            <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2} letterSpacing={1}>LIVE DIRECTIONS</TText>
          </YStack>
        </XStack>

        <YStack flex={1}>
          {loading && (
            <YStack position="absolute" top={0} left={0} right={0} bottom={0} justifyContent="center" alignItems="center" zIndex={50} backgroundColor={isDarkMode ? "rgba(11,15,13,0.7)" : "rgba(248,250,252,0.7)"}>
              <ActivityIndicator size="large" color="#00C48A" />
              <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} marginTop={12}>Calculating best route...</TText>
            </YStack>
          )}

          {userPos && (
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              initialRegion={{ latitude: userPos.lat, longitude: userPos.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
              showsUserLocation
              followsUserLocation={false}
              showsMyLocationButton={false}
              userInterfaceStyle={isDarkMode ? "dark" : "light"}
            >
              {destLat && destLng && (
                <Marker coordinate={{ latitude: destLat, longitude: destLng }} title={destinationName}>
                  <YStack width={28} height={28} borderRadius={14} backgroundColor="#EF4444" justifyContent="center" alignItems="center" borderWidth={3} borderColor="#FFF">
                    <Feather name="map-pin" size={14} color="#FFF" />
                  </YStack>
                </Marker>
              )}
              {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeColor="#00C48A" strokeWidth={5} lineCap="round" lineJoin="round" />}
            </MapView>
          )}

          <TouchableOpacity onPress={recenter} style={{ position: "absolute", top: 16, right: 24 }}>
            <YStack width={44} height={44} borderRadius={22} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} justifyContent="center" alignItems="center" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"}>
              <Feather name="crosshair" size={18} color={theme.textPrimary} />
            </YStack>
          </TouchableOpacity>

          <YStack position="absolute" bottom={24} left={24} right={24} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} padding={20} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} zIndex={20} maxHeight={showSteps ? 460 : undefined}>
            <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary} marginBottom={4}>{destinationName}</TText>
            {!!address && <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} numberOfLines={2} marginBottom={16}>{address}</TText>}

            {routeError && <TText fontFamily="Chirp-Medium" fontSize={12} color="#F59E0B" marginBottom={12}>{routeError}</TText>}
            {etaText !== "--" && (
              <XStack backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} borderRadius={16} padding={14} justifyContent="space-around" marginBottom={12}>
                <YStack alignItems="center">
                  <TText fontFamily="Chirp-Bold" fontSize={10} color={theme.textSecondary} letterSpacing={1} marginBottom={6}>DISTANCE</TText>
                  <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary}>{distanceText}</TText>
                </YStack>
                <YStack width={1} backgroundColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} />
                <YStack alignItems="center">
                  <TText fontFamily="Chirp-Bold" fontSize={10} color={theme.textSecondary} letterSpacing={1} marginBottom={6}>ETA</TText>
                  <TText fontFamily="Chirp-Heavy" fontSize={16} color="#00C48A">{etaText}</TText>
                </YStack>
              </XStack>
            )}

            {steps.length > 0 && (
              <>
                <TouchableOpacity onPress={() => setShowSteps((v) => !v)}>
                  <XStack alignItems="center" justifyContent="space-between" paddingVertical={8}>
                    <XStack alignItems="center" gap={8} flex={1}>
                      <Feather name="corner-up-right" size={14} color="#00C48A" />
                      <TText flex={1} fontFamily="Chirp-Bold" fontSize={13} color={theme.textPrimary} numberOfLines={1}>{steps[0].text}</TText>
                    </XStack>
                    <Feather name={showSteps ? "chevron-down" : "chevron-up"} size={16} color={theme.textSecondary} />
                  </XStack>
                </TouchableOpacity>
                {showSteps && (
                  <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                    {steps.map((s, i) => (
                      <XStack key={i} paddingVertical={8} borderTopWidth={1} borderColor={isDarkMode ? "#1F2E27" : "#F1F5F9"}>
                        <TText width={22} fontFamily="Chirp-Bold" fontSize={12} color="#00C48A">{i + 1}</TText>
                        <TText flex={1} fontFamily="Chirp-Medium" fontSize={12} color={theme.textPrimary}>{s.text}</TText>
                        <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginLeft={8}>{s.distance}</TText>
                      </XStack>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            <TouchableOpacity onPress={openExternal}>
              <XStack marginTop={12} borderWidth={1} borderColor="#00C48A" borderRadius={16} paddingVertical={12} justifyContent="center" alignItems="center" gap={8}>
                <Feather name="volume-2" size={14} color="#00C48A" />
                <TText fontFamily="Chirp-Bold" fontSize={13} color="#00C48A">Voice Navigation in Google Maps</TText>
              </XStack>
            </TouchableOpacity>
          </YStack>
        </YStack>
      </SafeAreaView>
    </YStack>
  );
};

export default EmergencyDirectionScreen;