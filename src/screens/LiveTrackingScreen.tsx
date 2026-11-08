// Live map opened from Notifications.
//  • mode "journey"  → "Track Journey": the sender's real-time movement along their trip
//                      (green trail, destination flag, progress, distance left, ETA).
//  • mode "sos"      → "View Location": EMERGENCY view (red). Shows the sender's live location
//                      while their SOS sharing is on, otherwise the location at the time of the alert,
//                      with the address, how long ago, directions and call-for-help buttons.
//  • mode "location" → a scheduled / one-off shared location (blue pin).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { StatusBar, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, Linking, Alert, ScrollView } from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../theme/ThemeContext";
import { supabase } from "../config/supabase";
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from "react-native-maps";
import { DEFAULT_SECURITY_SETTINGS, loadSecuritySettings, googleMapsLink } from "../utils/securityConfig";
import { getMyIdentity, recipientsInclude } from "../utils/myIdentity";

type Mode = "journey" | "sos" | "location";
type Pt = { latitude: number; longitude: number };

const LIVE_WINDOW_MS = 10 * 60 * 1000; // an update within 10 minutes counts as "live"

const kmBetween = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const timeAgo = (d?: Date | string | null) => {
  if (!d) return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

const clock = (d?: Date | string | null) => (d ? new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—");

const THEMES: Record<Mode, { color: string; soft: string; softDark: string; label: string }> = {
  journey: { color: "#00C48A", soft: "#ECFDF5", softDark: "rgba(0,196,138,0.12)", label: "JOURNEY" },
  sos: { color: "#DC2626", soft: "#FEECEC", softDark: "rgba(239,68,68,0.12)", label: "SOS EMERGENCY" },
  location: { color: "#3B82F6", soft: "#EFF6FF", softDark: "rgba(59,130,246,0.12)", label: "SHARED LOCATION" },
};

const LiveTrackingScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode } = useTheme();
  const mapRef = useRef<MapView>(null);
  const {
    senderName = "Contact", senderId, initialLat, initialLng,
    mode: rawMode = "journey", alertTime, alertMessage,
  } = route.params || {};
  const mode: Mode = rawMode === "sos" || rawMode === "location" ? rawMode : "journey";
  const t = THEMES[mode];
  const firstName = String(senderName).split(" ")[0];

  const cardBg = isDarkMode ? "#121A16" : "#FFFFFF";
  const divider = isDarkMode ? "#2D3B34" : "#F1F5F9";
  const softBg = isDarkMode ? "#1A221E" : "#F8FAFC";

  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [trail, setTrail] = useState<Pt[]>([]);
  const [follow, setFollow] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [policeNumber, setPoliceNumber] = useState(DEFAULT_SECURITY_SETTINGS.policeNumber);
  const [ambulanceNumber, setAmbulanceNumber] = useState(DEFAULT_SECURITY_SETTINGS.ambulanceNumber);
  const [, setTick] = useState(0);
  const [noAccess, setNoAccess] = useState(false);

  // ---------- data: latest row + realtime updates ----------
  useEffect(() => {
    let channel: any;
    let cancelled = false;
    // Is this row shared with me? journey → journey_phones, sos → sos_phones.
    // (Columns missing = older database without the recipients SQL → allowed.)
    const allowed = (r: any, myKey: string) => {
      const list = mode === "sos" ? r?.sos_phones : mode === "journey" ? r?.journey_phones : undefined;
      if (list === undefined || list === null) return true;
      return recipientsInclude(list, myKey);
    };
    const load = async () => {
      try {
        // Looked up ONLY by the sender's account id — never by name, so it can't open someone else's journey
        if (!senderId) return;
        const me = await getMyIdentity();
        const { data } = await supabase.from("journey_locations").select("*").eq("user_id", senderId).limit(1);
        const first = data?.[0];
        if (first && !cancelled && !allowed(first, me.phoneKey)) { setNoAccess(true); return; }
        if (first && !cancelled) {
          setRow(first);
          setTrail([{ latitude: first.lat, longitude: first.lng }]);
          channel = supabase
            .channel(`track-${mode}-${first.user_id}-${Date.now()}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "journey_locations", filter: `user_id=eq.${first.user_id}` }, (payload: any) => {
              const n = payload.new;
              if (!n || typeof n.lat !== "number") return;
              if (!allowed(n, me.phoneKey)) { setRow(null); setNoAccess(true); return; }
              setRow(n);
              setTrail((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.latitude === n.lat && last.longitude === n.lng) return prev;
                return [...prev.slice(-300), { latitude: n.lat, longitude: n.lng }];
              });
            })
            .subscribe();
        }
      } catch (e) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    loadSecuritySettings().then((s) => { setPoliceNumber(s.policeNumber); setAmbulanceNumber(s.ambulanceNumber); }).catch(() => {});
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => (status === "granted" ? Location.getLastKnownPositionAsync() : null))
      .then((loc) => { if (loc) setMyCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude }); })
      .catch(() => {});
    const timer = setInterval(() => setTick((x) => x + 1), 20000); // refresh "x min ago"
    return () => { cancelled = true; clearInterval(timer); if (channel) supabase.removeChannel(channel); };
  }, [senderId, senderName, mode]);

  // ---------- derive what to show for each mode ----------
  const rowFresh = row?.updated_at ? Date.now() - new Date(row.updated_at).getTime() < LIVE_WINDOW_MS : false;
  const alertAt = alertTime ? new Date(alertTime) : null;
  const rowNewerThanAlert = row?.updated_at && alertAt ? new Date(row.updated_at).getTime() >= alertAt.getTime() - 60000 : false;

  let isLive = false;
  let lat: number | undefined;
  let lng: number | undefined;
  if (noAccess) {
    // Not shared with this user (or sharing was stopped) — fall back to what the notification itself carried
    lat = mode === "journey" ? undefined : initialLat;
    lng = mode === "journey" ? undefined : initialLng;
  } else if (mode === "journey") {
    isLive = !!row?.is_active;
    lat = row?.lat ?? initialLat;
    lng = row?.lng ?? initialLng;
  } else if (mode === "sos") {
    // Live while the sender's SOS sharing is on (or, for older app versions, any fresh update after the alert)
    isLive = row ? (row.sos_active === true || (row.sos_active === undefined && rowFresh && rowNewerThanAlert)) && rowFresh : false;
    lat = isLive ? row.lat : (initialLat ?? (rowNewerThanAlert ? row?.lat : undefined));
    lng = isLive ? row.lng : (initialLng ?? (rowNewerThanAlert ? row?.lng : undefined));
  } else {
    lat = initialLat ?? row?.lat;
    lng = initialLng ?? row?.lng;
  }
  const hasLocation = typeof lat === "number" && typeof lng === "number";
  const hasDest = mode === "journey" && row?.dest_lat != null && row?.dest_lng != null;

  const remainingKm = hasLocation && hasDest ? kmBetween(lat!, lng!, row.dest_lat, row.dest_lng) : null;
  const totalKm = mode === "journey" ? (row?.total_km ?? (row?.start_lat != null && hasDest ? kmBetween(row.start_lat, row.start_lng, row.dest_lat, row.dest_lng) : null)) : null;
  const progress = remainingKm !== null && totalKm ? Math.max(0, Math.min(1, 1 - remainingKm / totalKm)) : null;
  const etaAt = mode === "journey" && row?.eta_at ? new Date(row.eta_at) : null;
  const etaLate = !!etaAt && isLive && etaAt.getTime() < Date.now();
  const arrived = mode === "journey" && !!row && !row.is_active;
  const distanceFromMe = hasLocation && myCoords ? kmBetween(myCoords.lat, myCoords.lng, lat!, lng!) : null;
  const updatedAt = mode === "sos" && !isLive ? alertAt || row?.updated_at : row?.updated_at || alertAt;

  // ---------- address of the current point (important for SOS) ----------
  const geoKey = hasLocation ? `${lat!.toFixed(4)},${lng!.toFixed(4)}` : "";
  useEffect(() => {
    if (!hasLocation) return;
    let active = true;
    Location.reverseGeocodeAsync({ latitude: lat!, longitude: lng! })
      .then((res) => {
        const a = res?.[0];
        if (!active || !a) return;
        const street = [a.streetNumber, a.street].filter(Boolean).join(" ") || a.name;
        setAddress([street, a.district || a.subregion, a.city].filter(Boolean).join(", "));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [geoKey]);

  // ---------- camera ----------
  const fitAll = () => {
    if (!mapRef.current || !hasLocation) return;
    const pts: Pt[] = [{ latitude: lat!, longitude: lng! }];
    if (hasDest) pts.push({ latitude: row.dest_lat, longitude: row.dest_lng });
    if (pts.length > 1) mapRef.current.fitToCoordinates(pts, { edgePadding: { top: 80, right: 60, bottom: 320, left: 60 }, animated: true });
    else mapRef.current.animateToRegion({ latitude: lat!, longitude: lng!, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 600);
  };

  useEffect(() => {
    if (!hasLocation || !mapRef.current) return;
    if (mode === "journey" && !follow) return;
    if (mode === "journey" && hasDest && trail.length <= 1) { fitAll(); return; }
    mapRef.current.animateCamera({ center: { latitude: lat!, longitude: lng! } }, { duration: 700 });
  }, [geoKey, follow, hasDest]);

  // ---------- actions ----------
  const openDirections = () => {
    if (!hasLocation) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`).catch(() =>
      Alert.alert("Couldn't open maps", "Please install Google Maps or try again.")
    );
  };
  const call = (n: string) => Linking.openURL(`tel:${n}`).catch(() => Alert.alert("Error", "Unable to open the phone dialer."));
  const copyLocation = async () => {
    if (!hasLocation) return;
    await Clipboard.setStringAsync(googleMapsLink(lat!, lng!));
    Alert.alert("Copied", `${firstName}'s location link was copied. You can share it with emergency services.`);
  };

  const headerTitle = mode === "journey" ? `Track ${firstName}'s Journey` : mode === "sos" ? `${firstName} needs help` : `${firstName}'s Location`;
  const statusLine = mode === "journey"
    ? (isLive ? `LIVE · UPDATED ${timeAgo(row?.updated_at).toUpperCase()}` : arrived ? "JOURNEY ENDED" : "WAITING FOR LIVE UPDATES")
    : mode === "sos"
    ? (isLive ? `LIVE LOCATION · UPDATED ${timeAgo(row?.updated_at).toUpperCase()}` : `LOCATION AT TIME OF ALERT · ${timeAgo(updatedAt).toUpperCase()}`)
    : `SHARED ${timeAgo(updatedAt).toUpperCase()}`;

  const markerColor = t.color;
  const sosRing = useMemo(() => (mode === "sos" ? [180, 90] : []), [mode]);

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <XStack alignItems="center" paddingHorizontal={20} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={14}
          backgroundColor={mode === "sos" ? (isDarkMode ? "rgba(239,68,68,0.10)" : "#FEECEC") : "transparent"}
          borderBottomWidth={mode === "sos" ? 1 : 0} borderBottomColor={isDarkMode ? "rgba(239,68,68,0.35)" : "#F8B4B4"}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: cardBg, borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={14} flex={1}>
            <XStack alignItems="center" gap={6}>
              {mode === "sos" && <Feather name="alert-triangle" size={16} color={t.color} />}
              <TText fontFamily="Chirp-Heavy" fontSize={18} color={mode === "sos" ? t.color : theme.textPrimary} numberOfLines={1}>{headerTitle}</TText>
            </XStack>
            <XStack alignItems="center" gap={6} marginTop={2}>
              <YStack width={6} height={6} borderRadius={3} backgroundColor={isLive ? t.color : theme.textSecondary} />
              <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} letterSpacing={1} numberOfLines={1}>{statusLine}</TText>
            </XStack>
          </YStack>
        </XStack>

        <YStack flex={1}>
          {loading && !hasLocation ? (
            <YStack flex={1} justifyContent="center" alignItems="center">
              <ActivityIndicator size="large" color={t.color} />
              <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} marginTop={12}>
                {mode === "journey" ? "Connecting to live journey..." : "Finding location..."}
              </TText>
            </YStack>
          ) : !hasLocation ? (
            <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal={40}>
              <Feather name="map-pin" size={32} color={theme.textSecondary} />
              <TText fontFamily="Chirp-Medium" fontSize={14} color={theme.textSecondary} textAlign="center" marginTop={12}>
                {mode === "journey"
                  ? noAccess ? `${firstName}'s journey is no longer shared with you.` : `${firstName}'s journey hasn't sent a live location yet.`
                  : `${firstName} didn't include a location with this alert.`}
              </TText>
              {mode === "sos" && (
                <TouchableOpacity onPress={() => call(policeNumber)} style={{ marginTop: 20 }}>
                  <XStack backgroundColor={t.color} borderRadius={16} paddingVertical={12} paddingHorizontal={20} alignItems="center" gap={8}>
                    <Feather name="phone" size={14} color="#FFF" />
                    <TText fontFamily="Chirp-Bold" fontSize={14} color="#FFF">Call Police {policeNumber}</TText>
                  </XStack>
                </TouchableOpacity>
              )}
            </YStack>
          ) : (
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              initialRegion={{ latitude: lat!, longitude: lng!, latitudeDelta: mode === "journey" ? 0.05 : 0.012, longitudeDelta: mode === "journey" ? 0.05 : 0.012 }}
              userInterfaceStyle={isDarkMode ? "dark" : "light"}
              showsUserLocation
              showsMyLocationButton={false}
              onPanDrag={() => mode === "journey" && follow && setFollow(false)}
            >
              {/* Journey: travelled trail + dashed line to destination */}
              {mode === "journey" && trail.length > 1 && <Polyline coordinates={trail} strokeColor="#00C48A" strokeWidth={5} />}
              {mode === "journey" && hasDest && isLive && (
                <Polyline coordinates={[{ latitude: lat!, longitude: lng! }, { latitude: row.dest_lat, longitude: row.dest_lng }]} strokeColor="#94A3B8" strokeWidth={2} lineDashPattern={[6, 6]} />
              )}

              {/* SOS: red danger rings + red trail while live */}
              {sosRing.map((r) => (
                <Circle key={r} center={{ latitude: lat!, longitude: lng! }} radius={r} strokeColor="rgba(220,38,38,0.5)" fillColor={r === 90 ? "rgba(220,38,38,0.18)" : "rgba(220,38,38,0.08)"} />
              ))}
              {mode === "sos" && isLive && trail.length > 1 && <Polyline coordinates={trail} strokeColor="#DC2626" strokeWidth={4} />}

              <Marker coordinate={{ latitude: lat!, longitude: lng! }} title={senderName} description={address || undefined} anchor={{ x: 0.5, y: 0.5 }}>
                {mode === "sos" ? (
                  <YStack width={44} height={44} borderRadius={22} backgroundColor="#DC2626" justifyContent="center" alignItems="center" borderWidth={3} borderColor="#FFF">
                    <Feather name="alert-triangle" size={18} color="#FFF" />
                  </YStack>
                ) : (
                  <YStack width={38} height={38} borderRadius={19} backgroundColor={markerColor} justifyContent="center" alignItems="center" borderWidth={3} borderColor="#FFF">
                    <TText fontFamily="Chirp-Heavy" fontSize={14} color="#FFF">{String(senderName).charAt(0).toUpperCase()}</TText>
                  </YStack>
                )}
              </Marker>

              {hasDest && (
                <Marker coordinate={{ latitude: row.dest_lat, longitude: row.dest_lng }} title={row.dest_name || "Destination"}>
                  <YStack width={30} height={30} borderRadius={15} backgroundColor="#111827" justifyContent="center" alignItems="center" borderWidth={3} borderColor="#FFF">
                    <Feather name="flag" size={12} color="#FFF" />
                  </YStack>
                </Marker>
              )}
            </MapView>
          )}

          {/* Floating map buttons */}
          {hasLocation && (
            <YStack position="absolute" top={16} right={16} gap={10}>
              <TouchableOpacity onPress={() => { setFollow(true); fitAll(); }}>
                <YStack width={44} height={44} borderRadius={22} backgroundColor={cardBg} justifyContent="center" alignItems="center" borderWidth={1} borderColor={divider}>
                  <Feather name="crosshair" size={18} color={t.color} />
                </YStack>
              </TouchableOpacity>
              {mode === "journey" && (
                <TouchableOpacity onPress={() => setFollow((f) => !f)}>
                  <YStack width={44} height={44} borderRadius={22} backgroundColor={follow ? t.color : cardBg} justifyContent="center" alignItems="center" borderWidth={1} borderColor={follow ? t.color : divider}>
                    <Feather name="navigation" size={16} color={follow ? "#FFF" : theme.textSecondary} />
                  </YStack>
                </TouchableOpacity>
              )}
            </YStack>
          )}

          {/* ---------- Bottom sheet: JOURNEY ---------- */}
          {hasLocation && mode === "journey" && (
            <YStack position="absolute" bottom={20} left={16} right={16} backgroundColor={cardBg} borderRadius={24} padding={18} borderWidth={1} borderColor={divider}>
              {arrived ? (
                <XStack alignItems="center" gap={10} marginBottom={14} backgroundColor={isDarkMode ? t.softDark : t.soft} borderRadius={14} padding={12}>
                  <Feather name="check-circle" size={18} color={t.color} />
                  <TText flex={1} fontFamily="Chirp-Bold" fontSize={13} color={theme.textPrimary}>{firstName}'s journey has ended. Showing their last location.</TText>
                </XStack>
              ) : etaLate ? (
                <XStack alignItems="center" gap={10} marginBottom={14} backgroundColor={isDarkMode ? "rgba(245,158,11,0.12)" : "#FEF3C7"} borderRadius={14} padding={12}>
                  <Feather name="clock" size={16} color="#F59E0B" />
                  <TText flex={1} fontFamily="Chirp-Bold" fontSize={12} color={theme.textPrimary}>{firstName} is past their expected arrival time ({clock(etaAt)}).</TText>
                </XStack>
              ) : null}

              {hasDest && (
                <XStack alignItems="center" marginBottom={12}>
                  <YStack width={28} height={28} borderRadius={14} backgroundColor={softBg} justifyContent="center" alignItems="center" marginRight={10}>
                    <Feather name="flag" size={12} color={theme.textPrimary} />
                  </YStack>
                  <YStack flex={1}>
                    <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} letterSpacing={1}>HEADING TO</TText>
                    <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary} numberOfLines={1}>{row.dest_name || "Destination"}</TText>
                  </YStack>
                </XStack>
              )}

              {progress !== null && (
                <YStack marginBottom={12}>
                  <YStack height={8} borderRadius={4} backgroundColor={softBg} overflow="hidden">
                    <YStack height={8} width={`${Math.round(progress * 100)}%`} backgroundColor={t.color} />
                  </YStack>
                  <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={6}>{Math.round(progress * 100)}% of the way there</TText>
                </YStack>
              )}

              <XStack backgroundColor={softBg} borderRadius={16} paddingVertical={12} marginBottom={12}>
                {[
                  { label: "DISTANCE LEFT", value: remainingKm !== null ? `${remainingKm.toFixed(1)} km` : "—", color: theme.textPrimary },
                  { label: "EXPECTED", value: etaAt ? clock(etaAt) : "—", color: etaLate ? "#F59E0B" : t.color },
                  { label: "UPDATED", value: timeAgo(row?.updated_at) || "—", color: theme.textPrimary },
                ].map((x, i) => (
                  <YStack key={x.label} flex={1} alignItems="center" borderLeftWidth={i === 0 ? 0 : 1} borderLeftColor={isDarkMode ? "#2D3B34" : "#E2E8F0"}>
                    <TText fontFamily="Chirp-Bold" fontSize={9} color={theme.textSecondary} letterSpacing={0.8} marginBottom={4}>{x.label}</TText>
                    <TText fontFamily="Chirp-Heavy" fontSize={14} color={x.color}>{x.value}</TText>
                  </YStack>
                ))}
              </XStack>

              <TouchableOpacity onPress={openDirections}>
                <XStack backgroundColor={t.color} borderRadius={16} paddingVertical={14} justifyContent="center" alignItems="center" gap={8}>
                  <Feather name="navigation" size={14} color="#FFF" />
                  <TText fontFamily="Chirp-Bold" fontSize={14} color="#FFF">Get Directions to {firstName}</TText>
                </XStack>
              </TouchableOpacity>
            </YStack>
          )}

          {/* ---------- Bottom sheet: SOS ---------- */}
          {hasLocation && mode === "sos" && (
            <YStack position="absolute" bottom={20} left={16} right={16} maxHeight={420} backgroundColor={cardBg} borderRadius={24} borderWidth={1.5} borderColor={isDarkMode ? "rgba(239,68,68,0.5)" : "#F8B4B4"} overflow="hidden">
              <ScrollView bounces={false} contentContainerStyle={{ padding: 18 }}>
                <XStack alignItems="center" gap={8} marginBottom={12}>
                  <YStack backgroundColor={isLive ? t.color : (isDarkMode ? "#2D3B34" : "#E2E8F0")} paddingHorizontal={8} paddingVertical={3} borderRadius={8}>
                    <TText fontFamily="Chirp-Bold" fontSize={10} color={isLive ? "#FFF" : theme.textSecondary} letterSpacing={0.8}>{isLive ? "● LIVE" : "LAST KNOWN"}</TText>
                  </YStack>
                  <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>
                    SOS sent {alertAt ? `${timeAgo(alertAt)} · ${clock(alertAt)}` : "recently"}
                  </TText>
                </XStack>

                <XStack alignItems="flex-start" marginBottom={12}>
                  <Feather name="map-pin" size={16} color={t.color} style={{ marginTop: 2, marginRight: 8 }} />
                  <YStack flex={1}>
                    <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary}>{address || `${lat!.toFixed(5)}, ${lng!.toFixed(5)}`}</TText>
                    <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={2}>
                      {isLive ? `Moving location · updated ${timeAgo(row?.updated_at)}` : "Where they were when they pressed SOS"}
                      {distanceFromMe !== null ? ` · ${distanceFromMe.toFixed(1)} km from you` : ""}
                    </TText>
                  </YStack>
                </XStack>

                {!!alertMessage && (
                  <YStack backgroundColor={isDarkMode ? t.softDark : t.soft} borderRadius={14} padding={12} marginBottom={14}>
                    <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textPrimary} lineHeight={18} numberOfLines={4}>{alertMessage}</TText>
                  </YStack>
                )}

                <TouchableOpacity onPress={openDirections}>
                  <XStack backgroundColor={t.color} borderRadius={16} paddingVertical={14} justifyContent="center" alignItems="center" gap={8} marginBottom={10}>
                    <Feather name="navigation" size={14} color="#FFF" />
                    <TText fontFamily="Chirp-Bold" fontSize={14} color="#FFF">Go to {firstName} now</TText>
                  </XStack>
                </TouchableOpacity>

                <XStack gap={10} marginBottom={10}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => call(policeNumber)}>
                    <XStack backgroundColor="#3B82F6" borderRadius={14} paddingVertical={12} justifyContent="center" alignItems="center" gap={6}>
                      <Feather name="shield" size={13} color="#FFF" />
                      <TText fontFamily="Chirp-Bold" fontSize={12} color="#FFF">Police {policeNumber}</TText>
                    </XStack>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => call(ambulanceNumber)}>
                    <XStack backgroundColor={isDarkMode ? "#7F1D1D" : "#991B1B"} borderRadius={14} paddingVertical={12} justifyContent="center" alignItems="center" gap={6}>
                      <Feather name="plus-circle" size={13} color="#FFF" />
                      <TText fontFamily="Chirp-Bold" fontSize={12} color="#FFF">Ambulance {ambulanceNumber}</TText>
                    </XStack>
                  </TouchableOpacity>
                </XStack>

                <TouchableOpacity onPress={copyLocation}>
                  <XStack backgroundColor={softBg} borderRadius={14} paddingVertical={12} justifyContent="center" alignItems="center" gap={6} borderWidth={1} borderColor={divider}>
                    <Feather name="copy" size={13} color={theme.textPrimary} />
                    <TText fontFamily="Chirp-Bold" fontSize={12} color={theme.textPrimary}>Copy location link</TText>
                  </XStack>
                </TouchableOpacity>
              </ScrollView>
            </YStack>
          )}

          {/* ---------- Bottom sheet: SHARED LOCATION ---------- */}
          {hasLocation && mode === "location" && (
            <YStack position="absolute" bottom={20} left={16} right={16} backgroundColor={cardBg} borderRadius={24} padding={18} borderWidth={1} borderColor={divider}>
              <XStack alignItems="flex-start" marginBottom={14}>
                <Feather name="map-pin" size={16} color={t.color} style={{ marginTop: 2, marginRight: 8 }} />
                <YStack flex={1}>
                  <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary}>{address || `${lat!.toFixed(5)}, ${lng!.toFixed(5)}`}</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={2}>
                    Shared {timeAgo(updatedAt)}{distanceFromMe !== null ? ` · ${distanceFromMe.toFixed(1)} km from you` : ""}
                  </TText>
                </YStack>
              </XStack>
              <TouchableOpacity onPress={openDirections}>
                <XStack backgroundColor={t.color} borderRadius={16} paddingVertical={14} justifyContent="center" alignItems="center" gap={8}>
                  <Feather name="navigation" size={14} color="#FFF" />
                  <TText fontFamily="Chirp-Bold" fontSize={14} color="#FFF">Get Directions</TText>
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