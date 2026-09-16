import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  SafeAreaView,
  ActivityIndicator
} from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { supabase } from "../config/supabase";
import { useAllGridDevices, parseStromTimestamp, DEVICE_LOCATIONS } from "../hooks/useDeviceData";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const getRelativeTime = (date: Date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} min${diffInMinutes > 1 ? 's' : ''} ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hr${diffInHours > 1 ? 's' : ''} ago`;
  
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getDateGroup = (date: Date) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return "Earlier";
};

const parseDbAlert = (dbAlert: any) => {
  const type = dbAlert.type?.toLowerCase() || '';
  const title = dbAlert.title || 'System Notification';
  const message = dbAlert.message || '';
  const createdAt = dbAlert.created_at ? new Date(dbAlert.created_at) : new Date();

  let category = 'security';
  let uiType = 'general';
  let bg = '#FEE2E2'; 
  let color = '#EF4444'; 
  let icon = 'shield-alert-outline';

  if (type.includes('emergency') || title.toLowerCase().includes('sos')) {
    category = 'security';
    uiType = 'sos';
    bg = '#FEE2E2'; color = '#EF4444'; icon = 'alert-outline';
  } else if (type.includes('journey') || message.toLowerCase().includes('journey')) {
    category = 'security';
    uiType = 'journey';
    bg = '#D1FAE5'; color = '#10B981'; icon = 'map-marker-outline';
  }

  return {
    id: dbAlert.id || Math.random().toString(),
    type: uiType,
    category,
    title,
    body: message,
    time: getRelativeTime(createdAt),
    dateGroup: getDateGroup(createdAt),
    isUnread: true,
    userColor: color,
    userBg: bg,
    icon: icon,
    rawDate: createdAt
  };
};

const NotificationsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);

  const [activeTab, setActiveTab] = useState<"All" | "Security" | "Power">("All");
  const [supabaseAlerts, setSupabaseAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [persistedOutages, setPersistedOutages] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  // 1. DYNAMIC GRID FEED
  const { devices, loading: devicesLoading } = useAllGridDevices();

  // Load persistent user actions & captured outages
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('strompulse_verified_outages_v1'),
      AsyncStorage.getItem('strompulse_dismissed_alerts'),
      AsyncStorage.getItem('strompulse_read_alerts')
    ]).then(([outageData, dismissedData, readData]) => {
      if (outageData) setPersistedOutages(JSON.parse(outageData));
      if (dismissedData) setDismissedIds(new Set(JSON.parse(dismissedData)));
      if (readData) setReadIds(new Set(JSON.parse(readData)));
      setIsStorageLoaded(true);
    });
  }, []);

  // 2. SUPABASE SECURITY FEED
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      let alertSubscription: any;

      const fetchSupabase = async () => {
        setLoading(true);
        const { data, error } = await supabase
          .from('alerts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30);

        if (!error && data && isMounted) {
          setSupabaseAlerts(data.map(parseDbAlert));
        }
        setLoading(false);

        alertSubscription = supabase
          .channel('public:alerts')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, payload => {
            if (isMounted) {
              setSupabaseAlerts(prev => [parseDbAlert(payload.new), ...prev]);
            }
          })
          .subscribe();
      };

      fetchSupabase();

      return () => {
        isMounted = false;
        if (alertSubscription) supabase.removeChannel(alertSubscription);
      };
    }, [])
  );

  // 3. CAPTURE & RECORD EXACT OUTAGES INTO PERSISTENT STORAGE
  useEffect(() => {
    if (!isStorageLoaded || devicesLoading || devices.length === 0) return;

    setPersistedOutages(prev => {
      const stored = [...prev];
      let hasChanges = false;

      devices.forEach(device => {
        // Record exact historical drop-off times between sessions
        if (device.history) {
          const rawKeys = Object.keys(device.history).sort(); // Oldest to newest

          for (let i = 0; i < rawKeys.length - 1; i++) {
            const currentSessionStart = rawKeys[i];
            const nextSessionRestored = rawKeys[i + 1];
            const historyNode = device.history[currentSessionStart];

            // Resolve exact timestamp when the current session ended
            let exactOutageTime: Date | null = null;
            if (historyNode?.last_seen) {
              exactOutageTime = parseStromTimestamp(historyNode.last_seen);
            } else if (historyNode?.timestamp) {
              exactOutageTime = parseStromTimestamp(historyNode.timestamp);
            } else if (typeof historyNode?.durationSeconds === 'number') {
              const start = parseStromTimestamp(currentSessionStart);
              if (start) exactOutageTime = new Date(start.getTime() + (historyNode.durationSeconds * 1000));
            }

            if (exactOutageTime) {
              const outageId = `outage-hist-${device.id}-${currentSessionStart}`;
              if (!stored.some(e => e.id === outageId)) {
                stored.push({
                  id: outageId,
                  deviceId: device.id,
                  type: 'outage',
                  rawDate: exactOutageTime.toISOString()
                });
                hasChanges = true;
              }
            }
          }
        }

        // Record live outage when heartbeat terminates (>60s)
        if (!device.isOnline && device.connectionState === 'offline') {
          const lastSeen = parseStromTimestamp(device.updated_at) || new Date();
          const liveOutageExactDate = new Date(lastSeen.getTime() + 60000);
          const liveId = `outage-live-${device.id}-${device.updated_at}`;

          if (!stored.some(e => e.id === liveId)) {
            stored.push({
              id: liveId,
              deviceId: device.id,
              type: 'outage',
              rawDate: liveOutageExactDate.toISOString()
            });
            hasChanges = true;
          }
        }
      });

      // Clear phantom live alerts if device has since resumed online status
      const validStored = stored.filter(item => {
        if (item.id.startsWith('outage-live-')) {
          const liveDev = devices.find(d => d.id === item.deviceId);
          if (liveDev && liveDev.isOnline) {
            hasChanges = true;
            return false;
          }
        }
        return true;
      });

      if (hasChanges) {
        const sorted = validStored.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime()).slice(0, 100);
        AsyncStorage.setItem('strompulse_verified_outages_v1', JSON.stringify(sorted));
        return sorted;
      }

      return prev;
    });
  }, [devices, devicesLoading, isStorageLoaded]);

  // 4. GENERATE CARDS WITH VERIFIED TIMESTAMPS
  const derivedPowerAlerts = useMemo(() => {
    const alerts: any[] = [];
    const now = Date.now();

    // A. Parse Restorations directly from Firebase history
    devices.forEach(device => {
      const meta = DEVICE_LOCATIONS[device.id] || { name: device.id, type: "area" };

      if (device.history) {
        Object.keys(device.history).forEach(key => {
          const restoredDate = parseStromTimestamp(key);
          if (!restoredDate) return;

          const isRecent = (now - restoredDate.getTime()) < 15 * 60 * 1000;

          alerts.push({
            id: `power-restored-${device.id}-${key}`,
            type: "restored",
            category: "power",
            title: `Power restored in ${meta.name}`,
            body: `Grid sensors confirm power came back online in ${meta.name}.`,
            time: getRelativeTime(restoredDate),
            dateGroup: getDateGroup(restoredDate),
            isUnread: isRecent,
            userColor: "#00C48A",
            userBg: isDarkMode ? "rgba(0,196,138,0.15)" : "#D1FAE5",
            icon: "lightbulb-on-outline",
            rawDate: restoredDate
          });
        });
      }
    });

    // B. Inject Verified Outages with Danger Red Icons
    persistedOutages.forEach(outage => {
      const meta = DEVICE_LOCATIONS[outage.deviceId] || { name: outage.deviceId, type: "area" };
      const outageDate = new Date(outage.rawDate);
      const isRecent = (now - outageDate.getTime()) < 15 * 60 * 1000;

      alerts.push({
        id: outage.id,
        type: "outage",
        category: "power",
        title: `Power outage in ${meta.name}`,
        body: `Sensors detected an interruption of power in ${meta.name}.`,
        time: getRelativeTime(outageDate),
        dateGroup: getDateGroup(outageDate),
        isUnread: isRecent,
        userColor: "#EF4444",
        userBg: isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2",
        icon: "power-plug-off",
        rawDate: outageDate
      });
    });

    return alerts;
  }, [devices, persistedOutages, isDarkMode]);

  // 5. MERGE, DEDUPLICATE, AND SORT
  const finalNotifications = useMemo(() => {
    return [...supabaseAlerts, ...derivedPowerAlerts]
      .filter(item => !dismissedIds.has(item.id))
      .map(item => ({
        ...item,
        isUnread: readIds.has(item.id) ? false : item.isUnread 
      }))
      .sort((a, b) => new Date(b.rawDate || 0).getTime() - new Date(a.rawDate || 0).getTime());
  }, [supabaseAlerts, derivedPowerAlerts, dismissedIds, readIds]);

  const filteredData = finalNotifications.filter((item) => {
    if (activeTab === "All") return true;
    if (activeTab === "Security" && item.category === "security") return true;
    if (activeTab === "Power" && item.category === "power") return true;
    return false;
  });

  const unreadCounts = useMemo(() => ({
    All: finalNotifications.filter((n) => n.isUnread).length,
    Security: finalNotifications.filter((n) => n.isUnread && n.category === "security").length,
    Power: finalNotifications.filter((n) => n.isUnread && n.category === "power").length,
  }), [finalNotifications]);

  const groupedNotifs = filteredData.reduce((acc, current) => {
    const group = current.dateGroup || "Today";
    if (!acc[group]) acc[group] = [];
    acc[group].push(current);
    return acc;
  }, {} as Record<string, typeof finalNotifications>);

  const formatCount = (count: number) => (count > 99 ? "99+" : `${count}`);

  const renderSegmentedControl = () => (
    <View style={styles.segmentedControlContainer}>
      {(["All", "Security", "Power"] as const).map((tab) => {
        const isActive = activeTab === tab;
        const unreadCount = unreadCounts[tab];
        return (
          <TouchableOpacity
            key={tab}
            activeOpacity={0.8}
            onPress={() => setActiveTab(tab)}
            style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                {tab}
              </Text>
              {unreadCount > 0 && (
                <View style={styles.badgeCountContainer}>
                  <Text style={styles.badgeCountText}>{formatCount(unreadCount)}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}>
            <Feather name="chevron-left" size={26} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>

        {renderSegmentedControl()}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {loading || devicesLoading ? (
            <View style={{ alignItems: "center", marginTop: 60 }}>
               <ActivityIndicator size="large" color="#00C48A" />
               <Text style={{ marginTop: 12, fontFamily: "Chirp-Medium", color: theme.textSecondary }}>Loading notifications...</Text>
            </View>
          ) : Object.keys(groupedNotifs).length === 0 ? (
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <MaterialCommunityIcons name="bell-off-outline" size={48} color={theme.textSecondary} style={{ opacity: 0.5, marginBottom: 12 }} />
              <Text style={{ fontFamily: "Chirp-Medium", color: theme.textSecondary }}>No notifications yet.</Text>
            </View>
          ) : (
            ["Today", "Yesterday", "Earlier"].filter(key => groupedNotifs[key]).map((groupKey) => (
              <View key={groupKey} style={styles.groupContainer}>
                <Text style={styles.dateGroupHeader}>{groupKey}</Text>

               {groupedNotifs[groupKey].map((item: any) => (
                  <TouchableOpacity 
                    key={item.id} 
                    activeOpacity={0.8}
                    style={styles.notificationCard}
                    onPress={() => {
                      const newRead = new Set(readIds).add(item.id);
                      setReadIds(newRead);
                      AsyncStorage.setItem('strompulse_read_alerts', JSON.stringify([...newRead]));
                    }}
                  >
                    <View style={[styles.iconBox, { backgroundColor: item.userBg }]}>
                      <MaterialCommunityIcons name={item.icon as any} size={22} color={item.userColor} />
                    </View>

                    <View style={styles.cardContent}>
                      <View style={styles.cardTopRow}>
                        <Text style={[styles.cardTitle, item.isUnread && styles.cardTitleUnread]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.cardTime}>{item.time}</Text>
                      </View>
                      
                      {/* DYNAMIC HEIGHT FIX: Power gets 2 lines, Security (SOS/Journey) shows full message */}
                      <Text 
                        style={styles.cardBody} 
                        numberOfLines={item.category === 'security' ? undefined : 2}
                      >
                        {item.body}
                      </Text>

                    </View>
                    
                    {item.isUnread && <View style={styles.unreadRightDot} />}
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const getStyles = (theme: any, isDarkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#FFFFFF" },
  safeArea: { flex: 1 },
  
  header: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingTop: Platform.OS === 'android' ? 60 : 30, paddingBottom: 24, position: "relative" },
  backButton: { position: "absolute", left: 24, zIndex: 10, bottom: 24 },
  headerTitle: { fontSize: 18, fontFamily: "Chirp-Bold", color: theme.textPrimary },

  segmentedControlContainer: { flexDirection: "row", backgroundColor: isDarkMode ? "#1A221E" : "#F1F5F9", borderRadius: 12, marginHorizontal: 24, padding: 4, marginBottom: 20 },
  segmentButton: { flex: 1, paddingVertical: 12, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  segmentButtonActive: { backgroundColor: isDarkMode ? "#2D3B34" : "#FFFFFF", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  segmentText: { fontSize: 13, fontFamily: "Chirp-Bold", color: isDarkMode ? "#94A3B8" : "#64748B" },
  segmentTextActive: { color: theme.textPrimary, fontFamily: "Chirp-Heavy" },

  badgeCountContainer: { 
    minWidth: 18, 
    height: 18, 
    borderRadius: 9, 
    backgroundColor: "#EF4444", 
    justifyContent: "center", 
    alignItems: "center", 
    paddingHorizontal: 4, 
    marginLeft: 6 
  },
  badgeCountText: { 
    color: "#FFFFFF", 
    fontSize: 9, 
    fontFamily: "Chirp-Heavy" 
  },

  listContent: { paddingHorizontal: 24, paddingBottom: 40 },
  groupContainer: { marginBottom: 8 },
  
  dateGroupHeader: { fontSize: 13, fontFamily: "Chirp-Bold", color: isDarkMode ? "#64748B" : "#94A3B8", marginBottom: 12, marginTop: 10 },

  notificationCard: { flexDirection: "row", backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#F8FAFC", alignItems: "flex-start" },
  iconBox: { width: 46, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center", marginRight: 14 },
  cardContent: { flex: 1, justifyContent: "center", marginTop: 2 },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardTitle: { fontSize: 14, fontFamily: "Chirp-Bold", color: theme.textPrimary, flex: 1, marginRight: 8 },
  cardTitleUnread: { color: theme.textPrimary },
  cardTime: { fontSize: 11, fontFamily: "Chirp-Medium", color: isDarkMode ? "#64748B" : "#94A3B8" },
  cardBody: { fontSize: 12, fontFamily: "Chirp-Regular", color: isDarkMode ? "#94A3B8" : "#64748B", lineHeight: 18, paddingRight: 8 },
  
  unreadRightDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#00C48A", alignSelf: "center", marginLeft: 4, marginTop: 4 },
});

export default NotificationsScreen;