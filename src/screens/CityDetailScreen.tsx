/**
 * Communities Screen
 * Dynamically switches between Light and Dark mode using ThemeContext.
 * Features searchable list of communities with rich visual stats.
 */

import React, { useState } from "react";
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
import { useCommunities, useCommunityStats } from "../hooks/useDeviceData";
import { useTheme } from "../theme/ThemeContext";
import { Loading, ErrorMessage } from "../components/UIComponents";
import { Community } from "../types";

const FILTER_TABS = ["All", "Estates", "Areas", "Schools", "Markets"];

// Maps community types to specific MaterialCommunityIcons
const getCommunityIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case "estate":
      return "home-city-outline";
    case "institution":
      return "school-outline";
    case "commercial":
      return "storefront-outline";
    case "area":
      return "map-marker-radius-outline";
    default:
      return "domain";
  }
};

const CommunitiesScreen: React.FC = () => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme);

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");

  const {
    communities,
    loading: communitiesLoading,
    error: communitiesError,
  } = useCommunities();

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Filter communities based on search and selected tab
  const filteredCommunities = communities.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.city?.toLowerCase().includes(searchQuery.toLowerCase());

    const communityType = c.type as string;

    const matchesTab =
      activeTab === "All" ||
      (activeTab === "Estates" && communityType === "estate") ||
      (activeTab === "Areas" &&
        (communityType === "area" || communityType === "other")) ||
      (activeTab === "Schools" && communityType === "institution") ||
      (activeTab === "Markets" && communityType === "commercial");

    return matchesSearch && matchesTab;
  });

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
          renderItem={({ item }) => <CommunityListItem community={item} />}
        />
      )}
    </View>
  );
};

/**
 * Advanced Floating Card Row
 */
const CommunityListItem: React.FC<{ community: Community }> = ({
  community,
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { stats } = useCommunityStats(community.id);

  // Determine if community is mostly online or offline
  const isOnline = stats ? stats.uptime_percentage > 50 : true;

  const statusConfig = isOnline
    ? { color: theme.success, bgColor: theme.successBg, icon: "lightning-bolt" }
    : { color: theme.error, bgColor: theme.errorBg, icon: "power-plug-off" };

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7}>
      {/* Left Icon Block */}
      <View style={[styles.iconBox, { backgroundColor: theme.background }]}>
        <MaterialCommunityIcons
          name={getCommunityIcon(community.type as string)}
          size={26}
          color={theme.textSecondary}
        />
      </View>

      {/* Center Details */}
      <View style={styles.cardContent}>
        <Text style={styles.communityName} numberOfLines={1}>
          {community.name}
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
            {stats?.total_devices || 0} nodes
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
                {stats?.uptime_percentage || 100}%
              </Text>
            </View>
            <Text style={styles.statLabel}>Uptime</Text>
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
              {stats?.current_outage_count || 1} Outage
              {(stats?.current_outage_count || 1) > 1 ? "s" : ""}
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
