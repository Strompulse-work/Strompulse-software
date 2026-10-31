// NEW / REPLACEMENT: "Follow Their Journey" screen.
// Opened from Notifications. Shows the person's live location, destination, progress and distance.
import React, { useEffect, useRef, useState } from "react";
import { StatusBar, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, Linking } from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { supabase } from "../config/supabase";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

const kmBetween = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const timeAgo = (iso?: string) => {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
};

const LiveTrackingScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode } = useTheme();
  const mapRef = useRef<MapView>(null);
  const { senderName = "Contact", senderId, initialLat, initialLng, mode = "journey" } = route.params || {};

  const [journey, setJourney] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [trail, setTrail] = useState<{ latitude: number; longitude: number }[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    let channel: any;
    const load = async () => {
      try {
        let query = supabase.from("journey_locations").select("*");
        query = senderId ? query.eq("user_id", senderId) : query.ilike("sender_name", senderName);
        const { data } = await query.order("updated_at", { ascending: false }).limit(1);
        if (data && data[0]) {
          setJourney(data[0]);
          setTrail([{ latitude: data[0].lat, longitude: data[0].lng }]);
          channel = supabase
            .channel(`journey-${data[0].user_id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "journey_locations", filter: `user_id=eq.${data[0].user_id}` }, (payload: any) => {
              if (payload.new) {
                setJourney(payload.new);
                setTrail((prev) => [...prev.slice(-200), { latitude: payload.new.lat, longitude: payload.new.lng }]);
              }
            })
            .subscribe();
        }
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    load();
    const t = setInterval(() => setTick((x) => x + 1), 30000); // refresh "updated x min ago"
    return () => { clearInterval(t); if (channel) supabase.removeChannel(channel); };
  }, [senderId, senderName]);

  const lat = journey?.lat ?? initialLat;
  const lng = journey?.lng ?? initialLng;
  const hasLocation = typeof lat === "number" && typeof lng === "number";
  const hasDest = journey?.dest_lat != null && journey?.dest_lng != null;

  const remainingKm = hasLocation && hasDest ? kmBetween(lat, lng, journey.dest_lat, journey.dest_lng) : null;
  const totalKm = journey?.total_km ?? (journey?.start_lat != null && hasDest ? kmBetween(journey.start_lat, journey.start_lng, journey.dest_lat, journey.dest_lng) : null);
  const progress = remainingKm !== null && totalKm ? Math.max(0, Math.min(1, 1 - remainingKm / totalKm)) : null;
  const etaAt = journey?.eta_at ? new Date(journey.eta_at) : null;
  const isLive = !!journey?.is_active;

  useEffect(() => {
    if (!mapRef.current || !hasLocation) return;
    const coords = [{ latitude: lat, longitude: lng }];
    if (hasDest) coords.push({ latitude: journey.dest_lat, longitude: journey.dest_lng });
    mapRef.current.fitToCoordinates(coords, { edgePadding: { top: 80, right: 60, bottom: 260, left: 60 }, animated: true });
  }, [lat, lng, journey?.dest_lat]);

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={16}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16} flex={1}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary} numberOfLines={1}>
              {mode === "journey" ? `Follow ${senderName}'s Journey` : `${senderName}'s Location`}
            </TText>
            <XStack alignItems="center" gap={6} marginTop={2}>
              <YStack width={6} height={6} borderRadius={3} backgroundColor={isLive ? "#00C48A" : theme.textSecondary} />
              <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} letterSpacing={1}>
                {isLive ? `LIVE · UPDATED ${timeAgo(journey?.updated_at).toUpperCase()}` : journey ? "JOURNEY ENDED" : "LAST SHARED LOCATION"}
              </TText>
            </XStack>
          </YStack>
        </XStack>

        <YStack flex={1}>
          {loading ? (
            <YStack flex={1} justifyContent="center" alignItems="center">
              <ActivityIndicator size="large" color="#00C48A" />
            </YStack>
          ) : !hasLocation ? (
            <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal={40}>
              <Feather name="map-pin" size={32} color={theme.textSecondary} />
              <TText fontFamily="Chirp-Medium" fontSize={14} color={theme.textSecondary} textAlign="center" marginTop={12}>
                {senderName} hasn't shared a live location yet.
              </TText>
            </YStack>
          ) : (
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
              userInterfaceStyle={isDarkMode ? "dark" : "light"}
            >
              {trail.length > 1 && <Polyline coordinates={trail} strokeColor="#00C48A" strokeWidth={4} />}
              <Marker coordinate={{ latitude: lat, longitude: lng }} title={senderName}>
                <YStack width={36} height={36} borderRadius={18} backgroundColor="#00C48A" justifyContent="center" alignItems="center" borderWidth={3} borderColor="#FFF">
                  <TText fontFamily="Chirp-Heavy" fontSize={14} color="#FFF">{senderName.charAt(0).toUpperCase()}</TText>
                </YStack>
              </Marker>
              {hasDest && (
                <Marker coordinate={{ latitude: journey.dest_lat, longitude: journey.dest_lng }} title={journey.dest_name}>
                  <YStack width={28} height={28} borderRadius={14} backgroundColor="#EF4444" justifyContent="center" alignItems="center" borderWidth={3} borderColor="#FFF">
                    <Feather name="flag" size={12} color="#FFF" />
                  </YStack>
                </Marker>
              )}
            </MapView>
          )}

          {hasLocation && (
            <YStack position="absolute" bottom={24} left={24} right={24} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} padding={20} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
              {hasDest && (
                <XStack alignItems="center" marginBottom={14}>
                  <Feather name="flag" size={14} color="#EF4444" style={{ marginRight: 8 }} />
                  <TText flex={1} fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary} numberOfLines={1}>{journey.dest_name || "Destination"}</TText>
                </XStack>
              )}
              {progress !== null && (
                <YStack marginBottom={14}>
                  <YStack height={8} borderRadius={4} backgroundColor={isDarkMode ? "#1A221E" : "#F1F5F9"} overflow="hidden">
                    <YStack height={8} width={`${Math.round(progress * 100)}%`} backgroundColor="#00C48A" />
                  </YStack>
                  <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={6}>{Math.round(progress * 100)}% of the way there</TText>
                </YStack>
              )}
              <XStack backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} borderRadius={16} padding={14} justifyContent="space-around" marginBottom={14}>
                <YStack alignItems="center">
                  <TText fontFamily="Chirp-Bold" fontSize={10} color={theme.textSecondary} letterSpacing={1} marginBottom={4}>DISTANCE LEFT</TText>
                  <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary}>{remainingKm !== null ? `${remainingKm.toFixed(1)} km` : "—"}</TText>
                </YStack>
                <YStack width={1} backgroundColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} />
                <YStack alignItems="center">
                  <TText fontFamily="Chirp-Bold" fontSize={10} color={theme.textSecondary} letterSpacing={1} marginBottom={4}>EXPECTED</TText>
                  <TText fontFamily="Chirp-Heavy" fontSize={15} color="#00C48A">{etaAt ? etaAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}</TText>
                </YStack>
              </XStack>
              <TouchableOpacity onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`).catch(() => {})}>
                <XStack backgroundColor="#00C48A" borderRadius={16} paddingVertical={14} justifyContent="center" alignItems="center" gap={8}>
                  <Feather name="navigation" size={14} color="#FFF" />
                  <TText fontFamily="Chirp-Bold" fontSize={14} color="#FFF">Get Directions to {senderName.split(" ")[0]}</TText>
                </XStack>
              </TouchableOpacity>
            </YStack>
          )}
        </YStack>
      </SafeAreaView>
    </YStack>
  );
};

export default LiveTrackingScreen;