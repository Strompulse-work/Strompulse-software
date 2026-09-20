import React, { useState, useRef, useCallback } from "react";
import { 
  Platform, StatusBar, Animated, SafeAreaView, Dimensions, 
  ScrollView, Alert, TouchableOpacity, Pressable, View 
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

const { height, width } = Dimensions.get("window");
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const STORAGE_KEY = "strompulse_emergency_contacts";
const JOURNEY_KEY = "strompulse_journey_active";
const SETTINGS_KEY = "strompulse_security_settings";

const SafetyScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode } = useTheme();

  const [isJourneyActive, setIsJourneyActive] = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const [currentLocation, setCurrentLocation] = useState("Locating...");
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [securitySettings, setSecuritySettings] = useState({ locationSharing: true, sendSms: true });
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
    navigation.setParams({ isJourneyActive: false });
  };

  const holdProgress = useRef(new Animated.Value(0)).current;
  const CIRCLE_RADIUS = 75;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

  const strokeDashoffset = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCLE_CIRCUMFERENCE, 0],
  });

  const triggerEmergencyProtocol = async () => {
    if (emergencyContacts.length === 0) {
      Alert.alert("No Contacts", "Please go to My Contacts and add people to your Emergency Network first.");
      holdProgress.setValue(0);
      return;
    }

    setAlertSent(true);
    let message = `SOS ALERT: I am in a GENERAL EMERGENCY.`;
    if (securitySettings.locationSharing) message += ` My last known location is ${currentLocation}.`;
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
                Your emergency broadcast has been successfully forwarded to your safety network.
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
        
        {/* --- MINIMALIST HEADER WITH SETTINGS --- */}
        <XStack justifyContent="center" alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={16} position="relative">
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ position: "absolute", left: 24, padding: 8, zIndex: 10 }}>
            <Feather name="arrow-left" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Safety</TText>
          <TouchableOpacity onPress={() => navigation.navigate("SafetySettingsScreen")} style={{ position: "absolute", right: 24, padding: 8, zIndex: 10 }}>
            <Feather name="settings" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          
          {isJourneyActive && (
            <XStack justifyContent="space-between" alignItems="center" backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} borderRadius={20} padding={16} marginHorizontal={24} borderWidth={1} borderColor="#00C48A" marginBottom={24}>
              <XStack alignItems="center">
                <YStack width={10} height={10} borderRadius={5} backgroundColor="#00C48A" marginRight={14} />
                <YStack>
                  <TText fontFamily="Chirp-Bold" fontSize={14} color="#00C48A" marginBottom={2}>Journey Share Active</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>GPS Tracking live</TText>
                </YStack>
              </XStack>
              <TouchableOpacity onPress={handleStopJourney}>
                <YStack backgroundColor="#EF4444" paddingHorizontal={16} paddingVertical={8} borderRadius={12}>
                  <TText fontFamily="Chirp-Bold" fontSize={12} color="#FFF">End</TText>
                </YStack>
              </TouchableOpacity>
            </XStack>
          )}

          {/* --- ROBUST PRESSABLE SOS BUTTON --- */}
          <View style={{ alignItems: "center", justifyContent: "center", height: 320, width: "100%", marginBottom: 10 }}>
            <View style={{ position: "absolute", width: 260, height: 260, borderRadius: 130, borderWidth: 1, borderColor: isDarkMode ? "#1A221E" : "#E2E8F0" }} />
            <View style={{ position: "absolute", width: 190, height: 190, borderRadius: 95, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#F1F5F9", backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF" }} />

            <Svg width="160" height="160" style={{ position: "absolute", zIndex: 10 }}>
              <AnimatedCircle cx="80" cy="80" r={CIRCLE_RADIUS} stroke="#EF4444" strokeWidth="6" fill="none" strokeDasharray={CIRCLE_CIRCUMFERENCE} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform="rotate(-90 80 80)" />
            </Svg>

            <Pressable 
              onPressIn={handlePressIn} 
              onPressOut={handlePressOut}
              style={{ width: 140, height: 140, borderRadius: 70, zIndex: 20, overflow: 'hidden' }}
            >
              <LinearGradient colors={["#EF4444", "#991B1B"]} style={{ width: 140, height: 140, borderRadius: 70, justifyContent: "center", alignItems: "center", shadowColor: "#EF4444", shadowOpacity: 0.3, shadowRadius: 20 }}>
                <TText fontFamily="Chirp-Heavy" fontSize={36} color="#FFFFFF" letterSpacing={1}>SOS</TText>
              </LinearGradient>
            </Pressable>

            <TText style={{ position: "absolute", bottom: 10, fontFamily: "Chirp-Medium", fontSize: 11, color: theme.textSecondary }}>
              Hold 1.5s to alert {emergencyContacts.length || "0"} contacts
            </TText>
          </View>

          {/* --- CLASSIC LIST GROUP --- */}
          <YStack marginHorizontal={24} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={32}>
            
            <TouchableOpacity onPress={() => navigation.navigate("JourneyShareScreen", { isJourneyActive })}>
              <XStack padding={18} alignItems="center" borderBottomWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                <YStack width={32} height={32} borderRadius={16} backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} justifyContent="center" alignItems="center">
                  <Feather name="navigation" size={16} color={theme.textPrimary} />
                </YStack>
                <TText flex={1} marginLeft={16} fontFamily="Chirp-Medium" fontSize={15} color={theme.textPrimary}>Journey Share</TText>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </XStack>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("ContactsScreen")}>
              <XStack padding={18} alignItems="center">
                <YStack width={32} height={32} borderRadius={16} backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} justifyContent="center" alignItems="center">
                  <Feather name="users" size={16} color={theme.textPrimary} />
                </YStack>
                <TText flex={1} marginLeft={16} fontFamily="Chirp-Medium" fontSize={15} color={theme.textPrimary}>Emergency Contacts</TText>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </XStack>
            </TouchableOpacity>

          </YStack>

          {/* --- ACTIVE EMERGENCY NETWORK --- */}
          <YStack paddingHorizontal={24}>
            <TText fontFamily="Chirp-Bold" fontSize={12} color={theme.textSecondary} marginLeft={4} marginBottom={12}>YOUR SAFETY NETWORK</TText>
            
            {emergencyContacts.length > 0 ? (
              <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                {emergencyContacts.map((contact, index) => (
                  <XStack 
                    key={contact.id} 
                    padding={16} 
                    alignItems="center" 
                    borderBottomWidth={index === emergencyContacts.length - 1 ? 0 : 1} 
                    borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}
                  >
                    <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? contact.bgDark : contact.bg} justifyContent="center" alignItems="center" marginRight={16}>
                      <TText fontFamily="Chirp-Bold" fontSize={16} color={contact.color}>{contact.initial}</TText>
                    </YStack>
                    <YStack flex={1}>
                      <TText fontFamily="Chirp-Medium" fontSize={15} color={theme.textPrimary}>{contact.name}</TText>
                      <TText fontFamily="Chirp-Regular" fontSize={13} color={theme.textSecondary} marginTop={2}>{contact.phone}</TText>
                    </YStack>
                  </XStack>
                ))}
              </YStack>
            ) : (
              <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} padding={24} borderRadius={24} alignItems="center" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                <TText fontFamily="Chirp-Medium" fontSize={14} color={theme.textPrimary} marginBottom={6}>No Contacts Added</TText>
                <TText fontFamily="Chirp-Regular" fontSize={13} color={theme.textSecondary} textAlign="center">Add trusted people to receive your SOS alerts.</TText>
              </YStack>
            )}
          </YStack>

        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default SafetyScreen;