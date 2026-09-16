import React, { useState, useCallback, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  StatusBar, 
  TouchableOpacity, 
  Platform, 
  TextInput, 
  ScrollView, 
  Alert,
  SafeAreaView,
  ActivityIndicator
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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
  const styles = getStyles(theme, isDarkMode);

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
          setSelectedContacts(new Set(parsed.map((c: any) => c.id)));
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

  const etaOptions = ["15m", "30m", "1h", "2h"];

  const getEtaMilliseconds = (etaStr: string) => {
    switch (etaStr) {
      case "15m": return 15 * 60 * 1000;
      case "30m": return 30 * 60 * 1000;
      case "1h": return 60 * 60 * 1000;
      case "2h": return 120 * 60 * 1000;
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

    // --- PUSH JOURNEY TO LIVE NOTIFICATIONS ---
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

  // Option 1: Delay Message
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

  // Option 2: Safety / Arrived Safely Message after expiration
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

    // Clear active status and head back
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
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.7} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Journey Share</Text>
            <Text style={styles.headerSubtitle}>LIVE LOCATION WITH YOUR CONTACTS</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.mapGraphicCard}>
            {currentCoords && mapRegion ? (
              <MapView 
                style={StyleSheet.absoluteFillObject}
                region={mapRegion}
                showsUserLocation={true} 
                showsMyLocationButton={false}
                userInterfaceStyle={isDarkMode ? "dark" : "light"}
                pitchEnabled={false}
              >
                <Marker coordinate={{ latitude: currentCoords.lat, longitude: currentCoords.lng }}>
                  <View style={styles.mapMarkerContainer}>
                    <Text style={styles.mapMarkerText}>{currentLocation.split(',')[0]}</Text>
                    <View style={styles.mapMarkerPulse}>
                      <View style={styles.mapMarkerCore} />
                    </View>
                  </View>
                </Marker>
              </MapView>
            ) : (
              <View style={styles.mapGridPattern}>
                <ActivityIndicator size="small" color="#00C48A" />
                <Text style={{ marginTop: 8, fontSize: 10, color: theme.textSecondary }}>Fetching Exact GPS...</Text>
              </View>
            )}
          </View>

          {!isActive ? (
            <>
              <Text style={styles.sectionTitle}>WHERE ARE YOU GOING?</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Osogbo, Bodija..."
                  placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
                  value={destination}
                  onChangeText={setDestination}
                />
                <MaterialCommunityIcons name="menu-down" size={24} color={isDarkMode ? "#94A3B8" : "#64748B"} />
              </View>

              <Text style={styles.sectionTitle}>EXPECTED ARRIVAL TIME</Text>
              <View style={styles.etaRow}>
                {etaOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.etaPill, eta === option && styles.etaPillActive]}
                    onPress={() => setEta(option)}
                  >
                    <Text style={[styles.etaText, eta === option && styles.etaTextActive]}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionTitle}>SHARING WITH</Text>
              <View style={styles.sharingWithContainer}>
                {activeRecipients.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {allContacts.map((contact) => (
                      <TouchableOpacity 
                        key={contact.id}
                        onPress={() => toggleContactSelection(contact.id)}
                        style={[styles.sharingAvatarItem, !selectedContacts.has(contact.id) && { opacity: 0.4 }]}
                      >
                        <View style={[styles.avatarCircle, { backgroundColor: isDarkMode ? contact.bgDark : contact.bg }]}>
                          <Text style={[styles.avatarText, { color: contact.color }]}>{contact.initial}</Text>
                        </View>
                        <Text style={styles.avatarNameText} numberOfLines={1}>{contact.name.split(' ')[0]}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.emptyText}>Tap contacts to select who to share with.</Text>
                )}
              </View>
            </>
          ) : (
            <View style={{ marginTop: 10 }}>
              
              {/* --- COUNTDOWN TIMER UI --- */}
              {!isEtaExpired && (
                <View style={styles.countdownCard}>
                  <Text style={styles.countdownLabel}>ESTIMATED TIME OF ARRIVAL</Text>
                  <Text style={styles.countdownTime}>{timeLeftString}</Text>
                </View>
              )}

              {/* --- DUAL OPTIONS WHEN ETA EXPIRED --- */}
              {isEtaExpired && (
                <View style={styles.etaExpiredCard}>
                  <View style={styles.etaExpiredHeader}>
                    <MaterialCommunityIcons name="alert" size={20} color="#EF4444" />
                    <Text style={styles.etaExpiredTitle}>ETA Elapsed</Text>
                  </View>
                  <Text style={styles.etaExpiredDesc}>Your expected arrival time has passed. Choose an update to send to your contacts:</Text>
                  
                  {/* Option 1: Delay / Check on me */}
                  <TouchableOpacity style={styles.etaNotifyBtn} onPress={notifyEtaExpired}>
                    <Text style={styles.etaNotifyBtnText}>Notify Contacts of Delay</Text>
                  </TouchableOpacity>

                  {/* Option 2: I am safe / Arrived safely */}
                  <TouchableOpacity style={styles.etaSafeBtn} onPress={notifySafetyAfterExpiration}>
                    <Text style={styles.etaSafeBtnText}>I'm Safe / Arrived Safely</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.sectionTitle}>ACTIVELY TRACKING YOU</Text>
              {activeRecipients.map((contact) => (
                <View key={contact.id} style={styles.sentCard}>
                  <View style={styles.sentLeft}>
                    <View style={[styles.avatarCircle, { width: 36, height: 36, borderRadius: 18, backgroundColor: isDarkMode ? contact.bgDark : contact.bg }]}>
                      <Text style={[styles.avatarText, { fontSize: 14, color: contact.color }]}>{contact.initial}</Text>
                    </View>
                    <Text style={styles.sentName}>{contact.name}</Text>
                  </View>
                  <View style={styles.sentPill}>
                    <View style={styles.smallGreenDot} />
                    <Text style={styles.sentPillText}>Live Tracker Sent</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {isActive ? (
            <TouchableOpacity style={styles.stopButton} activeOpacity={0.8} onPress={stopSharing}>
              <Text style={styles.stopButtonText}>Stop Journey Share</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.startButton} activeOpacity={0.8} onPress={startSharing}>
              <Text style={styles.startButtonText}>Start Journey Share</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

const getStyles = (theme: any, isDarkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#F4F6F8" },
  safeArea: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingTop: Platform.OS === "ios" ? 20 : 10, marginBottom: 24 },
  backButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", justifyContent: "center", alignItems: "center", backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", marginRight: 16 },
  headerTextContainer: { flex: 1, justifyContent: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Sora_800ExtraBold", color: theme.textPrimary },
  headerSubtitle: { fontSize: 10, fontFamily: "Sora_700Bold", color: theme.textSecondary, letterSpacing: 1.5, marginTop: 2, textTransform: "uppercase" },
  
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  
  mapGraphicCard: { height: 220, backgroundColor: isDarkMode ? "#121A16" : "#E2E8F0", borderRadius: 20, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#CBD5E1", marginBottom: 24, overflow: "hidden" },
  mapGridPattern: { flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#F8FAFC", justifyContent: "center", alignItems: "center" },
  mapMarkerContainer: { alignItems: "center", justifyContent: "center", zIndex: 10 },
  mapMarkerText: { fontSize: 10, fontFamily: "Sora_700Bold", color: isDarkMode ? "#F8FAFC" : "#1E293B", marginBottom: 6, backgroundColor: isDarkMode ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.9)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: "hidden" },
  mapMarkerPulse: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,196,138,0.3)", justifyContent: "center", alignItems: "center" },
  mapMarkerCore: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#00C48A", borderWidth: 2, borderColor: "#FFFFFF" },

  sectionTitle: { fontSize: 11, fontFamily: "Sora_700Bold", color: theme.textSecondary, letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  
  inputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", paddingHorizontal: 16, height: 56, marginBottom: 24 },
  input: { flex: 1, fontSize: 14, fontFamily: "Sora_500Medium", color: theme.textPrimary },
  
  etaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  etaPill: { flex: 1, backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", borderRadius: 16, paddingVertical: 14, alignItems: "center", marginHorizontal: 4 },
  etaPillActive: { backgroundColor: isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5", borderColor: "#00C48A" },
  etaText: { fontSize: 13, fontFamily: "Sora_600SemiBold", color: theme.textSecondary },
  etaTextActive: { color: "#00C48A", fontFamily: "Sora_700Bold" },
  
  sharingWithContainer: { flexDirection: "row", marginBottom: 20, paddingLeft: 4 },
  sharingAvatarItem: { alignItems: "center", marginRight: 16 },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  avatarText: { fontSize: 20, fontFamily: "Sora_700Bold" },
  avatarNameText: { fontSize: 11, fontFamily: "Sora_500Medium", color: theme.textSecondary, width: 50, textAlign: "center" },
  emptyText: { fontSize: 12, fontFamily: "Sora_500Medium", color: theme.textSecondary, paddingLeft: 4, paddingBottom: 10 },

  countdownCard: { backgroundColor: isDarkMode ? "rgba(0,196,138,0.05)" : "#ECFDF5", borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? "rgba(0,196,138,0.2)" : "#D1FAE5", paddingVertical: 24, alignItems: "center", marginBottom: 24 },
  countdownLabel: { fontSize: 10, fontFamily: "Sora_700Bold", color: "#00C48A", letterSpacing: 1.5, marginBottom: 8 },
  countdownTime: { fontSize: 36, fontFamily: "Sora_800ExtraBold", color: theme.textPrimary, fontVariant: ["tabular-nums"] },

  sentCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" },
  sentLeft: { flexDirection: "row", alignItems: "center" },
  sentName: { fontSize: 14, fontFamily: "Sora_700Bold", color: theme.textPrimary, marginLeft: 12 },
  sentPill: { flexDirection: "row", alignItems: "center", backgroundColor: isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  smallGreenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#00C48A", marginRight: 6 },
  sentPillText: { color: "#00C48A", fontSize: 10, fontFamily: "Sora_700Bold" },

  etaExpiredCard: { backgroundColor: isDarkMode ? "rgba(239,68,68,0.1)" : "#FEF2F2", borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: isDarkMode ? "#7F1D1D" : "#FECACA" },
  etaExpiredHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  etaExpiredTitle: { fontSize: 14, fontFamily: "Sora_700Bold", color: "#EF4444", marginLeft: 6 },
  etaExpiredDesc: { fontSize: 12, fontFamily: "Sora_500Medium", color: theme.textPrimary, marginBottom: 16, lineHeight: 18 },
  
  etaNotifyBtn: { backgroundColor: "#EF4444", borderRadius: 12, paddingVertical: 12, alignItems: "center", marginBottom: 10 },
  etaNotifyBtnText: { color: "#FFF", fontSize: 13, fontFamily: "Sora_700Bold" },

  etaSafeBtn: { backgroundColor: "#00C48A", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  etaSafeBtnText: { color: "#FFF", fontSize: 13, fontFamily: "Sora_700Bold" },

  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === "ios" ? 34 : 24, paddingTop: 16 },
  startButton: { backgroundColor: "#00C48A", borderRadius: 16, paddingVertical: 18, alignItems: "center", justifyContent: "center" },
  startButtonText: { fontSize: 16, fontFamily: "Sora_700Bold", color: "#FFFFFF" },
  stopButton: { backgroundColor: "#EF4444", borderRadius: 16, paddingVertical: 18, alignItems: "center", justifyContent: "center" },
  stopButtonText: { fontSize: 16, fontFamily: "Sora_700Bold", color: "#FFFFFF" },
});

export default JourneyShareScreen;