import React, { useState, useRef, useEffect } from "react";
import { 
  Platform, 
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
  TouchableWithoutFeedback,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Animated,
  Dimensions,
  ScrollView,
  Switch
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthService from "../services/authService";

const { width } = Dimensions.get("window");

const PrivateDashboardScreen = ({ navigation }: any) => {
  const { theme, isDarkMode, toggleDarkMode } = useTheme();
  const [pin, setPin] = useState("");
  const pinInputRef = useRef<TextInput>(null);

  const PIN_LENGTH = 4;

  // --- SIDEBAR STATE & ANIMATION ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(width)).current;
  
  // --- USER DATA FOR SIDEBAR ---
  const [user, setUser] = useState<any>(null);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      const fetchInitData = async () => {
        try {
          const session = await AuthService.getCurrentSession();
          if (session) setUser(session.user);
          setLocalAvatar(await AsyncStorage.getItem("global_avatar"));
          setLocalName(await AsyncStorage.getItem("global_name"));
        } catch (e) {}
      };
      fetchInitData();
    }, [])
  );

  const displayAvatar = localAvatar || user?.avatar_url || user?.user_metadata?.avatar_url || null;
  const fullName = localName || user?.full_name || "Afolabi Taiwo Glory";

  const toggleSidebar = (open: boolean) => {
    if (open) {
      setIsSidebarOpen(true);
      Animated.timing(sidebarAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(sidebarAnim, {
        toValue: width,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setIsSidebarOpen(false));
    }
  };

  const handleLogoutPress = () => {
    toggleSidebar(false);
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out of your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await AuthService.logout();
            } catch (err) {
              console.error("Error logging out:", err);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

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
            
            {/* --- MAIN HEADER --- */}
            <XStack alignItems="center" justifyContent="space-between" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={24}>
              <Image source={require("../../assets/images/strompulselogo.png")} style={{ width: 40, height: 40, resizeMode: "contain" }} />
              <TText style={{ fontFamily: "SoraTitle-Bold", fontSize: 23 }} color={theme.textPrimary}>Strompulse</TText>
              <TouchableOpacity onPress={() => toggleSidebar(true)}>
                <YStack width={42} height={42} justifyContent="center" alignItems="flex-end">
                  <Feather name="menu" size={24} color={theme.textPrimary} />
                </YStack>
              </TouchableOpacity>
            </XStack>

            {/* --- MAIN CONTENT SCROLLABLE --- */}
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
            >
              
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

              {/* --- SECONDARY PROMO CARD (ENTIRELY CLICKABLE) --- */}
              <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate("RequestDeviceScreen")}>
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
                    
                    {/* Replaced Icon with Hardware Image */}
                    <Image 
                      source={require("../../assets/images/stromdevice.png")} 
                      style={{ width: 52, height: 52, resizeMode: 'contain', marginRight: 16 }} 
                    />

                    <YStack flex={1}>
                      <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary} marginBottom={6}>
                        Not a Stromer yet?
                      </TText>
                      <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} lineHeight={18} marginBottom={16}>
                        Available nationwide. Order from any city in Nigeria and view your power status and analytics on the Strompulse app.
                      </TText>
                      
                      <XStack alignItems="center" alignSelf="flex-start">
                        <TText fontFamily="Chirp-Bold" fontSize={13} color="#00C48A" marginRight={6}>Request Device</TText>
                        <Feather name="arrow-right" size={14} color="#00C48A" />
                      </XStack>
                    </YStack>
                  </XStack>
                </YStack>
              </TouchableOpacity>

            </ScrollView>
          </SafeAreaView>
        </YStack>
      </TouchableWithoutFeedback>

      {/* --- SIDEBAR DRAWER --- */}
      {isSidebarOpen && (
        <YStack position="absolute" top={0} left={0} right={0} bottom={0} zIndex={99999}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} activeOpacity={1} onPress={() => toggleSidebar(false)} />
          <Animated.View style={{
            position: "absolute", top: 0, bottom: 0, right: 0, width: width * 0.78,
            backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF",
            transform: [{ translateX: sidebarAnim }],
            paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 50,
            paddingHorizontal: 20, borderLeftWidth: 1,
            borderLeftColor: isDarkMode ? "#2D3B34" : "#E2E8F0",
            elevation: 20, shadowColor: "#000", shadowOffset: { width: -5, height: 0 }, shadowOpacity: 0.3, shadowRadius: 15,
          }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <TouchableOpacity onPress={() => toggleSidebar(false)} style={{ alignSelf: "flex-end", padding: 8, marginBottom: 12 }}>
                <Feather name="x" size={24} color={theme.textPrimary} />
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.8} onPress={() => { toggleSidebar(false); navigation.navigate("Profile"); }} style={{ flexDirection: "row", alignItems: "center", marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: isDarkMode ? "#1F2E27" : "#F1F5F9" }}>
                {displayAvatar ? (
                  <Image source={{ uri: displayAvatar }} style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: "#00C48A", marginRight: 14 }} />
                ) : (
                  <YStack width={56} height={56} borderRadius={28} backgroundColor="#064E3B" justifyContent="center" alignItems="center" borderWidth={2} borderColor="#00C48A" marginRight={14}>
                    <TText fontFamily="Chirp-Heavy" fontSize={22} color="#FFFFFF">{fullName.charAt(0).toUpperCase()}</TText>
                  </YStack>
                )}
                <YStack flex={1}>
                  <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary} numberOfLines={1}>{fullName}</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={12} color="#00C48A" marginTop={2}>View Profile →</TText>
                </YStack>
              </TouchableOpacity>

              <YStack gap={4} marginBottom={28} paddingBottom={20} borderBottomWidth={1} borderBottomColor={isDarkMode ? "#1F2E27" : "#F1F5F9"}>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("Profile"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="user" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Profile</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("RequestDeviceScreen"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="cpu" size={20} color="#00C48A" />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color="#00C48A">Become a Stromer</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("MySubscriptionsScreen"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="bookmark" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>My Subscriptions</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("AboutScreen"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="info" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>About Strompulse</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("PrivacySecurityScreen"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="shield" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Privacy and Security</TText>
                </TouchableOpacity>
              </YStack>

              <YStack gap={4}>
                <XStack paddingVertical={14} alignItems="center" justifyContent="space-between">
                  <XStack alignItems="center" gap={16}>
                    <Feather name="moon" size={20} color={theme.textPrimary} />
                    <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Dark Mode</TText>
                  </XStack>
                  <Switch value={isDarkMode} onValueChange={() => toggleDarkMode()} trackColor={{ false: theme.border, true: "#00C48A" }} thumbColor="#FFFFFF" />
                </XStack>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("SettingsScreen", { currentName: fullName, currentImage: displayAvatar }); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="settings" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Settings</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("HelpSupportScreen"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="help-circle" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Help Center</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleLogoutPress} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 }}>
                  <Feather name="log-out" size={20} color="#EF4444" />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color="#EF4444">Log out</TText>
                </TouchableOpacity>
              </YStack>
            </ScrollView>
          </Animated.View>
        </YStack>
      )}
    </KeyboardAvoidingView>
  );
};

export default PrivateDashboardScreen;