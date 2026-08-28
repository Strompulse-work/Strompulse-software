import React, { useState, useRef } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  Platform, 
  StatusBar,
  Image,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
  TouchableWithoutFeedback
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";

const { height, width } = Dimensions.get("window");

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
        <View style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          
          <Image 
            source={require("../../assets/images/gridstrom3.png")} 
            style={StyleSheet.absoluteFillObject} 
            resizeMode="cover"
          />
          <LinearGradient 
            colors={['rgba(11, 15, 13, 0.4)', 'rgba(11, 15, 13, 0.95)', '#0B0F0D']} 
            style={StyleSheet.absoluteFillObject} 
          />

          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <View style={styles.backButtonBlur}>
                  <MaterialCommunityIcons name="chevron-left" size={20} color="#FFFFFF" />
                  <Text style={styles.backButtonText}>Back to Home</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <View style={[styles.authCard, { backgroundColor: isDarkMode ? "rgba(18, 26, 22, 0.75)" : "rgba(255, 255, 255, 0.9)" }]}>
                
                <View style={styles.iconGlowWrapper}>
                  <LinearGradient colors={["#00C48A", "#064E3B"]} style={styles.iconCircle}>
                    <MaterialCommunityIcons name="lock-outline" size={32} color="#FFFFFF" />
                  </LinearGradient>
                </View>

                <Text style={[styles.title, { color: isDarkMode ? "#FFFFFF" : "#1E293B" }]}>Private Vault</Text>
                <Text style={[styles.subtitle, { color: isDarkMode ? "#94A3B8" : "#64748B" }]}>
                  Enter the security code paired with your Pole Sentinel hardware to access real-time personal analytics.
                </Text>

                <TouchableOpacity 
                  activeOpacity={1} 
                  style={styles.pinContainer} 
                  onPress={() => pinInputRef.current?.focus()}
                >
                  {[...Array(PIN_LENGTH)].map((_, index) => {
                    const isFilled = index < pin.length;
                    const isFocused = index === pin.length;
                    return (
                      <View 
                        key={index} 
                        style={[
                          styles.pinBox, 
                          { 
                            backgroundColor: isDarkMode ? "rgba(0,0,0,0.3)" : "#F1F5F9",
                            borderColor: isFocused ? "#00C48A" : (isDarkMode ? "#2D3B34" : "#E2E8F0")
                          }
                        ]}
                      >
                        {isFilled && <View style={styles.pinDotActive} />}
                      </View>
                    );
                  })}
                </TouchableOpacity>

                <TextInput
                  ref={pinInputRef}
                  value={pin}
                  onChangeText={handlePinChange}
                  keyboardType="numeric"
                  maxLength={PIN_LENGTH}
                  secureTextEntry
                  style={styles.hiddenInput}
                  autoFocus={true}
                />

                <TouchableOpacity 
                  style={[styles.unlockBtn, pin.length !== PIN_LENGTH && styles.unlockBtnDisabled]} 
                  onPress={handleUnlock} 
                  activeOpacity={0.8}
                  disabled={pin.length !== PIN_LENGTH}
                >
                  <Text style={styles.unlockBtnText}>Access Dashboard</Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color="#FFF" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
                
                <Text style={styles.demoText}>Demo code: 0000</Text>
              </View>

              <TouchableOpacity style={[styles.secondaryCard, { backgroundColor: isDarkMode ? "rgba(18, 26, 22, 0.6)" : "rgba(255, 255, 255, 0.85)" }]} activeOpacity={0.8} onPress={() => navigation.navigate("RequestDeviceScreen")}>
                <View style={[styles.plugIconBox, { backgroundColor: isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5" }]}>
                  <MaterialCommunityIcons name="power-plug" size={24} color="#00C48A" />
                </View>
                <View style={styles.secondaryTextArea}>
                  <Text style={[styles.secondaryTitle, { color: isDarkMode ? "#F8FAFC" : "#1E293B" }]}>Not a Stromer yet?</Text>
                  <Text style={[styles.secondarySubtitle, { color: isDarkMode ? "#94A3B8" : "#64748B" }]}>
                    Order a personal device anywhere in Nigeria to unlock premium power analytics.
                  </Text>
                  <View style={styles.requestLinkRow}>
                    <Text style={styles.requestLinkText}>Request Device</Text>
                    <MaterialCommunityIcons name="chevron-right" size={16} color="#00C48A" />
                  </View>
                </View>
              </TouchableOpacity>

            </View>
          </SafeAreaView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0F0D" },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { paddingHorizontal: 20, paddingTop: 20, marginBottom: 20, zIndex: 10 },
  backButton: { alignSelf: "flex-start" },
  backButtonBlur: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  backButtonText: { fontSize: 13, fontFamily: "Sora_600SemiBold", color: "#FFFFFF", marginLeft: 4 },
  content: { paddingHorizontal: 20, alignItems: "center", justifyContent: "center", flex: 1, paddingBottom: 40 },
  authCard: { borderRadius: 32, padding: 32, alignItems: "center", width: "100%", marginBottom: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", shadowColor: "#000", shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.3, shadowRadius: 30, elevation: 10 },
  iconGlowWrapper: { shadowColor: "#00C48A", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, marginBottom: 24 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.2)" },
  title: { fontSize: 26, fontFamily: "Sora_800ExtraBold", marginBottom: 10 },
  subtitle: { fontSize: 13, fontFamily: "Sora_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 36, paddingHorizontal: 10 },
  pinContainer: { flexDirection: "row", justifyContent: "space-between", width: "90%", marginBottom: 32 },
  pinBox: { width: 60, height: 70, borderRadius: 20, justifyContent: "center", alignItems: "center", borderWidth: 2 },
  pinDotActive: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#00C48A", shadowColor: "#00C48A", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8, elevation: 5 },
  hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0 },
  unlockBtn: { flexDirection: "row", backgroundColor: "#00C48A", borderRadius: 20, width: "100%", paddingVertical: 18, alignItems: "center", justifyContent: "center", marginBottom: 20, shadowColor: "#00C48A", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 5 },
  unlockBtnDisabled: { backgroundColor: "#334155", shadowOpacity: 0, elevation: 0 },
  unlockBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Sora_700Bold" },
  demoText: { fontSize: 11, fontFamily: "Sora_500Medium", color: "#64748B" },
  secondaryCard: { flexDirection: "row", borderRadius: 28, padding: 24, width: "100%", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  plugIconBox: { width: 56, height: 56, borderRadius: 18, justifyContent: "center", alignItems: "center", marginRight: 16 },
  secondaryTextArea: { flex: 1, justifyContent: "center" },
  secondaryTitle: { fontSize: 15, fontFamily: "Sora_700Bold", marginBottom: 6 },
  secondarySubtitle: { fontSize: 11, fontFamily: "Sora_400Regular", lineHeight: 18, marginBottom: 14 },
  requestLinkRow: { flexDirection: "row", alignItems: "center" },
  requestLinkText: { fontSize: 12, fontFamily: "Sora_700Bold", color: "#00C48A", marginRight: 4 },
});

export default PrivateDashboardScreen;