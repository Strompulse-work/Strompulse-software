import React, { useCallback, useState } from "react";
import { Platform, StatusBar, ScrollView, TouchableOpacity, SafeAreaView } from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { useFocusEffect } from "@react-navigation/native";
import { getSmsSosQuota, SmsQuota, SMS_SOS_MONTHLY_LIMIT } from "../utils/securityConfig";

const SafetyTipsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const cardBg = isDarkMode ? "#121A16" : "#FFFFFF";
  const divider = isDarkMode ? "#2D3B34" : "#F1F5F9";
  const [quota, setQuota] = useState<SmsQuota>({ used: 0, remaining: SMS_SOS_MONTHLY_LIMIT, limit: SMS_SOS_MONTHLY_LIMIT });

  useFocusEffect(useCallback(() => { getSmsSosQuota().then(setQuota); }, []));

  const sections = [
    {
      title: "HOW SOS IS DELIVERED",
      tips: [
        { title: "Online SOS — WhatsApp & in-app", desc: "With internet, SOS goes to contacts on StromPulse as an in-app alert and opens WhatsApp with your message ready. Online SOS is unlimited.", icon: "wifi", color: "#00C48A" },
        { title: "Offline SOS — SMS", desc: "With no internet, SOS is sent by SMS. You need mobile network signal, but not data.", icon: "wifi-off", color: "#3B82F6" },
        { title: `SMS limit: ${SMS_SOS_MONTHLY_LIMIT} per month`, desc: `You can send up to ${SMS_SOS_MONTHLY_LIMIT} SMS SOS alerts each month. It resets on the 1st. You have ${quota.remaining} of ${quota.limit} left this month.`, icon: "message-square", color: "#F59E0B" },
        { title: "Contacts on StromPulse", desc: "Contacts who also use StromPulse get an instant in-app alert with your location, in addition to WhatsApp or SMS.", icon: "bell", color: "#00C48A" },
      ],
    },
    {
      title: "WHICH FEATURE TO USE",
      tips: [
        { title: "SOS — you need help now", desc: "Hold the SOS button for 3 seconds. A one-time emergency alert with your location goes to your emergency contacts.", icon: "alert-triangle", color: "#EF4444" },
        { title: "Share My Journey — you're travelling", desc: "Contacts follow your trip live until you tap \"I've arrived\". If you don't check in after your ETA, they're alerted automatically.", icon: "navigation", color: "#00C48A" },
        { title: "Automatic Location Sharing — daily check-ins", desc: "Sends your location to your contacts 1, 2 or 3 times a day. It's routine, not an emergency alert.", icon: "map-pin", color: "#3B82F6" },
      ],
    },
    {
      title: "YOUR PREFERENCES",
      tips: [
        { title: "Choose how alerts are sent", desc: "Turn WhatsApp, SMS and in-app alerts on or off in Security Preferences.", icon: "sliders", color: "#00C48A" },
        { title: "Set your emergency numbers", desc: "Police and Ambulance default to 112. You can change them in Security Preferences.", icon: "phone", color: "#3B82F6" },
        { title: "Save a favorite contact", desc: "Call the person you trust most in one tap from Safety Tools.", icon: "star", color: "#F59E0B" },
      ],
    },
    {
      title: "GENERAL SAFETY",
      tips: [
        { title: "In immediate danger, don't hesitate", desc: "If you feel unsafe right now, hold the SOS button immediately — you can always explain later.", icon: "alert-octagon", color: "#EF4444" },
        { title: "Fire emergency", desc: "Get yourself and others out first. Alert people nearby, then use SOS once you're safely away from the building.", icon: "alert-circle", color: "#F59E0B" },
        { title: "Travelling at night", desc: "Start Share My Journey before you set off so your contacts can follow your route in real time.", icon: "moon", color: "#F59E0B" },
        { title: "Keep contacts current", desc: "Review your Emergency Contacts every few months — numbers and relationships change.", icon: "users", color: "#3B82F6" },
        { title: "Know what's nearby", desc: "Check the closest hospitals and police stations on routes you travel often.", icon: "map", color: "#00C48A" },
      ],
    },
  ];

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={24}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Safety Tips</TText>
            <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2} letterSpacing={1}>STAY SAFER WHEREVER YOU GO</TText>
          </YStack>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          {sections.map((section) => (
            <YStack key={section.title} marginBottom={28}>
              <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>{section.title}</TText>
              <YStack backgroundColor={cardBg} borderRadius={24} borderWidth={1} borderColor={divider} overflow="hidden">
                {section.tips.map((tip, idx) => (
                  <XStack key={tip.title} padding={20} alignItems="flex-start" borderBottomWidth={idx === section.tips.length - 1 ? 0 : 1} borderColor={divider}>
                    <YStack width={44} height={44} borderRadius={22} backgroundColor={`${tip.color}1A`} justifyContent="center" alignItems="center" marginRight={16}>
                      <Feather name={tip.icon as any} size={20} color={tip.color} />
                    </YStack>
                    <YStack flex={1}>
                      <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} marginBottom={4}>{tip.title}</TText>
                      <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} lineHeight={18}>{tip.desc}</TText>
                    </YStack>
                  </XStack>
                ))}
              </YStack>
            </YStack>
          ))}

          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate("SafetySettingsScreen")}>
            <XStack backgroundColor={cardBg} borderRadius={24} padding={20} alignItems="center" borderWidth={1} borderColor="#00C48A">
              <YStack flex={1}>
                <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} marginBottom={2}>Open Security Preferences</TText>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Review contacts, delivery methods and numbers</TText>
              </YStack>
              <YStack width={32} height={32} borderRadius={16} backgroundColor="#00C48A" justifyContent="center" alignItems="center">
                <Feather name="arrow-right" size={14} color="#FFF" />
              </YStack>
            </XStack>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default SafetyTipsScreen;