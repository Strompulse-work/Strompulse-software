import React, { useState } from "react";
import { StatusBar, TouchableOpacity, SafeAreaView, ScrollView, Platform, Linking, Alert, Modal, Vibration, View } from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import * as Clipboard from 'expo-clipboard';
import * as Location from "expo-location";
import { CameraView, useCameraPermissions } from 'expo-camera'; 

const SafetyToolsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();

  // REAL-TIME FLASHLIGHT CONTROL
  const [permission, requestPermission] = useCameraPermissions();
  const [isFlashlightOn, setIsFlashlightOn] = useState(false);

  // REAL-TIME FAKE CALL CONTROL
  const [isFakeCallVisible, setIsFakeCallVisible] = useState(false);
  const [fakeCallTimer, setFakeCallTimer] = useState(0);
  const [fakeCallState, setFakeCallState] = useState<'incoming' | 'active'>('incoming');
  let callInterval: NodeJS.Timeout;

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => Alert.alert("Error", "Unable to open dialer"));
  };

  const copyLocationLink = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "Enable location permissions to copy a map link.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const mapLink = `https://maps.google.com/?q=${loc.coords.latitude},${loc.coords.longitude}`;
      await Clipboard.setStringAsync(mapLink);
      Alert.alert("Link Copied", "Your live Google Maps link has been copied to your clipboard.");
    } catch (e) {
      Alert.alert("Error", "Could not get your location.");
    }
  };

  // NATIVE FLASHLIGHT TOGGLE
  const toggleFlashlight = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Permission Denied", "Camera permission is required to trigger the hardware flashlight.");
        return;
      }
    }
    
    setIsFlashlightOn(!isFlashlightOn);
  };

  // NATIVE FAKE CALL MODAL & VIBRATION LOOP
  const startFakeCallSequence = () => {
    Alert.alert(
      "Fake Call Scheduled",
      "Your phone will begin to ring in 3 seconds.",
      [
        {
          text: "OK",
          onPress: () => {
            setTimeout(() => {
              setFakeCallState('incoming');
              setFakeCallTimer(0);
              setIsFakeCallVisible(true);
              // Trigger a repeating hardware vibration to simulate a ringing phone
              Vibration.vibrate([1000, 1500, 1000, 1500, 1000, 1500, 1000, 1500, 1000, 1500], true);
            }, 3000);
          }
        }
      ]
    );
  };

  const acceptFakeCall = () => {
    Vibration.cancel();
    setFakeCallState('active');
    callInterval = setInterval(() => {
      setFakeCallTimer(prev => prev + 1);
    }, 1000);
  };

  const endFakeCall = () => {
    Vibration.cancel();
    clearInterval(callInterval);
    setIsFakeCallVisible(false);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      {/* 
        Hidden CameraView: 
        Rendered at a normal 100x100 size so the OS doesn't forcefully suspend it, 
        but positioned way off-screen (-1000) so it remains invisible to the user.
      */}
      {isFlashlightOn && permission?.granted && (
        <View style={{ position: 'absolute', top: -1000, left: -1000, width: 100, height: 100 }}>
          <CameraView 
            style={{ flex: 1 }} 
            facing="back"
            enableTorch={true} 
          />
        </View>
      )}

      {/* FULL-SCREEN NATIVE FAKE CALL MODAL OVERLAY */}
      <Modal visible={isFakeCallVisible} animationType="fade" transparent={false}>
        <YStack flex={1} backgroundColor="#111827" paddingTop={80} paddingBottom={60} justifyContent="space-between" alignItems="center">
          <YStack alignItems="center">
            <TText fontFamily="Chirp-Heavy" fontSize={36} color="#FFFFFF" marginBottom={12}>Mum</TText>
            <TText fontFamily="Chirp-Medium" fontSize={18} color="#9CA3AF">
              {fakeCallState === 'incoming' ? 'mobile' : formatTimer(fakeCallTimer)}
            </TText>
          </YStack>

          {fakeCallState === 'incoming' ? (
            <XStack width="100%" justifyContent="space-evenly" paddingHorizontal={40}>
              <TouchableOpacity onPress={endFakeCall}>
                <YStack alignItems="center">
                  <YStack width={76} height={76} borderRadius={38} backgroundColor="#EF4444" justifyContent="center" alignItems="center" marginBottom={12}>
                    <Ionicons name="call-outline" size={36} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
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
                  <Ionicons name="call-outline" size={36} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
                </YStack>
                <TText fontFamily="Chirp-Medium" fontSize={15} color="#FFF">End Call</TText>
              </YStack>
            </TouchableOpacity>
          )}
        </YStack>
      </Modal>

      <SafeAreaView style={{ flex: 1 }}>
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={24}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Safety Tools</TText> 
            <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2} letterSpacing={1}>QUICK ACCESS</TText> 
          </YStack>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} overflow="hidden">
            
            <TouchableOpacity onPress={() => handleCall("112")}>
              <XStack padding={20} alignItems="center" borderBottomWidth={1} borderBottomColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                <TText fontSize={20} marginRight={16}>📞</TText>
                <YStack flex={1}>
                  <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} marginBottom={2}>Call Police</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>112 • Nigeria emergency line</TText>
                </YStack>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </XStack>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleCall("112")}>
              <XStack padding={20} alignItems="center" borderBottomWidth={1} borderBottomColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                <TText fontSize={20} marginRight={16}>🚑</TText>
                <YStack flex={1}>
                  <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} marginBottom={2}>Call Ambulance</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>112 • Also handles medical emergencies</TText>
                </YStack>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </XStack>
            </TouchableOpacity>

            <TouchableOpacity onPress={startFakeCallSequence}>
              <XStack padding={20} alignItems="center" borderBottomWidth={1} borderBottomColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                <TText fontSize={20} marginRight={16}>🎭</TText>
                <YStack flex={1}>
                  <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} marginBottom={2}>Fake Call</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Simulate an incoming call to exit a situation</TText>
                </YStack>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </XStack>
            </TouchableOpacity>

            <TouchableOpacity onPress={copyLocationLink}>
              <XStack padding={20} alignItems="center" borderBottomWidth={1} borderBottomColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                <TText fontSize={20} marginRight={16}>🔗</TText>
                <YStack flex={1}>
                  <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} marginBottom={2}>Copy Location Link</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Copy a link to your current position</TText>
                </YStack>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </XStack>
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleFlashlight}>
              <XStack padding={20} alignItems="center">
                <TText fontSize={20} marginRight={16}>🔦</TText>
                <YStack flex={1}>
                  <TText fontFamily="Chirp-Heavy" fontSize={15} color={isFlashlightOn ? "#00C48A" : theme.textPrimary} marginBottom={2}>Flashlight</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>{isFlashlightOn ? "Torch is currently ON" : "Toggle your device flashlight"}</TText>
                </YStack>
                {isFlashlightOn ? (
                  <Feather name="power" size={20} color="#00C48A" />
                ) : (
                  <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                )}
              </XStack>
            </TouchableOpacity>

          </YStack>
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default SafetyToolsScreen;