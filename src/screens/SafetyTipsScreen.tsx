import React from "react";
import { Platform, StatusBar, ScrollView, TouchableOpacity, SafeAreaView } from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

const SafetyTipsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();

  const tips = [
    { title: "In immediate danger, don't hesitate", desc: "If you feel unsafe right now, hold the SOS button immediately — you can always explain later.", icon: "alert-triangle", color: "#EF4444" },
    { title: "Fire emergency", desc: "Get yourself and others out first. Alert people nearby, then use SOS once you're safely away from the building.", icon: "flame", color: "#F59E0B" },
    { title: "Travelling at night", desc: "Start Journey Share before you set off so your contacts can see your route in real time.", icon: "moon", color: "#F59E0B" },
    { title: "Low signal areas", desc: "SMS alerts can still go through on weak signal even when data fails — keep SMS alerts turned on in Settings.", icon: "wifi-off", color: "#EF4444" },
    { title: "Keep contacts current", desc: "Review your Emergency Contacts list every few months — numbers and relationships change.", icon: "users", color: "#3B82F6" },
    { title: "Know what's nearby", desc: "Take note of the nearest hospital or police station on routes you travel often.", icon: "map", color: "#00C48A" }
  ];

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#E8F0EF"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={24}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Safety Tips</TText>
            <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={2} textTransform="uppercase">STAY SAFER WHEREVER YOU GO</TText>
          </YStack>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} overflow="hidden">
            {tips.map((tip, idx) => (
              <XStack key={idx} padding={20} alignItems="center" borderBottomWidth={idx === tips.length - 1 ? 0 : 1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                <YStack width={44} height={44} borderRadius={22} backgroundColor={isDarkMode ? "rgba(255,255,255,0.05)" : "#F8FAFC"} justifyContent="center" alignItems="center" marginRight={16}>
                  <Feather name={tip.icon as any} size={20} color={tip.color} />
                </YStack>
                <YStack flex={1}>
                  <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} marginBottom={4}>{tip.title}</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} lineHeight={18}>{tip.desc}</TText>
                </YStack>
              </XStack>
            ))}
          </YStack>
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default SafetyTipsScreen;