import React, { useState, useCallback, useMemo, useEffect } from "react";
import { StatusBar, Platform, SafeAreaView, ActivityIndicator, ScrollView, TouchableOpacity, Alert } from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { supabase } from "../config/supabase";
import { useAllGridDevices, parseStromTimestamp } from "../hooks/useDeviceData";
import { DEVICE_LOCATIONS } from "../constants/gridLocations";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMyIdentity, isAlertForMe } from "../utils/myIdentity";
import { markNotificationsSeen, notifyNotificationsChanged, READ_KEY, DISMISSED_KEY } from "../utils/notificationCenter";



const getRelativeTime = (date: Date) => {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "Just now";
  const m = Math.floor(diff / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
};

const getDateGroup = (date: Date) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return "Earlier";
};

// Pull coordinates out of the alert's data payload, or out of the Google Maps link inside the message text.
const extractCoords = (dbAlert: any, message: string) => {
  const meta = dbAlert.data || dbAlert.metadata || dbAlert.payload || {};
  const lat = meta.lat ?? meta.latitude;
  const lng = meta.lng ?? meta.longitude;
  if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  const match = message.match(/maps\.google\.com\/\?q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  return null;
};

const stripLinks = (message: string) => message.replace(/\s*https?:\/\/\S+/g, "").trim();

const parseDbAlert = (dbAlert: any, isDarkMode: boolean) => {
  const type = dbAlert.type?.toLowerCase() || "";
  const title = dbAlert.title || "System Notification";
  const message = dbAlert.message || "";
  const createdAt = dbAlert.created_at ? new Date(dbAlert.created_at) : new Date();
  const meta = dbAlert.data || dbAlert.metadata || dbAlert.payload || {};

  let uiType = "general";
  let bg = isDarkMode ? "rgba(59,130,246,0.1)" : "#EFF6FF";
  let color = "#3B82F6";
  let icon = "bell";
  let senderName = meta.senderName || meta.sender_name || "";

  const isDelay = meta.kind === "delay" || (type.includes("emergency") && !title.toLowerCase().includes("sos"));
  if (isDelay) {
    uiType = "delay"; bg = isDarkMode ? "rgba(245,158,11,0.12)" : "#FEF3C7"; color = "#F59E0B"; icon = "clock";
    if (!senderName) senderName = title.replace(/^🚨\s*/, "").replace(/('s journey is delayed| hasn't arrived)$/i, "").trim();
  } else if (type.includes("emergency") || title.toLowerCase().includes("sos")) {
    uiType = "sos"; bg = isDarkMode ? "rgba(239,68,68,0.1)" : "#FEE2E2"; color = "#EF4444"; icon = "alert-circle";
    if (!senderName) senderName = title.replace(/^.*?(SOS alert from|SOS from)\s*/i, "").replace(/^🚨\s*/, "").trim();
  } else if (type.includes("journey_end")) {
    uiType = "journey_end"; bg = isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"; color = "#00C48A"; icon = "check-circle";
  } else if (type.includes("journey") || message.toLowerCase().includes("journey")) {
    uiType = "journey"; bg = isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"; color = "#00C48A"; icon = "navigation";
    if (!senderName) senderName = title.replace(/ started a journey$/i, "").trim();
  } else if (type.includes("location")) {
    uiType = "location"; bg = isDarkMode ? "rgba(59,130,246,0.1)" : "#EFF6FF"; color = "#3B82F6"; icon = "map-pin";
    if (!senderName) senderName = title.replace(/ shared their location$/i, "").trim();
  }

  return {
    id: dbAlert.id || `${title}-${createdAt.getTime()}`,
    type: uiType,
    category: "security",
    title,
    body: stripLinks(message),
    time: getRelativeTime(createdAt),
    dateGroup: getDateGroup(createdAt),
    isUnread: true,
    userColor: color,
    userBg: bg,
    icon,
    rawDate: createdAt,
    // Always the real sender's account id (never matched by name, so two people called "Tunde" can't get mixed up)
    senderId: dbAlert.user_id || dbAlert.sender_id || meta.senderId || null,
    senderName: senderName || "Contact",
    coords: extractCoords(dbAlert, message),
    groupName: meta.groupName || null,
    recipientNames: Array.isArray(meta.recipientNames) ? meta.recipientNames : [],
    purpose: meta.purpose || null,
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
  const [missingPhone, setMissingPhone] = useState(false);

  const { devices, loading: devicesLoading } = useAllGridDevices();

  const solidActionBg = isDarkMode ? "#FFFFFF" : "#000000";
  const solidActionIcon = isDarkMode ? "#000000" : "#FFFFFF";

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("strompulse_verified_outages_v1"),
      AsyncStorage.getItem("strompulse_dismissed_alerts"),
      AsyncStorage.getItem("strompulse_read_alerts"),
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
      let alertSubscription: any = null;

      // Only alerts addressed to MY phone number (and not sent by me) are shown.
      // The database enforces the same rule (see alerts_recipients_only.sql); this is a second safety net.
      const start = async () => {
        const me = await getMyIdentity();
        if (!isMounted) return;
        setMissingPhone(!!me.userId && !me.phoneKey);

        // Subscribe FIRST so no time-sensitive SOS insert is missed while the initial fetch runs
        alertSubscription = supabase
          .channel(`alerts-${me.userId || "anon"}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, (payload) => {
            if (!isMounted || !isAlertForMe(payload.new, me)) return;
            const parsed = parseDbAlert(payload.new, isDarkMode);
            setSupabaseAlerts((prev) => (prev.some((a) => a.id === parsed.id) ? prev : [parsed, ...prev]));
          })
          .subscribe();

        const { data, error } = await supabase
          .from("alerts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        if (!error && data && isMounted) {
          setSupabaseAlerts(data.filter((a) => isAlertForMe(a, me)).slice(0, 40).map((a) => parseDbAlert(a, isDarkMode)));
        }
        if (isMounted) setLoading(false);
      };
      start().catch(() => { if (isMounted) setLoading(false); });

      // Viewing this tab clears the badge (and the app-icon badge)
      markNotificationsSeen();

      return () => {
        isMounted = false;
        markNotificationsSeen();
        if (alertSubscription) supabase.removeChannel(alertSubscription);
      };
    }, [isDarkMode])
  );

  useEffect(() => {
    if (!isStorageLoaded || devicesLoading || devices.length === 0) return;
    setPersistedOutages((prev) => {
      const stored = [...prev];
      let hasChanges = false;

      devices.forEach((device) => {
        if (device.history) {
          const rawKeys = Object.keys(device.history).sort();
          for (let i = 0; i < rawKeys.length - 1; i++) {
            const sessionStart = rawKeys[i];
            const node = device.history[sessionStart];
            let outageTime: Date | null = null;
            if (node?.last_seen) outageTime = parseStromTimestamp(node.last_seen);
            else if (node?.timestamp) outageTime = parseStromTimestamp(node.timestamp);
            else if (typeof node?.durationSeconds === "number") {
              const start = parseStromTimestamp(sessionStart);
              if (start) outageTime = new Date(start.getTime() + node.durationSeconds * 1000);
            }
            if (outageTime) {
              const outageId = `outage-hist-${device.id}-${sessionStart}`;
              if (!stored.some((e) => e.id === outageId)) {
                stored.push({ id: outageId, deviceId: device.id, type: "outage", rawDate: outageTime.toISOString() });
                hasChanges = true;
              }
            }
          }
        }
        if (!device.isOnline && device.connectionState === "offline") {
          const lastSeen = parseStromTimestamp(device.updated_at) || new Date();
          const liveId = `outage-live-${device.id}-${device.updated_at}`;
          if (!stored.some((e) => e.id === liveId)) {
            stored.push({ id: liveId, deviceId: device.id, type: "outage", rawDate: new Date(lastSeen.getTime() + 60000).toISOString() });
            hasChanges = true;
          }
        }
      });

      const validStored = stored.filter((item) => {
        if (item.id.startsWith("outage-live-")) {
          const liveDev = devices.find((d) => d.id === item.deviceId);
          if (liveDev && liveDev.isOnline) { hasChanges = true; return false; }
        }
        return true;
      });

      if (hasChanges) {
        const sorted = validStored.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime()).slice(0, 100);
        AsyncStorage.setItem("strompulse_verified_outages_v1", JSON.stringify(sorted));
        return sorted;
      }
      return prev;
    });
  }, [devices, devicesLoading, isStorageLoaded]);

  const derivedPowerAlerts = useMemo(() => {
    const alerts: any[] = [];
    const now = Date.now();
    devices.forEach((device) => {
      const meta = (DEVICE_LOCATIONS as any)[device.id] || { name: device.id, type: "area" };
      if (device.history) {
        Object.keys(device.history).forEach((key) => {
          const restoredDate = parseStromTimestamp(key);
          if (!restoredDate) return;
          alerts.push({
            id: `power-restored-${device.id}-${key}`, deviceId: device.id, areaName: meta.name,
            type: "restored", category: "electricity",
            title: `Power restored • ${meta.name}`,
            body: `Grid sensors confirm power came back online in ${meta.name}.`,
            time: getRelativeTime(restoredDate), dateGroup: getDateGroup(restoredDate),
            isUnread: now - restoredDate.getTime() < 15 * 60 * 1000,
            userColor: "#00C48A", userBg: isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5", icon: "zap", rawDate: restoredDate,
          });
        });
      }
    });
    persistedOutages.forEach((outage) => {
      const meta = (DEVICE_LOCATIONS as any)[outage.deviceId] || { name: outage.deviceId, type: "area" };
      const outageDate = new Date(outage.rawDate);
      alerts.push({
        id: outage.id, deviceId: outage.deviceId, areaName: meta.name,
        type: "outage", category: "electricity",
        title: `Power outage • ${meta.name}`,
        body: `Sensors confirmed a power cut. IBEDC notified.`,
        time: getRelativeTime(outageDate), dateGroup: getDateGroup(outageDate),
        isUnread: now - outageDate.getTime() < 15 * 60 * 1000,
        userColor: "#EF4444", userBg: isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2", icon: "zap-off", rawDate: outageDate,
      });
    });
    return alerts;
  }, [devices, persistedOutages, isDarkMode]);

  const finalNotifications = useMemo(() => {
    return [...supabaseAlerts, ...derivedPowerAlerts]
      .filter((item) => !dismissedIds.has(item.id))
      .map((item) => ({ ...item, isUnread: readIds.has(item.id) ? false : item.isUnread }))
      .sort((a, b) => new Date(b.rawDate || 0).getTime() - new Date(a.rawDate || 0).getTime());
  }, [supabaseAlerts, derivedPowerAlerts, dismissedIds, readIds]);

  // Big box: always shown on All/Security — latest SOS + latest journey share, or an empty state
  const activeSosAlert = finalNotifications.find((n) => n.type === "sos");
  const activeJourneyAlert = finalNotifications.find((n) => n.type === "journey");
  const showFeatured = activeTab === "All" || activeTab === "Security";

  const standardNotifications = finalNotifications.filter((item) => {
    if (showFeatured && activeSosAlert && item.id === activeSosAlert.id) return false;
    if (showFeatured && activeJourneyAlert && item.id === activeJourneyAlert.id) return false;
    if (activeTab === "All") return true;
    if (activeTab === "Security") return item.category === "security";
    return item.category === "electricity";
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
  }, {} as Record<string, any[]>);

  const formatCount = (count: number) => (count > 99 ? "99+" : `${count}`);

  useEffect(() => {
    const unsubscribe = navigation.addListener("blur", () => {
      if (finalNotifications.length === 0) return;
      setReadIds((prev) => {
        const next = new Set(prev);
        let changed = false;
        finalNotifications.forEach((n) => { if (!next.has(n.id)) { next.add(n.id); changed = true; } });
        if (changed) AsyncStorage.setItem(READ_KEY, JSON.stringify([...next])).then(notifyNotificationsChanged);
        return next;
      });
    });
    return unsubscribe;
  }, [navigation, finalNotifications]);

  const handleDismissSos = async (id: string) => {
    const newDismissed = new Set(dismissedIds); newDismissed.add(id); setDismissedIds(newDismissed);
    const newRead = new Set(readIds); newRead.add(id); setReadIds(newRead);
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify([...newDismissed]));
    await AsyncStorage.setItem(READ_KEY, JSON.stringify([...newRead]));
    notifyNotificationsChanged();
  };

  // "Track Journey" → live journey map · "View Location" on SOS → emergency live-location map
  const openTracking = (item: any, mode: "journey" | "sos" | "location") => {
    if (mode === "journey" && !item.senderId) {
      Alert.alert("Journey unavailable", `We couldn't find ${item.senderName}'s live journey.`);
      return;
    }
    if (mode !== "journey" && !item.coords && !item.senderId) {
      Alert.alert("Location not shared", `${item.senderName} didn't include a location with this alert. Try calling them directly.`);
      return;
    }
    // Opening it counts as reading it
    setReadIds((prev) => {
      if (prev.has(item.id)) return prev;
      const next = new Set(prev); next.add(item.id);
      AsyncStorage.setItem(READ_KEY, JSON.stringify([...next])).then(notifyNotificationsChanged);
      return next;
    });
    navigation.navigate("LiveTrackingScreen", {
      mode,
      senderName: item.senderName,
      senderId: item.senderId,
      initialLat: item.coords?.lat,
      initialLng: item.coords?.lng,
      alertTime: item.rawDate ? new Date(item.rawDate).toISOString() : undefined,
      alertMessage: item.body,
      groupName: item.groupName,
      recipientNames: item.recipientNames,
      purpose: item.purpose,
    });
  };

  const sharedWithText = (item: any) => {
    const n = item.recipientNames?.length || 0;
    if (item.groupName) return `Shared with ${item.groupName}${n ? ` · ${n} people` : ""}`;
    if (n > 1) return `Also sent to ${n - 1} other${n - 1 === 1 ? "" : "s"}`;
    return null;
  };

  const renderSegmentedControl = () => (
    <XStack marginHorizontal={24} marginBottom={24} justifyContent="space-between" gap={8}>
      {(["All", "Security", "Electricity"] as const).map((tab) => {
        const isActive = activeTab === tab;
        const unreadCount = unreadCounts[tab];
        return (
          <TouchableOpacity key={tab} activeOpacity={0.8} onPress={() => setActiveTab(tab)} style={{ flex: 1 }}>
            <XStack paddingVertical={10} alignItems="center" justifyContent="center" borderRadius={24} borderWidth={1} borderColor={isActive ? "transparent" : (isDarkMode ? "#2D3B34" : "#E2E8F0")} backgroundColor={isActive ? solidActionBg : "transparent"}>
              <TText fontFamily={isActive ? "Chirp-Heavy" : "Chirp-Bold"} fontSize={12} color={isActive ? solidActionIcon : (isDarkMode ? "#64748B" : "#94A3B8")}>{tab}</TText>
              {unreadCount > 0 && (
                <YStack minWidth={16} height={16} borderRadius={8} backgroundColor="#EF4444" justifyContent="center" alignItems="center" paddingHorizontal={4} marginLeft={6}>
                  <TText color="#FFFFFF" fontSize={9} fontFamily="Chirp-Heavy">{formatCount(unreadCount)}</TText>
                </YStack>
              )}
            </XStack>
          </TouchableOpacity>
        );
      })}
    </XStack>
  );

  const renderCardIcon = (item: any) => {
    if (item.type === "journey") {
      return (
        <YStack position="relative" marginRight={14}>
          <YStack width={44} height={44} borderRadius={22} backgroundColor={isDarkMode ? "#1A221E" : "#F1F5F9"} justifyContent="center" alignItems="center">
            <TText fontSize={18} fontFamily="Chirp-Heavy" color={isDarkMode ? "#94A3B8" : "#64748B"}>{item.senderName.charAt(0).toUpperCase()}</TText>
          </YStack>
          <YStack position="absolute" bottom={-2} right={-2} width={16} height={16} borderRadius={8} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} justifyContent="center" alignItems="center" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"}>
            <Feather name="navigation" size={8} color="#00C48A" />
          </YStack>
        </YStack>
      );
    }
    return (
      <YStack position="relative" marginRight={14}>
        <YStack width={44} height={44} borderRadius={22} backgroundColor={item.userBg} justifyContent="center" alignItems="center">
          <Feather name={item.icon} size={20} color={item.userColor} />
        </YStack>
      </YStack>
    );
  };

  const ActionPill = ({ label, color, onPress, icon, solid }: any) => (
    <TouchableOpacity onPress={onPress}>
      <XStack paddingHorizontal={14} paddingVertical={7} borderRadius={16} borderWidth={1} borderColor={color} backgroundColor={solid ? color : "transparent"} alignSelf="flex-start" marginTop={12} alignItems="center" gap={6}>
        {icon && <Feather name={icon} size={12} color={solid ? "#FFFFFF" : color} />}
        <TText fontFamily="Chirp-Bold" fontSize={11} color={solid ? "#FFFFFF" : color}>{label}</TText>
      </XStack>
    </TouchableOpacity>
  );

  const showInitialLoader = loading && supabaseAlerts.length === 0 && derivedPowerAlerts.length === 0;

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} />
      <SafeAreaView style={{ flex: 1 }}>
        <XStack justifyContent="center" alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={20}>
          <TText style={{ fontFamily: "SoraTitle-Bold", fontSize: 18 }} color={theme.textPrimary}>Notifications</TText>
        </XStack>

        {renderSegmentedControl()}

        {missingPhone && (
          <TouchableOpacity onPress={() => navigation.navigate("LinkPhone")} style={{ marginHorizontal: 24, marginBottom: 16 }}>
            <XStack backgroundColor={isDarkMode ? "rgba(245,158,11,0.12)" : "#FEF3C7"} borderRadius={16} padding={12} alignItems="center" gap={10}>
              <Feather name="alert-circle" size={16} color="#F59E0B" />
              <TText flex={1} fontFamily="Chirp-Bold" fontSize={12} color={theme.textPrimary}>Verify your phone number so your contacts' SOS and journey alerts can reach you. Tap to add it.</TText>
            </XStack>
          </TouchableOpacity>
        )}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}>
          {showFeatured && (
            <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} marginBottom={24} borderWidth={1.5} borderColor={activeSosAlert ? "#EF4444" : activeJourneyAlert ? "#00C48A" : (isDarkMode ? "#2D3B34" : "#E2E8F0")} overflow="hidden" shadowColor={activeSosAlert ? "#EF4444" : "#00C48A"} shadowOffset={{ width: 0, height: 4 }} shadowOpacity={0.12} shadowRadius={12} elevation={6}>
              {/* --- SOS half --- */}
              {activeSosAlert && (
                <YStack padding={18} backgroundColor={isDarkMode ? "rgba(239,68,68,0.06)" : "#FFF7F7"}>
                  <XStack justifyContent="space-between" alignItems="center" marginBottom={10}>
                    <XStack alignItems="center" gap={8}>
                      <YStack width={26} height={26} borderRadius={7} backgroundColor="#EF4444" justifyContent="center" alignItems="center">
                        <TText fontSize={8} fontFamily="Chirp-Heavy" color="#FFFFFF">SOS</TText>
                      </YStack>
                      <TText color="#EF4444" fontSize={10} fontFamily="Chirp-Bold" letterSpacing={1}>EMERGENCY · {activeSosAlert.time.toUpperCase()}</TText>
                    </XStack>
                    <TouchableOpacity onPress={() => handleDismissSos(activeSosAlert.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Feather name="x" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </XStack>
                  <TText fontSize={15} fontFamily="Chirp-Heavy" color={theme.textPrimary} marginBottom={4}>{activeSosAlert.title}</TText>
                  <TText fontSize={12} fontFamily="Chirp-Medium" color={theme.textSecondary} lineHeight={18} numberOfLines={3}>{activeSosAlert.body}</TText>
                  {!!sharedWithText(activeSosAlert) && (
                    <XStack alignItems="center" gap={5} marginTop={6}>
                      <Feather name="users" size={11} color={theme.textSecondary} />
                      <TText fontSize={11} fontFamily="Chirp-Medium" color={theme.textSecondary}>{sharedWithText(activeSosAlert)}</TText>
                    </XStack>
                  )}
                  <TouchableOpacity onPress={() => openTracking(activeSosAlert, "sos")} style={{ marginTop: 12 }}>
                    <XStack backgroundColor="#EF4444" borderRadius={14} paddingVertical={12} justifyContent="center" alignItems="center" gap={8}>
                      <Feather name="map-pin" size={15} color="#FFFFFF" />
                      <TText fontSize={14} fontFamily="Chirp-Bold" color="#FFFFFF">View Location</TText>
                    </XStack>
                  </TouchableOpacity>
                </YStack>
              )}

              {!activeSosAlert && (
                <YStack padding={18}>
                  <XStack alignItems="center" gap={8} marginBottom={8}>
                    <YStack width={26} height={26} borderRadius={7} backgroundColor={isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2"} justifyContent="center" alignItems="center">
                      <TText fontSize={8} fontFamily="Chirp-Heavy" color="#EF4444">SOS</TText>
                    </YStack>
                    <TText color="#EF4444" fontSize={10} fontFamily="Chirp-Bold" letterSpacing={1}>SOS ALERTS</TText>
                  </XStack>
                  <TText fontSize={14} fontFamily="Chirp-Heavy" color={theme.textPrimary} marginBottom={2}>No SOS alerts</TText>
                  <TText fontSize={12} fontFamily="Chirp-Medium" color={theme.textSecondary} lineHeight={18}>
                    If someone who added you as an emergency contact sends an SOS, it appears here with their live location.
                  </TText>
                  <XStack marginTop={12} backgroundColor={isDarkMode ? "#1A221E" : "#F1F5F9"} borderRadius={14} paddingVertical={12} justifyContent="center" alignItems="center" gap={8} opacity={0.7}>
                    <Feather name="map-pin" size={15} color={theme.textSecondary} />
                    <TText fontSize={14} fontFamily="Chirp-Bold" color={theme.textSecondary}>View Location</TText>
                  </XStack>
                </YStack>
              )}

              <YStack height={1} backgroundColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} />

              {/* --- Journey share half --- */}
              {activeJourneyAlert && (
                <YStack padding={18}>
                  <XStack justifyContent="space-between" alignItems="center" marginBottom={10}>
                    <XStack alignItems="center" gap={8}>
                      <YStack width={26} height={26} borderRadius={13} backgroundColor="#00C48A" justifyContent="center" alignItems="center">
                        <Feather name="navigation" size={12} color="#FFF" />
                      </YStack>
                      <TText color="#00C48A" fontSize={10} fontFamily="Chirp-Bold" letterSpacing={1}>JOURNEY SHARE · {activeJourneyAlert.time.toUpperCase()}</TText>
                    </XStack>
                    <TouchableOpacity onPress={() => handleDismissSos(activeJourneyAlert.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Feather name="x" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </XStack>
                  <TText fontSize={15} fontFamily="Chirp-Heavy" color={theme.textPrimary} marginBottom={4}>{activeJourneyAlert.title}</TText>
                  <TText fontSize={12} fontFamily="Chirp-Medium" color={theme.textSecondary} lineHeight={18} numberOfLines={3}>{activeJourneyAlert.body}</TText>
                  {!!sharedWithText(activeJourneyAlert) && (
                    <XStack alignItems="center" gap={5} marginTop={6}>
                      <Feather name="users" size={11} color={theme.textSecondary} />
                      <TText fontSize={11} fontFamily="Chirp-Medium" color={theme.textSecondary}>{sharedWithText(activeJourneyAlert)}</TText>
                    </XStack>
                  )}
                  <TouchableOpacity onPress={() => openTracking(activeJourneyAlert, "journey")} style={{ marginTop: 12 }}>
                    <XStack backgroundColor="#00C48A" borderRadius={14} paddingVertical={12} justifyContent="center" alignItems="center" gap={8}>
                      <Feather name="navigation" size={15} color="#FFFFFF" />
                      <TText fontSize={14} fontFamily="Chirp-Bold" color="#FFFFFF">Follow the Journey</TText>
                    </XStack>
                  </TouchableOpacity>
                </YStack>
              )}
              {!activeJourneyAlert && (
                <YStack padding={18}>
                  <XStack alignItems="center" gap={8} marginBottom={8}>
                    <YStack width={26} height={26} borderRadius={13} backgroundColor={isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5"} justifyContent="center" alignItems="center">
                      <Feather name="navigation" size={12} color="#00C48A" />
                    </YStack>
                    <TText color="#00C48A" fontSize={10} fontFamily="Chirp-Bold" letterSpacing={1}>JOURNEY SHARE</TText>
                  </XStack>
                  <TText fontSize={14} fontFamily="Chirp-Heavy" color={theme.textPrimary} marginBottom={2}>No journeys shared with you</TText>
                  <TText fontSize={12} fontFamily="Chirp-Medium" color={theme.textSecondary} lineHeight={18}>
                    When a contact or community shares a journey with you, you can follow their live movement from here.
                  </TText>
                  <XStack marginTop={12} backgroundColor={isDarkMode ? "#1A221E" : "#F1F5F9"} borderRadius={14} paddingVertical={12} justifyContent="center" alignItems="center" gap={8} opacity={0.7}>
                    <Feather name="navigation" size={15} color={theme.textSecondary} />
                    <TText fontSize={14} fontFamily="Chirp-Bold" color={theme.textSecondary}>Follow the Journey</TText>
                  </XStack>
                </YStack>
              )}
            </YStack>
          )}

          {showInitialLoader ? (
            <YStack alignItems="center" marginTop={60}>
              <ActivityIndicator size="small" color="#00C48A" />
              <TText marginTop={12} fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary}>Loading notifications...</TText>
            </YStack>
          ) : Object.keys(groupedNotifs).length === 0 && !showFeatured ? (
            <YStack alignItems="center" marginTop={60}>
              {activeTab === "Electricity" && devicesLoading ? <ActivityIndicator size="small" color="#00C48A" /> : (
                <>
                  <Feather name="bell-off" size={32} color={theme.textSecondary} style={{ opacity: 0.5, marginBottom: 12 }} />
                  <TText fontFamily="Chirp-Medium" fontSize={14} color={theme.textSecondary}>No notifications yet.</TText>
                </>
              )}
            </YStack>
          ) : (
            ["Today", "Yesterday", "Earlier"].filter((key) => groupedNotifs[key]).map((groupKey) => (
              <YStack key={groupKey} marginBottom={24}>
                <TText fontSize={11} fontFamily="Chirp-Bold" letterSpacing={1.5} color={theme.textSecondary} marginBottom={12} marginLeft={4}>{groupKey.toUpperCase()}</TText>
                {groupedNotifs[groupKey].map((item: any) => (
                  <XStack key={item.id} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={20} padding={16} marginBottom={12} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} alignItems="flex-start" opacity={item.isUnread ? 1 : (isDarkMode ? 0.6 : 0.55)}>
                    {renderCardIcon(item)}
                    <YStack flex={1} marginTop={2}>
                      <XStack justifyContent="space-between" alignItems="center" marginBottom={4}>
                        <TText fontSize={15} fontFamily="Chirp-Heavy" color={theme.textPrimary} flex={1} marginRight={8} numberOfLines={1}>{item.title}</TText>
                        <TText fontSize={11} fontFamily="Chirp-Medium" color={theme.textSecondary}>{item.time}</TText>
                      </XStack>
                      <TText fontSize={13} fontFamily="Chirp-Regular" color={theme.textSecondary} lineHeight={20} paddingRight={4}>{item.body}</TText>

                      {!!sharedWithText(item) && <TText fontSize={11} fontFamily="Chirp-Medium" color={theme.textSecondary} marginTop={4}>{sharedWithText(item)}</TText>}
                      {item.type === "journey" && <ActionPill label="Follow the Journey" icon="navigation" color="#00C48A" solid onPress={() => openTracking(item, "journey")} />}
                      {item.type === "delay" && <ActionPill label="View Location" icon="clock" color="#F59E0B" solid onPress={() => openTracking(item, "journey")} />}
                      {item.type === "journey_end" && <ActionPill label="View Journey" icon="flag" color="#00C48A" onPress={() => openTracking(item, "journey")} />}
                      {item.type === "location" && <ActionPill label="View Location" icon="map-pin" color="#3B82F6" onPress={() => openTracking(item, "location")} />}
                      {item.type === "sos" && <ActionPill label="View Location" icon="alert-triangle" color="#EF4444" solid onPress={() => openTracking(item, "sos")} />}
                      {(item.type === "outage" || item.type === "restored") && (
                        <ActionPill label="View Status" color={item.userColor} onPress={() => navigation.navigate("CommunityZonesScreen", { areaId: item.deviceId, areaName: item.areaName })} />
                      )}
                    </YStack>
                    {item.isUnread && <YStack width={8} height={8} borderRadius={4} backgroundColor="#00C48A" alignSelf="center" marginLeft={8} />}
                  </XStack>
                ))}
              </YStack>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default NotificationsScreen;