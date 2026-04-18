import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Platform,
} from "react-native";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useCommunities, useCommunityStats } from "../hooks/useDeviceData";
import { useTheme } from "../theme/ThemeContext";

const CityCommunitiesScreen = ({ route, navigation }: any) => {
  const { city } = route.params;
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);
  const [searchQuery, setSearchQuery] = useState("");
  const { communities } = useCommunities();

  const filtered = communities.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{city}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filtered.length} AREAS</Text>
        </View>
      </View>

      {/* Aggregate Stats Header */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: theme.success }]}>31</Text>
          <Text style={styles.statLabel}>ONLINE</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: theme.warning }]}>9</Text>
          <Text style={styles.statLabel}>PARTIAL</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: theme.error }]}>8</Text>
          <Text style={styles.statLabel}>OFFLINE</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Feather
          name="search"
          size={20}
          color={theme.textSecondary}
          style={{ marginRight: 10 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search community..."
          placeholderTextColor={theme.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <Text style={styles.sectionLabel}>ESTATES & COMMUNITIES</Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <CommunityRow
            community={item}
            navigation={navigation}
            theme={theme}
          />
        )}
      />
    </View>
  );
};

const CommunityRow = ({ community, navigation, theme }: any) => {
  const { stats } = useCommunityStats(community.id);
  const isOnline = stats ? stats.uptime_percentage > 50 : true;
  const statusColor = isOnline ? theme.success : theme.error;

  return (
    <TouchableOpacity
      style={[styles(theme, false).card]}
      onPress={() => navigation.navigate("EstateDetails", { community })}
    >
      <View style={[styles(theme, false).iconBox]}>
        <MaterialCommunityIcons
          name="home-city-outline"
          size={24}
          color={theme.textSecondary}
        />
      </View>
      <View style={styles(theme, false).cardContent}>
        <Text style={styles(theme, false).communityName} numberOfLines={1}>
          {community.name}
        </Text>
        <Text style={styles(theme, false).subtext}>
          {community.city || "Ibadan"} • 4 zones
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: statusColor, fontSize: 12, fontWeight: "800" }}>
          {isOnline ? "ONLINE" : "OFFLINE"}
        </Text>
        <Text style={styles(theme, false).subtext}>4 zones</Text>
      </View>
    </TouchableOpacity>
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
      paddingBottom: 20,
    },
    backButton: { marginRight: 16 },
    headerTitle: {
      fontSize: 24,
      fontWeight: "800",
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
    statsRow: {
      flexDirection: "row",
      marginHorizontal: 20,
      backgroundColor: theme.cardBg,
      borderRadius: 16,
      paddingVertical: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 20,
    },
    statBox: { flex: 1, alignItems: "center" },
    statDivider: { width: 1, backgroundColor: theme.border },
    statNum: { fontSize: 24, fontWeight: "800" },
    statLabel: {
      fontSize: 10,
      color: theme.textSecondary,
      fontWeight: "700",
      marginTop: 4,
      letterSpacing: 0.5,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.cardBg,
      marginHorizontal: 20,
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 52,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 20,
    },
    searchInput: { flex: 1, color: theme.textPrimary, fontSize: 16 },
    sectionLabel: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
      marginLeft: 20,
      marginBottom: 12,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.cardBg,
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    iconBox: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.background,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
    },
    cardContent: { flex: 1 },
    communityName: {
      color: theme.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 4,
    },
    subtext: { color: theme.textSecondary, fontSize: 13, fontWeight: "500" },
  });
const styles = getStyles;
export default CityCommunitiesScreen;
