import React, { useState, useEffect } from "react";
import { 
  Platform, 
  StatusBar, 
  ScrollView,
  Switch,
  TouchableOpacity,
  SafeAreaView,
  TextInput
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthService from "../services/authService";

const SETTINGS_KEY = "strompulse_security_settings";

const SafetySettingsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();

  // Settings states
  const [locationSharing, setLocationSharing] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [backgroundTrigger, setBackgroundTrigger] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [userName, setUserName] = useState("Stromer");

  // Load saved preferences
  useEffect(() => {
    const loadSettings = async () => {
      const session = await AuthService.getCurrentSession();
      if (session && session.user) {
        setUserName(session.user.full_name?.split(' ')[0] || "Stromer");
      }

      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setLocationSharing(parsed.locationSharing ?? true);
        setSendSms(parsed.sendSms ?? true);
        setBackgroundTrigger(parsed.backgroundTrigger ?? false);
        setCustomMessage(parsed.customMessage || "");
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
      backgroundTrigger: key === 'background' ? value : backgroundTrigger,
      customMessage: customMessage
    };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  const saveCustomMessage = async () => {
    const newSettings = {
      locationSharing,
      sendSms,
      backgroundTrigger,
      customMessage
    };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* --- MINIMALIST HEADER --- */}
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
          
          {/* --- EMERGENCY MESSAGE BLOCK --- */}
          <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>
            EMERGENCY MESSAGE
          </TText>
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
                    Always included, not editable: "Live tracking available on Strompulse."
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

          <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>
            PRIVACY
          </TText>

          {/* --- SETTINGS LIST GROUP --- */}
          <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={32}>
            
            {/* Location Sharing */}
            <XStack padding={20} alignItems="center" borderBottomWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
              <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center" marginRight={16}>
                <Feather name="map-pin" size={18} color="#00C48A" />
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
            <XStack padding={20} alignItems="center" borderBottomWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
              <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? "rgba(59,130,246,0.1)" : "#EFF6FF"} justifyContent="center" alignItems="center" marginRight={16}>
                <Feather name="message-square" size={18} color="#3B82F6" />
              </YStack>
              <YStack flex={1} paddingRight={10}>
                <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary} marginBottom={2}>Also Send via SMS</TText>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Contacts also get a text message</TText>
              </YStack>
              <Switch 
                trackColor={{ false: isDarkMode ? "#2D3B34" : "#E2E8F0", true: "#3B82F6" }}
                thumbColor={"#FFFFFF"}
                ios_backgroundColor={isDarkMode ? "#2D3B34" : "#E2E8F0"}
                onValueChange={(val) => toggleSetting('sms', val)}
                value={sendSms}
              />
            </XStack>

            {/* Background Trigger */}
            <XStack padding={20} alignItems="center">
              <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? "rgba(245,158,11,0.1)" : "#FEF3C7"} justifyContent="center" alignItems="center" marginRight={16}>
                <Feather name="smartphone" size={18} color="#F59E0B" />
              </YStack>
              <YStack flex={1} paddingRight={10}>
                <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary} marginBottom={2}>Background Trigger</TText>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Activate SOS without opening app</TText>
              </YStack>
              <Switch 
                trackColor={{ false: isDarkMode ? "#2D3B34" : "#E2E8F0", true: "#F59E0B" }}
                thumbColor={"#FFFFFF"}
                ios_backgroundColor={isDarkMode ? "#2D3B34" : "#E2E8F0"}
                onValueChange={(val) => toggleSetting('background', val)}
                value={backgroundTrigger}
              />
            </XStack>

          </YStack>

          {/* --- INFO BOX --- */}
          <XStack backgroundColor={isDarkMode ? "rgba(59,130,246,0.1)" : "#EFF6FF"} borderRadius={16} borderWidth={1} borderColor={isDarkMode ? "rgba(59,130,246,0.2)" : "#DBEAFE"} padding={16} alignItems="flex-start">
            <Feather name="info" size={16} color="#3B82F6" style={{ marginTop: 2, marginRight: 10 }} />
            <TText flex={1} fontFamily="Chirp-Medium" fontSize={12} color={isDarkMode ? "#93C5FD" : "#1D4ED8"} lineHeight={18}>
              Background trigger is an Android-first feature. iOS support is coming in the next update.
            </TText>
          </XStack>

        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default SafetySettingsScreen;