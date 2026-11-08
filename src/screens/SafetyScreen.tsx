import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Platform, StatusBar, Animated, SafeAreaView, Dimensions,
  ScrollView, Alert, TouchableOpacity, Pressable, View, Image, Switch, StyleSheet
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import * as SMS from "expo-sms";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import AuthService from "../services/authService";
import { useFocusEffect } from "@react-navigation/native";
import { sendPushAlert } from "../utils/sendAlert";
import { startSosLiveSharing, stopSosLiveSharing, isSosLiveSharing } from "../utils/sosLiveLocation";
import { getMyIdentity } from "../utils/myIdentity";
import { registerForPushNotificationsAsync } from "../utils/pushRegistration";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import {
  CONTACTS_KEY, DEFAULT_SECURITY_SETTINGS, SecuritySettings, SmsQuota, SMS_SOS_MONTHLY_LIMIT,
  loadSecuritySettings, getSmsSosQuota, consumeSmsSosQuota, normalizePhone, googleMapsLink,
  getDueAutoShareSlot, markAutoShareSlot,
} from "../utils/securityConfig";

const { width } = Dimensions.get("window");
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const JOURNEY_KEY = "strompulse_journey_active";

const GOOGLE_API_KEY = Platform.OS === "ios" ? "AIzaSyCeWigeIvMAGJ_X-qj8UqY6CoGTbzBSHfA" : "AIzaSyB76SNOlgP1dkPZXhlPPIU_650y45Cd1Mo";

