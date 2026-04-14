/**
 * Communities Screen
 * Matches SRD Dark Theme: Searchable list of communities with compact uptime stats
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
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useCommunities, useCommunityStats } from "../hooks/useDeviceData";
import { Loading, ErrorMessage } from "../components/UIComponents";
import { Community } from "../types";

// Extracted exact colors from your SRD image
const THEME = {
  background: "#12141D",
  cardBg: "#1E202B",
  textPrimary: "#FFFFFF",
  textSecondary: "#8E92A4",
  success: "#00E676", // Bright Green
  error: "#FF3B30", // Bright Red
  warning: "#FFCC00", // Yellow
  border: "#2C2F3F",
};

const FILTER_TABS = ["All", "Estates", "Areas", "Schools", "Markets"];

const CommunitiesScreen: React.FC = () => {
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

    // Safely cast c.type as string to bypass strict TypeScript warnings
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
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={THEME.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search estates, areas..."
          placeholderTextColor={THEME.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTER_TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.activeTabText,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Communities List */}
      {filteredCommunities.length === 0 ? (
        <View style={[styles.container, styles.center]}>
          <MaterialIcons
            name="location-off"
            size={48}
            color={THEME.textSecondary}
          />
          <Text style={{ color: THEME.textSecondary, marginTop: 16 }}>
            No communities match your search.
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
              tintColor={THEME.success}
            />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => <CommunityListItem community={item} />}
        />
      )}
    </View>
  );
};

/**
 * Sleek Row Component (Matches SRD design exactly)
 */
const CommunityListItem: React.FC<{ community: Community }> = ({
  community,
}) => {
  // This hook ensures each row updates in real-time when the simulator flips!
  const { stats } = useCommunityStats(community.id);

  // Determine if community is mostly online or offline
  const isOnline = stats ? stats.uptime_percentage > 50 : true;
  const statusColor = isOnline ? THEME.success : THEME.error;

  return (
    <View style={styles.row}>
      {/* Status Dot */}
      <View style={[styles.dot, { backgroundColor: statusColor }]} />

      {/* Center Details */}
      <View style={styles.rowContent}>
        <Text style={styles.communityName}>{community.name}</Text>
        <Text style={styles.communitySubtext}>
          {community.city || "Ibadan"} • {stats?.total_devices || 0} devices
        </Text>
      </View>

      {/* Right Side Stats */}
      <View style={styles.rowStats}>
        {isOnline ? (
          <>
            <Text style={[styles.statValue, { color: THEME.success }]}>
              {stats?.uptime_percentage || 100}%
            </Text>
            <Text style={styles.statLabel}>uptime</Text>
          </>
        ) : (
          <>
            <Text style={[styles.statValue, { color: THEME.error }]}>OFF</Text>
            <Text style={styles.statLabel}>
              {stats?.current_outage_count || 1} active
            </Text>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.cardBg,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: THEME.textPrimary,
    fontSize: 15,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    paddingVertical: 12,
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginHorizontal: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "transparent",
  },
  activeTab: {
    borderColor: THEME.success,
    backgroundColor: "rgba(0, 230, 118, 0.1)", // Faint green tint
  },
  tabText: {
    color: THEME.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  activeTabText: {
    color: THEME.success,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 16,
  },
  rowContent: {
    flex: 1,
  },
  communityName: {
    color: THEME.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  communitySubtext: {
    color: THEME.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  rowStats: {
    alignItems: "flex-end",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  statLabel: {
    color: THEME.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
});

export default CommunitiesScreen;
