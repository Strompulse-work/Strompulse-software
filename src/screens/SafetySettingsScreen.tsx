import React, { useState, useEffect } from "react";
import { 
  Platform, 
  StatusBar, 
  ScrollView,
  Switch,
  TouchableOpacity,
  SafeAreaView
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS_KEY = "strompulse_security_settings";

const SafetySettingsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();

  // States matching the privacy toggles
  const [locationSharing, setLocationSharing] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [backgroundTrigger, setBackgroundTrigger] = useState(false);

  // Load saved preferences
  useEffect(() => {
    const loadSettings = async () => {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setLocationSharing(parsed.locationSharing ?? true);
        setSendSms(parsed.sendSms ?? true);
        setBackgroundTrigger(parsed.backgroundTrigger ?? false);
      }
    };
    loadSettings();
  }, []);

  const toggleSetting = async (key: string, value: boolean) => {
    if (key === 'location') setLocationSharing(value);
    if (key === 'sms') setSendSms(value);
    if (key === 'background') setBackgroundTrigger(value);

    const newSettings = {
      locationSharing: key === 'location' ? value : locationSharing,
      sendSms: key === 'sms' ? value : sendSms,
      backgroundTrigger: key === 'background' ? value : backgroundTrigger
    };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* --- MINIMALIST HEADER --- */}
        <XStack justifyContent="center" alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={16} position="relative">
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ position: "absolute", left: 24, padding: 8, zIndex: 10 }}>
            <Feather name="arrow-left" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Safety Preferences</TText>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 10 }}>
          
          <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>
            TRIGGERS & PRIVACY
          </TText>

          {/* --- CLASSIC LIST GROUP --- */}
          <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={24}>
            
            {/* Location Sharing */}
            <XStack padding={18} alignItems="center" borderBottomWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
              <YStack width={36} height={36} borderRadius={18} backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} justifyContent="center" alignItems="center" marginRight={16}>
                <Feather name="map-pin" size={18} color={theme.textPrimary} />
              </YStack>
              <YStack flex={1} paddingRight={10}>
                <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary} marginBottom={2}>Location Sharing</TText>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Shared during SOS & journey</TText>
              </YStack>
              <Switch 
                trackColor={{ false: isDarkMode ? "#2D3B34" : "#E2E8F0", true: "#00C48A" }}
                thumbColor={"#FFFFFF"}
                ios_backgroundColor={isDarkMode ? "#2D3B34" : "#E2E8F0"}
                onValueChange={(val) => toggleSetting('location', val)}
                value={locationSharing}
              />
            </XStack>

            {/* SMS Delivery */}
            <XStack padding={18} alignItems="center" borderBottomWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
              <YStack width={36} height={36} borderRadius={18} backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} justifyContent="center" alignItems="center" marginRight={16}>
                <Feather name="message-square" size={18} color={theme.textPrimary} />
              </YStack>
              <YStack flex={1} paddingRight={10}>
                <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary} marginBottom={2}>Also Send via SMS</TText>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Contacts also get a text message</TText>
              </YStack>
              <Switch 
                trackColor={{ false: isDarkMode ? "#2D3B34" : "#E2E8F0", true: "#00C48A" }}
                thumbColor={"#FFFFFF"}
                ios_backgroundColor={isDarkMode ? "#2D3B34" : "#E2E8F0"}
                onValueChange={(val) => toggleSetting('sms', val)}
                value={sendSms}
              />
            </XStack>

            {/* Background Trigger */}
            <XStack padding={18} alignItems="center">
              <YStack width={36} height={36} borderRadius={18} backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} justifyContent="center" alignItems="center" marginRight={16}>
                <Feather name="smartphone" size={18} color={theme.textPrimary} />
              </YStack>
              <YStack flex={1} paddingRight={10}>
                <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary} marginBottom={2}>Background Trigger</TText>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Activate SOS without opening app</TText>
              </YStack>
              <Switch 
                trackColor={{ false: isDarkMode ? "#2D3B34" : "#E2E8F0", true: "#00C48A" }}
                thumbColor={"#FFFFFF"}
                ios_backgroundColor={isDarkMode ? "#2D3B34" : "#E2E8F0"}
                onValueChange={(val) => toggleSetting('background', val)}
                value={backgroundTrigger}
              />
            </XStack>

          </YStack>

          {/* --- INFO BOX --- */}
          <XStack backgroundColor={isDarkMode ? "rgba(59,130,246,0.1)" : "#EFF6FF"} borderRadius={16} borderWidth={1} borderColor={isDarkMode ? "rgba(59,130,246,0.2)" : "#DBEAFE"} padding={16} alignItems="flex-start">
            <Feather name="info" size={16} color="#2563EB" style={{ marginTop: 2, marginRight: 10 }} />
            <TText flex={1} fontFamily="Chirp-Medium" fontSize={12} color={isDarkMode ? "#93C5FD" : "#1D4ED8"} lineHeight={18}>
              Background trigger is not available yet.
            </TText>
          </XStack>

        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default SafetySettingsScreen;