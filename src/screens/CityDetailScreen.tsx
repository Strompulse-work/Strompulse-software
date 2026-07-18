/**
 * CityDetailsScreen
 * Dynamically switches between Light and Dark mode using ThemeContext.
 * Features searchable list of communities with global real-time Firebase integration.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  TextInput,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import { MaterialCommunityIcons, Ionicons, Feather } from "@expo/vector-icons";
import AuthService from "../services/authService";
import { useAllGridDevices } from "../hooks/useDeviceData";
import { useTheme } from "../theme/ThemeContext";
import { Loading, ErrorMessage } from "../components/UIComponents";

const FILTER_TABS = ["All", "Estates", "Areas", "Schools"];

// --- GLOBAL HARDWARE TO LOCATION MAPPING ---
const DEVICE_LOCATIONS: Record<string, { name: string; type: string }> = {
  "STROM001": { name: "Jericho Quarters", type: "estate" },
  "STROM002": { name: "Agodi GRA", type: "estate" },
  "STROM003": { name: "Bodija Estate", type: "estate" },
  "STROM004": { name: "Challenge", type: "area" },
  "STROM005": { name: "Mokola", type: "area" },
  "STROM006": { name: "Oluyole Estate", type: "estate" },
  "STROM007": { name: "Ring Road Area", type: "area" },
  "STROM008": { name: "UI Campus", type: "school" },
  "STROM009": { name: "Mapo Hall", type: "area" },
  "STROM010": { name: "Eleyele", type: "area" },
};

// Maps community regions to specific MaterialCommunityIcons
const getCommunityIcon = (type: string, name: string) => {
  const nameLower = name?.toLowerCase() || "";
  if (type === "school" || nameLower.includes("campus") || nameLower.includes("ui")) return "school-outline";
  if (nameLower.includes("quarters") || nameLower.includes("jericho")) return "home-city-outline";
  if (type === "estate") return "domain";
  return "map-marker-radius-outline";
};

const CityDetailsScreen: React.FC = () => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme);

  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");

  useEffect(() => {
    const getUser = async () => {
      const session = await AuthService.getCurrentSession();
      if (session) setUser(session.user);
    };
    getUser();
  }, []);

  const {
    devices,
    loading: devicesLoading,
    error: devicesError,
  } = useAllGridDevices();

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (devicesLoading && devices.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Loading />
      </View>
    );
  }

  if (devicesError) {
    return (
      <View style={[styles.container, styles.center]}>
        <ErrorMessage message={devicesError} />
      </View>
    );
  }

  // Synchronize internal hardware arrays with localized dictionaries
  const gridItems = Object.keys(DEVICE_LOCATIONS).map((id) => {
    const liveDevice = devices.find((d) => d.id === id);
    const meta = DEVICE_LOCATIONS[id];
    
    return {
      id,
      name: meta.name,
      type: meta.type,
      city: "Ibadan",
      status: liveDevice ? liveDevice.status : 0,
      voltage: liveDevice ? liveDevice.voltage : 0,
    };
  });

  // Filter global regions based on search queries and selected category filter tabs
  const filteredGrid = gridItems.filter((item) => {
    const nameLower = item.name.toLowerCase();
    const queryLower = searchQuery.toLowerCase();
    
    const matchesSearch = nameLower.includes(queryLower) || item.city.toLowerCase().includes(queryLower);

    let matchesTab = false;
    if (activeTab === "All") {
      matchesTab = true;
    } else if (activeTab === "Estates") {
      matchesTab = item.type === "estate";
    } else if (activeTab === "Areas") {
      matchesTab = item.type === "area";
    } else if (activeTab === "Schools") {
      matchesTab = item.type === "school";
    }

    return matchesSearch && matchesTab;
  });

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />

      {/* Header Title */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Grid Regions</Text>
      </View>

      {/* Advanced Search Bar */}
      <View style={styles.searchContainer}>
        <Feather
          name="search"
          size={20}
          color={theme.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search estates, regions, schools..."
          placeholderTextColor={theme.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons
              name="close-circle"
              size={20}
              color={theme.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, isActive && styles.activeTab]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.tabText, isActive && styles.activeTabText]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Region Grid List */}
      {filteredGrid.length === 0 ? (
        <View style={[styles.container, styles.center]}>
          <MaterialCommunityIcons
            name="map-search-outline"
            size={64}
            color={theme.textTertiary}
          />
          <Text
            style={{ color: theme.textSecondary, marginTop: 16, fontSize: 16, fontFamily: "Sora_400Regular" }}
          >
            No locations match your search.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredGrid}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.success}
            />
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <RegionListItem region={item} />
          )}
        />
      )}
    </View>
  );
};

