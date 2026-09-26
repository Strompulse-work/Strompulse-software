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
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
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
  let color = '#3B82F6'; 
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

  const [activeTab, setActiveTab] = useState<"All" | "Security" | "Electricity">("All");
  const [supabaseAlerts, setSupabaseAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [persistedOutages, setPersistedOutages] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  const { devices, loading: devicesLoading } = useAllGridDevices();

  const solidActionBg = isDarkMode ? "#FFFFFF" : "#000000";
  const solidActionIcon = isDarkMode ? "#000000" : "#FFFFFF";

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
            deviceId: device.id,
            type: "restored",
            category: "electricity",
            title: `Power restored • ${meta.name}`,
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
        deviceId: outage.deviceId,
        type: "outage",
        category: "electricity",
        title: `Power outage • ${meta.name}`,
        body: `Sensors confirmed a power cut. IBEDC notified.`,
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

  const finalNotifications = useMemo(() => {
    return [...supabaseAlerts, ...derivedPowerAlerts]
      .filter(item => !dismissedIds.has(item.id))
      .map(item => ({
        ...item,
        isUnread: readIds.has(item.id) ? false : item.isUnread 
      }))
      .sort((a, b) => new Date(b.rawDate || 0).getTime() - new Date(a.rawDate || 0).getTime());
  }, [supabaseAlerts, derivedPowerAlerts, dismissedIds, readIds]);

  // FIXED: Isolate the latest active SOS regardless of read status (so it doesn't disappear when leaving the screen)
  const activeSosAlert = finalNotifications.find(n => n.type === 'sos');
  
  const standardNotifications = finalNotifications.filter((item) => {
    if (activeSosAlert && item.id === activeSosAlert.id) return false;
    if (activeTab === "All") return true;
    if (activeTab === "Security" && item.category === "security") return true;
    if (activeTab === "Electricity" && item.category === "electricity") return true;
    return false;
  });

  const unreadCounts = useMemo(() => ({
    All: finalNotifications.filter((n) => n.isUnread).length,
    Security: finalNotifications.filter((n) => n.isUnread && n.category === "security").length,
    Electricity: finalNotifications.filter((n) => n.isUnread && n.category === "electricity").length,
  }), [finalNotifications]);

  const groupedNotifs = standardNotifications.reduce((acc, current) => {
    const group = current.dateGroup || "Today";
    if (!acc[group]) acc[group] = [];
    acc[group].push(current);
    return acc;
  }, {} as Record<string, typeof standardNotifications>);

  const formatCount = (count: number) => (count > 99 ? "99+" : `${count}`);

  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      if (finalNotifications.length > 0) {
        setReadIds(prevReadIds => {
          const newReadIds = new Set(prevReadIds);
          let changed = false;
          finalNotifications.forEach(n => {
            if (!newReadIds.has(n.id)) {
              newReadIds.add(n.id);
              changed = true;
            }
          });
          if (changed) {
            AsyncStorage.setItem('strompulse_read_alerts', JSON.stringify([...newReadIds]));
          }
          return newReadIds;
        });
      }
    });
    return unsubscribe;
  }, [navigation, finalNotifications]);

  const handleDismissSos = async (id: string) => {
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    setDismissedIds(newDismissed);
    
    const newRead = new Set(readIds);
    newRead.add(id);
    setReadIds(newRead);
    
    await AsyncStorage.setItem('strompulse_dismissed_alerts', JSON.stringify([...newDismissed]));
    await AsyncStorage.setItem('strompulse_read_alerts', JSON.stringify([...newRead]));
  };

  const renderSegmentedControl = () => (
    <XStack marginHorizontal={24} marginBottom={24} justifyContent="space-between" gap={8}>
      {(["All", "Security", "Electricity"] as const).map((tab) => {
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

  const renderCardIcon = (item: any) => {
    if (item.type === 'journey') {
      const initial = item.title.charAt(0).toUpperCase();
      return (
        <YStack position="relative" marginRight={14}>
          <YStack width={44} height={44} borderRadius={22} backgroundColor={isDarkMode ? "#1A221E" : "#F1F5F9"} justifyContent="center" alignItems="center">
            <TText fontSize={18} fontFamily="Chirp-Heavy" color={isDarkMode ? "#94A3B8" : "#64748B"}>{initial}</TText>
          </YStack>
          <YStack position="absolute" bottom={-2} right={-2} width={16} height={16} borderRadius={8} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} justifyContent="center" alignItems="center" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"}>
            <Feather name="map-pin" size={8} color="#EF4444" />
          </YStack>
        </YStack>
      );
    }
    
    return (
      <YStack position="relative" marginRight={14}>
        <YStack width={44} height={44} borderRadius={22} backgroundColor={item.userBg} justifyContent="center" alignItems="center">
          <Feather name={item.icon} size={20} color={item.userColor} />
        </YStack>
        <YStack position="absolute" top={0} left={0} width={10} height={10} borderRadius={5} backgroundColor={item.userColor} borderWidth={2} borderColor={isDarkMode ? "#121A16" : "#FFFFFF"} />
      </YStack>
    );
  };

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} />

      <SafeAreaView style={{ flex: 1 }}>
        <XStack justifyContent="center" alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={20} position="relative">
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={{ position: "absolute", left: 24, padding: 8, zIndex: 10 }}
          >
            <Feather name="arrow-left" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <TText style={{ fontFamily: "SoraTitle-Bold", fontSize: 16 }} color={theme.textPrimary}>Notifications</TText>
        </XStack>

        {renderSegmentedControl()}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}>
          
          {/* --- ACTIVE SOS COMPONENT --- */}
          {activeSosAlert && (activeTab === "All" || activeTab === "Security") && (
            <YStack 
              backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} 
              borderRadius={24} 
              padding={20} 
              marginBottom={24} 
              borderWidth={2} 
              borderColor="#EF4444"
              shadowColor="#EF4444"
              shadowOffset={{ width: 0, height: 4 }}
              shadowOpacity={0.15}
              shadowRadius={12}
              elevation={8}
            >
              <XStack justifyContent="space-between" alignItems="flex-start" marginBottom={16}>
                <XStack alignItems="center" flex={1}>
                  <YStack position="relative" marginRight={12}>
                    <YStack width={44} height={44} borderRadius={12} backgroundColor={isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2"} justifyContent="center" alignItems="center">
                      <YStack width={26} height={26} borderRadius={6} backgroundColor="#EF4444" justifyContent="center" alignItems="center">
                        <TText fontSize={9} fontFamily="Chirp-Heavy" color="#FFFFFF">SOS</TText>
                      </YStack>
                    </YStack>
                    <YStack position="absolute" top={-4} left={-4} width={12} height={12} borderRadius={6} backgroundColor="#EF4444" borderWidth={2} borderColor={isDarkMode ? "#121A16" : "#FFFFFF"} />
                  </YStack>

                  <YStack flex={1}>
                    <XStack alignItems="center" marginBottom={4}>
                      <YStack backgroundColor="rgba(239,68,68,0.15)" paddingHorizontal={6} paddingVertical={2} borderRadius={6} marginRight={8}>
                        <TText color="#EF4444" fontSize={9} fontFamily="Chirp-Bold" letterSpacing={0.5}>EMERGENCY</TText>
                      </YStack>
                    </XStack>
                    <TText fontSize={16} fontFamily="Chirp-Heavy" color={theme.textPrimary}>{activeSosAlert.title}</TText>
                  </YStack>
                </XStack>
                <TText fontSize={11} fontFamily="Chirp-Medium" color={theme.textSecondary}>{activeSosAlert.time}</TText>
              </XStack>

              <TText fontSize={13} fontFamily="Chirp-Medium" color={theme.textSecondary} lineHeight={20} marginBottom={20}>
                {activeSosAlert.body}
              </TText>

              <XStack gap={12}>
                <TouchableOpacity 
                  style={{ flex: 2 }}
                  onPress={() => {
                    navigation.navigate("LiveTrackingScreen", { 
                      senderName: activeSosAlert.title.replace('SOS from ', ''),
                      initialLat: 7.5186, 
                      initialLng: 4.5266
                    });
                  }}
                >
                  <XStack backgroundColor="#EF4444" borderRadius={16} paddingVertical={14} justifyContent="center" alignItems="center">
                    <Feather name="map-pin" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <TText fontSize={14} fontFamily="Chirp-Bold" color="#FFFFFF">View Location</TText>
                  </XStack>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={{ flex: 1 }}
                  onPress={() => handleDismissSos(activeSosAlert.id)}
                >
                  <YStack backgroundColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} borderRadius={16} paddingVertical={14} justifyContent="center" alignItems="center">
                    <TText fontSize={14} fontFamily="Chirp-Bold" color={theme.textSecondary}>Dismiss</TText>
                  </YStack>
                </TouchableOpacity>
              </XStack>
            </YStack>
          )}

          {loading || devicesLoading ? (
            <YStack alignItems="center" marginTop={60}>
               <ActivityIndicator size="small" color="#00C48A" />
               <TText marginTop={12} fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary}>Loading notifications...</TText>
            </YStack>
          ) : Object.keys(groupedNotifs).length === 0 && !activeSosAlert ? (
            <YStack alignItems="center" marginTop={60}>
              <Feather name="bell-off" size={32} color={theme.textSecondary} style={{ opacity: 0.5, marginBottom: 12 }} />
              <TText fontFamily="Chirp-Medium" fontSize={14} color={theme.textSecondary}>No notifications yet.</TText>
            </YStack>
          ) : (
            ["Today", "Yesterday", "Earlier"].filter(key => groupedNotifs[key]).map((groupKey) => (
              <YStack key={groupKey} marginBottom={24}>
                <TText fontSize={11} fontFamily="Chirp-Bold" letterSpacing={1.5} color={theme.textSecondary} marginBottom={12} marginLeft={4}>{groupKey.toUpperCase()}</TText>

                <YStack>
                  {groupedNotifs[groupKey].map((item: any) => {
                    
                    let cardBorderColor = isDarkMode ? "#2D3B34" : "#E2E8F0";

                    return (
                      <XStack 
                        key={item.id}
                        backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"}
                        borderRadius={20}
                        padding={16}
                        marginBottom={12}
                        borderWidth={1}
                        borderColor={cardBorderColor}
                        alignItems="flex-start" 
                        opacity={item.isUnread ? 1 : (isDarkMode ? 0.6 : 0.55)}
                      >
                        {/* ICON */}
                        {renderCardIcon(item)}

                        {/* CONTENT */}
                        <YStack flex={1} marginTop={2}>
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
                            lineHeight={20}
                            paddingRight={4}
                          >
                            {item.body}
                          </TText>

                          {/* ACTION PILL BUTTONS (Clickable even when faded) */}
                          {item.type === 'journey' && (
                            <TouchableOpacity 
                              onPress={() => navigation.navigate("LiveTrackingScreen", { 
                                senderName: item.title.replace(' started a journey', ''),
                                initialLat: 7.5186,
                                initialLng: 4.5266
                              })}
                            >
                              <XStack paddingHorizontal={14} paddingVertical={6} borderRadius={16} borderWidth={1} borderColor="#00C48A" alignSelf="flex-start" marginTop={12}>
                                <TText fontFamily="Chirp-Bold" fontSize={11} color="#00C48A">Track Journey</TText>
                              </XStack>
                            </TouchableOpacity>
                          )}

                          {(item.type === 'outage' || item.type === 'restored') && (
                            <TouchableOpacity 
                              onPress={() => navigation.navigate("CommunityZonesScreen", { 
                                areaId: item.deviceId, 
                                areaName: item.title.split(' • ')[1] 
                              })}
                            >
                              <XStack paddingHorizontal={14} paddingVertical={6} borderRadius={16} borderWidth={1} borderColor={item.userColor} alignSelf="flex-start" marginTop={12}>
                                <TText fontFamily="Chirp-Bold" fontSize={11} color={item.userColor}>View Status</TText>
                              </XStack>
                            </TouchableOpacity>
                          )}
                        </YStack>
                        
                        {/* UNREAD GREEN DOT */}
                        {item.isUnread && (
                          <YStack width={8} height={8} borderRadius={4} backgroundColor="#00C48A" alignSelf="center" marginLeft={8} />
                        )}
                      </XStack>
                    );
                  })}
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