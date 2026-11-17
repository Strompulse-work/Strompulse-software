import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Platform, StatusBar, Animated, SafeAreaView, Dimensions, Easing,
  ScrollView, Alert, TouchableOpacity, View, Image, Switch, StyleSheet, Modal, Vibration
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import * as SMS from "expo-sms";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import AuthService from "../services/authService";
import { useFocusEffect } from "@react-navigation/native";
import { sendPushAlert } from "../utils/sendAlert";
import { startSosLiveSharing, stopSosLiveSharing, isSosLiveSharing } from "../utils/sosLiveLocation";
import { getMyIdentity } from "../utils/myIdentity";
import { loadGroups, buildRecipients, SafetyGroup, GroupMember } from "../utils/safetyGroups";
import { logSafetyEvent } from "../utils/safetyHistory";
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
const SOS_COUNTDOWN_SECONDS = 5;

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
  const soft = isDarkMode ? "#1F2E27" : "#F1F5F9";

  const [isJourneyActive, setIsJourneyActive] = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const [sosChannels, setSosChannels] = useState<string[]>([]);
  const [sosWasOnline, setSosWasOnline] = useState(true);
  const [sosMessage, setSosMessage] = useState("");
  const [sosRecipients, setSosRecipients] = useState<GroupMember[]>([]);
  const [sosLiveOn, setSosLiveOn] = useState(isSosLiveSharing());
  const [currentLocation, setCurrentLocation] = useState("Locating...");
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [sosGroups, setSosGroups] = useState<SafetyGroup[]>([]);
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

  // SOS countdown (tap once → 5 s → send, unless cancelled)
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
        sendPushAlert("location_share", `${name} shared their location`, `Scheduled location update: ${place}. ${googleMapsLink(coords.lat, coords.lng)}`, phones, {
          kind: "location", senderName: name, lat: coords.lat, lng: coords.lng,
          recipientNames: contacts.map((c) => c.name),
        })
      ).catch(() => {});
      logSafetyEvent({ type: "location_share", at: Date.now(), recipients: contacts.map((c) => ({ name: c.name, phone: c.phone })) });
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

        // Communities that the user chose to alert on SOS
        loadGroups().then(({ mine }) => { if (active) setSosGroups(mine.filter((g) => g.alert_on_sos && g.members.length > 0)); }).catch(() => {});

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

  useEffect(() => () => { if (countdownTimer.current) clearInterval(countdownTimer.current); }, []);

  // Gentle pulse on the SOS button
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

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
  const RING = 190;
  const RING_R = RING / 2 - 8;
  const RING_C = 2 * Math.PI * RING_R;
  const ringOffset = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0, RING_C] });

  const recipientsForSos = () => buildRecipients(
    emergencyContacts.map((c) => ({ name: c.name, phone: c.phone })),
    sosGroups,
  );

  const sendSmsSos = async (message: string, phones: string[]): Promise<boolean> => {
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
    const { result } = await SMS.sendSMSAsync(phones, message);
    if (result === "cancelled") return false;
    const q = await consumeSmsSosQuota();
    setSmsQuota(q);
    return true;
  };

  // Opens WhatsApp with the message ready (app link first, then the universal wa.me link)
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
    const recipients = recipientsForSos();
    setSosRecipients(recipients);
    const phones = recipients.map((r) => r.phone);
    const groupNames = sosGroups.map((g) => g.name);

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
      // 1) In-app alert + push to every recipient (not awaited, so nothing is delayed)
      if (settings.notifyInApp) {
        Promise.resolve(
          sendPushAlert("emergency", `SOS alert from ${userName}`, message, phones, {
            kind: "sos", senderName: userName,
            recipientNames: recipients.map((r) => r.name),
            ...(groupNames.length ? { groupName: groupNames.join(", ") } : {}),
            ...(settings.locationSharing && currentCoords ? { lat: currentCoords.lat, lng: currentCoords.lng } : {}),
          })
        ).catch(() => {});
        channels.push("StromPulse in-app alert");
      }
      // Live location for recipients who open the SOS (stops after 1 hour or "I'm Safe")
      if (settings.locationSharing && currentCoords) {
        startSosLiveSharing(userName, currentCoords, phones).then((ok) => setSosLiveOn(ok)).catch(() => {});
      }
      // 2) WhatsApp to the first emergency contact — others can be messaged from the SOS Sent screen
      if (settings.notifyWhatsApp && recipients[0]) {
        const opened = await openWhatsApp(recipients[0].phone, message);
        if (opened) channels.push("WhatsApp");
        else if (settings.notifySms && (await sendSmsSos(message, phones))) channels.push("SMS");
      } else if (!settings.notifyInApp && settings.notifySms && (await sendSmsSos(message, phones))) {
        channels.push("SMS");
      }
    } else if (settings.notifySms) {
      // Offline → SMS (needs network signal, not data)
      if (await sendSmsSos(message, phones)) channels.push("SMS");
    }

    setSosChannels(channels);
    logSafetyEvent({ type: "sos", at: Date.now(), recipients, groupNames, channels });
  };

  const stopCountdown = () => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    countdownTimer.current = null;
    ringAnim.stopAnimation();
    Vibration.cancel();
    setCountdown(null);
  };

  const onSosPress = () => {
    if (recipientsForSos().length === 0) {
      Alert.alert("No Emergency Contacts", "Add at least one emergency contact (or a community set to receive SOS) before using SOS.", [
        { text: "Cancel", style: "cancel" },
        { text: "Add Contacts", onPress: () => navigation.navigate("ContactsScreen") },
      ]);
      return;
    }
    ringAnim.setValue(0);
    setCountdown(SOS_COUNTDOWN_SECONDS);
    Vibration.vibrate(200);
    Animated.timing(ringAnim, { toValue: 1, duration: SOS_COUNTDOWN_SECONDS * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    let left = SOS_COUNTDOWN_SECONDS;
    countdownTimer.current = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        stopCountdown();
        fireSosProtocol();
      } else {
        Vibration.vibrate(120);
        setCountdown(left);
      }
    }, 1000);
  };

  const cancelSos = () => {
    stopCountdown();
    logSafetyEvent({ type: "sos_cancelled", at: Date.now() });
  };

  const sendSosNow = () => {
    stopCountdown();
    fireSosProtocol();
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
            <TouchableOpacity onPress={() => setAlertSent(false)} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: divider }}>
              <Feather name="chevron-left" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <YStack marginLeft={16}>
              <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>SOS Sent</TText>
              <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2} letterSpacing={1}>{sosWasOnline ? "ONLINE DELIVERY" : "OFFLINE DELIVERY"}</TText>
            </YStack>
          </XStack>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 24 }}>
            <YStack alignItems="center" marginTop={16} marginBottom={24}>
              <YStack width={96} height={96} borderRadius={48} backgroundColor="#EF4444" justifyContent="center" alignItems="center" marginBottom={18}>
                <Feather name="alert-triangle" size={44} color="#FFFFFF" />
              </YStack>
              <TText fontFamily="Chirp-Heavy" fontSize={24} color={theme.textPrimary} marginBottom={8} textAlign="center">
                {sosChannels.length > 0 ? "Broadcast Active" : "Alert Not Delivered"}
              </TText>
              <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} textAlign="center" lineHeight={20}>
                {sosChannels.length > 0
                  ? `${sosRecipients.length} ${sosRecipients.length === 1 ? "person was" : "people were"} alerted via ${sosChannels.join(", ")}.`
                  : "No alert could be sent. Please call emergency services directly."}
              </TText>
            </YStack>

            {sosLiveOn && (
              <YStack backgroundColor={isDarkMode ? "rgba(239,68,68,0.10)" : "#FEF2F2"} borderRadius={20} borderWidth={1} borderColor={isDarkMode ? "rgba(239,68,68,0.45)" : "#FECACA"} padding={16} marginBottom={16}>
                <XStack alignItems="center" gap={10} marginBottom={10}>
                  <YStack width={10} height={10} borderRadius={5} backgroundColor="#DC2626" />
                  <YStack flex={1}>
                    <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary}>Sharing your live location</TText>
                    <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>The people alerted can see you move for the next hour</TText>
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

            {sosRecipients.length > 0 && !!sosMessage && (
              <YStack backgroundColor={cardBg} borderRadius={20} borderWidth={1} borderColor={divider} padding={16} marginBottom={16}>
                <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1} marginBottom={12}>SEND TO EACH PERSON</TText>
                {sosRecipients.map((c, i) => (
                  <XStack key={c.phone} alignItems="center" paddingVertical={8} borderTopWidth={i === 0 ? 0 : 1} borderColor={soft}>
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

            <TouchableOpacity onPress={() => setAlertSent(false)}>
              <YStack backgroundColor={cardBg} borderWidth={1} borderColor={divider} borderRadius={20} paddingVertical={18} alignItems="center">
                <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Close Alert Interface</TText>
              </YStack>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </YStack>
    );
  }

  // ---------------- Nearby help: closest of each, side by side ----------------
  const NEARBY_CATEGORIES = [
    { key: "hospital", label: "HOSPITAL", icon: "plus", color: "#EF4444", list: nearbyHospitals },
    { key: "pharmacy", label: "PHARMACY", icon: "package", color: "#8B5CF6", list: nearbyPharmacies },
    { key: "police", label: "POLICE", icon: "shield", color: "#3B82F6", list: nearbyPolice },
  ];

  const openEmergencyMap = (focus?: string) =>
    navigation.navigate("EmergencyMapScreen", { userLat: currentCoords?.lat, userLng: currentCoords?.lng, focus });

  const renderClosestTile = (cat: (typeof NEARBY_CATEGORIES)[number]) => {
    const p = cat.list[0];
    return (
      <TouchableOpacity key={cat.key} activeOpacity={0.85} style={{ flex: 1 }} onPress={() => openEmergencyMap(cat.key)}>
        <YStack flex={1} backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} borderRadius={14} padding={10} borderWidth={1} borderColor={soft}>
          <XStack alignItems="center" gap={6} marginBottom={6}>
            <YStack width={22} height={22} borderRadius={11} backgroundColor={`${cat.color}1A`} justifyContent="center" alignItems="center">
              <Feather name={cat.icon as any} size={11} color={cat.color} />
            </YStack>
            <TText fontFamily="Chirp-Bold" fontSize={8} color={cat.color} letterSpacing={0.6}>{cat.label}</TText>
          </XStack>
          {nearbyLoading ? (
            <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>Searching...</TText>
          ) : p ? (
            <>
              <TText fontFamily="Chirp-Heavy" fontSize={11} color={theme.textPrimary} numberOfLines={2} lineHeight={14} minHeight={28}>{p.name}</TText>
              <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2}>{p.dist} km · ~{p.time} min</TText>
              <TouchableOpacity onPress={() => openDirections(p)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <XStack marginTop={8} backgroundColor="#00C48A" borderRadius={10} paddingVertical={5} justifyContent="center" alignItems="center" gap={4}>
                  <Feather name="navigation" size={10} color="#FFF" />
                  <TText fontFamily="Chirp-Bold" fontSize={10} color="#FFF">Go</TText>
                </XStack>
              </TouchableOpacity>
            </>
          ) : (
            <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary}>None within 8 km</TText>
          )}
        </YStack>
      </TouchableOpacity>
    );
  };

  const smsUsed = smsQuota.used > 0;
  const sosNames = recipientsForSos().map((r) => r.name.split(" ")[0]);

  const QuickCard = ({ icon, iconBg, iconColor, title, subtitle, onPress, badge }: any) => (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <XStack backgroundColor={cardBg} borderRadius={20} paddingVertical={12} paddingHorizontal={14} alignItems="center" marginBottom={10} borderWidth={1} borderColor="#00C48A">
        <YStack width={40} height={40} borderRadius={20} backgroundColor={iconBg} justifyContent="center" alignItems="center" marginRight={12}>
          <Feather name={icon} size={18} color={iconColor} />
        </YStack>
        <YStack flex={1}>
          <XStack alignItems="center" gap={8}>
            <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary}>{title}</TText>
            {badge}
          </XStack>
          <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} numberOfLines={1}>{subtitle}</TText>
        </YStack>
        <YStack width={28} height={28} borderRadius={14} backgroundColor="#00C48A" justifyContent="center" alignItems="center">
          <Feather name="arrow-right" size={13} color="#FFF" />
        </YStack>
      </XStack>
    </TouchableOpacity>
  );

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header — "SAFETY & SECURITY" sits above the line */}
        <YStack paddingHorizontal={24} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={12} borderBottomWidth={1} borderBottomColor={divider}>
          <XStack justifyContent="space-between" alignItems="center">
            <Image source={require("../../assets/images/strompulselogo.png")} style={{ width: 40, height: 40, resizeMode: "contain" }} />
            <YStack position="absolute" left={0} right={0} alignItems="center" pointerEvents="none">
              <TText style={{ fontFamily: "SoraTitle-Bold", fontSize: 22 }} color={theme.textPrimary}>Strompulse</TText>
            </YStack>
            <TouchableOpacity onPress={() => toggleSidebar(true)} style={{ padding: 4 }}>
              <Feather name="menu" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
          </XStack>
          <XStack alignSelf="center" marginTop={8} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} paddingHorizontal={12} paddingVertical={5} borderRadius={16} borderWidth={1} borderColor={isDarkMode ? "#047857" : "#A7F3D0"} alignItems="center" gap={6}>
            <YStack width={6} height={6} borderRadius={3} backgroundColor="#00C48A" />
            <TText fontFamily="Chirp-Bold" fontSize={11} color="#00C48A" letterSpacing={0.5}>SAFETY & SECURITY</TText>
          </XStack>
        </YStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 120 }}>
          {/* 1. Security Preferences (white, like before) */}
          <QuickCard
            icon="settings" iconColor="#00C48A" iconBg={isDarkMode ? "rgba(0,196,138,0.2)" : "#C6E8D9"}
            title="Security Preferences" subtitle="Contacts, alert delivery, emergency numbers"
            onPress={() => navigation.navigate("SafetySettingsScreen")}
          />

          {/* 2. Tools · Communities · Analytics */}
          <XStack marginBottom={10} justifyContent="space-between" gap={8}>
            {[
              { label: "Tools", icon: "briefcase", onPress: () => navigation.navigate("SafetyToolsScreen") },
              { label: "Communities", icon: "users", onPress: () => navigation.navigate("CommunitiesScreen") },
              { label: "Analytics", icon: "bar-chart-2", onPress: () => navigation.navigate("SafetyAnalyticsScreen") },
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
          <QuickCard
            icon="navigation" iconColor="#00C48A" iconBg={isDarkMode ? "rgba(0,196,138,0.2)" : "#C6E8D9"}
            title="Share My Journey" subtitle="Live trip tracking until you check in"
            onPress={() => navigation.navigate("JourneyShareScreen", { isJourneyActive })}
            badge={isJourneyActive ? (
              <YStack backgroundColor="#00C48A" paddingHorizontal={6} paddingVertical={2} borderRadius={6}>
                <TText fontFamily="Chirp-Bold" fontSize={9} color="#FFF">LIVE</TText>
              </YStack>
            ) : null}
          />

          {/* 4. SOS — tap once, 5 s to cancel */}
          <YStack backgroundColor={cardBg} borderRadius={20} paddingVertical={14} paddingHorizontal={16} marginBottom={10} borderWidth={1} borderColor={isDarkMode ? "rgba(239,68,68,0.45)" : "#FECACA"} overflow="hidden">
            {/* soft decorative corners, as in the reference */}
            <View pointerEvents="none" style={{ position: "absolute", top: -40, left: -40, width: 110, height: 110, borderRadius: 55, backgroundColor: isDarkMode ? "rgba(239,68,68,0.08)" : "#FEF2F2" }} />
            <View pointerEvents="none" style={{ position: "absolute", bottom: -50, right: -40, width: 130, height: 130, borderRadius: 65, backgroundColor: isDarkMode ? "rgba(0,196,138,0.06)" : "#F0FDF4" }} />

            <XStack alignItems="center" justifyContent="center" marginBottom={10}>
              {smsUsed && (
                <XStack position="absolute" left={0} alignItems="center" gap={4} backgroundColor={smsQuota.remaining > 0 ? (isDarkMode ? "rgba(59,130,246,0.15)" : "#EFF6FF") : (isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2")} paddingHorizontal={7} paddingVertical={3} borderRadius={8}>
                  <Feather name="message-square" size={9} color={smsQuota.remaining > 0 ? "#3B82F6" : "#EF4444"} />
                  <TText fontFamily="Chirp-Bold" fontSize={9} color={smsQuota.remaining > 0 ? "#3B82F6" : "#EF4444"}>{smsQuota.remaining}/{smsQuota.limit} left</TText>
                </XStack>
              )}
              <YStack backgroundColor={isDarkMode ? "rgba(239,68,68,0.18)" : "#FEE2E2"} paddingHorizontal={10} paddingVertical={4} borderRadius={8}>
                <TText fontFamily="Chirp-Bold" fontSize={10} color="#DC2626" letterSpacing={0.8}>SOS · EMERGENCY ALERT</TText>
              </YStack>
            </XStack>

            <YStack alignItems="center" justifyContent="center" height={124}>
              <View style={{ position: "absolute", width: 124, height: 124, borderRadius: 62, backgroundColor: isDarkMode ? "rgba(239,68,68,0.12)" : "#FEE2E2" }} />
              <View style={{ position: "absolute", width: 106, height: 106, borderRadius: 53, backgroundColor: isDarkMode ? "rgba(239,68,68,0.2)" : "#FECACA" }} />
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity activeOpacity={0.85} onPress={onSosPress} style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: "#DC2626", justifyContent: "center", alignItems: "center", shadowColor: "#DC2626", shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
                  <Feather name="phone-call" size={20} color="#FFFFFF" style={{ marginBottom: 2 }} />
                  <TText fontFamily="Chirp-Heavy" fontSize={22} color="#FFFFFF" letterSpacing={1}>SOS</TText>
                </TouchableOpacity>
              </Animated.View>
            </YStack>

            {sosLiveOn && (
              <XStack marginTop={10} alignItems="center" justifyContent="space-between" backgroundColor={isDarkMode ? "#1A221E" : "#FFFFFF"} borderRadius={12} paddingVertical={8} paddingHorizontal={12} borderWidth={1} borderColor={isDarkMode ? "rgba(239,68,68,0.45)" : "#FECACA"}>
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

          {/* 5. Nearby Help — closest hospital, pharmacy & police in one row */}
          <YStack backgroundColor={cardBg} borderRadius={20} borderWidth={1} borderColor="#00C48A" paddingVertical={12} paddingHorizontal={14}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => openEmergencyMap()}>
              <XStack justifyContent="space-between" alignItems="center" marginBottom={10}>
                <YStack flex={1}>
                  <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary}>Nearby Help</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>Tap to see the 3 closest of each</TText>
                </YStack>
                <YStack width={28} height={28} borderRadius={14} backgroundColor="#00C48A" justifyContent="center" alignItems="center">
                  <Feather name="arrow-right" size={13} color="#FFF" />
                </YStack>
              </XStack>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.9} onPress={() => openEmergencyMap()}>
              <YStack height={96} borderRadius={14} overflow="hidden" backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} marginBottom={10}>
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

            <XStack gap={8}>
              {NEARBY_CATEGORIES.map(renderClosestTile)}
            </XStack>
          </YStack>
        </ScrollView>
      </SafeAreaView>

      {/* ---------- SOS countdown (red, 5 s, cancel) ---------- */}
      <Modal visible={countdown !== null} animationType="fade" transparent={false} onRequestClose={cancelSos} statusBarTranslucent>
        <YStack flex={1} backgroundColor="#DC1F1F" alignItems="center" justifyContent="space-between" paddingTop={Platform.OS === "ios" ? 90 : 60} paddingBottom={Platform.OS === "ios" ? 50 : 30} paddingHorizontal={28}>
          <YStack alignItems="center">
            <TText fontFamily="Chirp-Heavy" fontSize={26} color="#FFFFFF" textAlign="center" marginBottom={8}>Sending an SOS alert</TText>
            <TText fontFamily="Chirp-Medium" fontSize={15} color="rgba(255,255,255,0.9)" textAlign="center" lineHeight={22}>
              {sosNames.length > 0
                ? `Alerting ${sosNames.slice(0, 3).join(", ")}${sosNames.length > 3 ? ` +${sosNames.length - 3} more` : ""}${sosGroups.length ? ` (incl. ${sosGroups.map((g) => g.name).join(", ")})` : ""}`
                : "Alerting your emergency contacts"}
            </TText>
          </YStack>

          <YStack width={RING} height={RING} justifyContent="center" alignItems="center">
            <Svg width={RING} height={RING} style={{ position: "absolute" }}>
              <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke="rgba(255,255,255,0.25)" strokeWidth={8} fill="none" />
              <AnimatedCircle cx={RING / 2} cy={RING / 2} r={RING_R} stroke="#FFFFFF" strokeWidth={8} fill="none" strokeDasharray={RING_C} strokeDashoffset={ringOffset} strokeLinecap="round" transform={`rotate(-90 ${RING / 2} ${RING / 2})`} />
            </Svg>
            <YStack width={RING - 44} height={RING - 44} borderRadius={(RING - 44) / 2} backgroundColor="#E53935" justifyContent="center" alignItems="center" borderWidth={2} borderColor="rgba(255,255,255,0.35)">
              <TText fontFamily="Chirp-Heavy" fontSize={64} color="#FFFFFF">{countdown ?? ""}</TText>
            </YStack>
          </YStack>

          <YStack width="100%" alignItems="center">
            <TText fontFamily="Chirp-Medium" fontSize={14} color="rgba(255,255,255,0.9)" marginBottom={14}>Are you sure you need help?</TText>
            <TouchableOpacity onPress={cancelSos} style={{ width: "100%" }} activeOpacity={0.85}>
              <YStack backgroundColor="#FFFFFF" borderRadius={28} paddingVertical={16} alignItems="center">
                <TText fontFamily="Chirp-Heavy" fontSize={16} color="#DC1F1F">Cancel</TText>
              </YStack>
            </TouchableOpacity>
            <TouchableOpacity onPress={sendSosNow} style={{ marginTop: 16 }}>
              <TText fontFamily="Chirp-Bold" fontSize={13} color="#FFFFFF" textDecorationLine="underline">Send now</TText>
            </TouchableOpacity>
          </YStack>
        </YStack>
      </Modal>

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