import React, { useState, useCallback } from "react";
import {
  Platform, StatusBar, ScrollView, Switch, TouchableOpacity, SafeAreaView, TextInput, Alert
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthService from "../services/authService";
import { useFocusEffect } from "@react-navigation/native";
import {
  CONTACTS_KEY, DEFAULT_EMERGENCY_NUMBER, DEFAULT_SECURITY_SETTINGS, SecuritySettings, AutoShareFrequency,
  SmsQuota, SMS_SOS_MONTHLY_LIMIT, AUTO_SHARE_HOURS, formatHour,
  loadSecuritySettings, saveSecuritySettings, getSmsSosQuota, isValidPhone,
} from "../utils/securityConfig";

const SafetySettingsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const cardBg = isDarkMode ? "#121A16" : "#FFFFFF";
  const cardBorder = isDarkMode ? "#2D3B34" : "#F1F5F9";
  const inputBg = isDarkMode ? "#1A221E" : "#F8FAFC";
  const inputBorder = isDarkMode ? "#2D3B34" : "#E2E8F0";

  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [userName, setUserName] = useState("Stromer");
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [smsQuota, setSmsQuota] = useState<SmsQuota>({ used: 0, remaining: SMS_SOS_MONTHLY_LIMIT, limit: SMS_SOS_MONTHLY_LIMIT });

  // local text fields (saved on blur)
  const [customMessage, setCustomMessage] = useState("");
  const [fakeCallName, setFakeCallName] = useState("Mum");
  const [policeNumber, setPoliceNumber] = useState(DEFAULT_EMERGENCY_NUMBER);
  const [ambulanceNumber, setAmbulanceNumber] = useState(DEFAULT_EMERGENCY_NUMBER);
  const [favName, setFavName] = useState("");
  const [favPhone, setFavPhone] = useState("");

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const session = await AuthService.getCurrentSession();
        if (session?.user) setUserName((session.user as any).full_name?.split(" ")[0] || "Stromer");
        else {
          const localName = await AsyncStorage.getItem("global_name");
          if (localName) setUserName(localName.split(" ")[0]);
        }
        const s = await loadSecuritySettings();
        setSettings(s);
        setCustomMessage(s.customMessage);
        setFakeCallName(s.fakeCallName);
        setPoliceNumber(s.policeNumber);
        setAmbulanceNumber(s.ambulanceNumber);
        setFavName(s.favoriteContactName);
        setFavPhone(s.favoriteContactPhone);

        const saved = await AsyncStorage.getItem(CONTACTS_KEY);
        setEmergencyContacts(saved ? JSON.parse(saved).filter((c: any) => c.isEmergency) : []);
        setSmsQuota(await getSmsSosQuota());
      };
      load();
    }, [])
  );

  const update = async (patch: Partial<SecuritySettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    await saveSecuritySettings(patch);
  };

  const saveNumber = (key: "policeNumber" | "ambulanceNumber", value: string, setter: (v: string) => void) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setter(DEFAULT_EMERGENCY_NUMBER);
      update({ [key]: DEFAULT_EMERGENCY_NUMBER } as any);
      return;
    }
    if (!isValidPhone(trimmed)) {
      Alert.alert("Invalid number", "Please enter a valid phone number (3–15 digits).");
      setter(settings[key]);
      return;
    }
    update({ [key]: trimmed } as any);
  };

  const saveFavorite = () => {
    const phone = favPhone.trim();
    if (phone && !isValidPhone(phone)) {
      Alert.alert("Invalid number", "Please enter a valid phone number for your favorite contact.");
      return;
    }
    update({ favoriteContactName: favName.trim(), favoriteContactPhone: phone });
  };

  const pickFavoriteFromContacts = (c: any) => {
    setFavName(c.name);
    setFavPhone(c.phone);
    update({ favoriteContactName: c.name, favoriteContactPhone: c.phone });
  };

  const SectionLabel = ({ children }: any) => (
    <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>{children}</TText>
  );

  const ToggleRow = ({ icon, iconColor, iconBg, title, subtitle, value, onChange, isLast }: any) => (
    <XStack padding={20} alignItems="center" borderBottomWidth={isLast ? 0 : 1} borderBottomColor={cardBorder}>
      <YStack width={40} height={40} borderRadius={20} backgroundColor={iconBg} justifyContent="center" alignItems="center" marginRight={16}>
        <Feather name={icon} size={18} color={iconColor} />
      </YStack>
      <YStack flex={1} paddingRight={10}>
        <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary} marginBottom={2}>{title}</TText>
        <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} lineHeight={17}>{subtitle}</TText>
      </YStack>
      <Switch trackColor={{ false: inputBorder, true: "#00C48A" }} thumbColor="#FFFFFF" onValueChange={onChange} value={value} />
    </XStack>
  );

  const NumberInput = ({ label, value, onChangeText, onBlur, icon, iconColor }: any) => (
    <YStack marginBottom={12}>
      <TText fontFamily="Chirp-Bold" fontSize={12} color={theme.textPrimary} marginBottom={6}>{label}</TText>
      <XStack backgroundColor={inputBg} borderRadius={16} paddingHorizontal={16} height={52} alignItems="center" borderWidth={1} borderColor={inputBorder}>
        <Feather name={icon} size={16} color={iconColor} style={{ marginRight: 10 }} />
        <TextInput style={{ flex: 1, fontFamily: "Chirp-Medium", fontSize: 15, color: theme.textPrimary }} keyboardType="phone-pad" value={value} onChangeText={onChangeText} onBlur={onBlur} placeholder={DEFAULT_EMERGENCY_NUMBER} placeholderTextColor={theme.textSecondary} />
      </XStack>
    </YStack>
  );

  const shareOptions: { value: AutoShareFrequency; label: string }[] = [
    { value: 0, label: "Off" }, { value: 1, label: "Once" }, { value: 2, label: "Twice" }, { value: 3, label: "3 times" },
  ];

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={24}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: inputBg, borderRadius: 12, borderWidth: 1, borderColor: inputBorder }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Security Preferences</TText>
            <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2} letterSpacing={1}>CONTACTS, ALERTS & PRIVACY</TText>
          </YStack>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>

          {/* 1. EMERGENCY CONTACTS (top) */}
          <SectionLabel>EMERGENCY CONTACTS</SectionLabel>
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate("ContactsScreen")}>
            <YStack backgroundColor={cardBg} borderRadius={24} borderWidth={1} borderColor="#00C48A" padding={20} marginBottom={32}>
              <XStack alignItems="center">
                <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center" marginRight={16}>
                  <Feather name="users" size={18} color="#00C48A" />
                </YStack>
                <YStack flex={1}>
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary} marginBottom={2}>Select Emergency Contacts</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} numberOfLines={1}>
                    {emergencyContacts.length > 0 ? `${emergencyContacts.map((c) => c.name.split(" ")[0]).join(", ")} (${emergencyContacts.length}/3)` : "No contacts selected yet"}
                  </TText>
                </YStack>
                <YStack width={32} height={32} borderRadius={16} backgroundColor="#00C48A" justifyContent="center" alignItems="center">
                  <Feather name="arrow-right" size={14} color="#FFF" />
                </YStack>
              </XStack>
            </YStack>
          </TouchableOpacity>

          {/* 2. ALERT DELIVERY */}
          <SectionLabel>ALERT DELIVERY METHODS</SectionLabel>
          <YStack backgroundColor={cardBg} borderRadius={24} borderWidth={1} borderColor={cardBorder} marginBottom={12}>
            <ToggleRow icon="bell" iconColor="#00C48A" iconBg={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} title="StromPulse In-App" subtitle="Instant alert to contacts who use StromPulse" value={settings.notifyInApp} onChange={(v: boolean) => update({ notifyInApp: v })} />
            <ToggleRow icon="message-circle" iconColor="#22C55E" iconBg={isDarkMode ? "rgba(34,197,94,0.1)" : "#F0FDF4"} title="WhatsApp (Online)" subtitle="Used when you have internet. Unlimited." value={settings.notifyWhatsApp} onChange={(v: boolean) => update({ notifyWhatsApp: v })} />
            <ToggleRow isLast icon="message-square" iconColor="#3B82F6" iconBg={isDarkMode ? "rgba(59,130,246,0.1)" : "#EFF6FF"} title="SMS (Offline)" subtitle={`Used with no internet. ${smsQuota.remaining} of ${smsQuota.limit} SMS SOS alerts left this month.`} value={settings.notifySms} onChange={(v: boolean) => update({ notifySms: v })} />
          </YStack>
          <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} lineHeight={16} marginLeft={4} marginBottom={32}>
            SMS needs mobile network signal but not data. The SMS allowance resets automatically on the 1st of every month.
          </TText>

          {/* 3. EMERGENCY NUMBERS */}
          <SectionLabel>EMERGENCY SERVICE NUMBERS</SectionLabel>
          <YStack backgroundColor={cardBg} borderRadius={24} borderWidth={1} borderColor={cardBorder} padding={20} marginBottom={32}>
            <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} lineHeight={20} marginBottom={16}>
              Used by Call Police and Call Ambulance in Safety Tools. Default is {DEFAULT_EMERGENCY_NUMBER}.
            </TText>
            <NumberInput label="Police" icon="shield" iconColor="#3B82F6" value={policeNumber} onChangeText={setPoliceNumber} onBlur={() => saveNumber("policeNumber", policeNumber, setPoliceNumber)} />
            <NumberInput label="Ambulance" icon="plus-circle" iconColor="#EF4444" value={ambulanceNumber} onChangeText={setAmbulanceNumber} onBlur={() => saveNumber("ambulanceNumber", ambulanceNumber, setAmbulanceNumber)} />
            <TouchableOpacity onPress={() => { setPoliceNumber(DEFAULT_EMERGENCY_NUMBER); setAmbulanceNumber(DEFAULT_EMERGENCY_NUMBER); update({ policeNumber: DEFAULT_EMERGENCY_NUMBER, ambulanceNumber: DEFAULT_EMERGENCY_NUMBER }); }}>
              <TText fontFamily="Chirp-Bold" fontSize={12} color="#00C48A" marginTop={4}>Reset both to {DEFAULT_EMERGENCY_NUMBER}</TText>
            </TouchableOpacity>
          </YStack>

          {/* 4. FAVORITE CONTACT */}
          <SectionLabel>FAVORITE CONTACT</SectionLabel>
          <YStack backgroundColor={cardBg} borderRadius={24} borderWidth={1} borderColor={cardBorder} padding={20} marginBottom={32}>
            <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} lineHeight={20} marginBottom={16}>
              Call this person in one tap from Safety Tools.
            </TText>
            <XStack backgroundColor={inputBg} borderRadius={16} paddingHorizontal={16} height={52} alignItems="center" borderWidth={1} borderColor={inputBorder} marginBottom={12}>
              <Feather name="user" size={16} color={theme.textSecondary} style={{ marginRight: 10 }} />
              <TextInput style={{ flex: 1, fontFamily: "Chirp-Medium", fontSize: 15, color: theme.textPrimary }} placeholder="Name" placeholderTextColor={theme.textSecondary} value={favName} onChangeText={setFavName} onBlur={saveFavorite} />
            </XStack>
            <XStack backgroundColor={inputBg} borderRadius={16} paddingHorizontal={16} height={52} alignItems="center" borderWidth={1} borderColor={inputBorder}>
              <Feather name="phone" size={16} color={theme.textSecondary} style={{ marginRight: 10 }} />
              <TextInput style={{ flex: 1, fontFamily: "Chirp-Medium", fontSize: 15, color: theme.textPrimary }} placeholder="Phone number" keyboardType="phone-pad" placeholderTextColor={theme.textSecondary} value={favPhone} onChangeText={setFavPhone} onBlur={saveFavorite} />
            </XStack>
            {emergencyContacts.length > 0 && (
              <YStack marginTop={16}>
                <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} marginBottom={8}>Or pick an emergency contact</TText>
                <XStack flexWrap="wrap" gap={8}>
                  {emergencyContacts.map((c) => {
                    const selected = favPhone === c.phone;
                    return (
                      <TouchableOpacity key={c.id || c.phone} onPress={() => pickFavoriteFromContacts(c)}>
                        <YStack paddingHorizontal={14} paddingVertical={8} borderRadius={16} borderWidth={1} borderColor={selected ? "#00C48A" : inputBorder} backgroundColor={selected ? "rgba(0,196,138,0.1)" : "transparent"}>
                          <TText fontFamily="Chirp-Bold" fontSize={12} color={selected ? "#00C48A" : theme.textSecondary}>{c.name.split(" ")[0]}</TText>
                        </YStack>
                      </TouchableOpacity>
                    );
                  })}
                </XStack>
              </YStack>
            )}
          </YStack>

          {/* 5. AUTOMATIC LOCATION SHARING */}
          <SectionLabel>AUTOMATIC LOCATION SHARING</SectionLabel>
          <YStack backgroundColor={cardBg} borderRadius={24} borderWidth={1} borderColor={cardBorder} padding={20} marginBottom={32}>
            <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} lineHeight={20} marginBottom={16}>
              Send your location to your emergency contacts automatically each day. This is separate from SOS and Share My Journey.
            </TText>
            <XStack justifyContent="space-between" gap={8}>
              {shareOptions.map((opt) => {
                const selected = settings.autoShareFrequency === opt.value;
                return (
                  <TouchableOpacity key={opt.value} style={{ flex: 1 }} onPress={() => update({ autoShareFrequency: opt.value })}>
                    <YStack backgroundColor={selected ? "rgba(0,196,138,0.1)" : "transparent"} borderWidth={1} borderColor={selected ? "#00C48A" : inputBorder} paddingVertical={12} borderRadius={12} alignItems="center">
                      <TText fontFamily="Chirp-Bold" fontSize={12} color={selected ? "#00C48A" : theme.textSecondary}>{opt.label}</TText>
                    </YStack>
                  </TouchableOpacity>
                );
              })}
            </XStack>
            {settings.autoShareFrequency > 0 && (
              <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={12}>
                Shares at {AUTO_SHARE_HOURS[settings.autoShareFrequency].map(formatHour).join(", ")} when you open StromPulse with internet access.
              </TText>
            )}
          </YStack>

          {/* 6. EMERGENCY MESSAGE */}
          <SectionLabel>EMERGENCY MESSAGE</SectionLabel>
          <YStack backgroundColor={cardBg} borderRadius={24} borderWidth={1} borderColor={cardBorder} padding={20} marginBottom={32}>
            <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} lineHeight={20} marginBottom={16}>
              This is what your contacts receive when you send SOS. Leave blank to use the default message.
            </TText>
            <YStack backgroundColor={inputBg} borderRadius={16} borderWidth={1} borderColor={inputBorder} padding={16}>
              <XStack alignItems="flex-start">
                <TText fontSize={14} marginRight={6} marginTop={2}>🆘</TText>
                <TextInput
                  style={{ flex: 1, fontFamily: "Chirp-Medium", fontSize: 14, color: theme.textPrimary, lineHeight: 22, minHeight: 60 }}
                  multiline
                  placeholder={`SOS from ${userName}. This is an emergency alert — please check on me.`}
                  placeholderTextColor={theme.textSecondary}
                  value={customMessage}
                  onChangeText={setCustomMessage}
                  onBlur={() => update({ customMessage })}
                />
              </XStack>
              <XStack borderTopWidth={1} borderTopColor={inputBorder} marginTop={12} paddingTop={12} alignItems="center">
                <Feather name="lock" size={12} color={theme.textSecondary} style={{ marginRight: 8 }} />
                <TText flex={1} fontFamily="Chirp-Regular" fontSize={11} color={theme.textSecondary} lineHeight={16}>
                  Always included: your location link (if enabled) and "Download Strompulse to view more details: strompulse.com/live"
                </TText>
              </XStack>
            </YStack>
          </YStack>

          {/* 7. FAKE CALL */}
          <SectionLabel>FAKE CALL</SectionLabel>
          <YStack backgroundColor={cardBg} borderRadius={24} borderWidth={1} borderColor={cardBorder} padding={20} marginBottom={32}>
            <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} lineHeight={20} marginBottom={16}>
              The caller name shown when you start a Fake Call from Safety Tools.
            </TText>
            <XStack backgroundColor={inputBg} borderRadius={16} paddingHorizontal={16} height={52} alignItems="center" borderWidth={1} borderColor={inputBorder}>
              <TextInput style={{ flex: 1, fontFamily: "Chirp-Medium", fontSize: 15, color: theme.textPrimary }} placeholder="e.g. Mum, Boss..." placeholderTextColor={theme.textSecondary} value={fakeCallName} onChangeText={setFakeCallName} onBlur={() => update({ fakeCallName: fakeCallName.trim() || "Mum" })} />
            </XStack>
          </YStack>

          {/* 8. PRIVACY */}
          <SectionLabel>PRIVACY</SectionLabel>
          <YStack backgroundColor={cardBg} borderRadius={24} borderWidth={1} borderColor={cardBorder} marginBottom={32}>
            <ToggleRow isLast icon="map-pin" iconColor="#00C48A" iconBg={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} title="Include Location in Alerts" subtitle="Adds your location link to SOS and journey alerts" value={settings.locationSharing} onChange={(v: boolean) => update({ locationSharing: v })} />
          </YStack>

          {/* 9. BACKGROUND TRIGGER (premium) */}
          <SectionLabel>ADVANCED</SectionLabel>
          <YStack backgroundColor={cardBg} borderRadius={24} borderWidth={1} borderColor={cardBorder} marginBottom={16}>
            <XStack padding={20} alignItems="center" opacity={0.7}>
              <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? "rgba(245,158,11,0.1)" : "#FEF3C7"} justifyContent="center" alignItems="center" marginRight={16}>
                <Feather name="zap" size={18} color="#F59E0B" />
              </YStack>
              <YStack flex={1} paddingRight={10}>
                <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary} marginBottom={2}>Trigger Without App Open</TText>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Activate SOS from the background</TText>
              </YStack>
              <YStack backgroundColor="#F59E0B" paddingHorizontal={8} paddingVertical={4} borderRadius={8}>
                <TText fontFamily="Chirp-Bold" fontSize={9} color="#FFF" letterSpacing={0.5}>PREMIUM · SOON</TText>
              </YStack>
            </XStack>
          </YStack>
          <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} lineHeight={16} marginLeft={4}>
            Arrival check-in has moved to Share My Journey.
          </TText>
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default SafetySettingsScreen;