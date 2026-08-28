import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

const PlaceDetailScreen = ({ route, navigation }: any) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  
  // Destructure mocked params passed from ExploreScreen
  const { name = "Shoprite Ibadan", status = "online" } = route.params || {};
  const isOnline = status === "online";

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header Actions */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialCommunityIcons name="heart-outline" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Image Placeholder */}
        <View style={styles.imageBox}>
          <MaterialCommunityIcons name="silverware-fork-knife" size={48} color="#CBD5E1" />
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.openBadge}><Text style={styles.openText}>Open now</Text></View>
          <View style={styles.distanceBadge}><Text style={styles.distanceText}>2.3km away</Text></View>
        </View>

        <Text style={styles.title}>{name}</Text>
        <Text style={styles.subtitle}>Dugbe, Ibadan • 9am–9pm</Text>
        <Text style={styles.rating}>⭐⭐⭐⭐⭐ 4.1 <Text style={{ color: theme.textSecondary }}>631 reviews</Text></Text>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#00C48A" }]}>
            <MaterialCommunityIcons name="map-marker" size={18} color="#FFF" />
            <Text style={[styles.actionText, { color: "#FFF" }]}>Directions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <MaterialCommunityIcons name="phone" size={18} color={theme.textPrimary} />
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <MaterialCommunityIcons name="share-variant" size={18} color={theme.textPrimary} />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Features */}
        <Text style={styles.sectionTitle}>FEATURES</Text>
        <View style={styles.featuresRow}>
          {["Parking", "ATM", "Takeaway", "AC"].map(feature => (
            <View key={feature} style={styles.featureChip}>
              <MaterialCommunityIcons name="check" size={14} color="#00C48A" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* LIVE POWER STATUS BANNER */}
        <View style={[styles.powerBanner, isOnline ? styles.powerOnline : styles.powerOutage]}>
          <MaterialCommunityIcons 
            name={isOnline ? "lightbulb-outline" : "lightning-bolt"} 
            size={24} 
            color={isOnline ? "#059669" : "#EF4444"} 
            style={{ marginRight: 12 }} 
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.powerTitle, { color: isOnline ? "#059669" : "#EF4444" }]}>
              Power Status • Dugbe
            </Text>
            <Text style={[styles.powerDesc, { color: isOnline ? "#047857" : "#B91C1C" }]}>
              {isOnline ? "Area currently has electricity • Strompulse • updated 2 min ago" : "Outage in this area • Strompulse • updated 2 min ago"}
            </Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  iconBtn: { padding: 8, backgroundColor: theme.cardBg, borderRadius: 20, borderWidth: 1, borderColor: theme.border },
  imageBox: { height: 200, backgroundColor: "#F8FAFC", borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  badgeRow: { flexDirection: "row", marginBottom: 12 },
  openBadge: { backgroundColor: "#ECFDF5", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
  openText: { color: "#00C48A", fontSize: 12, fontFamily: "Sora_700Bold" },
  distanceBadge: { backgroundColor: "#F1F5F9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  distanceText: { color: "#64748B", fontSize: 12, fontFamily: "Sora_600SemiBold" },
  title: { fontSize: 24, fontFamily: "Sora_800ExtraBold", color: theme.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 14, fontFamily: "Sora_400Regular", color: theme.textSecondary, marginBottom: 8 },
  rating: { fontSize: 14, fontFamily: "Sora_700Bold", color: "#D97706", marginBottom: 24 },
  actionRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.border, marginHorizontal: 4 },
  actionText: { fontSize: 14, fontFamily: "Sora_600SemiBold", marginLeft: 6, color: theme.textPrimary },
  sectionTitle: { fontSize: 12, fontFamily: "Sora_700Bold", color: theme.textSecondary, letterSpacing: 1, marginBottom: 12 },
  featuresRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 32 },
  featureChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  featureText: { fontSize: 12, fontFamily: "Sora_600SemiBold", color: "#475569", marginLeft: 4 },
  powerBanner: { flexDirection: "row", padding: 16, borderRadius: 16, borderWidth: 1, alignItems: "center" },
  powerOnline: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  powerOutage: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  powerTitle: { fontSize: 14, fontFamily: "Sora_700Bold", marginBottom: 2 },
  powerDesc: { fontSize: 11, fontFamily: "Sora_400Regular" },
});
export default PlaceDetailScreen;