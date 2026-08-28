/**
 * Journey Share Screen v2.0
 * Features: Real-time user GPS location fetching via Expo Location, dynamic route state syncing, and contact status.
 */

import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Platform, TextInput, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useTheme } from "../theme/ThemeContext";

const JourneyShareScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme);

  const [destination, setDestination] = useState("");
  const [eta, setEta] = useState("30m");
  const [currentLocation, setCurrentLocation] = useState("Locating current position...");
  
  const initialActive = route.params?.isJourneyActive || false;
  const [isActive, setIsActive] = useState(initialActive);

  // Fetch real-time user location when component mounts
  useEffect(() => {
    const fetchCurrentLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setCurrentLocation("Ibadan, Oyo State");
          return;
        }

        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        let response = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (response && response.length > 0) {
          const address = response[0];
          const locality = address.district || address.subregion || address.city || "Ibadan";
          const region = address.region || "Oyo State";
          setCurrentLocation(`${locality}, ${region}`);
        } else {
          setCurrentLocation("Ibadan, Oyo State");
        }
      } catch (err) {
        console.error("Error fetching location:", err);
        setCurrentLocation("Ibadan, Oyo State");
      }
    };

    fetchCurrentLocation();
  }, []);

  useEffect(() => {
    if (route.params?.isJourneyActive !== undefined) {
      setIsActive(route.params.isJourneyActive);
    }
  }, [route.params?.isJourneyActive, route.params?.timestamp]);

  const alertContacts = [
    { id: 1, initial: "M", name: "Mum", color: "#F59E0B", bg: "#FEF3C7" },
    { id: 2, initial: "T", name: "Tunde", color: "#3B82F6", bg: "#DBEAFE" },
    { id: 3, initial: "S", name: "Sola", color: "#8B5CF6", bg: "#F3E8FF" },
  ];

  const etaOptions = ["15m", "30m", "1h", "2h"];

  const startSharing = () => {
    setIsActive(true);
    navigation.navigate("Safety", { 
      isJourneyActive: true, 
      timestamp: Date.now() 
    });
  };

  const stopSharing = () => {
    setIsActive(false);
    navigation.navigate("Safety", { 
      isJourneyActive: false, 
      timestamp: Date.now() 
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.7} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Journey Share</Text>
          <Text style={styles.headerSubtitle}>
            {isActive ? "LIVE LOCATION WITH CONTACTS" : "LIVE LOCATION WITH YOUR CONTACTS"}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {isActive ? (
          <View style={styles.activeLocationCard}>
            <View style={styles.activeIconCircle}>
              <MaterialCommunityIcons name="map-marker-outline" size={24} color="#00C48A" />
            </View>
            <Text style={styles.activeLocationTitle}>Journey Active</Text>
            <Text style={styles.activeLocationSub}>{currentLocation}</Text>
          </View>
        ) : (
          <View style={styles.locationCard}>
            <MaterialCommunityIcons name="map-marker" size={24} color="#EF4444" style={{ marginBottom: 8 }} />
            <Text style={styles.locationText}>{currentLocation}</Text>
          </View>
        )}

        {!isActive && (
          <>
            <Text style={styles.sectionTitle}>DESTINATION (OPTIONAL)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="e.g. Dugbe Market"
                placeholderTextColor={theme.textSecondary}
                value={destination}
                onChangeText={setDestination}
              />
            </View>

            <Text style={styles.sectionTitle}>ESTIMATED ARRIVAL</Text>
            <View style={styles.etaRow}>
              {etaOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.etaPill, eta === option && styles.etaPillActive]}
                  onPress={() => setEta(option)}
                >
                  <Text style={[styles.etaText, eta === option && styles.etaTextActive]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>SHARING WITH</Text>
            <View style={styles.avatarRow}>
              {alertContacts.map((contact) => (
                <View key={contact.id} style={styles.avatarContainer}>
                  <View style={[styles.avatarCircle, { backgroundColor: contact.bg, borderColor: contact.bg }]}>
                    <Text style={[styles.avatarText, { color: contact.color }]}>{contact.initial}</Text>
                  </View>
                  <Text style={styles.avatarLabel}>{contact.name}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {isActive && (
          <View style={{ marginTop: 8 }}>
            {alertContacts.map((contact) => (
              <View key={contact.id} style={styles.sentCard}>
                <View style={styles.sentLeft}>
                  <View style={[styles.avatarSmall, { borderColor: contact.color, backgroundColor: contact.bg }]}>
                    <Text style={[styles.avatarTextSmall, { color: contact.color }]}>{contact.initial}</Text>
                  </View>
                  <Text style={styles.sentName}>{contact.name}</Text>
                </View>
                <View style={styles.sentPill}>
                  <View style={styles.smallGreenDot} />
                  <Text style={styles.sentPillText}>Live</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {isActive ? (
          <TouchableOpacity style={styles.stopButton} activeOpacity={0.8} onPress={stopSharing}>
            <Text style={styles.stopButtonText}>Stop Sharing</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.startButton} activeOpacity={0.8} onPress={startSharing}>
            <Text style={styles.startButtonText}>Start Journey Share</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginTop: Platform.OS === "ios" ? 60 : 40, marginBottom: 32 },
  backButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.border, justifyContent: "center", alignItems: "center", backgroundColor: theme.cardBg, marginRight: 16 },
  headerTextContainer: { flex: 1, justifyContent: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Sora_700Bold", color: theme.textPrimary },
  headerSubtitle: { fontSize: 10, fontFamily: "Sora_600SemiBold", color: theme.textSecondary, letterSpacing: 1, marginTop: 2, textTransform: "uppercase" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  
  locationCard: { backgroundColor: "#ECFDF5", borderRadius: 16, borderWidth: 1, borderColor: "#A7F3D0", paddingVertical: 32, alignItems: "center", marginBottom: 32 },
  locationText: { fontSize: 15, fontFamily: "Sora_600SemiBold", color: "#0F172A", textAlign: "center", paddingHorizontal: 16 },
  sectionTitle: { fontSize: 11, fontFamily: "Sora_700Bold", color: theme.textSecondary, letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  inputContainer: { backgroundColor: theme.cardBg, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, height: 54, justifyContent: "center", marginBottom: 24 },
  input: { fontSize: 15, fontFamily: "Sora_400Regular", color: theme.textPrimary, height: "100%" },
  etaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32 },
  etaPill: { flex: 1, backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginHorizontal: 4 },
  etaPillActive: { backgroundColor: "#ECFDF5", borderColor: "#00C48A" },
  etaText: { fontSize: 14, fontFamily: "Sora_600SemiBold", color: theme.textSecondary },
  etaTextActive: { color: "#00C48A", fontFamily: "Sora_700Bold" },
  avatarRow: { flexDirection: "row", gap: 20 },
  avatarContainer: { alignItems: "center" },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  avatarText: { fontSize: 20, fontFamily: "Sora_700Bold" },
  avatarLabel: { fontSize: 12, fontFamily: "Sora_400Regular", color: theme.textSecondary },
  
  activeLocationCard: { backgroundColor: "#ECFDF5", borderRadius: 16, paddingVertical: 32, alignItems: "center", marginBottom: 32 },
  activeIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(0, 196, 138, 0.1)", borderWidth: 1, borderColor: "rgba(0, 196, 138, 0.3)", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  activeLocationTitle: { fontSize: 16, fontFamily: "Sora_700Bold", color: "#059669", marginBottom: 4 },
  activeLocationSub: { fontSize: 12, fontFamily: "Sora_400Regular", color: "#047857", textAlign: "center", paddingHorizontal: 16 },
  
  sentCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: theme.cardBg, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  sentLeft: { flexDirection: "row", alignItems: "center" },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarTextSmall: { fontSize: 14, fontFamily: "Sora_700Bold" },
  sentName: { fontSize: 15, fontFamily: "Sora_700Bold", color: theme.textPrimary },
  sentPill: { flexDirection: "row", alignItems: "center" },
  smallGreenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#00C48A", marginRight: 6 },
  sentPillText: { color: "#00C48A", fontSize: 12, fontFamily: "Sora_700Bold" },

  footer: { paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 34 : 24, paddingTop: 16 },
  startButton: { backgroundColor: "#059669", borderRadius: 12, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  startButtonText: { fontSize: 16, fontFamily: "Sora_700Bold", color: "#FFFFFF" },
  stopButton: { backgroundColor: "#FEF2F2", borderRadius: 12, paddingVertical: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#FECACA" },
  stopButtonText: { fontSize: 16, fontFamily: "Sora_700Bold", color: "#EF4444" },
});

export default JourneyShareScreen;