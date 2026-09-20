import React from "react";
import { 
  Platform, 
  StatusBar, 
  TouchableOpacity,
  ScrollView,
  SafeAreaView
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Circle as SvgCircle } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";

// Reusable Donut Chart Component (Refactored to Tamagui)
const DonutChartText = ({ percentage, value, label, color, isDarkMode, theme }: any) => {
  const radius = 35;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <YStack alignItems="center">
      <TText fontSize={10} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={1} marginBottom={16}>
        {label}
      </TText>
      <YStack width={100} height={100} position="relative" marginBottom={16}>
        <Svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: [{ rotate: "-90deg" }] }}>
          {/* Background Circle */}
          <SvgCircle cx="50" cy="50" r={radius} stroke={isDarkMode ? "#2D3B34" : "#F1F5F9"} strokeWidth={strokeWidth} fill="transparent" />
          {/* Progress Circle */}
          <SvgCircle 
            cx="50" cy="50" r={radius} 
            stroke={color} 
            strokeWidth={strokeWidth} 
            fill="transparent" 
            strokeDasharray={circumference} 
            strokeDashoffset={strokeDashoffset} 
            strokeLinecap="round" 
          />
        </Svg>
        <YStack position="absolute" top={0} left={0} right={0} bottom={0} justifyContent="center" alignItems="center">
          <TText fontSize={20} fontFamily="Chirp-Heavy" color={theme.textPrimary}>{percentage}%</TText>
        </YStack>
      </YStack>
      <TText fontSize={16} fontFamily="Chirp-Bold" color={theme.textPrimary} marginBottom={4}>{value}</TText>
    </YStack>
  );
};

const PrivateDashboardInternalScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} />
      
      <SafeAreaView style={{ flex: 1 }}>
        {/* --- MINIMALIST HEADER --- */}
        <XStack justifyContent="space-between" alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={20}>
          <XStack alignItems="center">
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 16 }}>
              <Feather name="chevron-left" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <YStack>
              <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary} textTransform="uppercase" letterSpacing={1} marginBottom={2}>
                Pole Sentinel 001
              </TText>
              <TText fontSize={20} fontFamily="Chirp-Heavy" color={theme.textPrimary}>
                My Dashboard
              </TText>
            </YStack>
          </XStack>
          
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <XStack backgroundColor={isDarkMode ? "rgba(239,68,68,0.1)" : "#FEE2E2"} paddingHorizontal={12} paddingVertical={8} borderRadius={16} alignItems="center">
              <Feather name="lock" size={14} color="#EF4444" />
              <TText color="#EF4444" fontSize={12} fontFamily="Chirp-Bold" marginLeft={6}>Lock</TText>
            </XStack>
          </TouchableOpacity>
        </XStack>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          
          {/* --- MAIN HARDWARE STATUS CARD --- */}
          <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} padding={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={24}>
            <XStack justifyContent="space-between" alignItems="center" marginBottom={20}>
              <XStack alignItems="center" backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} paddingHorizontal={12} paddingVertical={6} borderRadius={12}>
                <YStack width={8} height={8} borderRadius={4} backgroundColor="#00C48A" marginRight={8} />
                <TText fontSize={12} fontFamily="Chirp-Bold" color="#00C48A">Presently Stable</TText>
              </XStack>
              <TText fontSize={11} fontFamily="Chirp-Medium" color={theme.textSecondary}>Updated just now</TText>
            </XStack>
            
            <XStack alignItems="baseline">
              <TText fontSize={48} fontFamily="Chirp-Heavy" color={theme.textPrimary}>224</TText>
              <TText fontSize={24} fontFamily="Chirp-Bold" color={theme.textPrimary}> V</TText>
            </XStack>
            <TText fontSize={12} fontFamily="Chirp-Medium" color={theme.textSecondary} marginTop={4}>Real-time Current Phase</TText>
          </YStack>

          {/* --- POWER STATUS CURVE CARD --- */}
          <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} padding={20} marginBottom={24}>
            <XStack justifyContent="space-between" alignItems="flex-start" marginBottom={24}>
              <XStack alignItems="center">
                <YStack width={40} height={40} borderRadius={16} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center">
                  <Feather name="activity" size={18} color="#00C48A" />
                </YStack>
                <YStack marginLeft={12}>
                  <TText fontSize={15} fontFamily="Chirp-Heavy" color={theme.textPrimary} marginBottom={2}>Power Status Curve</TText>
                  <TText fontSize={11} fontFamily="Chirp-Medium" color={theme.textSecondary}>Today's pattern · Home Device</TText>
                </YStack>
              </XStack>
              <TouchableOpacity>
                <XStack paddingHorizontal={12} paddingVertical={6} borderRadius={12} backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} alignItems="center">
                  <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary} marginRight={4}>Today</TText>
                  <Feather name="chevron-down" size={12} color={theme.textSecondary} />
                </XStack>
              </TouchableOpacity>
            </XStack>

            <YStack height={160} width="100%">
              <Svg width="100%" height="160" viewBox="0 0 320 160">
                <Defs>
                  <SvgGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#00C48A" stopOpacity="0.2" />
                    <Stop offset="1" stopColor="#00C48A" stopOpacity="0" />
                  </SvgGradient>
                  <SvgGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#00C48A" />
                    <Stop offset="0.6" stopColor="#3B82F6" />
                    <Stop offset="1" stopColor="#8B5CF6" />
                  </SvgGradient>
                </Defs>

                {/* Grid Lines */}
                <Path d="M 40 10 L 40 130" stroke={isDarkMode ? "#2D3B34" : "#F1F5F9"} strokeWidth="1" strokeDasharray="4 4" />
                <Path d="M 120 10 L 120 130" stroke={isDarkMode ? "#2D3B34" : "#F1F5F9"} strokeWidth="1" strokeDasharray="4 4" />
                <Path d="M 200 10 L 200 130" stroke={isDarkMode ? "#2D3B34" : "#F1F5F9"} strokeWidth="1" strokeDasharray="4 4" />
                <Path d="M 280 10 L 280 130" stroke={isDarkMode ? "#2D3B34" : "#F1F5F9"} strokeWidth="1" strokeDasharray="4 4" />
                <Path d="M 0 130 L 320 130" stroke={isDarkMode ? "#2D3B34" : "#E2E8F0"} strokeWidth="1" />

                {/* Curved Line and Fill */}
                <Path d="M 0 100 C 40 60, 80 50, 140 30 C 200 10, 240 120, 320 70 L 320 130 L 0 130 Z" fill="url(#fillGrad)" />
                <Path d="M 0 100 C 40 60, 80 50, 140 30 C 200 10, 240 120, 320 70" fill="none" stroke="url(#lineGrad)" strokeWidth="4" strokeLinecap="round" />
                
                {/* Data Points */}
                <SvgCircle cx="60" cy="72" r="5" fill={isDarkMode ? "#1A221E" : "#FFF"} stroke="#00C48A" strokeWidth="3" />
                <SvgCircle cx="160" cy="38" r="5" fill={isDarkMode ? "#1A221E" : "#FFF"} stroke="#3B82F6" strokeWidth="3" />
                <SvgCircle cx="240" cy="100" r="5" fill={isDarkMode ? "#1A221E" : "#FFF"} stroke="#8B5CF6" strokeWidth="3" />
              </Svg>

              <XStack justifyContent="space-between" marginTop={12} paddingHorizontal={4}>
                <TText fontSize={10} fontFamily="Chirp-Bold" color={theme.textSecondary}>12am</TText>
                <TText fontSize={10} fontFamily="Chirp-Bold" color={theme.textSecondary}>6am</TText>
                <TText fontSize={10} fontFamily="Chirp-Bold" color={theme.textSecondary}>12pm</TText>
                <TText fontSize={10} fontFamily="Chirp-Bold" color={theme.textSecondary}>6pm</TText>
                <TText fontSize={10} fontFamily="Chirp-Bold" color={theme.textSecondary}>11pm</TText>
              </XStack>
            </YStack>
          </YStack>

          {/* --- DONUTS ROW --- */}
          <XStack justifyContent="space-between" marginBottom={24} gap={16}>
            <YStack flex={1} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} padding={20} alignItems="center">
               <DonutChartText percentage={82} value="19.7 hrs" label="TODAY'S UPTIME" color="#00C48A" isDarkMode={isDarkMode} theme={theme} />
               <TText fontSize={10} fontFamily="Chirp-Medium" color={theme.textSecondary}>of 24 hours today</TText>
            </YStack>
            <YStack flex={1} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} padding={20} alignItems="center">
               <DonutChartText percentage={76} value="4.2 outages" label="7-DAY STABILITY" color="#3B82F6" isDarkMode={isDarkMode} theme={theme} />
               <TText fontSize={10} fontFamily="Chirp-Medium" color={theme.textSecondary}>avg. this week</TText>
            </YStack>
          </XStack>

          {/* --- WEEKLY BAR CHART --- */}
          <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} padding={20} marginBottom={24}>
            <XStack justifyContent="space-between" alignItems="flex-start" marginBottom={16}>
              <XStack alignItems="center">
                <YStack width={40} height={40} borderRadius={16} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center">
                  <Feather name="bar-chart-2" size={18} color="#00C48A" />
                </YStack>
                <YStack marginLeft={12}>
                  <TText fontSize={15} fontFamily="Chirp-Heavy" color={theme.textPrimary} marginBottom={2}>This Week's Flow</TText>
                  <TText fontSize={11} fontFamily="Chirp-Medium" color={theme.textSecondary}>Daily uptime hours · Home Device</TText>
                </YStack>
              </XStack>
              <TouchableOpacity>
                <XStack paddingHorizontal={12} paddingVertical={6} borderRadius={12} backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} alignItems="center">
                  <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary} marginRight={4}>This week</TText>
                  <Feather name="chevron-down" size={12} color={theme.textSecondary} />
                </XStack>
              </TouchableOpacity>
            </XStack>

            <XStack justifyContent="space-between" alignItems="flex-end" height={120} marginTop={10}>
              {[14, 18, 22, 10, 16, 20, 19].map((val, idx) => (
                <YStack key={idx} alignItems="center" width={30}>
                  <YStack width={12} height={90} borderRadius={6} backgroundColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} justifyContent="flex-end" overflow="hidden" marginBottom={8}>
                    <YStack width="100%" height={`${(val / 24) * 100}%`} backgroundColor="#00C48A" borderRadius={6} />
                  </YStack>
                  <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary}>
                    {["M", "T", "W", "T", "F", "S", "S"][idx]}
                  </TText>
                </YStack>
              ))}
            </XStack>
          </YStack>

        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default PrivateDashboardInternalScreen;