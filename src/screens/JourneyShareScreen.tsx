import React, { useState, useCallback, useEffect } from "react";
import { 
  StatusBar, 
  TouchableOpacity, 
  Platform, 
  TextInput, 
  ScrollView, 
  Alert,
  SafeAreaView,
  ActivityIndicator
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import * as SMS from "expo-sms";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../theme/ThemeContext";
import { useFocusEffect } from "@react-navigation/native";
import MapView, { Marker } from "react-native-maps";
import AuthService from "../services/authService";
import { supabase } from "../config/supabase";

const STORAGE_KEY = "strompulse_emergency_contacts";
const JOURNEY_KEY = "strompulse_journey_active";
const JOURNEY_END_TIME_KEY = "strompulse_journey_end_time";
const JOURNEY_CONTACTS_KEY = "strompulse_journey_contacts";
const SETTINGS_KEY = "strompulse_security_settings";

const JourneyShareScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode } = useTheme();

  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [eta, setEta] = useState("30m");
  
  const [currentLocation, setCurrentLocation] = useState("Locating...");
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);
  const [mapRegion, setMapRegion] = useState<any>(null);
  
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [isActive, setIsActive] = useState(false);
  const [securitySettings, setSecuritySettings] = useState({ locationSharing: true, sendSms: true });

  const [isEtaExpired, setIsEtaExpired] = useState(false);
  const [journeyEndTime, setJourneyEndTime] = useState<number | null>(null);
  const [timeLeftString, setTimeLeftString] = useState("--:--");

  useFocusEffect(
    useCallback(() => {
      const fetchInitData = async () => {
        const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
        if (savedSettings) setSecuritySettings(JSON.parse(savedSettings));

        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setAllContacts(parsed);
        }

        const journeyStatus = await AsyncStorage.getItem(JOURNEY_KEY);
        const savedEndTime = await AsyncStorage.getItem(JOURNEY_END_TIME_KEY);
        
        if (journeyStatus === "true" || route.params?.isJourneyActive) {
          setIsActive(true);
          if (savedEndTime) {
            setJourneyEndTime(parseInt(savedEndTime, 10));
          }
          // Reload active tracking contacts from async storage
          const savedJourneyContacts = await AsyncStorage.getItem(JOURNEY_CONTACTS_KEY);
          if (savedJourneyContacts) {
            setSelectedContacts(new Set(JSON.parse(savedJourneyContacts)));
          }
        }

        try {
          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            setCurrentLocation("Location Permission Denied");
            return;
          }
          
          let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setCurrentCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          setMapRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          });

          let response = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          if (response && response.length > 0) {
            const exactCity = response[0].city || response[0].district || response[0].subregion || response[0].name || "Unknown Area";
            const exactState = response[0].region || "";
            setCurrentLocation(`${exactCity}${exactState ? `, ${exactState}` : ""}`);
          }
        } catch (err) {
          setCurrentLocation("Location Unavailable");
        }
      };
      fetchInitData();
    }, [route.params])
  );

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startLiveTracking = async () => {
      if (isActive) {
        locationSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 5 },
          (loc) => {
            setCurrentCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            setMapRegion((prev: any) => ({ ...prev, latitude: loc.coords.latitude, longitude: loc.coords.longitude }));
          }
        );
      }
    };

    startLiveTracking();
    return () => { if (locationSubscription) locationSubscription.remove(); };
  }, [isActive]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && journeyEndTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const diff = journeyEndTime - now;

        if (diff <= 0) {
          setIsEtaExpired(true);
          setTimeLeftString("00:00");
          clearInterval(interval);
        } else {
          setIsEtaExpired(false);
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          
          if (hours > 0) setTimeLeftString(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
          else setTimeLeftString(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      }, 1000); 
    }
    return () => clearInterval(interval);
  }, [isActive, journeyEndTime]);

  const etaOptions = ["15m", "30m", "1h", "2h", "3h+"];

  const getEtaMilliseconds = (etaStr: string) => {
    switch (etaStr) {
      case "15m": return 15 * 60 * 1000;
      case "30m": return 30 * 60 * 1000;
      case "1h": return 60 * 60 * 1000;
      case "2h": return 120 * 60 * 1000;
      case "3h+": return 180 * 60 * 1000; 
      default: return 30 * 60 * 1000;
    }
  };

  const toggleContactSelection = (id: string) => {
    const newSet = new Set(selectedContacts);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedContacts(newSet);
  };

  const startSharing = async () => {
    if (selectedContacts.size === 0) {
      Alert.alert("No Contacts Selected", "Please select at least one contact to share your journey with.");
      return;
    }

    const calculatedEndTime = Date.now() + getEtaMilliseconds(eta);
    
    setIsActive(true);
    setJourneyEndTime(calculatedEndTime);
    setIsEtaExpired(false);
    
    await AsyncStorage.setItem(JOURNEY_KEY, "true");
    await AsyncStorage.setItem(JOURNEY_END_TIME_KEY, calculatedEndTime.toString());
    
    // Save selected active tracking contacts specifically for the duration of the journey
    await AsyncStorage.setItem(JOURNEY_CONTACTS_KEY, JSON.stringify(Array.from(selectedContacts)));

    const recipients = allContacts.filter(c => selectedContacts.has(c.id));
    const phoneNumbers = recipients.map(c => c.phone).join(Platform.OS === "ios" ? "," : ";");
    
    const destStr = destination ? ` to ${destination}` : "";
    const purposeStr = purpose ? ` for ${purpose}` : "";
    let message = `I'm starting a journey${destStr}${purposeStr}. My ETA is ${eta}.`;
    
    if (securitySettings.locationSharing) {
       message = `My current location is ${currentLocation}, I'm starting a journey${destStr}${purposeStr}. My ETA is ${eta}. Track my live location via Strompulse here: strompulse.de/track/j-9x2k`;
    }

    if (securitySettings.sendSms) {
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) await SMS.sendSMSAsync(phoneNumbers, message);
    }

    if (recipients.length > 0) {
      const primaryContact = recipients[0];
      let cleanPhone = primaryContact.phone.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '234' + cleanPhone.slice(1);
      else if (cleanPhone.length <= 10) cleanPhone = '234' + cleanPhone;

      const waUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
      Linking.openURL(waUrl).catch(() => {});
    }

    try {
      const session = await AuthService.getCurrentSession();
      const currentUser = session?.user;
      const userName = (currentUser as any)?.full_name;
      const recipientPhonesArray = recipients.map(c => c.phone);

      await supabase.from("alerts").insert({
        user_id: currentUser?.id,
        type: "journey_start",
        title: userName ? `${userName} started a journey` : "Journey started",
        message: `Heading${destination ? ` to ${destination}` : ""}. Estimated arrival in ${eta}.`,
        recipient_phones: recipientPhonesArray
      });
    } catch (e) {
      console.warn("Failed to push live journey alert", e);
    }

    navigation.navigate("Safety", { isJourneyActive: true, timestamp: Date.now() });
  };

  const notifyEtaExpired = async () => {
    const recipients = allContacts.filter(c => selectedContacts.has(c.id));
    const phoneNumbers = recipients.map(c => c.phone).join(Platform.OS === "ios" ? "," : ";");
    const destStr = destination ? ` to ${destination}` : "";
    
    let message = `🚨 ALERT: My expected arrival time of ${eta} for my journey${destStr} has elapsed and I have not checked in.`;
    if (securitySettings.locationSharing) {
      message += ` My last tracked location is ${currentLocation}. Please check on me. strompulse.de/track/j-9x2k`;
    }

    if (securitySettings.sendSms) {
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) await SMS.sendSMSAsync(phoneNumbers, message);
    }

    if (recipients.length > 0) {
      const primaryContact = recipients[0];
      let cleanPhone = primaryContact.phone.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '234' + cleanPhone.slice(1);
      else if (cleanPhone.length <= 10) cleanPhone = '234' + cleanPhone;

      const waUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
      Linking.openURL(waUrl).catch(() => {});
    }
  };

  const notifySafetyAfterExpiration = async () => {
    const recipients = allContacts.filter(c => selectedContacts.has(c.id));
    const phoneNumbers = recipients.map(c => c.phone).join(Platform.OS === "ios" ? "," : ";");
    
    let message = `✅ UPDATE: I'm safe! I forgot to notify that I'm safe and I arrived safely at my destination.`;

    if (securitySettings.sendSms) {
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) await SMS.sendSMSAsync(phoneNumbers, message);
    }

    if (recipients.length > 0) {
      const primaryContact = recipients[0];
      let cleanPhone = primaryContact.phone.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '234' + cleanPhone.slice(1);
      else if (cleanPhone.length <= 10) cleanPhone = '234' + cleanPhone;

      const waUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
      Linking.openURL(waUrl).catch(() => {});
    }

    await AsyncStorage.removeItem(JOURNEY_KEY);
    await AsyncStorage.removeItem(JOURNEY_END_TIME_KEY);
    await AsyncStorage.removeItem(JOURNEY_CONTACTS_KEY);
    navigation.navigate("Safety", { isJourneyActive: false, timestamp: Date.now() });
  };

  const stopSharing = async () => {
    setIsActive(false);
    setIsEtaExpired(false);
    setJourneyEndTime(null);
    setTimeLeftString("--:--");
    
    await AsyncStorage.removeItem(JOURNEY_KEY);
    await AsyncStorage.removeItem(JOURNEY_END_TIME_KEY);
    await AsyncStorage.removeItem(JOURNEY_CONTACTS_KEY);
    
    const recipients = allContacts.filter(c => selectedContacts.has(c.id));
    if (recipients.length > 0) {
      Alert.alert(
        "Journey Ended", 
        "Would you like to notify your contacts that you have arrived safely?",
        [
          { text: "No", style: "cancel", onPress: () => navigation.navigate("Safety", { isJourneyActive: false }) },
          { text: "Yes, Send Update", onPress: () => sendArrivalMessage(recipients) }
        ]
      );
    } else {
      navigation.navigate("Safety", { isJourneyActive: false, timestamp: Date.now() });
    }
  };

  const sendArrivalMessage = async (recipients: any[]) => {
    const message = `✅ UPDATE: I have ended my journey and arrived safely at my destination.`;
    const primaryContact = recipients[0];
    let cleanPhone = primaryContact.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '234' + cleanPhone.slice(1);
    else if (cleanPhone.length <= 10) cleanPhone = '234' + cleanPhone;

    const waUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    Linking.openURL(waUrl).catch(() => {});
    navigation.navigate("Safety", { isJourneyActive: false, timestamp: Date.now() });
  };

  const activeRecipients = allContacts.filter(c => selectedContacts.has(c.id));

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* --- HEADER --- */}
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={16}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Journey Share</TText>
            <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={2}>LIVE LOCATION WITH YOUR CONTACTS</TText>
          </YStack>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          
          {!isActive ? (
            <>
              {/* --- DESTINATION & PURPOSE (OPTIONAL) --- */}
              <YStack marginBottom={24} marginTop={10}>
                <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={8} marginLeft={4}>WHERE ARE YOU GOING? (OPTIONAL)</TText>
                <XStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={16} paddingHorizontal={16} height={52} alignItems="center" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={16}>
                  <TextInput
                    style={{ flex: 1, fontSize: 14, fontFamily: "Chirp-Medium", color: theme.textPrimary }}
                    placeholder="e.g. Dugbe Market, Bodija..."
                    placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
                    value={destination}
                    onChangeText={setDestination}
                  />
                </XStack>

                <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={8} marginLeft={4}>PURPOSE (OPTIONAL)</TText>
                <XStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={16} paddingHorizontal={16} height={52} alignItems="center" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                  <TextInput
                    style={{ flex: 1, fontSize: 14, fontFamily: "Chirp-Medium", color: theme.textPrimary }}
                    placeholder="e.g. Work, visiting a friend, errand..."
                    placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
                    value={purpose}
                    onChangeText={setPurpose}
                  />
                </XStack>
              </YStack>

              {/* --- ETA OPTIONS --- */}
              <YStack marginBottom={24}>
                <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>EXPECTED ARRIVAL TIME</TText>
                <XStack justifyContent="space-between">
                  {etaOptions.map((option) => {
                    const isSelected = eta === option;
                    return (
                      <TouchableOpacity key={option} onPress={() => setEta(option)} style={{ flex: 1, marginHorizontal: 4 }}>
                        <YStack 
                          backgroundColor={isSelected ? (isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5") : (isDarkMode ? "#1A221E" : "#FFFFFF")}
                          borderWidth={1}
                          borderColor={isSelected ? "#00C48A" : (isDarkMode ? "#2D3B34" : "#F1F5F9")}
                          borderRadius={12}
                          paddingVertical={12}
                          alignItems="center"
                        >
                          <TText fontSize={13} fontFamily={isSelected ? "Chirp-Bold" : "Chirp-Medium"} color={isSelected ? "#00C48A" : theme.textPrimary}>
                            {option}
                          </TText>
                        </YStack>
                      </TouchableOpacity>
                    );
                  })}
                </XStack>
              </YStack>

              {/* --- CONTACTS SELECTOR --- */}
              <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginLeft={4} marginBottom={12}>SHARING WITH</TText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16, gap: 12 }}>
                {allContacts.length > 0 ? (
                  allContacts.map((contact) => {
                    const isSelected = selectedContacts.has(contact.id);
                    return (
                      <TouchableOpacity key={contact.id} activeOpacity={0.7} onPress={() => toggleContactSelection(contact.id)}>
                        <YStack alignItems="center" width={70}>
                          <YStack width={56} height={56} borderRadius={28} backgroundColor={isDarkMode ? contact.bgDark : contact.bg} justifyContent="center" alignItems="center" marginBottom={6} opacity={isSelected ? 1 : 0.4} borderWidth={2} borderColor={isSelected ? "#00C48A" : "transparent"}>
                            <TText fontSize={20} fontFamily="Chirp-Heavy" color={contact.color}>{contact.initial}</TText>
                          </YStack>
                          <TText fontSize={12} fontFamily="Chirp-Medium" color={isSelected ? theme.textPrimary : theme.textSecondary} numberOfLines={1} textAlign="center">{contact.name.split(' ')[0]}</TText>
                        </YStack>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <YStack padding={16} alignItems="center" width="100%">
                    <TText fontSize={13} fontFamily="Chirp-Medium" color={theme.textSecondary} textAlign="center">
                      No contacts available. Add contacts in Security settings.
                    </TText>
                  </YStack>
                )}
              </ScrollView>

              <TouchableOpacity activeOpacity={0.8} onPress={startSharing} style={{ marginTop: 24 }}>
                <YStack backgroundColor="#00C48A" borderRadius={20} paddingVertical={18} alignItems="center" justifyContent="center">
                  <TText fontSize={16} fontFamily="Chirp-Bold" color="#FFFFFF">Start Journey Share</TText>
                </YStack>
              </TouchableOpacity>
            </>
          ) : (
            <YStack marginTop={10}>
              
              {/* --- MAP DURING JOURNEY --- */}
              <YStack height={220} backgroundColor={isDarkMode ? "#121A16" : "#E2E8F0"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={24} overflow="hidden" position="relative">
                {currentCoords && mapRegion ? (
                  <MapView 
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    region={mapRegion}
                    showsUserLocation={true} 
                    showsMyLocationButton={false}
                    userInterfaceStyle={isDarkMode ? "dark" : "light"}
                    pitchEnabled={false}
                  >
                    <Marker coordinate={{ latitude: currentCoords.lat, longitude: currentCoords.lng }}>
                      <YStack alignItems="center" justifyContent="center" zIndex={10}>
                        <TText fontSize={10} fontFamily="Chirp-Bold" color={isDarkMode ? "#F8FAFC" : "#1E293B"} marginBottom={6} backgroundColor={isDarkMode ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.9)"} paddingHorizontal={10} paddingVertical={4} borderRadius={10} overflow="hidden">
                          {currentLocation.split(',')[0]}
                        </TText>
                        <YStack width={30} height={30} borderRadius={15} backgroundColor="rgba(0,196,138,0.3)" justifyContent="center" alignItems="center">
                          <YStack width={14} height={14} borderRadius={7} backgroundColor="#00C48A" borderWidth={2} borderColor="#FFFFFF" />
                        </YStack>
                      </YStack>
                    </Marker>
                  </MapView>
                ) : (
                  <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} justifyContent="center" alignItems="center">
                    <ActivityIndicator size="small" color="#00C48A" />
                    <TText marginTop={8} fontSize={10} fontFamily="Chirp-Medium" color={theme.textSecondary}>Fetching Exact GPS...</TText>
                  </YStack>
                )}
              </YStack>

              {/* --- COUNTDOWN TIMER UI --- */}
              {!isEtaExpired && (
                <YStack backgroundColor={isDarkMode ? "rgba(0,196,138,0.05)" : "#ECFDF5"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "rgba(0,196,138,0.2)" : "#D1FAE5"} paddingVertical={24} alignItems="center" marginBottom={24}>
                  <TText fontSize={10} fontFamily="Chirp-Bold" color="#00C48A" letterSpacing={1.5} marginBottom={8}>ESTIMATED TIME OF ARRIVAL</TText>
                  <TText fontSize={42} fontFamily="Chirp-Heavy" color={theme.textPrimary} fontVariant={["tabular-nums"]}>{timeLeftString}</TText>
                </YStack>
              )}

              {/* --- DUAL OPTIONS WHEN ETA EXPIRED --- */}
              {isEtaExpired && (
                <YStack backgroundColor={isDarkMode ? "rgba(239,68,68,0.05)" : "#FEF2F2"} borderRadius={24} padding={20} marginBottom={24} borderWidth={1} borderColor={isDarkMode ? "#7F1D1D" : "#FECACA"}>
                  <XStack alignItems="center" marginBottom={8}>
                    <Feather name="alert-circle" size={20} color="#EF4444" />
                    <TText fontSize={14} fontFamily="Chirp-Bold" color="#EF4444" marginLeft={6}>ETA Elapsed</TText>
                  </XStack>
                  <TText fontSize={13} fontFamily="Chirp-Medium" color={theme.textPrimary} marginBottom={20} lineHeight={20}>
                    Your expected arrival time has passed. Choose an update to send to your contacts:
                  </TText>
                  
                  <TouchableOpacity onPress={notifyEtaExpired}>
                    <YStack backgroundColor="#EF4444" borderRadius={16} paddingVertical={16} alignItems="center" marginBottom={12}>
                      <TText color="#FFF" fontSize={13} fontFamily="Chirp-Bold">Notify Contacts of Delay</TText>
                    </YStack>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={notifySafetyAfterExpiration}>
                    <YStack backgroundColor="#00C48A" borderRadius={16} paddingVertical={16} alignItems="center">
                      <TText color="#FFF" fontSize={13} fontFamily="Chirp-Bold">I'm Safe / Arrived Safely</TText>
                    </YStack>
                  </TouchableOpacity>
                </YStack>
              )}

              <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginLeft={4} marginBottom={12}>ACTIVELY TRACKING YOU</TText>
              <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={32}>
                {activeRecipients.length > 0 ? activeRecipients.map((contact, index) => (
                  <XStack 
                    key={contact.id} 
                    padding={16} 
                    alignItems="center" 
                    justifyContent="space-between" 
                    borderBottomWidth={index === activeRecipients.length - 1 ? 0 : 1} 
                    borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}
                  >
                    <XStack alignItems="center">
                      <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? contact.bgDark : contact.bg} justifyContent="center" alignItems="center" marginRight={16}>
                        <TText fontFamily="Chirp-Bold" fontSize={16} color={contact.color}>{contact.initial}</TText>
                      </YStack>
                      <YStack>
                        <TText fontFamily="Chirp-Medium" fontSize={15} color={theme.textPrimary}>{contact.name}</TText>
                        <TText fontFamily="Chirp-Regular" fontSize={13} color={theme.textSecondary} marginTop={2}>{contact.phone}</TText>
                      </YStack>
                    </XStack>
                    <Feather name="navigation" size={20} color="#00C48A" />
                  </XStack>
                )) : (
                  <YStack padding={24} alignItems="center">
                    <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary}>You have not selected any contacts to track you.</TText>
                  </YStack>
                )}
              </YStack>
              
              <TouchableOpacity activeOpacity={0.8} onPress={stopSharing}>
                <YStack backgroundColor="#EF4444" borderRadius={20} paddingVertical={18} alignItems="center" justifyContent="center">
                  <TText fontSize={16} fontFamily="Chirp-Bold" color="#FFFFFF">Stop Journey Share</TText>
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