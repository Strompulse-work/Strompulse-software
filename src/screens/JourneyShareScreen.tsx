import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StatusBar, TouchableOpacity, Platform, TextInput,
  ScrollView, Alert, SafeAreaView, StyleSheet, ActivityIndicator, Switch
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import * as SMS from "expo-sms";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useTheme } from "../theme/ThemeContext";
import { useFocusEffect } from "@react-navigation/native";
import AuthService from "../services/authService";
import { supabase } from "../config/supabase";
import { sendPushAlert } from "../utils/sendAlert";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { getDrivingRoute } from "../utils/routing";
import {
  CONTACTS_KEY, DEFAULT_SECURITY_SETTINGS, SecuritySettings,
  loadSecuritySettings, saveSecuritySettings, getSmsSosQuota, consumeSmsSosQuota, normalizePhone, googleMapsLink,
} from "../utils/securityConfig";

const JOURNEY_KEY = "strompulse_journey_active";
const JOURNEY_END_TIME_KEY = "strompulse_journey_end_time";
const JOURNEY_CONTACTS_KEY = "strompulse_journey_contacts";
const JOURNEY_META_KEY = "strompulse_journey_meta";

const ROUTE_REFRESH_MS = 60 * 1000;   // re-query directions at most once a minute
const UPLOAD_INTERVAL_MS = 15 * 1000; // push live position to followers every 15s max

const GOOGLE_API_KEY = Platform.OS === "ios" ? "AIzaSyCeWigeIvMAGJ_X-qj8UqY6CoGTbzBSHfA" : "AIzaSyB76SNOlgP1dkPZXhlPPIU_650y45Cd1Mo";

const delayToMs = (d: string) => ({ "15 min": 15, "30 min": 30, "1 hr": 60, "2 hr": 120, "5 hr": 300 } as Record<string, number>)[d] * 60000 || 30 * 60000;

const JourneyShareScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode } = useTheme();
  const cardBg = isDarkMode ? "#121A16" : "#FFFFFF";
  const divider = isDarkMode ? "#2D3B34" : "#E2E8F0";

  const mapRef = useRef<MapView>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const destRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastRouteFetchRef = useRef(0);
  const lastUploadRef = useRef(0);
  const metaRef = useRef<any>(null);

  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchingRoute, setIsSearchingRoute] = useState(false);
  const [destinationName, setDestinationName] = useState("");

  const [calculatedEtaText, setCalculatedEtaText] = useState("Select a destination");
  const [calculatedEtaMs, setCalculatedEtaMs] = useState(0);
  const [remainingKm, setRemainingKm] = useState<number | null>(null);
  const [totalKm, setTotalKm] = useState<number | null>(null);

  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [isActive, setIsActive] = useState(false);
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS);

  const [autoAlertEnabled, setAutoAlertEnabled] = useState(true);
  const [autoAlertDelay, setAutoAlertDelay] = useState("30 min");

  const [isEtaExpired, setIsEtaExpired] = useState(false);
  const [journeyEndTime, setJourneyEndTime] = useState<number | null>(null);
  const [timeLeftString, setTimeLeftString] = useState("--:--");
  const [hasAutoAlertFired, setHasAutoAlertFired] = useState(false);

  const delayOptions = ["15 min", "30 min", "1 hr", "2 hr", "5 hr"];

  const getUserInfo = async () => {
    const session = await AuthService.getCurrentSession();
    return { id: session?.user?.id as string | undefined, name: (session?.user as any)?.full_name || "Someone" };
  };

  // ---------- live location upload for followers (Follow Their Journey) ----------
  const uploadLiveLocation = async (lat: number, lng: number, active = true, force = false) => {
    if (!force && Date.now() - lastUploadRef.current < UPLOAD_INTERVAL_MS) return;
    lastUploadRef.current = Date.now();
    try {
      const { id, name } = await getUserInfo();
      if (!id) return;
      const meta = metaRef.current || {};
      await supabase.from("journey_locations").upsert({
        user_id: id,
        sender_name: name,
        lat, lng,
        start_lat: meta.startCoords?.lat ?? null,
        start_lng: meta.startCoords?.lng ?? null,
        dest_name: meta.destinationName ?? null,
        dest_lat: meta.destinationCoords?.lat ?? null,
        dest_lng: meta.destinationCoords?.lng ?? null,
        total_km: meta.totalKm ?? null,
        eta_at: meta.endTime ? new Date(meta.endTime).toISOString() : null,
        started_at: meta.startedAt ? new Date(meta.startedAt).toISOString() : null,
        is_active: active,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      // table missing or offline — journey still works locally
    }
  };

  const fetchRouteData = async (origLat: number, origLng: number, destLat: number, destLng: number, fit = true) => {
    lastRouteFetchRef.current = Date.now();
    const r = await getDrivingRoute({ lat: origLat, lng: origLng }, { lat: destLat, lng: destLng });
    setRouteCoords(r.isEstimate ? [] : r.points);
    setCalculatedEtaText(r.durationText);
    setCalculatedEtaMs(Math.round(r.durationSec * 1000));
    setRemainingKm(r.distanceKm);
    if (fit && mapRef.current) {
      const fitPoints = r.points.length > 1 ? r.points : [{ latitude: origLat, longitude: origLng }, { latitude: destLat, longitude: destLng }];
      mapRef.current.fitToCoordinates(fitPoints, { edgePadding: { top: 80, right: 50, bottom: 50, left: 50 }, animated: true });
    }
    return r.distanceKm;
  };

  const stopLiveTracking = () => {
    if (subRef.current) subRef.current.remove();
    subRef.current = null;
  };

  const startLiveTracking = async () => {
    stopLiveTracking();
    subRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 20 },
      (loc) => {
        const { latitude, longitude } = loc.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });
        uploadLiveLocation(latitude, longitude, true);
        const dest = destRef.current;
        if (dest && Date.now() - lastRouteFetchRef.current > ROUTE_REFRESH_MS) {
          fetchRouteData(latitude, longitude, dest.lat, dest.lng, false);
        }
      }
    );
  };

  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        const s = await loadSecuritySettings();
        setSettings(s);
        setAutoAlertEnabled(s.autoAlertEnabled);
        setAutoAlertDelay(s.autoAlertDelay);

        const saved = await AsyncStorage.getItem(CONTACTS_KEY);
        let contacts: any[] = [];
        if (saved) {
          contacts = JSON.parse(saved);
          setAllContacts(contacts);
          setSelectedContacts(new Set(contacts.filter((c: any) => c.isEmergency).map((c: any) => c.id)));
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setCurrentCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }

        const journeyStatus = await AsyncStorage.getItem(JOURNEY_KEY);
        if (journeyStatus === "true" || route.params?.isJourneyActive) {
          const savedEndTime = await AsyncStorage.getItem(JOURNEY_END_TIME_KEY);
          const savedJourneyContacts = await AsyncStorage.getItem(JOURNEY_CONTACTS_KEY);
          const savedMeta = await AsyncStorage.getItem(JOURNEY_META_KEY);
          setIsActive(true);
          if (savedEndTime) setJourneyEndTime(parseInt(savedEndTime, 10));
          if (savedJourneyContacts) setSelectedContacts(new Set(JSON.parse(savedJourneyContacts)));
          if (savedMeta) {
            const meta = JSON.parse(savedMeta);
            metaRef.current = meta;
            setDestinationName(meta.destinationName || "");
            setSearchQuery(meta.destinationName || "");
            if (meta.destinationCoords) { setDestinationCoords(meta.destinationCoords); destRef.current = meta.destinationCoords; }
            if (meta.totalKm) setTotalKm(meta.totalKm);
            if (meta.etaText) setCalculatedEtaText(meta.etaText);
          }
          startLiveTracking();
        }
      };
      init();
      return () => stopLiveTracking();
    }, [route.params])
  );

  useEffect(() => {
    const t = setTimeout(async () => {
      if (searchQuery.trim().length > 2 && !destinationCoords) {
        setIsSearching(true);
        try {
          const headers: any = { "Content-Type": "application/json", "X-Goog-Api-Key": GOOGLE_API_KEY };
          if (Platform.OS === "ios") headers["X-Ios-Bundle-Identifier"] = "com.strompulse.app";
          if (Platform.OS === "android") headers["X-Android-Package"] = "com.strompulse.app";
          const body: any = { input: searchQuery.trim(), includedRegionCodes: ["ng"] };
          if (currentCoords) body.locationBias = { circle: { center: { latitude: currentCoords.lat, longitude: currentCoords.lng }, radius: 50000.0 } };
          const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", { method: "POST", headers, body: JSON.stringify(body) });
          const data = await res.json();
          setSearchResults(data.suggestions ? data.suggestions.filter((d: any) => d.placePrediction).map((d: any) => ({ id: d.placePrediction.placeId, name: d.placePrediction.text.text })) : []);
        } catch (error) { setSearchResults([]); } finally { setIsSearching(false); }
      } else setSearchResults([]);
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleSelectDestination = async (placeId: string, name: string) => {
    setSearchQuery(name);
    setDestinationName(name);
    setSearchResults([]);
    setIsSearchingRoute(true);
    try {
      const headers: any = { "Content-Type": "application/json", "X-Goog-Api-Key": GOOGLE_API_KEY, "X-Goog-FieldMask": "location" };
      if (Platform.OS === "ios") headers["X-Ios-Bundle-Identifier"] = "com.strompulse.app";
      if (Platform.OS === "android") headers["X-Android-Package"] = "com.strompulse.app";
      const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, { headers });
      const data = await res.json();
      if (data.location) {
        const dest = { lat: data.location.latitude, lng: data.location.longitude };
        setDestinationCoords(dest);
        destRef.current = dest;
        let start = currentCoords;
        if (!start) {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          start = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          setCurrentCoords(start);
        }
        const km = await fetchRouteData(start.lat, start.lng, dest.lat, dest.lng);
        if (km) setTotalKm(km);
      }
    } catch (e) {
      Alert.alert("Error", "Could not fetch location details.");
      setCalculatedEtaText("ETA Unavailable");
    } finally {
      setIsSearchingRoute(false);
    }
  };

  const clearDestination = () => {
    setSearchQuery("");
    setDestinationName("");
    setDestinationCoords(null);
    destRef.current = null;
    setRouteCoords([]);
    setCalculatedEtaText("Select a destination");
    setCalculatedEtaMs(0);
    setRemainingKm(null);
    setTotalKm(null);
    if (currentCoords && mapRef.current) {
      mapRef.current.animateToRegion({ latitude: currentCoords.lat, longitude: currentCoords.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 1000);
    }
  };

  // ETA countdown + auto-alert
  useEffect(() => {
    if (!isActive || !journeyEndTime) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = journeyEndTime - now;
      if (diff <= 0) {
        setIsEtaExpired(true);
        setTimeLeftString("00:00");
        if (autoAlertEnabled && !hasAutoAlertFired && now - journeyEndTime >= delayToMs(autoAlertDelay)) {
          setHasAutoAlertFired(true);
          notifyEtaExpired(true);
        }
      } else {
        setIsEtaExpired(false);
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeftString(h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, journeyEndTime, autoAlertEnabled, autoAlertDelay, hasAutoAlertFired]);

  const toggleContactSelection = (id: string) => {
    const next = new Set(selectedContacts);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedContacts(next);
  };

  const recipients = () => allContacts.filter((c) => selectedContacts.has(c.id));

  // Same recipient format as SOS (normalized phone numbers), sent in one call so alerts arrive together
  const pushToAll = (type: string, title: string, body: string, list: any[]) =>
    Promise.resolve(sendPushAlert(type as any, title, body, list.map((c) => normalizePhone(c.phone)) as any)).catch(() => {});

  const startSharing = async () => {
    if (selectedContacts.size === 0) {
      Alert.alert("No Contacts Selected", "Please select at least one contact to share your journey with.");
      return;
    }
    if (!destinationCoords || calculatedEtaMs === 0) {
      Alert.alert("Destination Required", "Please select a destination to calculate your ETA.");
      return;
    }
    const startedAt = Date.now();
    const endTime = startedAt + calculatedEtaMs;
    const meta = { destinationName, destinationCoords, startCoords: currentCoords, totalKm: totalKm ?? remainingKm, startedAt, endTime, etaText: calculatedEtaText };
    metaRef.current = meta;

    setIsActive(true);
    setJourneyEndTime(endTime);
    setIsEtaExpired(false);
    setHasAutoAlertFired(false);

    await AsyncStorage.multiSet([
      [JOURNEY_KEY, "true"],
      [JOURNEY_END_TIME_KEY, endTime.toString()],
      [JOURNEY_CONTACTS_KEY, JSON.stringify(Array.from(selectedContacts))],
      [JOURNEY_META_KEY, JSON.stringify(meta)],
    ]);
    saveSecuritySettings({ autoAlertEnabled, autoAlertDelay });

    if (currentCoords) uploadLiveLocation(currentCoords.lat, currentCoords.lng, true, true);
    startLiveTracking();

    // Notifications are fired in parallel and not awaited, so the UI never waits on them
    const { name } = await getUserInfo();
    const body = `Heading to ${destinationName}. Estimated arrival in ${calculatedEtaText}.${currentCoords ? ` Start: ${googleMapsLink(currentCoords.lat, currentCoords.lng)}` : ""}`;
    pushToAll("journey_start", `${name} started a journey`, body, recipients());
  };

  const sendDelaySms = async (message: string, phones: string[]) => {
    const q = await getSmsSosQuota();
    if (q.remaining <= 0) return false;
    if (!(await SMS.isAvailableAsync())) return false;
    const { result } = await SMS.sendSMSAsync(phones, message);
    if (result === "cancelled") return false;
    await consumeSmsSosQuota();
    return true;
  };

  const notifyEtaExpired = async (isAuto = false) => {
    const list = recipients();
    if (list.length === 0) return;
    const { name } = await getUserInfo();
    const destStr = destinationName ? ` to ${destinationName}` : "";
    let message = isAuto
      ? `🚨 AUTO-ALERT: ${name} hasn't checked in ${autoAlertDelay} after the expected arrival time for their journey${destStr}. Please check on them.`
      : `🚨 ALERT: My expected arrival time for my journey${destStr} has passed and I haven't arrived yet.`;
    if (settings.locationSharing && currentCoords) message += ` Last known location: ${googleMapsLink(currentCoords.lat, currentCoords.lng)}`;

    const net = await NetInfo.fetch();
    const online = !!net.isConnected && net.isInternetReachable !== false;

    if (online) {
      if (settings.notifyInApp) pushToAll("emergency", isAuto ? `🚨 ${name} hasn't arrived` : `🚨 ${name}'s journey is delayed`, message, list);
      if (!isAuto && settings.notifyWhatsApp) {
        const url = `whatsapp://send?phone=${normalizePhone(list[0].phone, false)}&text=${encodeURIComponent(message)}`;
        const can = await Linking.canOpenURL(url).catch(() => false);
        if (can) { Linking.openURL(url).catch(() => {}); return; }
      }
      if (settings.notifyInApp) return;
    }
    if (settings.notifySms) await sendDelaySms(message, list.map((c) => c.phone));
  };

  const stopJourneyCleanup = async (navigateBack = true) => {
    stopLiveTracking();
    if (currentCoords) uploadLiveLocation(currentCoords.lat, currentCoords.lng, false, true);
    metaRef.current = null;
    setIsActive(false);
    setJourneyEndTime(null);
    setIsEtaExpired(false);
    clearDestination();
    await AsyncStorage.multiRemove([JOURNEY_KEY, JOURNEY_END_TIME_KEY, JOURNEY_CONTACTS_KEY, JOURNEY_META_KEY]);
    if (navigateBack) navigation.navigate("MainTabs", { screen: "Safety", params: { isJourneyActive: false, timestamp: Date.now() } });
  };

  const confirmArrival = async () => {
    const { name } = await getUserInfo();
    pushToAll("journey_end", `✅ ${name} arrived safely`, `${name} has confirmed they arrived${destinationName ? ` at ${destinationName}` : ""}.`, recipients());
    await stopJourneyCleanup();
  };

  const endEarly = () => {
    Alert.alert("End Journey?", "Your contacts will stop seeing your live location.", [
      { text: "Keep Sharing", style: "cancel" },
      { text: "End Journey", style: "destructive", onPress: async () => {
        const { name } = await getUserInfo();
        pushToAll("journey_end", `${name} ended their journey`, `${name} stopped sharing their journey.`, recipients());
        stopJourneyCleanup();
      } },
    ]);
  };

  const contactNames = recipients().map((c) => c.name.split(" ")[0]).join(", ");
  const alertText = contactNames.length > 0 ? contactNames.replace(/,([^,]*)$/, " and$1") : "your trusted contacts";
  const progress = totalKm && remainingKm !== null ? Math.max(0, Math.min(1, 1 - remainingKm / totalKm)) : 0;
  const canStart = !!destinationCoords && calculatedEtaMs > 0;

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={16} borderBottomWidth={1} borderBottomColor={divider}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: divider }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16} flex={1}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Share My Journey</TText>
            <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2} letterSpacing={1}>{isActive ? "LIVE · CONTACTS CAN FOLLOW YOU" : "LIVE LOCATION WITH YOUR CONTACTS"}</TText>
          </YStack>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <YStack height={260} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={divider} marginBottom={24} marginTop={16}>
            {currentCoords ? (
              <MapView
                ref={mapRef}
                style={{ ...StyleSheet.absoluteFillObject }}
                provider={PROVIDER_GOOGLE}
                initialRegion={{ latitude: currentCoords.lat, longitude: currentCoords.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
                userInterfaceStyle={isDarkMode ? "dark" : "light"}
              >
                <Marker coordinate={{ latitude: currentCoords.lat, longitude: currentCoords.lng }}>
                  <YStack width={20} height={20} borderRadius={10} backgroundColor="rgba(0,196,138,0.3)" justifyContent="center" alignItems="center">
                    <YStack width={10} height={10} borderRadius={5} backgroundColor="#00C48A" borderWidth={1.5} borderColor="#FFF" />
                  </YStack>
                </Marker>
                {destinationCoords && (
                  <Marker coordinate={{ latitude: destinationCoords.lat, longitude: destinationCoords.lng }}>
                    <YStack width={24} height={24} borderRadius={12} backgroundColor="#EF4444" justifyContent="center" alignItems="center" borderWidth={2} borderColor="#FFF">
                      <Feather name="map-pin" size={12} color="#FFF" />
                    </YStack>
                  </Marker>
                )}
                {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeColor="#00C48A" strokeWidth={4} />}
              </MapView>
            ) : (
              <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={isDarkMode ? "#121A16" : "#F1F5F9"}>
                <ActivityIndicator size="small" color="#00C48A" />
              </YStack>
            )}

            {!isActive && (
              <YStack position="absolute" top={16} left={16} right={16} zIndex={100}>
                <XStack backgroundColor={isDarkMode ? "#1A221E" : "#FFFFFF"} borderRadius={16} paddingHorizontal={16} height={52} alignItems="center" borderWidth={1} borderColor={divider}>
                  <Feather name="search" size={16} color={theme.textSecondary} />
                  <TextInput
                    style={{ flex: 1, marginLeft: 12, fontSize: 14, fontFamily: "Chirp-Medium", color: theme.textPrimary }}
                    placeholder="Search destination..."
                    placeholderTextColor={theme.textSecondary}
                    value={searchQuery}
                    onChangeText={(t) => { if (destinationCoords) clearDestination(); setSearchQuery(t); }}
                  />
                  {isSearching && <ActivityIndicator size="small" color="#00C48A" style={{ marginRight: 8 }} />}
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={clearDestination} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Feather name="x-circle" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  )}
                </XStack>
                {searchResults.length > 0 && (
                  <YStack backgroundColor={isDarkMode ? "#1A221E" : "#FFFFFF"} borderRadius={16} borderWidth={1} borderColor={divider} marginTop={8} maxHeight={180} overflow="hidden">
                    <ScrollView keyboardShouldPersistTaps="handled">
                      {searchResults.map((item, idx) => (
                        <TouchableOpacity key={item.id} onPress={() => handleSelectDestination(item.id, item.name)}>
                          <XStack padding={16} borderBottomWidth={idx === searchResults.length - 1 ? 0 : 1} borderBottomColor={divider} alignItems="center">
                            <Feather name="map-pin" size={14} color="#00C48A" style={{ marginRight: 12 }} />
                            <TText flex={1} fontFamily="Chirp-Medium" fontSize={13} color={theme.textPrimary} numberOfLines={1}>{item.name}</TText>
                          </XStack>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </YStack>
                )}
              </YStack>
            )}
          </YStack>

          {!isActive ? (
            <>
              <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>EXPECTED ARRIVAL TIME</TText>
              <YStack backgroundColor={cardBg} borderRadius={16} borderWidth={1} borderColor={divider} paddingVertical={16} alignItems="center" marginBottom={24}>
                {isSearchingRoute ? <ActivityIndicator size="small" color="#00C48A" /> : (
                  <>
                    <TText fontSize={18} fontFamily="Chirp-Heavy" color={calculatedEtaMs > 0 ? "#00C48A" : theme.textSecondary}>{calculatedEtaText}</TText>
                    {remainingKm !== null && <TText fontSize={12} fontFamily="Chirp-Medium" color={theme.textSecondary} marginTop={4}>{calculatedEtaText.startsWith("~") ? `Estimated · about ${remainingKm.toFixed(1)} km` : `${remainingKm.toFixed(1)} km by road`}</TText>}
                  </>
                )}
              </YStack>

              <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginLeft={4} marginBottom={12}>SHARING WITH</TText>
              {allContacts.length === 0 ? (
                <TouchableOpacity onPress={() => navigation.navigate("ContactsScreen")}>
                  <XStack backgroundColor={cardBg} borderRadius={16} borderWidth={1} borderColor={divider} borderStyle="dashed" padding={16} alignItems="center" gap={10} marginBottom={24}>
                    <Feather name="user-plus" size={16} color="#00C48A" />
                    <TText fontFamily="Chirp-Bold" fontSize={13} color="#00C48A">Add contacts to share with</TText>
                  </XStack>
                </TouchableOpacity>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16, gap: 12, marginBottom: 8 }}>
                  {allContacts.map((contact) => {
                    const isSelected = selectedContacts.has(contact.id);
                    return (
                      <TouchableOpacity key={contact.id} activeOpacity={0.7} onPress={() => toggleContactSelection(contact.id)}>
                        <YStack alignItems="center" width={60}>
                          <YStack width={50} height={50} borderRadius={25} backgroundColor={isDarkMode ? contact.bgDark : contact.bg} justifyContent="center" alignItems="center" marginBottom={6} opacity={isSelected ? 1 : 0.4} borderWidth={2} borderColor={isSelected ? "#00C48A" : "transparent"}>
                            <TText fontSize={18} fontFamily="Chirp-Heavy" color={contact.color}>{contact.initial}</TText>
                          </YStack>
                          <TText fontSize={11} fontFamily="Chirp-Medium" color={isSelected ? theme.textPrimary : theme.textSecondary} numberOfLines={1} textAlign="center">{contact.name.split(" ")[0]}</TText>
                        </YStack>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginLeft={4} marginBottom={12}>ARRIVAL CHECK-IN</TText>
              <YStack backgroundColor={cardBg} borderRadius={24} borderWidth={1} borderColor="#00C48A" padding={20} marginBottom={32}>
                <XStack justifyContent="space-between" alignItems="center" marginBottom={autoAlertEnabled ? 16 : 0}>
                  <XStack alignItems="center" flex={1}>
                    <YStack width={36} height={36} borderRadius={18} backgroundColor={isDarkMode ? "rgba(239,68,68,0.1)" : "#FEE2E2"} justifyContent="center" alignItems="center" marginRight={12}>
                      <Feather name="clock" size={16} color="#EF4444" />
                    </YStack>
                    <YStack flex={1} paddingRight={8}>
                      <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} marginBottom={2}>Auto-Alert If I Go Quiet</TText>
                      <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>Alert contacts if you don't confirm arrival</TText>
                    </YStack>
                  </XStack>
                  <Switch trackColor={{ false: divider, true: "#00C48A" }} thumbColor="#FFFFFF" value={autoAlertEnabled} onValueChange={setAutoAlertEnabled} />
                </XStack>
                {autoAlertEnabled && (
                  <YStack borderTopWidth={1} borderTopColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} paddingTop={16}>
                    <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} lineHeight={18} marginBottom={16}>
                      If you haven't tapped "I've Arrived" this long after your ETA, we'll alert {alertText} with your last known location.
                    </TText>
                    <XStack justifyContent="space-between" flexWrap="wrap" gap={8}>
                      {delayOptions.map((opt) => (
                        <TouchableOpacity key={opt} onPress={() => setAutoAlertDelay(opt)} style={{ minWidth: "30%", flexGrow: 1 }}>
                          <YStack backgroundColor={autoAlertDelay === opt ? "rgba(0,196,138,0.1)" : "transparent"} borderWidth={1} borderColor={autoAlertDelay === opt ? "#00C48A" : divider} borderRadius={12} paddingVertical={12} alignItems="center">
                            <TText fontSize={12} fontFamily="Chirp-Bold" color={autoAlertDelay === opt ? "#00C48A" : theme.textSecondary}>{opt}</TText>
                          </YStack>
                        </TouchableOpacity>
                      ))}
                    </XStack>
                  </YStack>
                )}
              </YStack>

              <TouchableOpacity activeOpacity={0.8} onPress={startSharing} disabled={!canStart}>
                <YStack backgroundColor={canStart ? "#00C48A" : (isDarkMode ? "#1A221E" : "#E2E8F0")} borderRadius={20} paddingVertical={18} alignItems="center">
                  <TText fontSize={16} fontFamily="Chirp-Bold" color={canStart ? "#FFFFFF" : theme.textSecondary}>Start Journey Share</TText>
                </YStack>
              </TouchableOpacity>
            </>
          ) : (
            <YStack>
              {/* Journey progress */}
              <YStack backgroundColor={cardBg} borderRadius={24} borderWidth={1} borderColor="#00C48A" padding={20} marginBottom={16}>
                <XStack alignItems="center" marginBottom={16}>
                  <YStack width={36} height={36} borderRadius={18} backgroundColor="rgba(239,68,68,0.1)" justifyContent="center" alignItems="center" marginRight={12}>
                    <Feather name="flag" size={16} color="#EF4444" />
                  </YStack>
                  <YStack flex={1}>
                    <TText fontFamily="Chirp-Bold" fontSize={10} color={theme.textSecondary} letterSpacing={1}>DESTINATION</TText>
                    <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary} numberOfLines={1}>{destinationName || "—"}</TText>
                  </YStack>
                </XStack>
                <YStack height={8} borderRadius={4} backgroundColor={isDarkMode ? "#1A221E" : "#F1F5F9"} overflow="hidden" marginBottom={8}>
                  <YStack height={8} width={`${Math.round(progress * 100)}%`} backgroundColor="#00C48A" borderRadius={4} />
                </YStack>
                <XStack justifyContent="space-between">
                  <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>{Math.round(progress * 100)}% of the way</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>{remainingKm !== null ? `${remainingKm.toFixed(1)} km left` : "Calculating..."}</TText>
                </XStack>
                <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={12}>Shared with {alertText}</TText>
              </YStack>

              {!isEtaExpired ? (
                <YStack backgroundColor={isDarkMode ? "rgba(0,196,138,0.05)" : "#ECFDF5"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "rgba(0,196,138,0.2)" : "#D1FAE5"} paddingVertical={28} alignItems="center" marginBottom={16}>
                  <TText fontSize={11} fontFamily="Chirp-Bold" color="#00C48A" letterSpacing={1.5} marginBottom={8}>TIME TO EXPECTED ARRIVAL</TText>
                  <TText fontSize={44} fontFamily="Chirp-Heavy" color={theme.textPrimary} fontVariant={["tabular-nums"]}>{timeLeftString}</TText>
                </YStack>
              ) : (
                <YStack backgroundColor={isDarkMode ? "rgba(239,68,68,0.05)" : "#FEF2F2"} borderRadius={24} padding={20} marginBottom={16} borderWidth={1} borderColor={isDarkMode ? "#7F1D1D" : "#FECACA"}>
                  <XStack alignItems="center" marginBottom={8}>
                    <Feather name="alert-circle" size={20} color="#EF4444" />
                    <TText fontSize={15} fontFamily="Chirp-Heavy" color="#EF4444" marginLeft={8}>ETA Elapsed</TText>
                  </XStack>
                  <TText fontSize={13} fontFamily="Chirp-Medium" color={theme.textPrimary} marginBottom={16} lineHeight={20}>
                    {hasAutoAlertFired
                      ? "You didn't check in, so your contacts have been alerted automatically."
                      : autoAlertEnabled ? `If you don't check in, your contacts will be alerted ${autoAlertDelay} after your ETA.` : "Let your contacts know you're running late."}
                  </TText>
                  <TouchableOpacity onPress={() => notifyEtaExpired(false)}>
                    <YStack backgroundColor="#EF4444" borderRadius={16} paddingVertical={16} alignItems="center">
                      <TText color="#FFF" fontSize={14} fontFamily="Chirp-Bold">Notify Contacts of Delay</TText>
                    </YStack>
                  </TouchableOpacity>
                </YStack>
              )}

              <TouchableOpacity activeOpacity={0.8} onPress={confirmArrival}>
                <XStack backgroundColor="#00C48A" borderRadius={20} paddingVertical={18} alignItems="center" justifyContent="center" gap={8} marginBottom={12}>
                  <Feather name="check-circle" size={18} color="#FFF" />
                  <TText fontSize={15} fontFamily="Chirp-Bold" color="#FFFFFF">I've Arrived Safely</TText>
                </XStack>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.8} onPress={endEarly}>
                <YStack backgroundColor={cardBg} borderWidth={1} borderColor={divider} borderRadius={20} paddingVertical={18} alignItems="center">
                  <TText fontSize={15} fontFamily="Chirp-Bold" color={theme.textPrimary}>End Journey Early</TText>
                </YStack>
              </TouchableOpacity>
            </YStack>
          )}
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default JourneyShareScreen;