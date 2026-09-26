import React, { useState, useRef, useCallback } from "react";
import { 
  Platform, StatusBar, Animated, SafeAreaView, Dimensions, 
  ScrollView, Alert, TouchableOpacity, Pressable, View, ActivityIndicator, Image 
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
import CustomMapView from "../components/CustomMapView";

const { height, width } = Dimensions.get("window");
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const STORAGE_KEY = "strompulse_emergency_contacts";
const JOURNEY_KEY = "strompulse_journey_active";
const JOURNEY_CONTACTS_KEY = "strompulse_journey_contacts";
const SETTINGS_KEY = "strompulse_security_settings";

const SafetyScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode } = useTheme();

  const [isJourneyActive, setIsJourneyActive] = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const [currentLocation, setCurrentLocation] = useState("Locating...");
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [securitySettings, setSecuritySettings] = useState({ locationSharing: true, sendSms: true, customMessage: "" });
  const [user, setUser] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      const fetchRealtimeData = async () => {
        const session = await AuthService.getCurrentSession();
        if (session) setUser(session.user);

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

  const handleStopJourney = async () => {
    setIsJourneyActive(false);
    await AsyncStorage.removeItem(JOURNEY_KEY);
    await AsyncStorage.removeItem(JOURNEY_CONTACTS_KEY);
    await AsyncStorage.removeItem("strompulse_journey_end_time");
    navigation.setParams({ isJourneyActive: false });
  };

  const holdProgress = useRef(new Animated.Value(0)).current;
  
  const BUTTON_SIZE = 140; 
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
      const userName = (user as any)?.full_name;
      const recipientPhonesArray = emergencyContacts.map(contact => contact.phone);
      await supabase.from("alerts").insert({
        user_id: user?.id, 
        type: "emergency",
        title: userName ? `SOS from ${userName}` : "SOS ALERT",
        message: message,
        recipient_phones: recipientPhonesArray
      });
    } catch (e) {
      console.warn("Silent in-app alert failed to push", e);
    }

    if (securitySettings.sendSms) {
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) {
        await SMS.sendSMSAsync(emergencyContacts.map(c => c.phone), message);
      }
    }

    const primaryContact = emergencyContacts[0];
    let cleanPhone = primaryContact.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '234' + cleanPhone.slice(1);
    else if (cleanPhone.length <= 10) cleanPhone = '234' + cleanPhone;

    Linking.openURL(`whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`).catch(() => Alert.alert("Error", "WhatsApp is not installed."));
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

  const resetSafety = () => { setAlertSent(false); holdProgress.setValue(0); };

  if (alertSent) {
    return (
      <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <SafeAreaView style={{ flex: 1 }}>
          <XStack paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} justifyContent="center" alignItems="center" position="relative">
            <TouchableOpacity onPress={resetSafety} style={{ position: "absolute", left: 24, padding: 8 }}>
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

            {securitySettings.locationSharing && (
              <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} padding={20} alignItems="center" marginBottom={32} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1} marginBottom={8}>BROADCASTING LOCATION</TText>
                <TText fontFamily="Chirp-Bold" fontSize={16} color={theme.textPrimary}>{currentLocation}</TText>
              </YStack>
            )}

            <TText fontFamily="Chirp-Bold" fontSize={12} color={theme.textSecondary} marginLeft={4} marginBottom={12}>NOTIFIED CONTACTS</TText>
            <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
              {emergencyContacts.map((contact, index) => (
                <XStack 
                  key={contact.id} 
                  padding={16} 
                  alignItems="center" 
                  justifyContent="space-between" 
                  borderBottomWidth={index === emergencyContacts.length - 1 ? 0 : 1} 
                  borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}
                >
                  <XStack alignItems="center">
                    <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? contact.bgDark : contact.bg} justifyContent="center" alignItems="center" marginRight={16}>
                      <TText fontFamily="Chirp-Bold" fontSize={16} color={contact.color}>{contact.initial}</TText>
                    </YStack>
                    <YStack>
                      <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>{contact.name}</TText>
                      <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} marginTop={2}>{contact.phone}</TText>
                    </YStack>
                  </XStack>
                  <Feather name="check" size={20} color="#00C48A" />
                </XStack>
              ))}
            </YStack>

            <TouchableOpacity onPress={resetSafety} style={{ marginTop: 32 }}>
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
        
        {/* --- REFINED HEADER --- */}
        <XStack justifyContent="space-between" alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={16} position="relative">
          
          <Image 
            source={require("../../assets/images/strompulselogo.png")} 
            style={{ width: 48, height: 48, resizeMode: "contain" }} 
          />
          
          <YStack position="absolute" left={0} right={0} alignItems="center" pointerEvents="none">
            <TText style={{ fontFamily: "SoraTitle-Bold", fontSize: 20 }} color={theme.textPrimary}>Strompulse Security</TText>
            <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={2}>Stay safe, wherever you go</TText>
          </YStack>
          
          <TouchableOpacity onPress={() => navigation.navigate("SafetySettingsScreen")} style={{ backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", padding: 10, borderRadius: 20, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}>
            <Feather name="settings" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

          {/* --- ACTIVE JOURNEY BANNER --- */}
          {isJourneyActive && (
            <XStack marginHorizontal={24} marginTop={10} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} borderRadius={20} padding={16} borderWidth={1} borderColor="#00C48A" alignItems="center" justifyContent="space-between">
              <XStack alignItems="center" gap={12}>
                <YStack width={10} height={10} borderRadius={5} backgroundColor="#00C48A" />
                <YStack>
                  <TText fontFamily="Chirp-Bold" fontSize={14} color="#00C48A" marginBottom={2}>Journey Share Active</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>GPS Tracking live</TText>
                </YStack>
              </XStack>
              <TouchableOpacity onPress={handleStopJourney} activeOpacity={0.7}>
                <YStack backgroundColor="#EF4444" paddingHorizontal={16} paddingVertical={8} borderRadius={12}>
                  <TText fontFamily="Chirp-Bold" fontSize={12} color="#FFF">End</TText>
                </YStack>
              </TouchableOpacity>
            </XStack>
          )}
          
          {/* --- SOS BUTTON --- */}
          <View style={{ alignItems: "center", justifyContent: "center", height: 280, width: "100%", marginBottom: 10, marginTop: 10 }}>
            <View style={{ position: "absolute", width: 230, height: 230, borderRadius: 115, borderWidth: 1, borderColor: isDarkMode ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.15)" }} />
            <View style={{ position: "absolute", width: 180, height: 180, borderRadius: 90, borderWidth: 1, borderColor: isDarkMode ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.3)", backgroundColor: isDarkMode ? "rgba(239,68,68,0.05)" : "rgba(239,68,68,0.05)" }} />

            <Svg width={BUTTON_SIZE} height={BUTTON_SIZE} style={{ position: "absolute", zIndex: 10 }}>
              <AnimatedCircle 
                cx={BUTTON_SIZE/2} 
                cy={BUTTON_SIZE/2} 
                r={CIRCLE_RADIUS} 
                stroke="#EF4444" 
                strokeWidth="6" 
                fill="none" 
                strokeDasharray={CIRCLE_CIRCUMFERENCE} 
                strokeDashoffset={strokeDashoffset} 
                strokeLinecap="round" 
                transform={`rotate(-90 ${BUTTON_SIZE/2} ${BUTTON_SIZE/2})`} 
              />
            </Svg>

            <Pressable 
              onPressIn={handlePressIn} 
              onPressOut={handlePressOut}
              style={{ width: BUTTON_SIZE - 12, height: BUTTON_SIZE - 12, borderRadius: (BUTTON_SIZE - 12)/2, zIndex: 20, overflow: 'hidden' }}
            >
              <LinearGradient colors={["#EF4444", "#B91C1C"]} style={{ flex: 1, justifyContent: "center", alignItems: "center", shadowColor: "#EF4444", shadowOpacity: 0.4, shadowRadius: 20 }}>
                <Feather name="message-square" size={24} color="#FFFFFF" style={{ marginBottom: 4 }} />
                <TText fontFamily="Chirp-Heavy" fontSize={26} color="#FFFFFF" letterSpacing={1}>SOS</TText>
                <TText fontFamily="Chirp-Medium" fontSize={10} color="#FFFFFF" opacity={0.9} marginTop={2}>Hold for 3 seconds</TText>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Subtext info */}
          <XStack marginHorizontal={24} backgroundColor={isDarkMode ? "rgba(239,68,68,0.05)" : "#FEF2F2"} padding={16} borderRadius={16} borderWidth={1} borderColor={isDarkMode ? "rgba(239,68,68,0.2)" : "#FECACA"} marginBottom={24} alignItems="center">
            <Feather name="shield" size={16} color="#EF4444" style={{ marginRight: 12 }} />
            <TText flex={1} fontFamily="Chirp-Medium" fontSize={12} color={isDarkMode ? "#FCA5A5" : "#B91C1C"} lineHeight={18}>
              Alerts will be sent to your emergency contacts with your live location
            </TText>
          </XStack>

          {/* --- SHARE MY JOURNEY CARD --- */}
          <TouchableOpacity onPress={() => navigation.navigate("JourneyShareScreen", { isJourneyActive })}>
            <XStack marginHorizontal={24} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={16} padding={20} alignItems="center">
              <YStack width={36} height={36} borderRadius={18} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center">
                <Feather name="map-pin" size={16} color="#00C48A" />
              </YStack>
              <YStack flex={1} marginLeft={16}>
                <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Share My Journey</TText>
                <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={2}>Let your contacts follow your trip in real time</TText>
              </YStack>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </XStack>
          </TouchableOpacity>

          {/* --- BIG LIVE MAP (Movable & Interactive with CustomMapView) --- */}
          <YStack marginHorizontal={24} height={400} backgroundColor={isDarkMode ? "#121A16" : "#E2E8F0"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} overflow="hidden" position="relative" marginBottom={16}>
            {currentCoords ? (
              <CustomMapView 
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                showCoverage={false}
                showLegend={false}
                region={{
                  latitude: currentCoords.lat,
                  longitude: currentCoords.lng,
                  latitudeDelta: 0.015,
                  longitudeDelta: 0.015,
                }}
                markers={[{
                  id: "current_user",
                  title: currentLocation.split(',')[0],
                  latitude: currentCoords.lat,
                  longitude: currentCoords.lng,
                  connectionState: "online"
                }]}
              />
            ) : (
              <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} justifyContent="center" alignItems="center">
                <ActivityIndicator size="small" color="#00C48A" />
              </YStack>
            )}
            
            {/* Overlay hint if journey is not active */}
            {!isJourneyActive && (
              <YStack position="absolute" bottom={0} left={0} right={0} paddingVertical={16} backgroundColor={isDarkMode ? "rgba(18,26,22,0.85)" : "rgba(255,255,255,0.95)"} alignItems="center">
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Turn on Share My Journey above to track trips</TText>
              </YStack>
            )}
          </YStack>

          {/* --- EMERGENCY CONTACTS CARD WITH AVATARS --- */}
          <TouchableOpacity onPress={() => navigation.navigate("ContactsScreen")}>
            <YStack marginHorizontal={24} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} padding={20} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={16}>
              <XStack justifyContent="space-between" alignItems="center" marginBottom={16}>
                <XStack alignItems="center">
                  <YStack width={36} height={36} borderRadius={18} backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} justifyContent="center" alignItems="center" marginRight={12}>
                    <Feather name="users" size={16} color={theme.textPrimary} />
                  </YStack>
                  <YStack>
                    <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Emergency Contacts</TText>
                    <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={2}>{emergencyContacts.length} of 3 contacts will be alerted</TText>
                  </YStack>
                </XStack>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </XStack>

              <XStack gap={16} paddingLeft={4}>
                {emergencyContacts.slice(0, 3).map((contact, i) => (
                  <YStack key={i} alignItems="center">
                    <YStack width={44} height={44} borderRadius={22} backgroundColor={isDarkMode ? contact.bgDark : contact.bg} justifyContent="center" alignItems="center" marginBottom={6}>
                      <TText fontFamily="Chirp-Bold" fontSize={16} color={contact.color}>{contact.initial}</TText>
                    </YStack>
                    <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>{contact.name.split(' ')[0]}</TText>
                  </YStack>
                ))}
                {emergencyContacts.length < 3 && (
                  <YStack alignItems="center">
                    <YStack width={44} height={44} borderRadius={22} backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} justifyContent="center" alignItems="center" marginBottom={6} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} borderStyle="dashed">
                      <Feather name="plus" size={16} color={theme.textSecondary} />
                    </YStack>
                    <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>Add</TText>
                  </YStack>
                )}
              </XStack>
            </YStack>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default SafetyScreen;