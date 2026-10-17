import React, { useState, useCallback } from "react";
import { 
  Platform, StatusBar, ScrollView, Switch, TouchableOpacity, SafeAreaView, TextInput 
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthService from "../services/authService";
import { useFocusEffect } from "@react-navigation/native";

const SETTINGS_KEY = "strompulse_security_settings";

const SafetySettingsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();

  const [locationSharing, setLocationSharing] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [backgroundTrigger, setBackgroundTrigger] = useState(false);
  const [autoAlert, setAutoAlert] = useState(true);
  const [autoAlertDelay, setAutoAlertDelay] = useState("30 min");
  const [customMessage, setCustomMessage] = useState("");
  const [userName, setUserName] = useState("Stromer");

  useFocusEffect(
    useCallback(() => {
      const loadSettings = async () => {
        const session = await AuthService.getCurrentSession();
        if (session && session.user) {
          setUserName(session.user.full_name?.split(' ')[0] || "Stromer");
        } else {
          const localName = await AsyncStorage.getItem("global_name");
          if (localName) setUserName(localName.split(' ')[0]);
        }

        const saved = await AsyncStorage.getItem(SETTINGS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setLocationSharing(parsed.locationSharing ?? true);
          setSendSms(parsed.sendSms ?? true);
          setBackgroundTrigger(parsed.backgroundTrigger ?? false);
          setAutoAlert(parsed.autoAlert ?? true);
          setAutoAlertDelay(parsed.autoAlertDelay ?? "30 min");
          setCustomMessage(parsed.customMessage || "");
        }
      };
      loadSettings();
    }, [])
  );

  const toggleSetting = async (key: string, value: boolean | string) => {
    if (key === 'locationSharing') setLocationSharing(value as boolean);
    if (key === 'sendSms') setSendSms(value as boolean);
    if (key === 'backgroundTrigger') setBackgroundTrigger(value as boolean);
    if (key === 'autoAlert') setAutoAlert(value as boolean);
    if (key === 'autoAlertDelay') setAutoAlertDelay(value as string);

    const saved = await AsyncStorage.getItem(SETTINGS_KEY);
    const currentSettings = saved ? JSON.parse(saved) : {};
    const newSettings = { ...currentSettings, [key]: value };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  const saveCustomMessage = async () => {
    const saved = await AsyncStorage.getItem(SETTINGS_KEY);
    const currentSettings = saved ? JSON.parse(saved) : {};
    const newSettings = { ...currentSettings, customMessage };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#E8F0EF"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={24}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Security Settings</TText>
            <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={2} textTransform="uppercase">TRIGGERS & PRIVACY</TText>
          </YStack>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          
          <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>EMERGENCY MESSAGE</TText>
          <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} padding={20} marginBottom={32}>
            <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} lineHeight={20} marginBottom={16}>
              This is what your contacts receive when you send SOS. Leave blank to use the default message.
            </TText>

            <YStack backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} borderRadius={16} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} padding={16} marginBottom={16}>
              <XStack alignItems="flex-start">
                <TText fontSize={14} color="#EF4444" marginRight={6} marginTop={2}>🆘</TText>
                <TextInput
                  style={{ flex: 1, fontFamily: "Chirp-Medium", fontSize: 14, color: theme.textPrimary, lineHeight: 22, minHeight: 60 }}
                  multiline
                  placeholder={`SOS from ${userName}. This is an emergency alert — please check on me.`}
                  placeholderTextColor={theme.textSecondary}
                  value={customMessage}
                  onChangeText={setCustomMessage}
                  onBlur={saveCustomMessage}
                />
              </XStack>
              <YStack borderTopWidth={1} borderTopColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} marginTop={12} paddingTop={12}>
                <XStack alignItems="center">
                  <Feather name="lock" size={12} color={theme.textSecondary} style={{ marginRight: 8 }} />
                  <TText flex={1} fontFamily="Chirp-Regular" fontSize={11} color={theme.textSecondary} lineHeight={16}>
                    Always included, not editable: "Download Strompulse to view more details: strompulse.com/live"
                  </TText>
                </XStack>
              </YStack>
            </YStack>
            <TouchableOpacity activeOpacity={0.8} onPress={saveCustomMessage}>
              <YStack backgroundColor="#00C48A" borderRadius={16} paddingVertical={16} alignItems="center" justifyContent="center">
                <TText fontSize={14} fontFamily="Chirp-Bold" color="#FFFFFF">Save Message</TText>
              </YStack>
            </TouchableOpacity>
          </YStack>

          <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>PRIVACY</TText>
          <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={32}>
            <XStack padding={20} alignItems="center">
              <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center" marginRight={16}>
                <Feather name="map-pin" size={18} color="#00C48A" />
              </YStack>
              <YStack flex={1} paddingRight={10}>
                <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary} marginBottom={2}>Location Sharing</TText>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Shared during SOS & journey</TText>
              </YStack>
              <Switch trackColor={{ false: isDarkMode ? "#2D3B34" : "#E2E8F0", true: "#00C48A" }} thumbColor={"#FFFFFF"} onValueChange={(val) => toggleSetting('locationSharing', val)} value={locationSharing} />
            </XStack>
          </YStack>

          <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>ALERT DELIVERY</TText>
          <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={32}>
            <XStack padding={20} alignItems="center">
              <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? "rgba(59,130,246,0.1)" : "#EFF6FF"} justifyContent="center" alignItems="center" marginRight={16}>
                <Feather name="message-square" size={18} color="#3B82F6" />
              </YStack>
              <YStack flex={1} paddingRight={10}>
                <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary} marginBottom={2}>Also Send via SMS</TText>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Contacts also get a text message</TText>
              </YStack>
              <Switch trackColor={{ false: isDarkMode ? "#2D3B34" : "#E2E8F0", true: "#3B82F6" }} thumbColor={"#FFFFFF"} onValueChange={(val) => toggleSetting('sendSms', val)} value={sendSms} />
            </XStack>
          </YStack>

          <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>ARRIVAL CHECK-IN</TText>
          <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} padding={20} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={32}>
            <XStack alignItems="center" marginBottom={16}>
              <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? "rgba(239,68,68,0.1)" : "#FEF2F2"} justifyContent="center" alignItems="center" marginRight={16}>
                <Feather name="clock" size={18} color="#EF4444" />
              </YStack>
              <YStack flex={1}>
                <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary} marginBottom={2}>Auto-Alert If I Go Quiet</TText>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} numberOfLines={1}>We'll alert your trusted contacts</TText>
              </YStack>
              <Switch trackColor={{ false: isDarkMode ? "#2D3B34" : "#E2E8F0", true: "#00C48A" }} thumbColor={"#FFFFFF"} onValueChange={(val) => toggleSetting('autoAlert', val)} value={autoAlert} />
            </XStack>
            {autoAlert && (
              <YStack>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} lineHeight={18} marginBottom={16}>
                  If you haven't tapped "I've arrived" this long after your expected arrival time, we'll automatically alert your contacts.
                </TText>
                <XStack justifyContent="space-between" gap={8}>
                  {["15 min", "30 min", "1 hr"].map(opt => (
                    <TouchableOpacity key={opt} style={{ flex: 1 }} onPress={() => toggleSetting('autoAlertDelay', opt)}>
                      <YStack backgroundColor={autoAlertDelay === opt ? "rgba(0,196,138,0.1)" : "transparent"} borderWidth={1} borderColor={autoAlertDelay === opt ? "#00C48A" : (isDarkMode ? "#2D3B34" : "#E2E8F0")} paddingVertical={12} borderRadius={12} alignItems="center">
                        <TText fontFamily="Chirp-Bold" fontSize={13} color={autoAlertDelay === opt ? "#00C48A" : theme.textSecondary}>{opt}</TText>
                      </YStack>
                    </TouchableOpacity>
                  ))}
                </XStack>
              </YStack>
            )}
          </YStack>

          <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>BACKGROUND TRIGGER</TText>
          <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={32}>
            <XStack padding={20} alignItems="center">
              <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? "rgba(245,158,11,0.1)" : "#FEF3C7"} justifyContent="center" alignItems="center" marginRight={16}>
                <Feather name="lock" size={18} color="#F59E0B" />
              </YStack>
              <YStack flex={1} paddingRight={10}>
                <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary} marginBottom={2}>Trigger Without App Open</TText>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Activate SOS from background</TText>
              </YStack>
              <Switch trackColor={{ false: isDarkMode ? "#2D3B34" : "#E2E8F0", true: "#F59E0B" }} thumbColor={"#FFFFFF"} onValueChange={(val) => toggleSetting('backgroundTrigger', val)} value={backgroundTrigger} />
            </XStack>
          </YStack>

        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default SafetySettingsScreen;