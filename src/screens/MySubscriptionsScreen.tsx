import React from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

const MySubscriptionsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#F4F6F8" }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>My Subscriptions</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        
        {/* Active Plan */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>CURRENT PLAN</Text>
        <View style={[styles.card, { backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderColor: "#00C48A" }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {/* Changed from "flash-circle" to "lightning-bolt-circle" */}
              <MaterialCommunityIcons name="lightning-bolt-circle" size={24} color="#00C48A" style={{ marginRight: 8 }} />
              <Text style={[styles.planTitle, { color: theme.textPrimary }]}>Strompulse Basic</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>ACTIVE</Text>
            </View>
          </View>
          <Text style={[styles.planDesc, { color: theme.textSecondary }]}>Free access to regional power grids, community outage alerts, and basic live tracking capabilities.</Text>
        </View>

        {/* Upgrade Plan */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 12 }]}>AVAILABLE UPGRADES</Text>
        <View style={[styles.card, { backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", opacity: 0.8 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <MaterialCommunityIcons name="cpu-64-bit" size={24} color={theme.textPrimary} style={{ marginRight: 8 }} />
            <Text style={[styles.planTitle, { color: theme.textPrimary }]}>Personal Hardware Node</Text>
          </View>
          <Text style={[styles.planDesc, { color: theme.textSecondary }]}>Install a physical node in your home. Get 100% accurate private analytics, cost tracking, and precise 1-second outage alerts.</Text>
          <TouchableOpacity 
            style={[styles.upgradeBtn, { backgroundColor: isDarkMode ? "#1A221E" : "#F1F5F9" }]} 
            onPress={() => navigation.navigate("RequestDeviceScreen")}
          >
            <Text style={[styles.upgradeBtnText, { color: theme.textPrimary }]}>Learn More • ₦50,000</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 20 : 10, paddingBottom: 10 },
  iconBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "SoraTitle-Bold" },
  sectionTitle: { fontSize: 11, fontFamily: "Chirp-Bold", letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  card: { padding: 20, borderRadius: 24, borderWidth: 1.5, marginBottom: 24 },
  planTitle: { fontSize: 16, fontFamily: "Chirp-Heavy" },
  activeBadge: { backgroundColor: "rgba(0,196,138,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  activeBadgeText: { color: "#00C48A", fontSize: 10, fontFamily: "Chirp-Bold" },
  planDesc: { fontSize: 13, fontFamily: "Chirp-Medium", lineHeight: 20 },
  upgradeBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  upgradeBtnText: { fontSize: 13, fontFamily: "Chirp-Bold" }
});

export default MySubscriptionsScreen;