const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const SafetyScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode, toggleDarkMode } = useTheme();
  const cardBg = isDarkMode ? "#121A16" : "#FFFFFF";
  const divider = isDarkMode ? "#2D3B34" : "#E2E8F0";

  const [isJourneyActive, setIsJourneyActive] = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const [sosChannels, setSosChannels] = useState<string[]>([]);
  const [sosWasOnline, setSosWasOnline] = useState(true);
  const [sosMessage, setSosMessage] = useState("");
  const [sosLiveOn, setSosLiveOn] = useState(isSosLiveSharing());
  const [currentLocation, setCurrentLocation] = useState("Locating...");
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [smsQuota, setSmsQuota] = useState<SmsQuota>({ used: 0, remaining: SMS_SOS_MONTHLY_LIMIT, limit: SMS_SOS_MONTHLY_LIMIT });
  const [user, setUser] = useState<any>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(width)).current;
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);

  const [nearbyHospitals, setNearbyHospitals] = useState<any[]>([]);
  const [nearbyPolice, setNearbyPolice] = useState<any[]>([]);
  const [nearbyPharmacies, setNearbyPharmacies] = useState<any[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(true);

  const fetchEmergencyPlaces = async (lat: number, lng: number) => {
    setNearbyLoading(true);
    try {
      const headers: any = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress",
      };
      if (Platform.OS === "ios") headers["X-Ios-Bundle-Identifier"] = "com.strompulse.app";
      if (Platform.OS === "android") headers["X-Android-Package"] = "com.strompulse.app";

      const fetchTop3 = async (type: string, fallbackName: string) => {
        const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
          method: "POST",
          headers,
          body: JSON.stringify({
            includedTypes: [type],
            maxResultCount: 10,
            rankPreference: "DISTANCE",
            locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 8000.0 } },
          }),
        });
        const data = await res.json();
        if (!data.places) return [];
        return data.places
          .filter((p: any) => p.location)
          .map((p: any) => {
            const dist = getDistanceFromLatLonInKm(lat, lng, p.location.latitude, p.location.longitude);
            return {
              id: p.id, type,
              name: p.displayName?.text || fallbackName,
              address: p.formattedAddress || "",
              lat: p.location.latitude, lng: p.location.longitude,
              distNum: dist, dist: dist.toFixed(1), time: Math.max(1, Math.round(dist * 3)),
            };
          })
          .sort((a: any, b: any) => a.distNum - b.distNum)
          .slice(0, 3);
      };

      const [h, ph, p] = await Promise.all([
        fetchTop3("hospital", "Hospital"),
        fetchTop3("pharmacy", "Pharmacy"),
        fetchTop3("police", "Police Station"),
      ]);
      setNearbyHospitals(h);
      setNearbyPharmacies(ph);
      setNearbyPolice(p);
    } catch (error) {
    } finally {
      setNearbyLoading(false);
    }
  };

  const runAutoLocationShare = async (s: SecuritySettings, coords: { lat: number; lng: number }, place: string, contacts: any[], name: string) => {
    try {
      if (!s.autoShareFrequency || contacts.length === 0) return;
      const net = await NetInfo.fetch();
      if (!net.isConnected) return;
      const slot = await getDueAutoShareSlot(s.autoShareFrequency);
      if (!slot) return;
      await markAutoShareSlot(slot);
      const phones = contacts.map((c) => normalizePhone(c.phone));
      Promise.resolve(
        sendPushAlert("location_share", `${name} shared their location`, `Scheduled location update: ${place}. ${googleMapsLink(coords.lat, coords.lng)}`, phones, { kind: "location", senderName: name, lat: coords.lat, lng: coords.lng })
      ).catch(() => {});
    } catch {}
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const fetchRealtimeData = async () => {
        const session = await AuthService.getCurrentSession();
        if (session) {
          setUser(session.user);
          registerForPushNotificationsAsync(session.user.id);
          getMyIdentity().catch(() => {}); // warm up so SOS never waits on it
        }

        const savedAvatar = await AsyncStorage.getItem("global_avatar");
        if (savedAvatar) setLocalAvatar(savedAvatar);
        const savedName = await AsyncStorage.getItem("global_name");
        if (savedName) setLocalName(savedName);

        const s = await loadSecuritySettings();
        if (active) setSettings(s);
        const q = await getSmsSosQuota();
        if (active) setSmsQuota(q);

        const journeyStatus = await AsyncStorage.getItem(JOURNEY_KEY);
        setIsJourneyActive(journeyStatus === "true" || !!route.params?.isJourneyActive);

        let contacts: any[] = [];
        const savedContacts = await AsyncStorage.getItem(CONTACTS_KEY);
        if (savedContacts) contacts = JSON.parse(savedContacts).filter((c: any) => c.isEmergency);
        if (active) setEmergencyContacts(contacts);

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          if (!active) return;
          setCurrentCoords(coords);
          fetchEmergencyPlaces(coords.lat, coords.lng);

          let place = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
          try {
            const response = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
            if (response.length > 0) place = `${response[0].district || response[0].city}, ${response[0].region}`;
          } catch {}
          if (active) setCurrentLocation(place);

          const name = (session?.user as any)?.full_name || savedName || "Your contact";
          runAutoLocationShare(s, coords, place, contacts, name);
        } else {
          setCurrentLocation("Location Permission Denied");
          setNearbyLoading(false);
        }
      };
      fetchRealtimeData();
      return () => { active = false; };
    }, [route.params])
  );

  const displayAvatar = localAvatar || user?.avatar_url || user?.user_metadata?.avatar_url || null;
  const fullName = localName || user?.full_name || "Stromer";

  const toggleSidebar = (open: boolean) => {
    if (open) {
      setIsSidebarOpen(true);
      Animated.timing(sidebarAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(sidebarAnim, { toValue: width, duration: 250, useNativeDriver: true }).start(() => setIsSidebarOpen(false));
    }
  };

  const handleLogoutPress = () => {
    toggleSidebar(false);
    Alert.alert("Log Out", "Are you sure you want to log out of your account?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: async () => { try { await AuthService.logout(); } catch (err) {} } },
    ], { cancelable: true });
  };

  // ---------------- SOS ----------------
  const holdProgress = useRef(new Animated.Value(0)).current;
  const BUTTON_SIZE = 130;
  const CIRCLE_RADIUS = BUTTON_SIZE / 2 - 3;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
  const strokeDashoffset = holdProgress.interpolate({ inputRange: [0, 1], outputRange: [CIRCLE_CIRCUMFERENCE, 0] });

  const sendSmsSos = async (message: string): Promise<boolean> => {
    const quota = await getSmsSosQuota();
    if (quota.remaining <= 0) {
      Alert.alert(
        "SMS SOS limit reached",
        `You've used all ${quota.limit} SMS SOS alerts for this month. The allowance resets on the 1st. Call emergency services instead?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: `Call ${settings.policeNumber}`, onPress: () => Linking.openURL(`tel:${settings.policeNumber}`).catch(() => {}) },
        ]
      );
      return false;
    }
    const available = await SMS.isAvailableAsync();
    if (!available) {
      Alert.alert("SMS unavailable", "This device can't send SMS. Please call emergency services directly.");
      return false;
    }
    const { result } = await SMS.sendSMSAsync(emergencyContacts.map((c) => c.phone), message);
    if (result === "cancelled") return false;
    const q = await consumeSmsSosQuota();
    setSmsQuota(q);
    return true;
  };

  // Opens WhatsApp with the message ready. Tries the app link first, then the universal wa.me link
  // (which works even when the phone hides app-to-app detection), so it no longer silently falls back to SMS.
  const openWhatsApp = async (phone: string, message: string): Promise<boolean> => {
    const num = normalizePhone(phone, false);
    const text = encodeURIComponent(message);
    try {
      await Linking.openURL(`whatsapp://send?phone=${num}&text=${text}`);
      return true;
    } catch {
      try {
        await Linking.openURL(`https://wa.me/${num}?text=${text}`);
        return true;
      } catch {
        return false;
      }
    }
  };

  const fireSosProtocol = async () => {
    setAlertSent(true);
    const net = await NetInfo.fetch();
    // Only treat as offline when the phone is clearly offline (null/unknown counts as online)
    const online = net.isConnected !== false && net.isInternetReachable !== false;
    setSosWasOnline(online);

    const userName = user?.full_name || localName || "Someone";
    let message = settings.customMessage?.trim() ? settings.customMessage.trim() : `🚨 SOS ALERT from ${userName}: I am in an emergency.`;
    if (settings.locationSharing) {
      message += ` My last known location: ${currentLocation}.`;
      if (currentCoords) message += ` ${googleMapsLink(currentCoords.lat, currentCoords.lng)}`;
    }
    message += ` Please send help immediately. Download Strompulse to view more details: strompulse.com/live`;
    setSosMessage(message);

    const channels: string[] = [];

    if (online) {
      // 1) In-app alert to all emergency contacts (not awaited, so nothing is delayed)
      if (settings.notifyInApp) {
        const phones = emergencyContacts.map((c) => normalizePhone(c.phone));
        Promise.resolve(
          sendPushAlert("emergency", `SOS alert from ${userName}`, message, phones, {
            kind: "sos", senderName: userName,
            ...(settings.locationSharing && currentCoords ? { lat: currentCoords.lat, lng: currentCoords.lng } : {}),
          })
        ).catch(() => {});
        channels.push("StromPulse in-app alert");
      }
      // Live location for contacts who open the SOS in StromPulse (stops after 1 hour or "I'm Safe")
      if (settings.locationSharing && currentCoords) {
        startSosLiveSharing(userName, currentCoords, emergencyContacts.map((c) => normalizePhone(c.phone))).then((ok) => setSosLiveOn(ok)).catch(() => {});
      }
      // 2) WhatsApp to the first emergency contact — others can be messaged from the SOS Sent screen
      if (settings.notifyWhatsApp) {
        const opened = await openWhatsApp(emergencyContacts[0].phone, message);
        if (opened) channels.push("WhatsApp");
        else if (settings.notifySms && (await sendSmsSos(message))) channels.push("SMS");
      } else if (!settings.notifyInApp && settings.notifySms && (await sendSmsSos(message))) {
        channels.push("SMS");
      }
    } else if (settings.notifySms) {
      // Offline → SMS (needs network signal, not data)
      if (await sendSmsSos(message)) channels.push("SMS");
    }

    setSosChannels(channels);
    holdProgress.setValue(0);
  };

  const triggerEmergencyProtocol = () => {
    if (emergencyContacts.length === 0) {
      holdProgress.setValue(0);
      Alert.alert("No Emergency Contacts", "Add at least one emergency contact before using SOS.", [
        { text: "Cancel", style: "cancel" },
        { text: "Add Contacts", onPress: () => navigation.navigate("ContactsScreen") },
      ]);
      return;
    }
    fireSosProtocol();
  };

  const handlePressIn = () => {
    Animated.timing(holdProgress, { toValue: 1, duration: 3000, useNativeDriver: false }).start(({ finished }) => {
      if (finished) triggerEmergencyProtocol();
    });
  };

  const handlePressOut = () => {
    if (!alertSent) {
      holdProgress.stopAnimation();
      Animated.timing(holdProgress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    }
  };

  const copyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location needed", "Allow location access to copy your live location.");
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    await Clipboard.setStringAsync(googleMapsLink(loc.coords.latitude, loc.coords.longitude));
    Alert.alert("Link Copied", "Your current location link was copied to the clipboard.");
  };

  const openDirections = (place: any) => {
    if (!currentCoords) {
      Alert.alert("Location needed", "We couldn't find your current location yet.");
      return;
    }
    navigation.navigate("EmergencyDirectionScreen", {
      userLat: currentCoords.lat, userLng: currentCoords.lng,
      destLat: place.lat, destLng: place.lng,
      destName: place.name, destAddress: place.address,
      destinationName: place.name, address: place.address,
    });
  };

  // ---------------- SOS SENT SCREEN ----------------
  if (alertSent) {
    return (
      <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <SafeAreaView style={{ flex: 1 }}>
          <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={16}>
            <TouchableOpacity onPress={() => { setAlertSent(false); holdProgress.setValue(0); }} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: divider }}>
              <Feather name="chevron-left" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <YStack marginLeft={16}>
              <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>SOS Sent</TText>
              <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2} letterSpacing={1}>{sosWasOnline ? "ONLINE DELIVERY" : "OFFLINE DELIVERY"}</TText>
            </YStack>
          </XStack>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 24 }}>
            <YStack alignItems="center" marginTop={24} marginBottom={28}>
              <YStack width={100} height={100} borderRadius={50} backgroundColor="#EF4444" justifyContent="center" alignItems="center" marginBottom={20}>
                <Feather name="alert-triangle" size={48} color="#FFFFFF" />
              </YStack>
              <TText fontFamily="Chirp-Heavy" fontSize={24} color={theme.textPrimary} marginBottom={8} textAlign="center">
                {sosChannels.length > 0 ? "Broadcast Active" : "Alert Not Delivered"}
              </TText>
              <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} textAlign="center" lineHeight={20}>
                {sosChannels.length > 0
                  ? `Your emergency contacts were alerted via ${sosChannels.join(", ")}.`
                  : "No alert could be sent. Please call emergency services directly."}
              </TText>
            </YStack>

            {sosLiveOn && (
              <YStack backgroundColor={isDarkMode ? "rgba(239,68,68,0.10)" : "#FEECEC"} borderRadius={20} borderWidth={1} borderColor={isDarkMode ? "rgba(239,68,68,0.45)" : "#F8B4B4"} padding={16} marginBottom={16}>
                <XStack alignItems="center" gap={10} marginBottom={10}>
                  <YStack width={10} height={10} borderRadius={5} backgroundColor="#DC2626" />
                  <YStack flex={1}>
                    <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary}>Sharing your live location</TText>
                    <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>Contacts on StromPulse can see you move for the next hour</TText>
                  </YStack>
                </XStack>
                <TouchableOpacity onPress={async () => { await stopSosLiveSharing(); setSosLiveOn(false); }}>
                  <XStack backgroundColor="#00C48A" borderRadius={14} paddingVertical={12} justifyContent="center" alignItems="center" gap={8}>
                    <Feather name="check-circle" size={14} color="#FFF" />
                    <TText fontFamily="Chirp-Bold" fontSize={13} color="#FFF">I'm Safe — Stop Sharing</TText>
                  </XStack>
                </TouchableOpacity>
              </YStack>
            )}

            <YStack backgroundColor={cardBg} borderRadius={20} borderWidth={1} borderColor={divider} padding={16} marginBottom={16}>
              <XStack alignItems="center" justifyContent="space-between">
                <XStack alignItems="center" gap={10}>
                  <Feather name="message-square" size={16} color="#3B82F6" />
                  <TText fontFamily="Chirp-Bold" fontSize={13} color={theme.textPrimary}>SMS SOS this month</TText>
                </XStack>
                <TText fontFamily="Chirp-Heavy" fontSize={13} color={smsQuota.remaining > 0 ? "#00C48A" : "#EF4444"}>
                  {smsQuota.remaining} of {smsQuota.limit} left
                </TText>
              </XStack>
            </YStack>

            {emergencyContacts.length > 0 && !!sosMessage && (
              <YStack backgroundColor={cardBg} borderRadius={20} borderWidth={1} borderColor={divider} padding={16} marginBottom={16}>
                <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1} marginBottom={12}>SEND TO EACH CONTACT</TText>
                {emergencyContacts.map((c, i) => (
                  <XStack key={c.id || i} alignItems="center" paddingVertical={8} borderTopWidth={i === 0 ? 0 : 1} borderColor={isDarkMode ? "#1F2E27" : "#F1F5F9"}>
                    <TText flex={1} fontFamily="Chirp-Bold" fontSize={14} color={theme.textPrimary} numberOfLines={1}>{c.name}</TText>
                    <TouchableOpacity onPress={() => openWhatsApp(c.phone, sosMessage)}>
                      <XStack backgroundColor="#25D366" borderRadius={12} paddingHorizontal={12} paddingVertical={8} alignItems="center" gap={6} marginRight={8}>
                        <Feather name="message-circle" size={12} color="#FFF" />
                        <TText fontFamily="Chirp-Bold" fontSize={11} color="#FFF">WhatsApp</TText>
                      </XStack>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={async () => { if (await SMS.isAvailableAsync()) SMS.sendSMSAsync([c.phone], sosMessage); }}>
                      <XStack backgroundColor="#3B82F6" borderRadius={12} paddingHorizontal={12} paddingVertical={8} alignItems="center" gap={6}>
                        <Feather name="message-square" size={12} color="#FFF" />
                        <TText fontFamily="Chirp-Bold" fontSize={11} color="#FFF">SMS</TText>
                      </XStack>
                    </TouchableOpacity>
                  </XStack>
                ))}
              </YStack>
            )}

            <XStack gap={12} marginBottom={16}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${settings.policeNumber}`).catch(() => {})}>
                <XStack backgroundColor="#3B82F6" borderRadius={16} paddingVertical={14} justifyContent="center" alignItems="center" gap={8}>
                  <Feather name="phone" size={14} color="#FFF" />
                  <TText fontFamily="Chirp-Bold" fontSize={13} color="#FFF">Police {settings.policeNumber}</TText>
                </XStack>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${settings.ambulanceNumber}`).catch(() => {})}>
                <XStack backgroundColor="#EF4444" borderRadius={16} paddingVertical={14} justifyContent="center" alignItems="center" gap={8}>
                  <Feather name="phone" size={14} color="#FFF" />
                  <TText fontFamily="Chirp-Bold" fontSize={13} color="#FFF">Ambulance {settings.ambulanceNumber}</TText>
                </XStack>
              </TouchableOpacity>
            </XStack>

            <TouchableOpacity onPress={() => { setAlertSent(false); holdProgress.setValue(0); }}>
              <YStack backgroundColor={cardBg} borderWidth={1} borderColor={divider} borderRadius={20} paddingVertical={18} alignItems="center">
                <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Close Alert Interface</TText>
              </YStack>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </YStack>
    );
  }

  // One compact row per category: just the closest place. The full top-3 list lives on EmergencyMapScreen.
  const NEARBY_CATEGORIES = [
    { key: "hospital", label: "CLOSEST HOSPITAL", icon: "plus", color: "#EF4444", list: nearbyHospitals },
    { key: "pharmacy", label: "CLOSEST PHARMACY", icon: "package", color: "#8B5CF6", list: nearbyPharmacies },
    { key: "police", label: "CLOSEST POLICE STATION", icon: "shield", color: "#3B82F6", list: nearbyPolice },
  ];

  const openEmergencyMap = (focus?: string) =>
    navigation.navigate("EmergencyMapScreen", { userLat: currentCoords?.lat, userLng: currentCoords?.lng, focus });

  const renderClosestRow = (cat: (typeof NEARBY_CATEGORIES)[number], isLast: boolean) => {
    const p = cat.list[0];
    return (
      <TouchableOpacity key={cat.key} activeOpacity={0.8} onPress={() => openEmergencyMap(cat.key)}>
        <XStack alignItems="center" paddingVertical={10} borderBottomWidth={isLast ? 0 : 1} borderColor={isDarkMode ? "#1F2E27" : "#F1F5F9"}>
          <YStack width={36} height={36} borderRadius={18} backgroundColor={`${cat.color}1A`} justifyContent="center" alignItems="center" marginRight={12}>
            <Feather name={cat.icon as any} size={16} color={cat.color} />
          </YStack>
          <YStack flex={1} paddingRight={8}>
            <TText fontFamily="Chirp-Bold" fontSize={9} color={cat.color} letterSpacing={0.8} marginBottom={2}>{cat.label}</TText>
            {nearbyLoading ? (
              <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Searching...</TText>
            ) : p ? (
              <>
                <TText fontFamily="Chirp-Heavy" fontSize={13} color={theme.textPrimary} numberOfLines={1}>{p.name}</TText>
                <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>{p.dist} km • ~{p.time} min</TText>
              </>
            ) : (
              <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>None found within 8 km</TText>
            )}
          </YStack>
          {p && !nearbyLoading && (
            <TouchableOpacity onPress={() => openDirections(p)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <XStack backgroundColor="#00C48A" borderRadius={12} paddingHorizontal={10} paddingVertical={7} alignItems="center" gap={5}>
                <Feather name="navigation" size={11} color="#FFF" />
                <TText fontFamily="Chirp-Bold" fontSize={11} color="#FFF">Go</TText>
              </XStack>
            </TouchableOpacity>
          )}
        </XStack>
      </TouchableOpacity>
    );
  };

  const prefsBg = isDarkMode ? "#064E3B" : "#14532D";
  const sosBg = isDarkMode ? "rgba(239,68,68,0.10)" : "#FEECEC";
  const sosBorder = isDarkMode ? "rgba(239,68,68,0.45)" : "#F8B4B4";
  const sosText = isDarkMode ? "#FCA5A5" : "#B91C1C";

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        <XStack justifyContent="space-between" alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={16} borderBottomWidth={1} borderBottomColor={divider}>
          <Image source={require("../../assets/images/strompulselogo.png")} style={{ width: 40, height: 40, resizeMode: "contain" }} />
          <YStack position="absolute" left={0} right={0} alignItems="center" pointerEvents="none">
            <TText style={{ fontFamily: "SoraTitle-Bold", fontSize: 22 }} color={theme.textPrimary}>Strompulse</TText>
          </YStack>
          <TouchableOpacity onPress={() => toggleSidebar(true)} style={{ padding: 4 }}>
            <Feather name="menu" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
          <YStack alignItems="center" marginBottom={14} marginTop={14}>
            <XStack backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} paddingHorizontal={12} paddingVertical={6} borderRadius={16} borderWidth={1} borderColor={isDarkMode ? "#047857" : "#A7F3D0"} alignItems="center" gap={6}>
              <YStack width={6} height={6} borderRadius={3} backgroundColor="#00C48A" />
              <TText fontFamily="Chirp-Bold" fontSize={11} color="#00C48A" letterSpacing={0.5}>SAFETY & SECURITY SYSTEM</TText>
            </XStack>
          </YStack>

          {/* 1. Security Preferences — deep green, first */}
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate("SafetySettingsScreen")}>
            <XStack backgroundColor={prefsBg} borderRadius={20} paddingVertical={14} paddingHorizontal={16} alignItems="center" marginBottom={12}>
              <YStack width={42} height={42} borderRadius={12} backgroundColor="rgba(255,255,255,0.14)" justifyContent="center" alignItems="center" marginRight={14}>
                <Feather name="settings" size={20} color="#FFFFFF" />
              </YStack>
              <YStack flex={1}>
                <TText fontFamily="Chirp-Heavy" fontSize={16} color="#FFFFFF" marginBottom={2}>Security Preferences</TText>
                <TText fontFamily="Chirp-Medium" fontSize={12} color="rgba(255,255,255,0.75)" numberOfLines={1}>Contacts, alert delivery, emergency numbers</TText>
              </YStack>
              <Feather name="chevron-right" size={20} color="#FFFFFF" />
            </XStack>
          </TouchableOpacity>

          {/* 2. Quick actions */}
          <XStack marginBottom={12} justifyContent="space-between" gap={8}>
            {[
              { label: "Tools", icon: "shield", onPress: () => navigation.navigate("SafetyToolsScreen") },
              { label: "Copy Location", icon: "copy", onPress: copyLocation },
              { label: "Tips", icon: "file-text", onPress: () => navigation.navigate("SafetyTipsScreen") },
            ].map((a) => (
              <TouchableOpacity key={a.label} onPress={a.onPress} style={{ flex: 1 }} activeOpacity={0.8}>
                <XStack paddingVertical={10} alignItems="center" justifyContent="center" borderRadius={24} borderWidth={1} borderColor={divider} backgroundColor={cardBg} gap={6}>
                  <Feather name={a.icon as any} size={14} color="#00C48A" />
                  <TText fontFamily="Chirp-Bold" fontSize={12} color={theme.textPrimary} numberOfLines={1}>{a.label}</TText>
                </XStack>
              </TouchableOpacity>
            ))}
          </XStack>

          {/* 3. Share My Journey */}
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate("JourneyShareScreen", { isJourneyActive })}>
            <XStack backgroundColor={cardBg} borderRadius={20} paddingVertical={14} paddingHorizontal={16} alignItems="center" marginBottom={12} borderWidth={1} borderColor="#00C48A">
              <YStack width={42} height={42} borderRadius={21} backgroundColor={isDarkMode ? "rgba(0,196,138,0.2)" : "#C6E8D9"} justifyContent="center" alignItems="center" marginRight={14}>
                <Feather name="navigation" size={18} color="#00C48A" />
              </YStack>
              <YStack flex={1}>
                <XStack alignItems="center" gap={8} marginBottom={2}>
                  <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary}>Share My Journey</TText>
                  {isJourneyActive && (
                    <YStack backgroundColor="#00C48A" paddingHorizontal={6} paddingVertical={2} borderRadius={6}>
                      <TText fontFamily="Chirp-Bold" fontSize={9} color="#FFF">LIVE</TText>
                    </YStack>
                  )}
                </XStack>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Live trip tracking until you check in</TText>
              </YStack>
              <YStack width={30} height={30} borderRadius={15} backgroundColor="#00C48A" justifyContent="center" alignItems="center">
                <Feather name="arrow-right" size={14} color="#FFF" />
              </YStack>
            </XStack>
          </TouchableOpacity>

          {/* 4. SOS — light red */}
          <YStack backgroundColor={sosBg} borderRadius={20} paddingVertical={18} paddingHorizontal={16} marginBottom={12} borderWidth={1} borderColor={sosBorder}>
            <XStack alignItems="center" justifyContent="center" marginBottom={14}>
              <YStack backgroundColor={isDarkMode ? "rgba(239,68,68,0.18)" : "#FBD5D5"} paddingHorizontal={10} paddingVertical={4} borderRadius={8}>
                <TText fontFamily="Chirp-Bold" fontSize={10} color={sosText} letterSpacing={0.8}>SOS · ONE-TIME EMERGENCY ALERT</TText>
              </YStack>
            </XStack>
            <View style={{ alignItems: "center", justifyContent: "center", height: 130, width: "100%", marginBottom: 14 }}>
              <View style={{ position: "absolute", width: 130, height: 130, borderRadius: 65, borderWidth: 1, borderColor: isDarkMode ? "rgba(239,68,68,0.35)" : "#F8B4B4", backgroundColor: isDarkMode ? "rgba(239,68,68,0.12)" : "#FDDCDC" }} />
              <Svg width={BUTTON_SIZE} height={BUTTON_SIZE} style={{ position: "absolute", zIndex: 10 }} pointerEvents="none">
                <AnimatedCircle cx={BUTTON_SIZE / 2} cy={BUTTON_SIZE / 2} r={CIRCLE_RADIUS} stroke="#DC2626" strokeWidth="8" fill="none" strokeDasharray={CIRCLE_CIRCUMFERENCE} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform={`rotate(-90 ${BUTTON_SIZE / 2} ${BUTTON_SIZE / 2})`} />
              </Svg>
              <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} style={{ width: 100, height: 100, borderRadius: 50, zIndex: 20, overflow: "hidden" }}>
                <YStack flex={1} backgroundColor="#DC2626" justifyContent="center" alignItems="center">
                  <Feather name="phone-call" size={24} color="#FFFFFF" style={{ marginBottom: 4 }} />
                  <TText fontFamily="Chirp-Heavy" fontSize={24} color="#FFFFFF" letterSpacing={1}>SOS</TText>
                </YStack>
              </Pressable>
            </View>
            <TText fontFamily="Chirp-Medium" fontSize={13} color={sosText} textAlign="center" marginBottom={12} paddingHorizontal={8}>
              Hold the SOS button for 3 seconds to alert your emergency contacts
            </TText>
            <XStack justifyContent="center" alignItems="center" gap={6} backgroundColor={isDarkMode ? "rgba(239,68,68,0.12)" : "#FDDCDC"} borderRadius={12} paddingVertical={8}>
              <Feather name="message-square" size={12} color={sosText} />
              <TText fontFamily="Chirp-Bold" fontSize={11} color={sosText}>
                {smsQuota.remaining} of {smsQuota.limit} SMS SOS alerts remaining this month
              </TText>
            </XStack>
            {sosLiveOn && (
              <XStack marginTop={10} alignItems="center" justifyContent="space-between" backgroundColor={cardBg} borderRadius={12} paddingVertical={8} paddingHorizontal={12} borderWidth={1} borderColor={sosBorder}>
                <XStack alignItems="center" gap={8} flex={1}>
                  <YStack width={8} height={8} borderRadius={4} backgroundColor="#DC2626" />
                  <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textPrimary} numberOfLines={1}>SOS live location is ON</TText>
                </XStack>
                <TouchableOpacity onPress={async () => { await stopSosLiveSharing(); setSosLiveOn(false); }}>
                  <TText fontFamily="Chirp-Bold" fontSize={11} color="#00C48A">I'm Safe · Stop</TText>
                </TouchableOpacity>
              </XStack>
            )}
          </YStack>

          {/* 5. Nearby Help — closest of each; tap to see top 3 */}
          <YStack backgroundColor={cardBg} borderRadius={20} borderWidth={1} borderColor="#00C48A" paddingVertical={14} paddingHorizontal={16} marginBottom={12}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => openEmergencyMap()}>
              <XStack justifyContent="space-between" alignItems="center" marginBottom={12}>
                <YStack flex={1}>
                  <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary} marginBottom={2}>Nearby Help</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Closest hospital, pharmacy & police</TText>
                </YStack>
                <YStack width={30} height={30} borderRadius={15} backgroundColor="#00C48A" justifyContent="center" alignItems="center">
                  <Feather name="arrow-right" size={14} color="#FFF" />
                </YStack>
              </XStack>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.9} onPress={() => openEmergencyMap()}>
              <YStack height={120} borderRadius={14} overflow="hidden" backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} marginBottom={6}>
                {currentCoords ? (
                  <MapView
                    style={{ ...StyleSheet.absoluteFillObject }}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={{ latitude: currentCoords.lat, longitude: currentCoords.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
                    scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false} pointerEvents="none"
                  >
                    <Marker coordinate={{ latitude: currentCoords.lat, longitude: currentCoords.lng }}>
                      <YStack width={20} height={20} borderRadius={10} backgroundColor="rgba(0,196,138,0.3)" justifyContent="center" alignItems="center">
                        <YStack width={10} height={10} borderRadius={5} backgroundColor="#00C48A" borderWidth={1.5} borderColor="#FFF" />
                      </YStack>
                    </Marker>
                    {NEARBY_CATEGORIES.map((cat) => cat.list[0] ? (
                      <Marker key={cat.key} coordinate={{ latitude: cat.list[0].lat, longitude: cat.list[0].lng }}>
                        <YStack width={18} height={18} borderRadius={9} backgroundColor={cat.color} justifyContent="center" alignItems="center" borderWidth={2} borderColor="#FFF">
                          <Feather name={cat.icon as any} size={9} color="#FFF" />
                        </YStack>
                      </Marker>
                    ) : null)}
                  </MapView>
                ) : (
                  <YStack flex={1} justifyContent="center" alignItems="center">
                    <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Loading map...</TText>
                  </YStack>
                )}
              </YStack>
            </TouchableOpacity>

            {NEARBY_CATEGORIES.map((cat, i) => renderClosestRow(cat, i === NEARBY_CATEGORIES.length - 1))}

            <TouchableOpacity onPress={() => openEmergencyMap()}>
              <XStack marginTop={8} paddingTop={10} borderTopWidth={1} borderColor={isDarkMode ? "#1F2E27" : "#F1F5F9"} justifyContent="center" alignItems="center" gap={6}>
                <TText fontFamily="Chirp-Bold" fontSize={12} color="#00C48A">See 3 closest of each</TText>
                <Feather name="chevron-right" size={14} color="#00C48A" />
              </XStack>
            </TouchableOpacity>
          </YStack>

          {/* Emergency Contacts */}
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate("ContactsScreen")}>
            <YStack backgroundColor={cardBg} borderRadius={20} paddingVertical={14} paddingHorizontal={16} borderWidth={1} borderColor="#00C48A">
              <XStack justifyContent="space-between" alignItems="flex-start" marginBottom={12}>
                <YStack flex={1}>
                  <XStack alignItems="center" marginBottom={4}>
                    <Feather name="users" size={16} color={theme.textPrimary} style={{ marginRight: 8 }} />
                    <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary}>Emergency Contacts</TText>
                  </XStack>
                  <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>{emergencyContacts.length} of 3 contacts will be alerted</TText>
                </YStack>
                <TText fontFamily="Chirp-Bold" fontSize={13} color="#00C48A">Manage</TText>
              </XStack>
              <XStack gap={16} alignItems="center">
                {emergencyContacts.slice(0, 3).map((contact, i) => (
                  <YStack key={i} alignItems="center">
                    <YStack width={48} height={48} borderRadius={24} backgroundColor={isDarkMode ? contact.bgDark : contact.bg} justifyContent="center" alignItems="center" marginBottom={6}>
                      <TText fontFamily="Chirp-Heavy" fontSize={18} color={contact.color}>{contact.initial}</TText>
                    </YStack>
                    <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>{contact.name.split(" ")[0]}</TText>
                  </YStack>
                ))}
                {emergencyContacts.length < 3 && (
                  <YStack alignItems="center">
                    <YStack width={48} height={48} borderRadius={24} backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} justifyContent="center" alignItems="center" marginBottom={6} borderWidth={1} borderColor={divider} borderStyle="dashed">
                      <Feather name="plus" size={18} color="#00C48A" />
                    </YStack>
                    <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>Add</TText>
                  </YStack>
                )}
              </XStack>
              <XStack marginTop={12} paddingTop={10} borderTopWidth={1} borderColor={isDarkMode ? "#1F2E27" : "#F1F5F9"} alignItems="flex-start" gap={8}>
                <Feather name="info" size={12} color={theme.textSecondary} style={{ marginTop: 2 }} />
                <TText flex={1} fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} lineHeight={16}>
                  Contacts on StromPulse get an in-app alert. Others get WhatsApp when you're online, or SMS when you're offline.
                </TText>
              </XStack>
            </YStack>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      {isSidebarOpen && (
        <YStack position="absolute" top={0} left={0} right={0} bottom={0} zIndex={99999}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} activeOpacity={1} onPress={() => toggleSidebar(false)} />
          <Animated.View style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: width * 0.78, backgroundColor: cardBg, transform: [{ translateX: sidebarAnim }], paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 24 : 50, paddingHorizontal: 20, borderLeftWidth: 1, borderLeftColor: divider, elevation: 20, shadowColor: "#000", shadowOffset: { width: -5, height: 0 }, shadowOpacity: 0.3, shadowRadius: 15 }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <TouchableOpacity onPress={() => toggleSidebar(false)} style={{ alignSelf: "flex-end", padding: 8, marginBottom: 12 }}>
                <Feather name="x" size={24} color={theme.textPrimary} />
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.8} onPress={() => { toggleSidebar(false); navigation.navigate("Profile"); }} style={{ flexDirection: "row", alignItems: "center", marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: isDarkMode ? "#1F2E27" : "#F1F5F9" }}>
                {displayAvatar ? (
                  <Image source={{ uri: displayAvatar }} style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: "#00C48A", marginRight: 14 }} />
                ) : (
                  <YStack width={56} height={56} borderRadius={28} backgroundColor="#064E3B" justifyContent="center" alignItems="center" borderWidth={2} borderColor="#00C48A" marginRight={14}>
                    <TText fontFamily="Chirp-Heavy" fontSize={22} color="#FFFFFF">{fullName.charAt(0).toUpperCase()}</TText>
                  </YStack>
                )}
                <YStack flex={1}>
                  <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary} numberOfLines={1}>{fullName}</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={12} color="#00C48A" marginTop={2}>View Profile →</TText>
                </YStack>
              </TouchableOpacity>

              <YStack gap={4} marginBottom={28} paddingBottom={20} borderBottomWidth={1} borderBottomColor={isDarkMode ? "#1F2E27" : "#F1F5F9"}>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("Profile"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="user" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Profile</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("RequestDeviceScreen"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="cpu" size={20} color="#00C48A" />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color="#00C48A">Become a Stromer</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("MySubscriptionsScreen"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="bookmark" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>My Subscriptions</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("AboutScreen"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="info" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>About Strompulse</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("PrivacySecurityScreen"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="shield" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Privacy and Security</TText>
                </TouchableOpacity>
              </YStack>

              <YStack gap={4}>
                <XStack paddingVertical={14} alignItems="center" justifyContent="space-between">
                  <XStack alignItems="center" gap={16}>
                    <Feather name="moon" size={20} color={theme.textPrimary} />
                    <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Dark Mode</TText>
                  </XStack>
                  <Switch value={isDarkMode} onValueChange={() => toggleDarkMode()} trackColor={{ false: theme.border, true: "#00C48A" }} thumbColor="#FFFFFF" />
                </XStack>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("SettingsScreen", { currentName: fullName, currentImage: displayAvatar }); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="settings" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Settings</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("HelpSupportScreen"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="help-circle" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Help Center</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleLogoutPress} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 }}>
                  <Feather name="log-out" size={20} color="#EF4444" />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color="#EF4444">Log out</TText>
                </TouchableOpacity>
              </YStack>
            </ScrollView>
          </Animated.View>
        </YStack>
      )}
    </YStack>
  );
};

export default SafetyScreen;