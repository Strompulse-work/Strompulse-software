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
import { Feather, Ionicons } from "@expo/vector-icons";
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
const SETTINGS_KEY = "strompulse_security_settings";

const JourneyShareScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode } = useTheme();

  const [destination, setDestination] = useState("");
  const [eta, setEta] = useState("30m");
  
  const [currentLocation, setCurrentLocation] = useState("Locating...");
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);
  const [mapRegion, setMapRegion] = useState<any>(null);
  
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [isActive, setIsActive] = useState(false);
  const [securitySettings, setSecuritySettings] = useState({ locationSharing: true, sendSms: true });

  // ETA Timer States
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
          // If active, keep previous selection, otherwise clear or default
        }

        const journeyStatus = await AsyncStorage.getItem(JOURNEY_KEY);
        const savedEndTime = await AsyncStorage.getItem(JOURNEY_END_TIME_KEY);
        
        if (journeyStatus === "true" || route.params?.isJourneyActive) {
          setIsActive(true);
          if (savedEndTime) {
            setJourneyEndTime(parseInt(savedEndTime, 10));
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

  // --- LIVE GPS TRACKING ---
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startLiveTracking = async () => {
      if (isActive) {
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 3000, 
            distanceInterval: 5, 
          },
          (loc) => {
            setCurrentCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            setMapRegion((prev: any) => ({
              ...prev,
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            }));
          }
        );
      }
    };

    startLiveTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [isActive]);

  // --- VISUAL COUNTDOWN TIMER ---
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
          
          if (hours > 0) {
            setTimeLeftString(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
          } else {
            setTimeLeftString(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
          }
        }
      }, 1000); 
    }
    return () => clearInterval(interval);
  }, [isActive, journeyEndTime]);

  const etaOptions = ["15m", "30m", "1h", "2h", "2h+"];

  const getEtaMilliseconds = (etaStr: string) => {
    switch (etaStr) {
      case "15m": return 15 * 60 * 1000;
      case "30m": return 30 * 60 * 1000;
      case "1h": return 60 * 60 * 1000;
      case "2h": return 120 * 60 * 1000;
      case "2h+": return 120 * 60 * 1000; // or any value you prefer for "2h+"
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

    const recipients = allContacts.filter(c => selectedContacts.has(c.id));
    const phoneNumbers = recipients.map(c => c.phone).join(Platform.OS === "ios" ? "," : ";");
    
    const destStr = destination ? ` to ${destination}` : "";
    let message = `I'm starting a journey${destStr}. My ETA is ${eta}.`;
    
    if (securitySettings.locationSharing) {
       message = `My current location is ${currentLocation}, I'm starting a journey${destStr}. My ETA is ${eta}. Track my live location via Strompulse here: strompulse.de/track/j-9x2k`;
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
      Linking.openURL(waUrl).catch(() => {
        if (!securitySettings.sendSms) Alert.alert("Error", "WhatsApp is not installed.");
      });
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
    
    let message = `ALERT: My expected arrival time of ${eta} for my journey${destStr} has elapsed and I have not checked in.`;
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
    
    let message = `UPDATE: I'm safe! I forgot to notify that I'm safe and I arrived safely at my destination.`;

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
    navigation.navigate("Safety", { isJourneyActive: false, timestamp: Date.now() });
  };

  const stopSharing = async () => {
    setIsActive(false);
    setIsEtaExpired(false);
    setJourneyEndTime(null);
    setTimeLeftString("--:--");
    await AsyncStorage.removeItem(JOURNEY_KEY);
    await AsyncStorage.removeItem(JOURNEY_END_TIME_KEY);
    
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
    const message = `UPDATE: I have ended my journey and arrived safely at my destination.`;
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
        {/* --- MINIMALIST HEADER --- */}
        <XStack justifyContent="center" alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={16} position="relative">
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ position: "absolute", left: 24, padding: 8, zIndex: 10 }}>
            <Feather name="arrow-left" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Journey Share</TText>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          
          {/* --- MAP CARD --- */}
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

          {!isActive ? (
            <>
              {/* --- CLASSIC LIST GROUP: JOURNEY DETAILS --- */}
              <TText fontFamily="Chirp-Bold" fontSize={12} color={theme.textSecondary} marginLeft={4} marginBottom={12}>JOURNEY DETAILS</TText>
              <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={32}>
                
                {/* Destination */}
                <XStack padding={18} alignItems="center" borderBottomWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                  <Feather name="map-pin" size={20} color={theme.textSecondary} />
                  <TextInput
                    style={{ flex: 1, marginLeft: 16, fontSize: 15, fontFamily: "Chirp-Medium", color: theme.textPrimary }}
                    placeholder="Where to? (e.g. Osogbo, Bodija)"
                    placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
                    value={destination}
                    onChangeText={setDestination}
                  />
                </XStack>

                {/* ETA Options */}
                <YStack padding={18}>
                  <TText fontSize={13} fontFamily="Chirp-Medium" color={theme.textSecondary} marginBottom={12}>Expected Arrival Time</TText>
                  <XStack justifyContent="space-between">
                    {etaOptions.map((option) => {
                      const isSelected = eta === option;
                      return (
                        <TouchableOpacity key={option} onPress={() => setEta(option)} style={{ flex: 1, marginHorizontal: 4 }}>
                          <YStack 
                            backgroundColor={isSelected ? (isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5") : (isDarkMode ? "#1A221E" : "#F8FAFC")}
                            borderWidth={1}
                            borderColor={isSelected ? "#00C48A" : "transparent"}
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
              </YStack>

              {/* --- CLASSIC LIST GROUP: CONTACTS SELECTOR --- */}
              <TText fontFamily="Chirp-Bold" fontSize={12} color={theme.textSecondary} marginLeft={4} marginBottom={12}>SHARING WITH</TText>
              <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={32}>
                {allContacts.length > 0 ? (
                  allContacts.map((contact, index) => {
                    const isSelected = selectedContacts.has(contact.id);
                    return (
                      <TouchableOpacity key={contact.id} activeOpacity={0.7} onPress={() => toggleContactSelection(contact.id)}>
                        <XStack padding={16} alignItems="center" borderBottomWidth={index === allContacts.length - 1 ? 0 : 1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                          <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? contact.bgDark : contact.bg} justifyContent="center" alignItems="center" marginRight={16}>
                            <TText fontSize={16} fontFamily="Chirp-Heavy" color={contact.color}>{contact.initial}</TText>
                          </YStack>
                          <YStack flex={1}>
                            <TText fontSize={15} fontFamily="Chirp-Medium" color={theme.textPrimary}>{contact.name}</TText>
                            <TText fontSize={12} fontFamily="Chirp-Regular" color={theme.textSecondary} marginTop={2}>{contact.phone}</TText>
                          </YStack>
                          {isSelected ? (
                            <Feather name="check-circle" size={22} color="#00C48A" />
                          ) : (
                            <Feather name="circle" size={22} color={isDarkMode ? "#2D3B34" : "#E2E8F0"} />
                          )}
                        </XStack>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <YStack padding={24} alignItems="center">
                    <TText fontSize={13} fontFamily="Chirp-Medium" color={theme.textSecondary} textAlign="center">
                      No contacts added. Go to Emergency Contacts in Safety to add your network.
                    </TText>
                  </YStack>
                )}
              </YStack>
            </>
          ) : (
            <YStack marginTop={10}>
              
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

              <TText fontFamily="Chirp-Bold" fontSize={12} color={theme.textSecondary} marginLeft={4} marginBottom={12}>ACTIVELY TRACKING YOU</TText>
              <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={32}>
                {activeRecipients.map((contact, index) => (
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
                ))}
              </YStack>

            </YStack>
          )}
        </ScrollView>

        <YStack paddingHorizontal={24} paddingBottom={Platform.OS === "ios" ? 34 : 24} paddingTop={16}>
          {isActive ? (
            <TouchableOpacity activeOpacity={0.8} onPress={stopSharing}>
              <YStack backgroundColor="#EF4444" borderRadius={20} paddingVertical={18} alignItems="center" justifyContent="center">
                <TText fontSize={16} fontFamily="Chirp-Bold" color="#FFFFFF">Stop Journey Share</TText>
              </YStack>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity activeOpacity={0.8} onPress={startSharing}>
              <YStack backgroundColor="#00C48A" borderRadius={20} paddingVertical={18} alignItems="center" justifyContent="center">
                <TText fontSize={16} fontFamily="Chirp-Bold" color="#FFFFFF">Start Journey Share</TText>
              </YStack>
            </TouchableOpacity>
          )}
        </YStack>
      </SafeAreaView>
    </YStack>
  );
};

export default JourneyShareScreen;