import React, { useState, useCallback, useEffect } from "react";
import { 
  StatusBar, TouchableOpacity, Platform, TextInput, 
  ScrollView, Alert, SafeAreaView, Switch
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import * as SMS from "expo-sms";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../theme/ThemeContext";
import { useFocusEffect } from "@react-navigation/native";
import AuthService from "../services/authService";
import { sendPushAlert } from "../utils/sendAlert"; 

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
  
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [isActive, setIsActive] = useState(false);
  const [securitySettings, setSecuritySettings] = useState({ locationSharing: true, sendSms: true });

  const [autoAlertEnabled, setAutoAlertEnabled] = useState(true);
  const [autoAlertDelay, setAutoAlertDelay] = useState("30 min");

  const [isEtaExpired, setIsEtaExpired] = useState(false);
  const [journeyEndTime, setJourneyEndTime] = useState<number | null>(null);
  const [timeLeftString, setTimeLeftString] = useState("--:--");
  
  // Real-time tracking to ensure the SOS only fires once automatically
  const [hasAutoAlertFired, setHasAutoAlertFired] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const fetchInitData = async () => {
        const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          setSecuritySettings(parsed);
          if (parsed.autoAlertEnabled !== undefined) setAutoAlertEnabled(parsed.autoAlertEnabled);
          if (parsed.autoAlertDelay) setAutoAlertDelay(parsed.autoAlertDelay);
        }

        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setAllContacts(parsed);
          setSelectedContacts(new Set(parsed.filter((c:any) => c.isEmergency).map((c:any) => c.id)));
        }

        const journeyStatus = await AsyncStorage.getItem(JOURNEY_KEY);
        const savedEndTime = await AsyncStorage.getItem(JOURNEY_END_TIME_KEY);
        
        if (journeyStatus === "true" || route.params?.isJourneyActive) {
          setIsActive(true);
          if (savedEndTime) {
            setJourneyEndTime(parseInt(savedEndTime, 10));
          }
          const savedJourneyContacts = await AsyncStorage.getItem(JOURNEY_CONTACTS_KEY);
          if (savedJourneyContacts) {
            setSelectedContacts(new Set(JSON.parse(savedJourneyContacts)));
          }
        }
      };
      fetchInitData();
    }, [route.params])
  );

  // REAL-TIME INTERVAL HANDLER FOR COUNTDOWN & AUTO-ALERT
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && journeyEndTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const diff = journeyEndTime - now;

        if (diff <= 0) {
          setIsEtaExpired(true);
          setTimeLeftString("00:00");

          // Auto-Alert Logic
          if (autoAlertEnabled && !hasAutoAlertFired) {
            const delayMs = autoAlertDelay === "15 min" ? 15 * 60000 : autoAlertDelay === "30 min" ? 30 * 60000 : 60 * 60000;
            const timeSinceExpiration = now - journeyEndTime;
            
            // If the delay time has elapsed and the user hasn't checked in, FIRE THE ALERT automatically
            if (timeSinceExpiration >= delayMs) {
              notifyEtaExpired(true);
              setHasAutoAlertFired(true);
            }
          }

          // If we aren't waiting for an auto-alert, or it has already fired, clear the interval to save memory
          if (!autoAlertEnabled || hasAutoAlertFired) {
            clearInterval(interval);
          }
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
  }, [isActive, journeyEndTime, autoAlertEnabled, autoAlertDelay, hasAutoAlertFired]);

  const etaOptions = ["15m", "30m", "1h", "2h", "3h+"];
  const delayOptions = ["15 min", "30 min", "1 hr"];

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
    setHasAutoAlertFired(false);
    
    await AsyncStorage.setItem(JOURNEY_KEY, "true");
    await AsyncStorage.setItem(JOURNEY_END_TIME_KEY, calculatedEndTime.toString());
    await AsyncStorage.setItem(JOURNEY_CONTACTS_KEY, JSON.stringify(Array.from(selectedContacts)));

    // Save current Auto-Alert settings
    const saved = await AsyncStorage.getItem(SETTINGS_KEY);
    const currentSettings = saved ? JSON.parse(saved) : {};
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...currentSettings, autoAlertEnabled, autoAlertDelay }));

    const recipients = allContacts.filter(c => selectedContacts.has(c.id));
    
    try {
      const session = await AuthService.getCurrentSession();
      const userName = (session?.user as any)?.full_name || "Someone";
      const messageBody = `Heading${destination ? ` to ${destination}` : ""}. Estimated arrival in ${eta}.`;

      for (const contact of recipients) {
        await sendPushAlert('journey_start', `${userName} started a journey`, messageBody, contact.id);
      }
    } catch (e) {
      console.warn("Failed to push live journey alert", e);
    }

    navigation.navigate("Safety", { isJourneyActive: true, timestamp: Date.now() });
  };

  const notifyEtaExpired = async (isAuto = false) => {
    const recipients = allContacts.filter(c => selectedContacts.has(c.id));
    const phoneNumbers = recipients.map(c => c.phone);
    const destStr = destination ? ` to ${destination}` : "";
    
    let message = isAuto 
      ? `🚨 AUTO-ALERT: I haven't checked in for ${autoAlertDelay} after my ETA of ${eta} elapsed for my journey${destStr}. Please check on me.`
      : `🚨 ALERT: My expected arrival time of ${eta} for my journey${destStr} has elapsed and I have not checked in.`;

    if (securitySettings.locationSharing) {
      message += ` Track my last known location: strompulse.de/track/j-9x2k`;
    }

    if (securitySettings.sendSms) {
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) await SMS.sendSMSAsync(phoneNumbers, message);
    }

    if (!isAuto && recipients.length > 0) {
      const primaryContact = recipients[0];
      let cleanPhone = primaryContact.phone.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '234' + cleanPhone.slice(1);
      else if (cleanPhone.length <= 10) cleanPhone = '234' + cleanPhone;

      const waUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
      Linking.openURL(waUrl).catch(() => {});
    }

    try {
      const session = await AuthService.getCurrentSession();
      const userName = (session?.user as any)?.full_name || "Someone";
      
      for (const contact of recipients) {
        await sendPushAlert(
          'emergency',
          isAuto ? `🚨 Auto-Alert: ${userName} hasn't arrived` : `🚨 ETA Expired for ${userName}`,
          `Their expected arrival time of ${eta} has elapsed.`,
          contact.id
        );
      }
    } catch (e) {
      console.warn("Failed to send ETA push", e);
    }
  };

  const notifySafetyAfterExpiration = async () => {
    const recipients = allContacts.filter(c => selectedContacts.has(c.id));
    try {
      const session = await AuthService.getCurrentSession();
      const userName = (session?.user as any)?.full_name || "Someone";
      
      for (const contact of recipients) {
        await sendPushAlert('journey_start', `✅ ${userName} is Safe`, `They have confirmed they arrived safely.`, contact.id);
      }
    } catch (e) {
      console.warn("Failed to send safety push", e);
    }

    await AsyncStorage.removeItem(JOURNEY_KEY);
    await AsyncStorage.removeItem(JOURNEY_END_TIME_KEY);
    await AsyncStorage.removeItem(JOURNEY_CONTACTS_KEY);
    navigation.navigate("Safety", { isJourneyActive: false, timestamp: Date.now() });
  };

  const contactNames = allContacts.filter(c => selectedContacts.has(c.id)).map(c => c.name.split(' ')[0]).join(', ');
  const alertText = contactNames.length > 0 ? contactNames.replace(/,([^,]*)$/, ' and$1') : "your trusted contacts";

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* HEADER */}
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={16}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Journey Share</TText> 
            <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2} letterSpacing={1}>LIVE LOCATION WITH YOUR CONTACTS</TText> 
          </YStack>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          
          {!isActive ? (
            <>
              <YStack marginBottom={24} marginTop={10}>
                <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={8} marginLeft={4}>WHERE ARE YOU GOING?</TText>
                <XStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={16} paddingHorizontal={16} height={52} alignItems="center" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={16}>
                  <TextInput style={{ flex: 1, fontSize: 14, fontFamily: "Chirp-Medium", color: theme.textPrimary }} placeholder="e.g. Dugbe Market, Bodija..." placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"} value={destination} onChangeText={setDestination} />
                </XStack>

                <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={8} marginLeft={4}>PURPOSE (optional)</TText>
                <XStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={16} paddingHorizontal={16} height={52} alignItems="center" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                  <TextInput style={{ flex: 1, fontSize: 14, fontFamily: "Chirp-Medium", color: theme.textPrimary }} placeholder="e.g. Work, visiting a friend, errand..." placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"} value={purpose} onChangeText={setPurpose} />
                </XStack>
              </YStack>

              <YStack marginBottom={24}>
                <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>EXPECTED ARRIVAL TIME</TText>
                <XStack justifyContent="space-between">
                  {etaOptions.map((option) => {
                    const isSelected = eta === option;
                    return (
                      <TouchableOpacity key={option} onPress={() => setEta(option)} style={{ flex: 1, marginHorizontal: 4 }}>
                        <YStack backgroundColor={isSelected ? (isDarkMode ? "rgba(0,196,138,0.15)" : "#E0F2EB") : (isDarkMode ? "#1A221E" : "#FFFFFF")} borderWidth={1} borderColor={isSelected ? "#00C48A" : (isDarkMode ? "#2D3B34" : "#F1F5F9")} borderRadius={16} paddingVertical={14} alignItems="center">
                          <TText fontSize={13} fontFamily={isSelected ? "Chirp-Bold" : "Chirp-Medium"} color={isSelected ? "#00C48A" : theme.textSecondary}>{option}</TText>
                        </YStack>
                      </TouchableOpacity>
                    );
                  })}
                </XStack>
              </YStack>

              <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginLeft={4} marginBottom={12}>SHARING WITH</TText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16, gap: 12, marginBottom: 8 }}>
                {allContacts.map((contact) => {
                  const isSelected = selectedContacts.has(contact.id);
                  return (
                    <TouchableOpacity key={contact.id} activeOpacity={0.7} onPress={() => toggleContactSelection(contact.id)}>
                      <YStack alignItems="center" width={60}>
                        <YStack width={50} height={50} borderRadius={25} backgroundColor={isDarkMode ? contact.bgDark : contact.bg} justifyContent="center" alignItems="center" marginBottom={6} opacity={isSelected ? 1 : 0.4} borderWidth={2} borderColor={isSelected ? "#00C48A" : "transparent"}>
                          <TText fontSize={18} fontFamily="Chirp-Heavy" color={contact.color}>{contact.initial}</TText>
                        </YStack>
                        <TText fontSize={11} fontFamily="Chirp-Medium" color={isSelected ? theme.textPrimary : theme.textSecondary} numberOfLines={1} textAlign="center">{contact.name.split(' ')[0]}</TText>
                      </YStack>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* ARRIVAL CHECK-IN UI IDENTICAL TO SETTINGS */}
              <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginLeft={4} marginBottom={12}>ARRIVAL CHECK-IN</TText>
              <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#00C48A"} padding={20} marginBottom={32}>
                <XStack justifyContent="space-between" alignItems="center" marginBottom={16}>
                  <XStack alignItems="center" flex={1}>
                    <YStack width={36} height={36} borderRadius={18} backgroundColor={isDarkMode ? "rgba(239,68,68,0.1)" : "#FEE2E2"} justifyContent="center" alignItems="center" marginRight={12}>
                      <Feather name="clock" size={16} color="#EF4444" />
                    </YStack>
                    <YStack flex={1}>
                      <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} marginBottom={2}>Auto-Alert If I Go Quiet</TText> 
                      <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>We'll alert your trusted contacts if you don't confirm arrival</TText> 
                    </YStack>
                  </XStack>
                  <Switch trackColor={{ false: isDarkMode ? "#2D3B34" : "#E2E8F0", true: "#00C48A" }} thumbColor={"#FFFFFF"} value={autoAlertEnabled} onValueChange={setAutoAlertEnabled} />
                </XStack>

                {autoAlertEnabled && (
                  <YStack borderTopWidth={1} borderTopColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} paddingTop={16}>
                    <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} lineHeight={18} marginBottom={16}>
                      If you haven't tapped 'I've arrived' this long after your expected arrival time above, we'll automatically alert {alertText} with your last known location.
                    </TText>
                    <XStack justifyContent="space-between" gap={8}>
                      {delayOptions.map((opt) => (
                        <TouchableOpacity key={opt} onPress={() => setAutoAlertDelay(opt)} style={{ flex: 1 }}>
                          <YStack backgroundColor={autoAlertDelay === opt ? (isDarkMode ? "rgba(0,196,138,0.1)" : "#E0F2EB") : "transparent"} borderWidth={1} borderColor={autoAlertDelay === opt ? "#00C48A" : (isDarkMode ? "#2D3B34" : "#E2E8F0")} borderRadius={16} paddingVertical={12} alignItems="center">
                            <TText fontSize={12} fontFamily="Chirp-Bold" color={autoAlertDelay === opt ? "#00C48A" : theme.textSecondary}>{opt}</TText>
                          </YStack>
                        </TouchableOpacity>
                      ))}
                    </XStack>
                  </YStack>
                )}
              </YStack>

              <TouchableOpacity activeOpacity={0.8} onPress={startSharing}>
                <YStack backgroundColor="#00C48A" borderRadius={20} paddingVertical={18} alignItems="center" justifyContent="center">
                  <TText fontSize={16} fontFamily="Chirp-Bold" color="#FFFFFF">Start Journey Share</TText>
                </YStack>
              </TouchableOpacity>
            </>
          ) : (
            <YStack marginTop={10}>
              
              {/* --- COUNTDOWN TIMER UI --- */}
              {!isEtaExpired && (
                <YStack backgroundColor={isDarkMode ? "rgba(0,196,138,0.05)" : "#ECFDF5"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "rgba(0,196,138,0.2)" : "#D1FAE5"} paddingVertical={32} alignItems="center" marginBottom={24}>
                  <TText fontSize={11} fontFamily="Chirp-Bold" color="#00C48A" letterSpacing={1.5} marginBottom={12}>ESTIMATED TIME OF ARRIVAL</TText>
                  <TText fontSize={48} fontFamily="Chirp-Heavy" color={theme.textPrimary} fontVariant={["tabular-nums"]}>{timeLeftString}</TText>
                </YStack>
              )}

              {/* --- DUAL OPTIONS WHEN ETA EXPIRED --- */}
              {isEtaExpired && (
                <YStack backgroundColor={isDarkMode ? "rgba(239,68,68,0.05)" : "#FEF2F2"} borderRadius={24} padding={20} marginBottom={24} borderWidth={1} borderColor={isDarkMode ? "#7F1D1D" : "#FECACA"}>
                  <XStack alignItems="center" marginBottom={8}>
                    <Feather name="alert-circle" size={20} color="#EF4444" />
                    <TText fontSize={15} fontFamily="Chirp-Heavy" color="#EF4444" marginLeft={8}>ETA Elapsed</TText>
                  </XStack>
                  <TText fontSize={13} fontFamily="Chirp-Medium" color={theme.textPrimary} marginBottom={20} lineHeight={20}>
                    {hasAutoAlertFired 
                      ? "You did not check in, so an automated SOS alert has been fired to your contacts." 
                      : `If you do not check in, an automatic alert will fire in ${autoAlertDelay}.`}
                  </TText>
                  
                  <TouchableOpacity onPress={() => notifyEtaExpired(false)}>
                    <YStack backgroundColor="#EF4444" borderRadius={16} paddingVertical={16} alignItems="center" marginBottom={12}>
                      <TText color="#FFF" fontSize={14} fontFamily="Chirp-Bold">Notify Contacts of Delay</TText>
                    </YStack>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={notifySafetyAfterExpiration}>
                    <YStack backgroundColor="#00C48A" borderRadius={16} paddingVertical={16} alignItems="center">
                      <TText color="#FFF" fontSize={14} fontFamily="Chirp-Bold">I'm Safe / Arrived Safely</TText>
                    </YStack>
                  </TouchableOpacity>
                </YStack>
              )}

              <TouchableOpacity activeOpacity={0.8} onPress={() => { setIsActive(false); setJourneyEndTime(null); }}>
                <YStack backgroundColor={isDarkMode ? "#1A221E" : "#FFFFFF"} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} borderRadius={20} paddingVertical={18} alignItems="center" justifyContent="center">
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