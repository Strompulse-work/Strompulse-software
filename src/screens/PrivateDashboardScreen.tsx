import React, { useState, useRef } from "react";
import { 
  Platform, 
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
  TouchableWithoutFeedback,
  TouchableOpacity,
  SafeAreaView
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

const PrivateDashboardScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const [pin, setPin] = useState("");
  const pinInputRef = useRef<TextInput>(null);

  const PIN_LENGTH = 4;

  const handleUnlock = () => {
    Keyboard.dismiss();
    if (pin === "0000") {
      setPin(""); // Clear the PIN so it's empty if they log out
      navigation.navigate("PrivateDashboardInternal");
    } else {
      Alert.alert("Access Denied", "Incorrect PIN. Please use the demo code: 0000", [{ text: "Try Again" }]);
      setPin("");
    }
  };

  const handlePinChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    if (numericValue.length <= PIN_LENGTH) {
      setPin(numericValue);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F4F7F9"}>
          <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={isDarkMode ? "#0B0F0D" : "#F4F7F9"} />

          <SafeAreaView style={{ flex: 1 }}>
            
            {/* --- MINIMALIST HEADER --- */}
            <YStack justifyContent="center" alignItems="center" paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={24}>
              <TText fontFamily="Sora_700Bold" fontSize={20} color={theme.textPrimary}>
                Strompulse Stromers
              </TText>
            </YStack>

            {/* --- MAIN CONTENT --- */}
            <YStack paddingHorizontal={24} flex={1}>
              
              {/* --- AUTH CARD --- */}
              <YStack 
                backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"}
                borderRadius={28} 
                padding={32} 
                alignItems="center" 
                width="100%" 
                marginBottom={24} 
                borderWidth={1} 
                borderColor={isDarkMode ? "#047857" : "#A7F3D0"} // Strompulse green tint border
                shadowColor="#00C48A"
                shadowOffset={{ width: 0, height: 8 }}
                shadowOpacity={0.08}
                shadowRadius={20}
                elevation={6}
              >
                
                {/* Soft Lock Icon */}
                <YStack width={56} height={56} borderRadius={18} backgroundColor={isDarkMode ? "rgba(245,158,11,0.15)" : "#FEF3C7"} justifyContent="center" alignItems="center" marginBottom={20}>
                  <MaterialCommunityIcons name="lock-outline" size={28} color="#D97706" />
                </YStack>

                <TText fontSize={22} fontFamily="Chirp-Heavy" marginBottom={12} color={theme.textPrimary}>
                  Welcome, Stromer
                </TText>
                 <TText fontSize={13} fontFamily="Chirp-Medium" textAlign="center" lineHeight={20} marginBottom={32} color={theme.textSecondary} paddingHorizontal={8}>
                  Stromers are customers that orders their own personal devices
                </TText>
                <TText fontSize={13} fontFamily="Chirp-Medium" textAlign="center" lineHeight={20} marginBottom={32} color={theme.textSecondary} paddingHorizontal={8}>
                  Enter your personal access pin that came with your delivered private device 
                </TText>

                {/* Single Pill-Shaped PIN Input Display */}
                <TouchableOpacity 
                  activeOpacity={1} 
                  onPress={() => pinInputRef.current?.focus()}
                  style={{ width: "100%", alignItems: "center" }}
                >
                  <XStack 
                    width="80%" 
                    height={56} 
                    borderRadius={28} 
                    borderWidth={1} 
                    borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} 
                    backgroundColor={isDarkMode ? "#1A221E" : "#FFFFFF"}
                    justifyContent="center" 
                    alignItems="center" 
                    gap={24} 
                    marginBottom={24}
                  >
                    {[...Array(PIN_LENGTH)].map((_, index) => {
                      const isFilled = index < pin.length;
                      return (
                        <YStack 
                          key={index} 
                          width={12} 
                          height={12} 
                          borderRadius={6} 
                          backgroundColor={isFilled ? (isDarkMode ? "#FFFFFF" : "#475569") : (isDarkMode ? "#2D3B34" : "#CBD5E1")} 
                        />
                      );
                    })}
                  </XStack>
                </TouchableOpacity>

                <TextInput
                  ref={pinInputRef}
                  value={pin}
                  onChangeText={handlePinChange}
                  keyboardType="numeric"
                  maxLength={PIN_LENGTH}
                  secureTextEntry
                  style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                  autoFocus={true}
                />

                {/* Unlock Button */}
                <TouchableOpacity 
                  onPress={handleUnlock} 
                  activeOpacity={0.8}
                  disabled={pin.length !== PIN_LENGTH}
                  style={{ width: "100%" }}
                >
                  <YStack 
                    backgroundColor={pin.length === PIN_LENGTH ? "#00C48A" : (isDarkMode ? "#064E3B" : "#10B981")} 
                    opacity={pin.length === PIN_LENGTH ? 1 : 0.6}
                    borderRadius={16} 
                    paddingVertical={16} 
                    alignItems="center" 
                    justifyContent="center" 
                    marginBottom={20}
                  >
                    <TText color="#FFFFFF" fontSize={15} fontFamily="Chirp-Bold">
                      Unlock My Dashboard
                    </TText>
                  </YStack>
                </TouchableOpacity>
                
                <TText fontSize={11} fontFamily="Chirp-Medium" color={theme.textSecondary}>Demo access code: <TText fontFamily="Chirp-Bold" color={theme.textPrimary}>0000</TText></TText>
              </YStack>

              {/* --- SECONDARY PROMO CARD --- */}
              <YStack 
                backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"}
                borderRadius={28} 
                padding={24} 
                width="100%" 
                borderWidth={1} 
                borderColor={isDarkMode ? "#047857" : "#A7F3D0"} // Strompulse green tint border
                shadowColor="#00C48A"
                shadowOffset={{ width: 0, height: 8 }}
                shadowOpacity={0.06}
                shadowRadius={20}
                elevation={4}
              >
                <XStack alignItems="flex-start">
                  <YStack width={48} height={48} borderRadius={16} backgroundColor={isDarkMode ? "#1A221E" : "#F1F5F9"} justifyContent="center" alignItems="center" marginRight={16}>
                    <MaterialCommunityIcons name="power-plug-outline" size={24} color="#00C48A" />
                  </YStack>
                  <YStack flex={1}>
                    <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary} marginBottom={6}>
                      Not a Stromer yet?
                    </TText>
                    <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} lineHeight={18} marginBottom={16}>
                      Available nationwide. Order from any city in Nigeria and view your power status and analytics on the Strompulse app.
                    </TText>
                    
                    <TouchableOpacity onPress={() => navigation.navigate("RequestDeviceScreen")} activeOpacity={0.7}>
                      <XStack alignItems="center" alignSelf="flex-start">
                        <TText fontFamily="Chirp-Bold" fontSize={13} color="#00C48A" marginRight={6}>Request Device</TText>
                        <Feather name="arrow-right" size={14} color="#00C48A" />
                      </XStack>
                    </TouchableOpacity>
                  </YStack>
                </XStack>
              </YStack>

            </YStack>
          </SafeAreaView>
        </YStack>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default PrivateDashboardScreen;