/**
 * Communities Screen
 * Dynamically switches between Light and Dark mode using ThemeContext.
 * Features searchable list of communities with real-time Firebase integration.
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
import { useCommunities, useCommunityStats, useUserDevices } from "../hooks/useDeviceData";
import { useTheme } from "../theme/ThemeContext";
import { Loading, ErrorMessage } from "../components/UIComponents";
import { Community } from "../types";

const FILTER_TABS = ["All", "Estates", "Areas", "Schools", "Markets"];

// Maps community types to specific MaterialCommunityIcons
const getCommunityIcon = (type: string, name: string) => {
  const nameLower = name?.toLowerCase() || "";
  if (nameLower.includes("ui campus")) return "school-outline";
  if (nameLower.includes("mokola")) return "storefront-outline";
  if (nameLower.includes("jericho")) return "home-city-outline";
  if (nameLower.includes("ring road")) return "map-marker-radius-outline";
  return "domain";
};

const CommunitiesScreen: React.FC = () => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme);

  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");

  // 1. Fetch user session
  useEffect(() => {
    const getUser = async () => {
      const session = await AuthService.getCurrentSession();
      if (session) setUser(session.user);
    };
    getUser();
  }, []);

  const {
    communities,
    loading: communitiesLoading,
    error: communitiesError,
  } = useCommunities();

  // 2. Fetch real-time Firebase devices
  const { devices } = useUserDevices(user?.id || "");
  const stromDevice = devices.find((d) => d.id === "STROM001");

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Filter communities based on search and strict selected tab rules
  const filteredCommunities = communities.filter((c) => {
    const nameLower = c.name.toLowerCase();
    
    const matchesSearch =
      nameLower.includes(searchQuery.toLowerCase()) ||
      c.city?.toLowerCase().includes(searchQuery.toLowerCase());

    // Strict Tab Enforcement
    let matchesTab = false;
    
    if (activeTab === "All") {
      matchesTab = true;
    } else if (activeTab === "Estates") {
      // Show Jericho, plus any other general estates
      matchesTab = nameLower.includes("jericho") || (c as any).type === "estate";
    
    } else if (activeTab === "Schools") {
      // ONLY show UI Campus
      matchesTab = nameLower.includes("ui campus");
    } else if (activeTab === "Markets") {
      // ONLY show Mokola
      matchesTab = nameLower.includes("mokola");
    } else if (activeTab === "Areas") {
      // ONLY show Ring Road
      matchesTab = nameLower.includes("ring road");
    }

    return matchesSearch && matchesTab;
  });

  // PREVENT DUPLICATES: Find the exact index for Jericho, or default to 0 if it doesn't exist
  const jerichoIndex = filteredCommunities.findIndex((c) => 
    c.name?.toLowerCase().includes("jericho")
  );
  const targetJerichoIndex = jerichoIndex !== -1 ? jerichoIndex : 0;

  if (communitiesLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Loading />
      </View>
    );
  }

  if (communitiesError) {
    return (
      <View style={[styles.container, styles.center]}>
        <ErrorMessage message={communitiesError} />
      </View>
    );
  }

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

      {/* Premium Filter Tabs */}
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

      {/* Communities List */}
      {filteredCommunities.length === 0 ? (
        <View style={[styles.container, styles.center]}>
          <MaterialCommunityIcons
            name="map-search-outline"
            size={64}
            color={theme.textTertiary}
          />
          <Text
            style={{ color: theme.textSecondary, marginTop: 16, fontSize: 16 }}
          >
            No locations match your search.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredCommunities}
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
          renderItem={({ item, index }) => (
            <CommunityListItem 
              community={item} 
              stromDevice={stromDevice} 
              isJericho={index === targetJerichoIndex && item.name.toLowerCase().includes("jericho")} 
            />
          )}
        />
      )}
    </View>
  );
};

/**
 * Advanced Floating Card Row - Hooked up to Firebase Real-time Data
 */
const CommunityListItem: React.FC<{ community: Community; stromDevice: any; isJericho: boolean }> = ({
  community,
  stromDevice,
  isJericho
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { stats } = useCommunityStats(community.id);
  
  // Default all dummies to "ON"
  let isOnline = true; 
  let nodeCount = stats?.total_devices || (isJericho ? 1 : Math.floor(Math.random() * 5) + 2); 

  // If this is the ONE specific Jericho card, override with real-time Firebase data!
  if (isJericho && stromDevice) {
    const rawStatus = String(stromDevice.status).toLowerCase().trim();
    isOnline = rawStatus === "1" || rawStatus === "true" || rawStatus === "on";
  }

  const displayName = isJericho ? "Jericho Quarters" : community.name;

  const statusConfig = isOnline
    ? { color: theme.success, bgColor: theme.successBg, icon: "lightning-bolt" }
    : { color: theme.error, bgColor: theme.errorBg, icon: "power-plug-off" };

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7}>
      {/* Left Icon Block */}
      <View style={[styles.iconBox, { backgroundColor: theme.background }]}>
        <MaterialCommunityIcons
          name={getCommunityIcon(community.type as string, community.name)}
          size={26}
          color={theme.textSecondary}
        />
      </View>

      {/* Center Details */}
      <View style={styles.cardContent}>
        <Text style={styles.communityName} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={styles.metadataRow}>
          <Ionicons
            name="location-outline"
            size={14}
            color={theme.textSecondary}
          />
          <Text style={styles.communitySubtext}>
            {community.city || "Ibadan"}
          </Text>
          <Text style={styles.bulletPoint}>•</Text>
          <MaterialCommunityIcons
            name="chip"
            size={14}
            color={theme.textSecondary}
          />
          <Text style={styles.communitySubtext}>
            {nodeCount} node{nodeCount > 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {/* Right Side Rich Stats */}
      <View style={styles.cardStats}>
        {isOnline ? (
          <>
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
                ON
              </Text>
            </View>
            <Text style={styles.statLabel}>POWER RESTORED</Text>
          </>
        ) : (
          <>
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
                OFF
              </Text>
            </View>
            <Text style={[styles.statLabel, { color: theme.error }]}>
              POWER OUTAGE
            </Text>
          </>
        )}
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
      fontWeight: "800",
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
      fontWeight: "500",
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
      backgroundColor: theme.textPrimary, // Inverts based on theme
      borderColor: theme.textPrimary,
    },
    tabText: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },
    activeTabText: {
      color: theme.background, // Text becomes the background color for perfect contrast
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
      fontWeight: "700",
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
      fontWeight: "500",
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
      fontWeight: "800",
      marginLeft: 4,
    },
    statLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
  });

export default CommunitiesScreen;