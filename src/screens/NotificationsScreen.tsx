import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  StatusBar,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
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

const parseDbAlert = (dbAlert: any, isDarkMode: boolean) => {
  const type = dbAlert.type?.toLowerCase() || '';
  const title = dbAlert.title || 'System Notification';
  const message = dbAlert.message || '';
  const createdAt = dbAlert.created_at ? new Date(dbAlert.created_at) : new Date();

  let category = 'security';
  let uiType = 'general';
  let bg = isDarkMode ? 'rgba(59,130,246,0.1)' : '#EFF6FF'; 
  let color = '#2563EB'; 
  let icon = 'bell';

  if (type.includes('emergency') || title.toLowerCase().includes('sos')) {
    category = 'security';
    uiType = 'sos';
    bg = isDarkMode ? 'rgba(239,68,68,0.1)' : '#FEE2E2'; 
    color = '#EF4444'; 
    icon = 'alert-circle';
  } else if (type.includes('journey') || message.toLowerCase().includes('journey')) {
    category = 'security';
    uiType = 'journey';
    bg = isDarkMode ? 'rgba(0,196,138,0.1)' : '#ECFDF5'; 
    color = '#00C48A'; 
    icon = 'navigation';
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

  const [activeTab, setActiveTab] = useState<"All" | "Security" | "Power">("All");
  const [supabaseAlerts, setSupabaseAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [persistedOutages, setPersistedOutages] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  // 1. DYNAMIC GRID FEED
  const { devices, loading: devicesLoading } = useAllGridDevices();

  // Dynamic Action Color for Active Segmented Tabs
  const solidActionBg = isDarkMode ? "#FFFFFF" : "#000000";
  const solidActionIcon = isDarkMode ? "#000000" : "#FFFFFF";

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
          setSupabaseAlerts(data.map(alert => parseDbAlert(alert, isDarkMode)));
        }
        setLoading(false);

        alertSubscription = supabase
          .channel('public:alerts')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, payload => {
            if (isMounted) {
              setSupabaseAlerts(prev => [parseDbAlert(payload.new, isDarkMode), ...prev]);
            }
          })
          .subscribe();
      };

      fetchSupabase();

      return () => {
        isMounted = false;
        if (alertSubscription) supabase.removeChannel(alertSubscription);
      };
    }, [isDarkMode])
  );

  // 3. CAPTURE & RECORD EXACT OUTAGES INTO PERSISTENT STORAGE
  useEffect(() => {
    if (!isStorageLoaded || devicesLoading || devices.length === 0) return;

    setPersistedOutages(prev => {
      const stored = [...prev];
      let hasChanges = false;

      devices.forEach(device => {
        if (device.history) {
          const rawKeys = Object.keys(device.history).sort();

          for (let i = 0; i < rawKeys.length - 1; i++) {
            const currentSessionStart = rawKeys[i];
            const historyNode = device.history[currentSessionStart];

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
            userBg: isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5",
            icon: "zap",
            rawDate: restoredDate
          });
        });
      }
    });

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
        icon: "zap-off",
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
    <XStack marginHorizontal={24} marginBottom={24} justifyContent="space-between" gap={8}>
      {(["All", "Security", "Power"] as const).map((tab) => {
        const isActive = activeTab === tab;
        const unreadCount = unreadCounts[tab];
        return (
          <TouchableOpacity
            key={tab}
            activeOpacity={0.8}
            onPress={() => setActiveTab(tab)}
            style={{ flex: 1 }}
          >
            <XStack
              paddingVertical={10}
              alignItems="center"
              justifyContent="center"
              borderRadius={24}
              borderWidth={1}
              borderColor={isActive ? "transparent" : (isDarkMode ? "#2D3B34" : "#E2E8F0")}
              backgroundColor={isActive ? solidActionBg : "transparent"}
            >
              <TText fontFamily={isActive ? "Chirp-Heavy" : "Chirp-Bold"} fontSize={12} color={isActive ? solidActionIcon : (isDarkMode ? "#64748B" : "#94A3B8")}>
                {tab}
              </TText>
              {unreadCount > 0 && (
                <YStack
                  minWidth={16}
                  height={16}
                  borderRadius={8}
                  backgroundColor="#EF4444"
                  justifyContent="center"
                  alignItems="center"
                  paddingHorizontal={4}
                  marginLeft={6}
                >
                  <TText color="#FFFFFF" fontSize={9} fontFamily="Chirp-Heavy">
                    {formatCount(unreadCount)}
                  </TText>
                </YStack>
              )}
            </XStack>
          </TouchableOpacity>
        );
      })}
    </XStack>
  );

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* --- MINIMALIST HEADER --- */}
        <XStack justifyContent="center" alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={20} position="relative">
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={{ position: "absolute", left: 24, padding: 8, zIndex: 10 }}
          >
            <Feather name="arrow-left" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <TText fontSize={18} fontFamily="Chirp-Heavy" color={theme.textPrimary}>Notifications</TText>
        </XStack>

        {renderSegmentedControl()}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}>
          {loading || devicesLoading ? (
            <YStack alignItems="center" marginTop={60}>
               <ActivityIndicator size="small" color="#00C48A" />
               <TText marginTop={12} fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary}>Loading notifications...</TText>
            </YStack>
          ) : Object.keys(groupedNotifs).length === 0 ? (
            <YStack alignItems="center" marginTop={60}>
              <Feather name="bell-off" size={32} color={theme.textSecondary} style={{ opacity: 0.5, marginBottom: 12 }} />
              <TText fontFamily="Chirp-Medium" fontSize={14} color={theme.textSecondary}>No notifications yet.</TText>
            </YStack>
          ) : (
            ["Today", "Yesterday", "Earlier"].filter(key => groupedNotifs[key]).map((groupKey) => (
              <YStack key={groupKey} marginBottom={24}>
                <TText fontSize={11} fontFamily="Chirp-Bold" letterSpacing={1.5} color={theme.textSecondary} marginBottom={12} marginLeft={4}>{groupKey.toUpperCase()}</TText>

                {/* --- CLASSIC LIST GROUP FOR EACH DAY --- */}
                <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                  {groupedNotifs[groupKey].map((item: any, index: number) => (
                    <TouchableOpacity 
                      key={item.id} 
                      activeOpacity={0.7}
                      onPress={() => {
                        const newRead = new Set(readIds).add(item.id);
                        setReadIds(newRead);
                        AsyncStorage.setItem('strompulse_read_alerts', JSON.stringify([...newRead]));
                      }}
                    >
                      <XStack 
                        padding={16} 
                        alignItems="flex-start" 
                        borderBottomWidth={index === groupedNotifs[groupKey].length - 1 ? 0 : 1} 
                        borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}
                      >
                        <YStack width={40} height={40} borderRadius={20} backgroundColor={item.userBg} justifyContent="center" alignItems="center" marginRight={16}>
                          <Feather name={item.icon as any} size={18} color={item.userColor} />
                        </YStack>

                        <YStack flex={1} justifyContent="center" marginTop={2}>
                          <XStack justifyContent="space-between" alignItems="center" marginBottom={4}>
                            <TText fontSize={15} fontFamily="Chirp-Heavy" color={theme.textPrimary} flex={1} marginRight={8} numberOfLines={1}>
                              {item.title}
                            </TText>
                            <TText fontSize={11} fontFamily="Chirp-Medium" color={theme.textSecondary}>{item.time}</TText>
                          </XStack>
                          
                          <TText 
                            fontSize={13} 
                            fontFamily="Chirp-Regular" 
                            color={theme.textSecondary} 
                            lineHeight={18} 
                            paddingRight={8}
                            numberOfLines={item.category === 'security' ? undefined : 2}
                          >
                            {item.body}
                          </TText>
                        </YStack>
                        
                        {item.isUnread && (
                          <YStack width={8} height={8} borderRadius={4} backgroundColor="#00C48A" alignSelf="center" marginLeft={8} />
                        )}
                      </XStack>
                    </TouchableOpacity>
                  ))}
                </YStack>
              </YStack>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default NotificationsScreen;