/**
 * Advanced Floating Card Row - Hooked up directly to Global Real-time Hardware Metrics
 */
const RegionListItem: React.FC<{ region: any }> = ({ region }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  
  const rawStatus = String(region.status).toLowerCase().trim();
  const isOnline = rawStatus === "1" || rawStatus === "true" || rawStatus === "on";

  const statusConfig = isOnline
    ? { color: theme.success, bgColor: theme.successBg, icon: "lightning-bolt", label: "ON" }
    : { color: theme.error, bgColor: theme.errorBg, icon: "power-plug-off", label: "OFF" };

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7}>
      {/* Left Icon Block */}
      <View style={[styles.iconBox, { backgroundColor: theme.background }]}>
        <MaterialCommunityIcons
          name={getCommunityIcon(region.type, region.name)}
          size={26}
          color={theme.textSecondary}
        />
      </View>

      {/* Center Details */}
      <View style={styles.cardContent}>
        <Text style={styles.communityName} numberOfLines={1}>
          {region.name}
        </Text>
        <View style={styles.metadataRow}>
          <Ionicons
            name="location-outline"
            size={14}
            color={theme.textSecondary}
          />
          <Text style={styles.communitySubtext}>
            {region.city}
          </Text>
          <Text style={styles.bulletPoint}>•</Text>
          <MaterialCommunityIcons
            name="chip"
            size={14}
            color={theme.textSecondary}
          />

        </View>
      </View>

      {/* Right Side Rich Stats */}
      <View style={styles.cardStats}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusConfig.bgColor },
          ]}
        >
          <MaterialCommunityIcons
            name={statusConfig.icon as any}
            size={14}
            color={statusConfig.color}
          />
          <Text style={[styles.statValue, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
        <Text style={[styles.statLabel, !isOnline && { color: theme.error }]}>
          {isOnline ? "POWER RESTORED" : "POWER OUTAGE"}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// Generate styles dynamically based on the injected theme
const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    center: {
      justifyContent: "center",
      alignItems: "center",
    },
    headerContainer: {
      paddingHorizontal: 20,
      paddingTop: Platform.OS === "ios" ? 50 : 20,
      paddingBottom: 10,
    },
    headerTitle: {
      fontSize: 28,
      fontFamily: "Sora_800ExtraBold",
      color: theme.textPrimary,
      letterSpacing: -0.5,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.cardBg,
      marginHorizontal: 20,
      marginTop: 8,
      marginBottom: 16,
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 52,
      borderWidth: 1,
      borderColor: theme.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    searchIcon: {
      marginRight: 10,
    },
    searchInput: {
      flex: 1,
      color: theme.textPrimary,
      fontSize: 16,
      fontFamily: "Sora_500Medium",
    },
    tabsContainer: {
      marginBottom: 12,
    },
    tabsScrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    tab: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      marginHorizontal: 4,
      borderRadius: 24,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    activeTab: {
      backgroundColor: theme.textPrimary,
      borderColor: theme.textPrimary,
    },
    tabText: {
      color: theme.textSecondary,
      fontSize: 14,
      fontFamily: "Sora_600SemiBold",
    },
    activeTabText: {
      color: theme.background,
    },
    listContainer: {
      paddingHorizontal: 20,
      paddingBottom: 100,
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
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    iconBox: {
      width: 52,
      height: 52,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
    },
    cardContent: {
      flex: 1,
      justifyContent: "center",
    },
    communityName: {
      color: theme.textPrimary,
      fontSize: 17,
      fontFamily: "Sora_700Bold",
      marginBottom: 6,
      letterSpacing: -0.2,
    },
    metadataRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    communitySubtext: {
      color: theme.textSecondary,
      fontSize: 13,
      fontFamily: "Sora_500Medium",
      marginLeft: 4,
    },
    bulletPoint: {
      color: theme.textTertiary,
      marginHorizontal: 6,
      fontSize: 12,
    },
    cardStats: {
      alignItems: "flex-end",
      justifyContent: "center",
      marginLeft: 12,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 14,
      fontFamily: "Sora_800ExtraBold",
      marginLeft: 4,
    },
    statLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontFamily: "Sora_600SemiBold",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
  });

export default CityDetailsScreen;