import React, { useState, useRef, useCallback, useEffect } from "react";
import { 
  Platform, StatusBar, Animated, SafeAreaView, Dimensions, 
  ScrollView, Alert, TouchableOpacity, Pressable, View, Image, Switch, StyleSheet
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather, Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import * as SMS from "expo-sms";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";
import AuthService from "../services/authService";
import { useFocusEffect } from "@react-navigation/native";
import { sendPushAlert } from "../utils/sendAlert"; 
import { registerForPushNotificationsAsync } from "../utils/pushRegistration"; 
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

const { width } = Dimensions.get("window");
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const STORAGE_KEY = "strompulse_emergency_contacts";
const JOURNEY_KEY = "strompulse_journey_active";
const JOURNEY_CONTACTS_KEY = "strompulse_journey_contacts";
const SETTINGS_KEY = "strompulse_security_settings";

const GOOGLE_API_KEY = Platform.OS === 'ios' ? "AIzaSyCeWigeIvMAGJ_X-qj8UqY6CoGTbzBSHfA" : "AIzaSyB76SNOlgP1dkPZXhlPPIU_650y45Cd1Mo";

// Distance calculator (Haversine formula)
const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const SafetyScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode, toggleDarkMode } = useTheme();

  const [isJourneyActive, setIsJourneyActive] = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const [currentLocation, setCurrentLocation] = useState("Locating...");
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [securitySettings, setSecuritySettings] = useState({ locationSharing: true, sendSms: true, customMessage: "" });
  const [user, setUser] = useState<any>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(width)).current;
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);

  // Real-time Emergency Places State
  const [nearestHospital, setNearestHospital] = useState<any>(null);
  const [nearestPolice, setNearestPolice] = useState<any>(null);
  const [placesLastUpdated, setPlacesLastUpdated] = useState<number>(Date.now());
  const [updateTimeString, setUpdateTimeString] = useState("0s");

  // Background pulsing animation for the SOS button
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animatePulse = (anim: Animated.Value) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 3000, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true })
        ])
      ).start();
    };
    setTimeout(() => animatePulse(pulse1), 0);
    setTimeout(() => animatePulse(pulse2), 1000);
    setTimeout(() => animatePulse(pulse3), 2000);
  }, []);

  // Timer for "Updated Xs ago" badge
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - placesLastUpdated) / 1000);
      if (diff < 60) setUpdateTimeString(`${diff}s`);
      else setUpdateTimeString(`${Math.floor(diff / 60)}m`);
    }, 1000);
    return () => clearInterval(interval);
  }, [placesLastUpdated]);

  const fetchEmergencyPlaces = async (lat: number, lng: number) => {
    try {
      const headers: any = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location'
      };
      if (Platform.OS === 'ios') headers['X-Ios-Bundle-Identifier'] = 'com.strompulse.app';
      if (Platform.OS === 'android') headers['X-Android-Package'] = 'com.strompulse.app';

      const fetchNearest = async (type: string) => {
        const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            includedTypes: [type],
            maxResultCount: 10,
            locationRestriction: {
              circle: {
                center: { latitude: lat, longitude: lng },
                radius: 8000.0
              }
            }
          })
        });
        const data = await res.json();
        if (!data.places || data.places.length === 0) return null;
        
        // Find the closest out of the results
        let closest = data.places[0];
        let minDist = Infinity;
        data.places.forEach((p: any) => {
          if(p.location) {
            const dist = getDistanceFromLatLonInKm(lat, lng, p.location.latitude, p.location.longitude);
            if(dist < minDist) {
              minDist = dist;
              closest = p;
            }
          }
        });
        return closest;
      };

      const [nearestH, nearestP] = await Promise.all([
        fetchNearest('hospital'),
        fetchNearest('police')
      ]);

      if (nearestH && nearestH.location) {
        const hLat = nearestH.location.latitude;
        const hLng = nearestH.location.longitude;
        const dist = getDistanceFromLatLonInKm(lat, lng, hLat, hLng);
        setNearestHospital({ name: nearestH.displayName?.text || "Hospital", lat: hLat, lng: hLng, dist: dist.toFixed(1), time: Math.round(dist * 3) });
      }

      if (nearestP && nearestP.location) {
        const pLat = nearestP.location.latitude;
        const pLng = nearestP.location.longitude;
        const dist = getDistanceFromLatLonInKm(lat, lng, pLat, pLng);
        setNearestPolice({ name: nearestP.displayName?.text || "Police Station", lat: pLat, lng: pLng, dist: dist.toFixed(1), time: Math.round(dist * 3) });
      }

      setPlacesLastUpdated(Date.now());
    } catch (error) {
      console.error("Error fetching places", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const fetchRealtimeData = async () => {
        const session = await AuthService.getCurrentSession();
        if (session) {
          setUser(session.user);
          registerForPushNotificationsAsync(session.user.id);
        }

        const savedAvatar = await AsyncStorage.getItem("global_avatar");
        if (savedAvatar) setLocalAvatar(savedAvatar);
        
        const savedName = await AsyncStorage.getItem("global_name");
        if (savedName) setLocalName(savedName);

        const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
        if (savedSettings) setSecuritySettings(JSON.parse(savedSettings));

        const journeyStatus = await AsyncStorage.getItem(JOURNEY_KEY);
        setIsJourneyActive(journeyStatus === "true" || route.params?.isJourneyActive);

        const savedContacts = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedContacts) {
          const allContacts = JSON.parse(savedContacts);
          setEmergencyContacts(allContacts.filter((c: any) => c.isEmergency));
        }

        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setCurrentCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          fetchEmergencyPlaces(loc.coords.latitude, loc.coords.longitude);

          let response = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          if (response.length > 0) {
            setCurrentLocation(`${response[0].district || response[0].city}, ${response[0].region}`);
          } else {
            setCurrentLocation(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
          }
        } else {
          setCurrentLocation("Location Permission Denied");
        }
      };
      fetchRealtimeData();
    }, [route.params])
  );

  const displayAvatar = localAvatar || user?.avatar_url || user?.user_metadata?.avatar_url || null;
  const fullName = localName || user?.full_name || "Afolabi Taiwo Glory";

  const toggleSidebar = (open: boolean) => {
    if (open) {
      setIsSidebarOpen(true);
      Animated.timing(sidebarAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(sidebarAnim, { toValue: width, duration: 250, useNativeDriver: true }).start(() => setIsSidebarOpen(false));
    }
  };

  // RESTORED: Logout Function
  const handleLogoutPress = () => {
    toggleSidebar(false);
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out of your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await AuthService.logout();
            } catch (err) {
              console.error("Error logging out:", err);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const holdProgress = useRef(new Animated.Value(0)).current;
  const BUTTON_SIZE = 150; 
  const CIRCLE_RADIUS = (BUTTON_SIZE / 2) - 3; 
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

  const strokeDashoffset = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCLE_CIRCUMFERENCE, 0],
  });

  const triggerEmergencyProtocol = async () => {
    if (emergencyContacts.length === 0) {
      Alert.alert("No Contacts", "Please go to Contacts and assign people to your Emergency Network first.");
      holdProgress.setValue(0);
      return;
    }
    setAlertSent(true);
    let message = securitySettings.customMessage ? securitySettings.customMessage : `🚨 SOS ALERT: I am in a GENERAL EMERGENCY.`;
    if (securitySettings.locationSharing) message += ` My last known location is ${currentLocation}. Live tracking available on Strompulse.`;
    message += ` Please send help immediately.`;

    try {
      const userName = (user as any)?.full_name || "Someone";
      const recipientPhones = emergencyContacts.map(c => {
        let cleanPhone = c.phone.replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '+234' + cleanPhone.slice(1);
        else if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;
        return cleanPhone;
      });

      await sendPushAlert('emergency', `SOS alert from ${userName}`, message, recipientPhones);
    } catch (e) {
      console.warn("Silent in-app alert failed to push", e);
    }

    if (securitySettings.sendSms) {
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) await SMS.sendSMSAsync(emergencyContacts.map(c => c.phone), message);
    }

    const primaryContact = emergencyContacts[0];
    let cleanPhone = primaryContact.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '234' + cleanPhone.slice(1);
    else if (cleanPhone.length <= 10) cleanPhone = '234' + cleanPhone;
    Linking.openURL(`whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`).catch(() => {});
  };

  const handlePressIn = () => {
    Animated.timing(holdProgress, { toValue: 1, duration: 1500, useNativeDriver: false }).start(({ finished }) => {
      if (finished) triggerEmergencyProtocol();
    });
  };

  const handlePressOut = () => {
    if (!alertSent) {
      holdProgress.stopAnimation();
      Animated.timing(holdProgress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    }
  };

  const formatContactNames = () => {
    if (emergencyContacts.length === 0) return "your contacts";
    const names = emergencyContacts.map(c => c.name.split(' ')[0]);
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  };

  const createPulseStyle = (anim: Animated.Value) => ({
    position: 'absolute' as 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }],
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] })
  });

  if (alertSent) {
    return (
      <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <SafeAreaView style={{ flex: 1 }}>
          <XStack paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} justifyContent="center" alignItems="center" position="relative">
            <TouchableOpacity onPress={() => setAlertSent(false)} style={{ position: "absolute", left: 24, padding: 8 }}>
              <Feather name="arrow-left" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>SOS Sent</TText>
          </XStack>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 24 }}>
            <YStack alignItems="center" marginTop={40} marginBottom={45}>
              <YStack width={100} height={100} borderRadius={50} backgroundColor="#25D366" justifyContent="center" alignItems="center" marginBottom={24}>
                <Ionicons name="logo-whatsapp" size={48} color="#FFFFFF" />
              </YStack>
              <TText fontFamily="Chirp-Heavy" fontSize={24} color={theme.textPrimary} marginBottom={12} textAlign="center">Broadcast Active</TText>
              <TText fontFamily="Chirp-Medium" fontSize={14} color={theme.textSecondary} textAlign="center" lineHeight={22}>
                Your emergency broadcast has been successfully forwarded to your security network.
              </TText>
            </YStack>
            <TouchableOpacity onPress={() => setAlertSent(false)} style={{ marginTop: 32 }}>
              <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} borderRadius={20} paddingVertical={20} alignItems="center">
                <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Close Alert Interface</TText>
              </YStack>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        
        {/* --- HEADER --- */}
        <XStack justifyContent="space-between" alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={16} position="relative">
          <Image source={require("../../assets/images/strompulselogo.png")} style={{ width: 50, height: 50, resizeMode: "contain" }} />
          <YStack position="absolute" left={0} right={0} alignItems="center" pointerEvents="none">
            <TText style={{ fontFamily: "SoraTitle-Bold", fontSize: 22 }} color={theme.textPrimary}>Strompulse</TText>
          </YStack>
          <TouchableOpacity onPress={() => toggleSidebar(true)} style={{ padding: 4 }}>
            <Feather name="menu" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          
          <YStack alignItems="center" marginBottom={24}>
            <XStack backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#E6F8F3"} paddingHorizontal={12} paddingVertical={6} borderRadius={16} alignItems="center" gap={6}>
              <YStack width={6} height={6} borderRadius={3} backgroundColor="#00C48A" />
              <TText fontFamily="Chirp-Bold" fontSize={10} color="#00C48A" letterSpacing={1}>SECURITY SYSTEM</TText>
            </XStack>
          </YStack>

          {/* --- SETTINGS ROW --- */}
          <TouchableOpacity onPress={() => navigation.navigate("SafetySettingsScreen")}>
            <XStack marginHorizontal={24} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} padding={20} alignItems="center" justifyContent="space-between" shadowColor="#000" shadowOpacity={0.03} shadowRadius={15} shadowOffset={{width:0, height:8}}>
              <XStack alignItems="center" flex={1}>
                <YStack width={44} height={44} borderRadius={22} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center" marginRight={16}>
                  <Feather name="shield" size={18} color="#00C48A" />
                </YStack>
                <YStack flex={1} paddingRight={12}>
                  <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary} marginBottom={2}>Security Preferences</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>SOS, journey sharing & trusted contacts</TText>
                </YStack>
              </XStack>
              <YStack width={32} height={32} borderRadius={16} backgroundColor={isDarkMode ? "#1A221E" : "#F1F5F9"} justifyContent="center" alignItems="center">
                <Feather name="settings" size={16} color={theme.textSecondary} />
              </YStack>
            </XStack>
          </TouchableOpacity>

          {/* --- SOS BUTTON AREA --- */}
          <View style={{ alignItems: "center", justifyContent: "center", height: 340, width: "100%", position: "relative" }}>
            <Animated.View style={createPulseStyle(pulse1)} />
            <Animated.View style={createPulseStyle(pulse2)} />
            <Animated.View style={createPulseStyle(pulse3)} />
            
            <Svg width={BUTTON_SIZE} height={BUTTON_SIZE} style={{ position: "absolute", zIndex: 10 }}>
              <AnimatedCircle cx={BUTTON_SIZE/2} cy={BUTTON_SIZE/2} r={CIRCLE_RADIUS} stroke="#FFFFFF" strokeWidth="6" fill="none" strokeDasharray={CIRCLE_CIRCUMFERENCE} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform={`rotate(-90 ${BUTTON_SIZE/2} ${BUTTON_SIZE/2})`} />
            </Svg>

            <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, borderRadius: BUTTON_SIZE/2, zIndex: 20, overflow: 'hidden' }}>
              <LinearGradient colors={["#FF4B4B", "#DC2626"]} style={{ flex: 1, justifyContent: "center", alignItems: "center", shadowColor: "#EF4444", shadowOpacity: 0.4, shadowRadius: 20 }}>
                <Feather name="phone-call" size={26} color="#FFFFFF" style={{ marginBottom: 6 }} />
                <TText fontFamily="Chirp-Heavy" fontSize={32} color="#FFFFFF" letterSpacing={1}>SOS</TText>
                <TText fontFamily="Chirp-Bold" fontSize={11} color="#FFFFFF" opacity={0.9} marginTop={4}>Hold for 3 seconds</TText>
              </LinearGradient>
            </Pressable>
          </View>

          {/* --- INFO SUBTEXT --- */}
          <XStack marginHorizontal={24} backgroundColor={isDarkMode ? "rgba(239,68,68,0.05)" : "#FFF"} padding={16} borderRadius={16} marginBottom={24} alignItems="center" shadowColor="#000" shadowOpacity={0.02} shadowRadius={10} shadowOffset={{width:0, height:4}}>
            <Feather name="shield" size={16} color="#EF4444" style={{ marginRight: 12 }} />
            <TText flex={1} fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} lineHeight={18}>
              Sends your live location to {formatContactNames()}. If they don't respond, we text, then call.
            </TText>
          </XStack>

          {/* --- TOOLS & TIPS --- */}
          <XStack marginHorizontal={24} gap={12} marginBottom={24}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate("SafetyToolsScreen")}>
              <XStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} padding={16} borderRadius={20} alignItems="center" justifyContent="center" gap={10} shadowColor="#000" shadowOpacity={0.03} shadowRadius={15} shadowOffset={{width:0, height:8}}>
                <Feather name="shield" size={16} color={theme.textSecondary} />
                <TText fontFamily="Chirp-Bold" fontSize={14} color={theme.textPrimary}>Safety Tools</TText>
              </XStack>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate("SafetyTipsScreen")}>
              <XStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} padding={16} borderRadius={20} alignItems="center" justifyContent="center" gap={10} shadowColor="#000" shadowOpacity={0.03} shadowRadius={15} shadowOffset={{width:0, height:8}}>
                <Feather name="file-text" size={16} color={theme.textSecondary} />
                <TText fontFamily="Chirp-Bold" fontSize={14} color={theme.textPrimary}>Safety Tips</TText>
              </XStack>
            </TouchableOpacity>
          </XStack>

          {/* --- NEARBY HELP CARD (REAL-TIME EMERGENCY MAP) --- */}
          <YStack marginHorizontal={24} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} padding={20} marginBottom={16} shadowColor="#000" shadowOpacity={0.03} shadowRadius={15} shadowOffset={{width:0, height:8}}>
            <XStack justifyContent="space-between" alignItems="flex-start" marginBottom={16}>
              <YStack flex={1}>
                <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary} marginBottom={2}>Nearby Help</TText>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Closest hospital & police station</TText>
              </YStack>
              <TouchableOpacity onPress={() => navigation.navigate("EmergencyMapScreen", { userLat: currentCoords?.lat, userLng: currentCoords?.lng })}>
                <TText fontFamily="Chirp-Bold" fontSize={13} color="#00C48A">Open map</TText>
              </TouchableOpacity>
            </XStack>

            <YStack height={140} borderRadius={16} overflow="hidden" backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} position="relative" marginBottom={16}>
              {currentCoords ? (
                <MapView
                  style={{ ...StyleSheet.absoluteFillObject }}
                  provider={PROVIDER_GOOGLE}
                  initialRegion={{
                    latitude: currentCoords.lat,
                    longitude: currentCoords.lng,
                    latitudeDelta: 0.04,
                    longitudeDelta: 0.04,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                  pointerEvents="none"
                >
                  <Marker coordinate={{ latitude: currentCoords.lat, longitude: currentCoords.lng }}>
                    <YStack width={20} height={20} borderRadius={10} backgroundColor="rgba(0,196,138,0.3)" justifyContent="center" alignItems="center">
                      <YStack width={10} height={10} borderRadius={5} backgroundColor="#00C48A" borderWidth={1.5} borderColor="#FFF" />
                    </YStack>
                  </Marker>
                  {nearestHospital && (
                    <Marker coordinate={{ latitude: nearestHospital.lat, longitude: nearestHospital.lng }}>
                      <YStack width={24} height={24} borderRadius={12} backgroundColor="#EF4444" justifyContent="center" alignItems="center" borderWidth={2} borderColor="#FFF">
                        <Feather name="plus" size={14} color="#FFF" />
                      </YStack>
                    </Marker>
                  )}
                  {nearestPolice && (
                    <Marker coordinate={{ latitude: nearestPolice.lat, longitude: nearestPolice.lng }}>
                      <YStack width={24} height={24} borderRadius={12} backgroundColor="#3B82F6" justifyContent="center" alignItems="center" borderWidth={2} borderColor="#FFF">
                        <Feather name="shield" size={12} color="#FFF" />
                      </YStack>
                    </Marker>
                  )}
                </MapView>
              ) : (
                <YStack flex={1} justifyContent="center" alignItems="center">
                  <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Loading map...</TText>
                </YStack>
              )}

              <XStack position="absolute" top={12} left={12} backgroundColor={isDarkMode ? "rgba(18,26,22,0.9)" : "rgba(255,255,255,0.9)"} paddingHorizontal={10} paddingVertical={6} borderRadius={12} alignItems="center" gap={6}>
                <YStack width={6} height={6} borderRadius={3} backgroundColor="#00C48A" />
                <TText fontFamily="Chirp-Bold" fontSize={10} color={theme.textPrimary}>LIVE · Updated {updateTimeString}</TText>
              </XStack>
            </YStack>

            <XStack>
              <YStack flex={1} borderRightWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} paddingRight={12}>
                <XStack alignItems="center" gap={8} marginBottom={4}>
                  <Feather name="plus" size={14} color="#EF4444" />
                  <TText fontFamily="Chirp-Bold" fontSize={10} color={theme.textSecondary} letterSpacing={1}>NEAREST HOSPITAL</TText>
                </XStack>
                <TText fontFamily="Chirp-Heavy" fontSize={13} color={theme.textPrimary} marginBottom={2} numberOfLines={1}>{nearestHospital ? nearestHospital.name : "Searching..."}</TText>
                <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>{nearestHospital ? `${nearestHospital.dist} km • ${nearestHospital.time} min` : "--"}</TText>
              </YStack>

              <YStack flex={1} paddingLeft={12}>
                <XStack alignItems="center" gap={8} marginBottom={4}>
                  <Feather name="shield" size={14} color="#3B82F6" />
                  <TText fontFamily="Chirp-Bold" fontSize={10} color={theme.textSecondary} letterSpacing={1}>NEAREST POLICE</TText>
                </XStack>
                <TText fontFamily="Chirp-Heavy" fontSize={13} color={theme.textPrimary} marginBottom={2} numberOfLines={1}>{nearestPolice ? nearestPolice.name : "Searching..."}</TText>
                <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>{nearestPolice ? `${nearestPolice.dist} km • ${nearestPolice.time} min` : "--"}</TText>
              </YStack>
            </XStack>
          </YStack>

          {/* --- JOURNEY SHARE CARD --- */}
          <TouchableOpacity onPress={() => navigation.navigate("JourneyShareScreen", { isJourneyActive })}>
            <XStack marginHorizontal={24} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#E6F8F3"} borderRadius={24} padding={20} alignItems="center" marginBottom={16}>
              <YStack width={44} height={44} borderRadius={22} backgroundColor="#00C48A" justifyContent="center" alignItems="center" marginRight={16}>
                <Feather name="map-pin" size={18} color="#FFFFFF" />
              </YStack>
              <YStack flex={1}>
                <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary} marginBottom={2}>Share My Journey</TText>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Let your contacts follow your trip in real time</TText>
              </YStack>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </XStack>
          </TouchableOpacity>

          {/* --- TRUSTED CONTACTS AVATARS --- */}
          <TouchableOpacity onPress={() => navigation.navigate("ContactsScreen")}>
            <YStack marginHorizontal={24} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} padding={20} shadowColor="#000" shadowOpacity={0.03} shadowRadius={15} shadowOffset={{width:0, height:8}}>
              <XStack justifyContent="space-between" alignItems="flex-start" marginBottom={20}>
                <XStack alignItems="flex-start" gap={12}>
                  <Feather name="users" size={18} color={theme.textSecondary} style={{ marginTop: 2 }} />
                  <YStack>
                    <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary} marginBottom={2}>Trusted contacts</TText>
                    <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>{emergencyContacts.length} of 3 contacts will be alerted</TText>
                  </YStack>
                </XStack>
                <TText fontFamily="Chirp-Bold" fontSize={13} color="#00C48A">Manage</TText>
              </XStack>

              <XStack gap={16} paddingLeft={30}>
                {emergencyContacts.slice(0, 3).map((contact, i) => (
                  <YStack key={i} alignItems="center">
                    <YStack width={48} height={48} borderRadius={24} backgroundColor={isDarkMode ? contact.bgDark : contact.bg} justifyContent="center" alignItems="center" marginBottom={6}>
                      <TText fontFamily="Chirp-Bold" fontSize={18} color={contact.color}>{contact.initial}</TText>
                    </YStack>
                    <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>{contact.name.split(' ')[0]}</TText>
                  </YStack>
                ))}
                {emergencyContacts.length < 3 && (
                  <YStack alignItems="center">
                    <YStack width={48} height={48} borderRadius={24} backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} justifyContent="center" alignItems="center" marginBottom={6} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} borderStyle="dashed">
                      <Feather name="plus" size={18} color="#00C48A" />
                    </YStack>
                    <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Add</TText>
                  </YStack>
                )}
              </XStack>
            </YStack>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>

      {/* --- SIDEBAR DRAWER --- */}
      {isSidebarOpen && (
        <YStack position="absolute" top={0} left={0} right={0} bottom={0} zIndex={99999}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} activeOpacity={1} onPress={() => toggleSidebar(false)} />
          <Animated.View style={{
            position: "absolute", top: 0, bottom: 0, right: 0, width: width * 0.78,
            backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF",
            transform: [{ translateX: sidebarAnim }],
            paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 50,
            paddingHorizontal: 20, borderLeftWidth: 1, borderLeftColor: isDarkMode ? "#2D3B34" : "#E2E8F0",
          }}>
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