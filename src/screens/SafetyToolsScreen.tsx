import React, { useState, useCallback, useRef, useEffect } from "react";
import { StatusBar, TouchableOpacity, SafeAreaView, ScrollView, Platform, Linking, Alert, Modal, Vibration, View, Switch } from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { AppState } from "react-native";
import { DEFAULT_SECURITY_SETTINGS, SecuritySettings, loadSecuritySettings } from "../utils/securityConfig";

const SafetyToolsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const cardBg = isDarkMode ? "#121A16" : "#FFFFFF";
  const divider = isDarkMode ? "#2D3B34" : "#F1F5F9";

  const [permission, requestPermission] = useCameraPermissions();
  const [isFlashlightOn, setIsFlashlightOn] = useState(false);
  // The torch can only be switched on AFTER the camera session is running.
  // Turning it on at mount (before onCameraReady) is what made it flash and switch off.
  const [cameraReady, setCameraReady] = useState(false);
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS);

  const [isFakeCallVisible, setIsFakeCallVisible] = useState(false);
  const [isFakeCallPending, setIsFakeCallPending] = useState(false);
  const [fakeCallTimer, setFakeCallTimer] = useState(0);
  const [fakeCallState, setFakeCallState] = useState<"incoming" | "active">("incoming");
  const callIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadSecuritySettings().then(setSettings);
    }, [])
  );

  // Track foreground/background — the OS stops the camera (and torch) in the background
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    return () => sub.remove();
  }, []);

  const torchMounted = isFlashlightOn && !!permission?.granted && isFocused && appActive;

  // Whenever the camera is unmounted, it must report ready again before the torch is enabled
  useEffect(() => {
    if (!torchMounted) setCameraReady(false);
  }, [torchMounted]);

  // Leaving the screen switches the torch off so it never stays on by accident
  useEffect(() => {
    if (!isFocused) setIsFlashlightOn(false);
  }, [isFocused]);

  useEffect(() => {
    return () => {
      Vibration.cancel();
      if (callIntervalRef.current) clearInterval(callIntervalRef.current);
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    };
  }, []);

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => Alert.alert("Error", "Unable to open the phone dialer."));
  };

  const callFavorite = () => {
    if (!settings.favoriteContactPhone) {
      Alert.alert("No Favorite Contact", "Save a favorite contact in Security Preferences to call them in one tap.", [
        { text: "Cancel", style: "cancel" },
        { text: "Set Up", onPress: () => navigation.navigate("SafetySettingsScreen") },
      ]);
      return;
    }
    handleCall(settings.favoriteContactPhone);
  };

  const toggleFlashlight = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Permission Denied", "Camera permission is required to use the flashlight.");
        return;
      }
    }
    setIsFlashlightOn((v) => !v);
  };

  const startFakeCallSequence = () => {
    if (isFakeCallPending) return;
    setIsFakeCallPending(true);
    ringTimeoutRef.current = setTimeout(() => {
      setIsFakeCallPending(false);
      setFakeCallState("incoming");
      setFakeCallTimer(0);
      setIsFakeCallVisible(true);
      Vibration.vibrate([1000, 1500], true);
    }, 3000);
  };

  const acceptFakeCall = () => {
    Vibration.cancel();
    setFakeCallState("active");
    if (callIntervalRef.current) clearInterval(callIntervalRef.current);
    callIntervalRef.current = setInterval(() => setFakeCallTimer((prev) => prev + 1), 1000);
  };

  const endFakeCall = () => {
    Vibration.cancel();
    if (callIntervalRef.current) clearInterval(callIntervalRef.current);
    callIntervalRef.current = null;
    setIsFakeCallVisible(false);
  };

  const formatTimer = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  const CallBadge = ({ color }: { color: string }) => (
    <YStack width={36} height={36} borderRadius={18} backgroundColor={color} justifyContent="center" alignItems="center">
      <Feather name="phone" size={16} color="#FFF" />
    </YStack>
  );

  const ToolRow = ({ icon, iconColor, title, subtitle, onPress, trailing, isLast, titleColor }: any) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <XStack padding={20} alignItems="center" borderBottomWidth={isLast ? 0 : 1} borderBottomColor={divider}>
        <YStack width={44} height={44} borderRadius={22} backgroundColor={`${iconColor}1A`} justifyContent="center" alignItems="center" marginRight={16}>
          <Feather name={icon} size={20} color={iconColor} />
        </YStack>
        <YStack flex={1} paddingRight={10}>
          <TText fontFamily="Chirp-Heavy" fontSize={15} color={titleColor || theme.textPrimary} marginBottom={2}>{title}</TText>
          <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>{subtitle}</TText>
        </YStack>
        {trailing}
      </XStack>
    </TouchableOpacity>
  );

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <Modal visible={isFakeCallVisible} animationType="fade" transparent={false} onRequestClose={endFakeCall}>
        <YStack flex={1} backgroundColor="#111827" paddingTop={80} paddingBottom={60} justifyContent="space-between" alignItems="center">
          <YStack alignItems="center">
            <YStack width={96} height={96} borderRadius={48} backgroundColor="#374151" justifyContent="center" alignItems="center" marginBottom={20}>
              <TText fontFamily="Chirp-Heavy" fontSize={40} color="#FFFFFF">{settings.fakeCallName.charAt(0).toUpperCase()}</TText>
            </YStack>
            <TText fontFamily="Chirp-Heavy" fontSize={36} color="#FFFFFF" marginBottom={12}>{settings.fakeCallName}</TText>
            <TText fontFamily="Chirp-Medium" fontSize={18} color="#9CA3AF">{fakeCallState === "incoming" ? "mobile" : formatTimer(fakeCallTimer)}</TText>
          </YStack>

          {fakeCallState === "incoming" ? (
            <XStack width="100%" justifyContent="space-evenly" paddingHorizontal={40}>
              <TouchableOpacity onPress={endFakeCall}>
                <YStack alignItems="center">
                  <YStack width={76} height={76} borderRadius={38} backgroundColor="#EF4444" justifyContent="center" alignItems="center" marginBottom={12}>
                    <Ionicons name="call-outline" size={36} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
                  </YStack>
                  <TText fontFamily="Chirp-Medium" fontSize={15} color="#FFF">Decline</TText>
                </YStack>
              </TouchableOpacity>
              <TouchableOpacity onPress={acceptFakeCall}>
                <YStack alignItems="center">
                  <YStack width={76} height={76} borderRadius={38} backgroundColor="#22C55E" justifyContent="center" alignItems="center" marginBottom={12}>
                    <Ionicons name="call-outline" size={36} color="#FFF" />
                  </YStack>
                  <TText fontFamily="Chirp-Medium" fontSize={15} color="#FFF">Accept</TText>
                </YStack>
              </TouchableOpacity>
            </XStack>
          ) : (
            <TouchableOpacity onPress={endFakeCall}>
              <YStack alignItems="center">
                <YStack width={76} height={76} borderRadius={38} backgroundColor="#EF4444" justifyContent="center" alignItems="center" marginBottom={12}>
                  <Ionicons name="call-outline" size={36} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
                </YStack>
                <TText fontFamily="Chirp-Medium" fontSize={15} color="#FFF">End Call</TText>
              </YStack>
            </TouchableOpacity>
          )}
        </YStack>
      </Modal>

      <SafeAreaView style={{ flex: 1 }}>
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={24}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Safety Tools</TText>
            <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2} letterSpacing={1}>QUICK ACCESS</TText>
          </YStack>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>EMERGENCY CALLS</TText>
          <YStack backgroundColor={cardBg} borderRadius={24} borderWidth={1} borderColor={divider} overflow="hidden" marginBottom={32}>
            <ToolRow
              icon="star" iconColor="#00C48A"
              title={settings.favoriteContactName ? `Call ${settings.favoriteContactName}` : "Call Favorite Contact"}
              subtitle={settings.favoriteContactPhone || "Not set — tap to add in Security Preferences"}
              onPress={callFavorite}
              trailing={<CallBadge color="#00C48A" />}
            />
            <ToolRow icon="shield" iconColor="#3B82F6" title="Call Police" subtitle={`Call ${settings.policeNumber}`} onPress={() => handleCall(settings.policeNumber)} trailing={<CallBadge color="#3B82F6" />} />
            <ToolRow isLast icon="plus-circle" iconColor="#EF4444" title="Call Ambulance" subtitle={`Call ${settings.ambulanceNumber}`} onPress={() => handleCall(settings.ambulanceNumber)} trailing={<CallBadge color="#EF4444" />} />
          </YStack>

          <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>DEVICE TOOLS</TText>
          <YStack backgroundColor={cardBg} borderRadius={24} borderWidth={1} borderColor={divider} overflow="hidden">
            <ToolRow
              icon="phone-incoming" iconColor="#F59E0B"
              title="Fake Call"
              subtitle={isFakeCallPending ? "Your phone will ring in 3 seconds..." : `Simulate a call from "${settings.fakeCallName}" to exit a situation`}
              onPress={startFakeCallSequence}
              trailing={
                <YStack paddingHorizontal={12} paddingVertical={8} borderRadius={14} backgroundColor={isFakeCallPending ? (isDarkMode ? "#2D3B34" : "#E2E8F0") : "#F59E0B"}>
                  <TText fontFamily="Chirp-Bold" fontSize={11} color={isFakeCallPending ? theme.textSecondary : "#FFF"}>{isFakeCallPending ? "Ringing..." : "Start"}</TText>
                </YStack>
              }
            />
            <ToolRow
              isLast icon="sun" iconColor="#00C48A"
              title="Flashlight" titleColor={isFlashlightOn ? "#00C48A" : undefined}
              subtitle={isFlashlightOn ? (cameraReady ? "Torch is ON — stays on until you switch it off" : "Turning on...") : "Turn on your device flashlight"}
              onPress={toggleFlashlight}
              trailing={<Switch value={isFlashlightOn} onValueChange={toggleFlashlight} trackColor={{ false: isDarkMode ? "#2D3B34" : "#E2E8F0", true: "#00C48A" }} thumbColor="#FFFFFF" />}
            />
          </YStack>

          {/* The camera must be a real, visible view for the torch to stay on (iOS and Android
              pause hidden 1x1 / transparent cameras, which switches the torch off). */}
          {torchMounted && (
            <XStack marginTop={16} backgroundColor={cardBg} borderRadius={20} borderWidth={1} borderColor="#00C48A" padding={14} alignItems="center">
              <View style={{ width: 56, height: 56, borderRadius: 14, overflow: "hidden", backgroundColor: "#000", marginRight: 14 }}>
                <CameraView
                  style={{ width: 56, height: 56 }}
                  facing="back"
                  enableTorch={cameraReady}
                  onCameraReady={() => setTimeout(() => setCameraReady(true), 150)}
                  onMountError={() => {
                    setIsFlashlightOn(false);
                    Alert.alert("Flashlight unavailable", "The camera is being used by another app or this device has no flashlight.");
                  }}
                />
              </View>
              <YStack flex={1}>
                <TText fontFamily="Chirp-Heavy" fontSize={14} color="#00C48A">{cameraReady ? "Flashlight on" : "Starting flashlight..."}</TText>
                <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={2}>Keep this screen open. Leaving it turns the torch off.</TText>
              </YStack>
              <TouchableOpacity onPress={() => setIsFlashlightOn(false)}>
                <YStack paddingHorizontal={12} paddingVertical={8} borderRadius={14} backgroundColor="#EF4444">
                  <TText fontFamily="Chirp-Bold" fontSize={11} color="#FFF">Turn Off</TText>
                </YStack>
              </TouchableOpacity>
            </XStack>
          )}
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default SafetyToolsScreen;