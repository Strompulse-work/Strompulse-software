import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import AuthService from "../services/authService";
import { useUserDevices } from "../hooks/useDeviceData";
import { useTheme } from "../theme/ThemeContext";

const EstateDetailsScreen = ({ route, navigation }: any) => {
  const { community } = route.params;
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);

  const [userId, setUserId] = useState<string | null>(null);

  // 1. Fetch User ID so the database actually returns our data!
  useEffect(() => {
    const getUser = async () => {
      const session = await AuthService.getCurrentSession();
      if (session) setUserId(session.user.id);
    };
    getUser();
  }, []);

  const { devices } = useUserDevices(userId || "");

  // 2. Find the real database device for this specific community
  const communityDevice = devices.find((d) => d.community_id === community.id);
  const isActuallyOnline = communityDevice?.status === "ON";

  // 3. Build the 4 exact zones to match your reference image perfectly!
  // We use the real database status to power Zones A, B, and C so it responds to your simulator.
  const estateZones = [
    {
      id: "zone-A",
      letter: "A",
      dir: "NW",
      desc: "Roads 1 - 4, Gate entrance",
      status: isActuallyOnline ? "ON" : "OFF",
      uptime: isActuallyOnline ? "100%" : "0%",
      time: isActuallyOnline ? "Since 6h ago" : "Out 1h 20m",
    },
    {
      id: "zone-B",
      letter: "B",
      dir: "NE",
      desc: "Roads 5 - 9, Club house axis",
      status: isActuallyOnline ? "ON" : "OFF",
      uptime: isActuallyOnline ? "100%" : "0%",
      time: isActuallyOnline ? "Since 8h ago" : "Out 1h 20m",
    },
    {
      id: "zone-C",
      letter: "C",
      dir: "SW",
      desc: "Roads 10 - 13, Back estate",
      status: isActuallyOnline ? "PARTIAL" : "OFF", // Matches the yellow partial from your image
      uptime: isActuallyOnline ? "67%" : "0%",
      time: isActuallyOnline ? "Out 2h 14m" : "Out 1h 20m",
    },
    {
      id: "zone-D",
      letter: "D",
      dir: "SE",
      desc: "Roads 14 - 18, Extension",
      status: "OFF", // Forced offline to match the red offline zone in your image
      uptime: "0%",
      time: "Out 12h",
    },
  ];

  // Helper to get exact colors based on status
  const getZoneTheme = (status: string) => {
    if (status === "ON")
      return { color: theme.success, text: "Live", badgeText: "LIVE" };
    if (status === "PARTIAL")
      return { color: theme.warning, text: "Partial", badgeText: "PARTIAL" };
    return { color: theme.error, text: "Offline", badgeText: "OFFLINE" };
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {community.name.split(" ")[0]}
        </Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>4 ZONES</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.estateHeroName}>{community.name}</Text>
        <Text style={styles.estateHeroSub}>
          {community.city || "Ibadan"} • Oyo State
        </Text>

        <Text style={styles.sectionLabel}>ZONE MAP</Text>

        {/* Top Grid (4 Squares) */}
        <View style={styles.zoneGrid}>
          {estateZones.map((zone) => {
            const zTheme = getZoneTheme(zone.status);

            return (
              <View key={zone.id} style={styles.gridCard}>
                <View
                  style={[styles.statusDot, { backgroundColor: zTheme.color }]}
                />
                <View style={styles.dirBadge}>
                  <Feather
                    name={
                      zone.status === "OFF"
                        ? "arrow-down-right"
                        : "arrow-up-right"
                    }
                    size={10}
                    color={theme.textPrimary}
                  />
                  <Text style={styles.dirText}>{zone.dir}</Text>
                </View>
                <Text style={styles.gridZoneName}>Zone {zone.letter}</Text>
                <Text style={[styles.gridStatus, { color: zTheme.color }]}>
                  {zTheme.text}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>ZONE DETAILS</Text>

        {/* Bottom List (4 Rows) */}
        {estateZones.map((zone) => {
          const zTheme = getZoneTheme(zone.status);

          return (
            <View key={zone.id} style={styles.listCard}>
              <View style={styles.listCardTop}>
                <View
                  style={[
                    styles.letterAvatar,
                    {
                      backgroundColor: isDarkMode
                        ? "rgba(255,255,255,0.05)"
                        : theme.background,
                    },
                  ]}
                >
                  <Text style={[styles.letterText, { color: zTheme.color }]}>
                    {zone.letter}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listZoneTitle}>
                    Zone {zone.letter} —{" "}
                    {zone.dir === "NW"
                      ? "Northwest"
                      : zone.dir === "NE"
                        ? "Northeast"
                        : zone.dir === "SW"
                          ? "Southwest"
                          : "Southeast"}
                  </Text>
                  <Text style={styles.listZoneDesc}>{zone.desc}</Text>
                </View>
                <View
                  style={[
                    styles.liveBadge,
                    {
                      backgroundColor: isDarkMode
                        ? `${zTheme.color}20`
                        : `${zTheme.color}15`,
                    },
                  ]}
                >
                  <Text style={[styles.liveBadgeText, { color: zTheme.color }]}>
                    {zTheme.badgeText}
                  </Text>
                </View>
              </View>

              <View style={styles.progressRow}>
                <View
                  style={[
                    styles.progressBar,
                    { backgroundColor: zTheme.color },
                  ]}
                />
                <View
                  style={[
                    styles.progressBar,
                    { backgroundColor: zTheme.color },
                  ]}
                />
                <View
                  style={[
                    styles.progressBar,
                    { backgroundColor: zTheme.color },
                  ]}
                />
                <View
                  style={[
                    styles.progressBar,
                    {
                      backgroundColor:
                        zone.status === "ON" ? zTheme.color : theme.border,
                    },
                  ]}
                />
              </View>

              <View style={styles.listCardBottom}>
                <Text style={styles.bottomStat}>Uptime {zone.uptime}</Text>
                <Text style={styles.bottomStat}>{zone.time}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const getStyles = (theme: any, isDarkMode: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: Platform.OS === "ios" ? 60 : 30,
      paddingBottom: 10,
    },
    backButton: { marginRight: 16 },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.textPrimary,
      flex: 1,
    },
    countBadge: {
      backgroundColor: isDarkMode ? "rgba(5, 150, 105, 0.2)" : theme.successBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    countText: { color: theme.success, fontSize: 11, fontWeight: "800" },
    estateHeroName: {
      fontSize: 36,
      fontWeight: "800",
      color: theme.textPrimary,
      letterSpacing: -1,
      marginTop: 10,
    },
    estateHeroSub: {
      fontSize: 16,
      color: theme.textSecondary,
      marginBottom: 30,
    },
    sectionLabel: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
      marginBottom: 12,
    },
    zoneGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      backgroundColor: theme.cardBg,
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 30,
    },
    gridCard: {
      width: "48%",
      backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : theme.background,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      alignItems: "center",
      position: "relative",
    },
    statusDot: {
      position: "absolute",
      top: 12,
      right: 12,
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    dirBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.cardBg,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      marginBottom: 8,
    },
    dirText: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.textPrimary,
      marginLeft: 4,
    },
    gridZoneName: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.textPrimary,
      marginBottom: 2,
    },
    gridStatus: { fontSize: 12, fontWeight: "600" },
    listCard: {
      backgroundColor: theme.cardBg,
      borderRadius: 20,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    listCardTop: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    letterAvatar: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    letterText: { fontSize: 18, fontWeight: "800" },
    listZoneTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.textPrimary,
    },
    listZoneDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    liveBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    liveBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
    progressRow: { flexDirection: "row", gap: 4, marginBottom: 12 },
    progressBar: { flex: 1, height: 4, borderRadius: 2 },
    listCardBottom: { flexDirection: "row", justifyContent: "space-between" },
    bottomStat: { fontSize: 12, color: theme.textSecondary, fontWeight: "500" },
  });

export default EstateDetailsScreen;
