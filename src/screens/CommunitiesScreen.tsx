/**
 * Communities Screen
 * Shows list of communities with aggregated statistics
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useCommunities, useCommunityStats } from "../hooks/useDeviceData";
import {
  CommunityItem,
  Loading,
  ErrorMessage,
  SectionHeader,
} from "../components/UIComponents";
import { Colors, GlobalStyles, Spacing } from "../styles/theme";
import { Community, CommunityStats } from "../types";

const CommunitiesScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(
    null,
  );
  const [communityStatsMap, setCommunityStatsMap] = useState<
    Map<string, CommunityStats | null>
  >(new Map());

  // Fetch communities
  const {
    communities,
    loading: communitiesLoading,
    error: communitiesError,
  } = useCommunities();

  // Set first community as selected
  useEffect(() => {
    if (communities.length > 0 && !selectedCommunityId) {
      setSelectedCommunityId(communities[0].id);
    }
  }, [communities, selectedCommunityId]);

  // Fetch stats for all communities
  useEffect(() => {
    const statsMap = new Map<string, CommunityStats | null>();
    communities.forEach((community) => {
      // We'll use a simple hook approach per community
      statsMap.set(community.id, null);
    });
    setCommunityStatsMap(statsMap);
  }, [communities]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Trigger refetch
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (communitiesLoading) {
    return (
      <View style={[GlobalStyles.container, GlobalStyles.center]}>
        <Loading />
      </View>
    );
  }

  if (communitiesError) {
    return (
      <View style={GlobalStyles.container}>
        <ErrorMessage message={communitiesError} />
      </View>
    );
  }

  if (communities.length === 0) {
    return (
      <View style={[GlobalStyles.container, GlobalStyles.center]}>
        <MaterialIcons
          name="location-city"
          size={64}
          color={Colors.text.tertiary}
        />
        <Text
          style={[
            GlobalStyles.h3,
            { marginTop: Spacing.lg, color: Colors.text.secondary },
          ]}
        >
          No Communities Found
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={GlobalStyles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Communities List */}
      <SectionHeader title="Communities" />

      <FlatList
        data={communities}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <CommunityDetailView
            community={item}
            isSelected={selectedCommunityId === item.id}
            onSelect={() => setSelectedCommunityId(item.id)}
          />
        )}
      />

      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
};

/**
 * Individual Community Detail Component
 */
interface CommunityDetailViewProps {
  community: Community;
  isSelected: boolean;
  onSelect: () => void;
}

const CommunityDetailView: React.FC<CommunityDetailViewProps> = ({
  community,
  isSelected,
  onSelect,
}) => {
  const { stats, loading } = useCommunityStats(community.id);

  return (
    <TouchableOpacity
      style={[
        GlobalStyles.card,
        styles.communityCard,
        isSelected && styles.communityCardSelected,
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={GlobalStyles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={GlobalStyles.h3}>{community.name}</Text>
          <Text style={[GlobalStyles.bodySmall, { marginTop: Spacing.xs }]}>
            {community.city}, {community.state}
          </Text>
        </View>
        {stats && (
          <View style={styles.statusIndicator}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    stats.status_indicator === "healthy"
                      ? Colors.success
                      : stats.status_indicator === "warning"
                        ? Colors.warning
                        : Colors.error,
                },
              ]}
            />
          </View>
        )}
      </View>

      {isSelected && (
        <View style={{ marginTop: Spacing.lg }}>
          {loading ? (
            <View style={{ paddingVertical: Spacing.lg }}>
              <Loading size={40} />
            </View>
          ) : stats ? (
            <>
              {/* Device Count */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <MaterialIcons
                    name="devices"
                    size={20}
                    color={Colors.primary}
                  />
                  <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                    <Text style={GlobalStyles.label}>Total Devices</Text>
                    <Text style={GlobalStyles.h3}>{stats.total_devices}</Text>
                  </View>
                </View>
                <View style={styles.statItem}>
                  <MaterialIcons
                    name="check-circle"
                    size={20}
                    color={Colors.success}
                  />
                  <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                    <Text style={GlobalStyles.label}>Online</Text>
                    <Text style={GlobalStyles.h3}>{stats.devices_online}</Text>
                  </View>
                </View>
              </View>

              {/* Uptime and Status */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <MaterialIcons
                    name="trending-up"
                    size={20}
                    color={Colors.info}
                  />
                  <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                    <Text style={GlobalStyles.label}>Uptime</Text>
                    <Text style={GlobalStyles.h3}>
                      {stats.uptime_percentage}%
                    </Text>
                  </View>
                </View>
                <View style={styles.statItem}>
                  <MaterialIcons
                    name="warning"
                    size={20}
                    color={Colors.warning}
                  />
                  <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                    <Text style={GlobalStyles.label}>Active Outages</Text>
                    <Text style={GlobalStyles.h3}>
                      {stats.current_outage_count}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(stats.uptime_percentage, 100)}%`,
                        backgroundColor:
                          stats.status_indicator === "healthy"
                            ? Colors.success
                            : stats.status_indicator === "warning"
                              ? Colors.warning
                              : Colors.error,
                      },
                    ]}
                  />
                </View>
                <Text style={[GlobalStyles.caption, { marginTop: Spacing.xs }]}>
                  Community Health: {stats.uptime_percentage}%
                </Text>
              </View>
            </>
          ) : (
            <Text style={[GlobalStyles.body, { color: Colors.text.secondary }]}>
              Unable to load statistics
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  communityCard: {
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
  },
  communityCardSelected: {
    backgroundColor: "#f0f9ff",
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  statusIndicator: {
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginVertical: Spacing.sm,
  },
  statItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.backgroundDark,
    padding: Spacing.md,
    borderRadius: 8,
  },
  progressContainer: {
    marginTop: Spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.backgroundDark,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
});

export default CommunitiesScreen;
