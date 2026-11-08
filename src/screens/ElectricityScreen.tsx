import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import React, { useState, useEffect, useRef } from "react";
import {
  Platform, StatusBar, RefreshControl, View, Animated, Keyboard,
  TextInput, ActivityIndicator, Image, SafeAreaView, Dimensions,
  Modal, TouchableOpacity, ScrollView, Alert, Switch
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather, Ionicons } from "@expo/vector-icons";
import Svg, { Rect, Text as SvgText, Line } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";
import { useAllGridDevices, parseStromTimestamp } from "../hooks/useDeviceData";
import { DEVICE_LOCATIONS, CITIES } from "../constants/gridLocations";
import CustomMapView from "../components/CustomMapView";
import AuthService from "../services/authService";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

const { height, width } = Dimensions.get("window");
const MAX_TRUSTED_GAP_MS = 4 * 60 * 60 * 1000;
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const GOOGLE_API_KEY = Platform.OS === "ios" ? "AIzaSyCeWigeIvMAGJ_X-qj8UqY6CoGTbzBSHfA" : "AIzaSyB76SNOlgP1dkPZXhlPPIU_650y45Cd1Mo";

const CITY_DATA: Record<string, { lat: number; lng: number; radius: number; latDelta: number; lngDelta: number; northEast: any; southWest: any }> = {
  Ibadan: { lat: 7.3775, lng: 3.9059, radius: 30000.0, latDelta: 0.15, lngDelta: 0.15, northEast: { latitude: 7.6, longitude: 4.15 }, southWest: { latitude: 7.15, longitude: 3.65 } },
  Lagos: { lat: 6.5244, lng: 3.3792, radius: 40000.0, latDelta: 0.3, lngDelta: 0.3, northEast: { latitude: 6.75, longitude: 3.65 }, southWest: { latitude: 6.35, longitude: 3.1 } },
  Abuja: { lat: 9.0765, lng: 7.3986, radius: 40000.0, latDelta: 0.3, lngDelta: 0.3, northEast: { latitude: 9.3, longitude: 7.6 }, southWest: { latitude: 8.8, longitude: 7.1 } },
};

// ---------------- helpers ----------------
const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const isInsideCity = (lat: number, lng: number, city: string) => {
  const c = CITY_DATA[city];
  if (!c) return true;
  return lat >= c.southWest.latitude && lat <= c.northEast.latitude && lng >= c.southWest.longitude && lng <= c.northEast.longitude;
};

const placesHeaders = (fieldMask?: string) => {
  const headers: any = { "Content-Type": "application/json", "X-Goog-Api-Key": GOOGLE_API_KEY };
  if (fieldMask) headers["X-Goog-FieldMask"] = fieldMask;
  if (Platform.OS === "ios") headers["X-Ios-Bundle-Identifier"] = "com.strompulse.app";
  if (Platform.OS === "android") headers["X-Android-Package"] = "com.strompulse.app";
  return headers;
};

// Autocomplete strictly inside the selected city's bounding box
const cityAutocomplete = async (input: string, city: string, sessionToken?: string) => {
  const c = CITY_DATA[city] || CITY_DATA.Ibadan;
  const body: any = {
    input,
    includedRegionCodes: ["ng"],
    locationRestriction: {
      rectangle: {
        low: { latitude: c.southWest.latitude, longitude: c.southWest.longitude },
        high: { latitude: c.northEast.latitude, longitude: c.northEast.longitude },
      },
    },
  };
  if (sessionToken) body.sessionToken = sessionToken;
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", { method: "POST", headers: placesHeaders(), body: JSON.stringify(body) });
  const data = await res.json();
  if (data.error) {
    console.warn("[Places autocomplete]", data.error.status, data.error.message);
    return [];
  }
  return (data.suggestions || [])
    .filter((d: any) => d.placePrediction)
    .map((d: any) => ({
      id: d.placePrediction.placeId,
      title: d.placePrediction.structuredFormat?.mainText?.text || d.placePrediction.text.text,
      subtitle: d.placePrediction.structuredFormat?.secondaryText?.text || "",
      fullText: d.placePrediction.text.text,
    }));
};

const fetchPlaceLocation = async (placeId: string, sessionToken?: string) => {
  const url = `https://places.googleapis.com/v1/places/${placeId}${sessionToken ? `?sessionToken=${sessionToken}` : ""}`;
  const res = await fetch(url, { headers: placesHeaders("location") });
  const data = await res.json();
  return data.location ? { lat: data.location.latitude as number, lng: data.location.longitude as number } : null;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfIsoWeek = (d: Date) => {
  const s = startOfDay(d);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() - ((s.getDay() + 6) % 7));
};
const getIsoWeek = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7), year: d.getUTCFullYear() };
};
const formatHourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;

// Each history entry = one "power ON" session. The KEY is when power was restored.
// Fields inside the entry (last_seen / timestamp / durationSeconds) describe when that session ENDED
// and are updated by the device while it runs — they must never be used as the session start.
// (Using entry.timestamp as the start is what made 12am–noon drop to 0% later in the day.)
const SESSION_FALLBACK_MAX_MS = 24 * 60 * 60 * 1000;
const toMs = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v; // seconds or ms
  const d = parseStromTimestamp(String(v));
  return d ? d.getTime() : null;
};
const buildUpIntervalsFromHistory = (historyNode: any, isOnline: boolean, nowMs: number, lastSeenMs: number | null = null) => {
  if (!historyNode) return [];
  const sessions = Object.keys(historyNode)
    .map((key) => {
      const entry = historyNode[key];
      const obj = entry && typeof entry === "object" ? entry : {};
      const start = toMs(key) ?? toMs(obj.start) ?? toMs(obj.started_at) ?? toMs(obj.restored_at);
      if (start === null) return null;
      let end = toMs(obj.last_seen) ?? toMs(obj.ended_at) ?? toMs(obj.end);
      if (end === null && typeof obj.durationSeconds === "number") end = start + obj.durationSeconds * 1000;
      if (end === null) {
        const ts = toMs(obj.timestamp);
        if (ts !== null && ts > start) end = ts;
      }
      return { start, end: end !== null && end > start ? end : null };
    })
    .filter((s): s is { start: number; end: number | null } => !!s && !Number.isNaN(s.start))
    .sort((a, b) => a.start - b.start);

  const intervals: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < sessions.length; i++) {
    const { start, end: recordedEnd } = sessions[i];
    const nextStart = i < sessions.length - 1 ? sessions[i + 1].start : null;
    let end: number;
    if (nextStart === null) {
      // Latest session: still running if the device is online right now
      // Offline: it ended at the recorded end, or at the device's last heartbeat
      end = isOnline ? nowMs : recordedEnd ?? (lastSeenMs !== null && lastSeenMs > start ? lastSeenMs : start);
    } else if (recordedEnd !== null) {
      end = Math.min(recordedEnd, nextStart);
    } else {
      // No end recorded: assume power stayed on until the next restore (capped so one bad gap can't fill a whole day)
      end = Math.min(nextStart, start + SESSION_FALLBACK_MAX_MS);
    }
    end = Math.min(end, nowMs);
    if (end > start) intervals.push({ start, end });
  }
  return intervals;
};

const sumOverlapMs = (intervals: Array<{ start: number; end: number }>, rangeStart: number, rangeEnd: number) => {
  let total = 0;
  for (const iv of intervals) {
    const s = Math.max(iv.start, rangeStart);
    const e = Math.min(iv.end, rangeEnd);
    if (e > s) total += e - s;
  }
  return total;
};

const calculateIntervalUptime = (device: any, startMs: number, endMs: number, nowMs: number) => {
  if (startMs >= nowMs) return null;
  const clampedEnd = Math.min(endMs, nowMs);
  const durationMs = clampedEnd - startMs;
  if (durationMs <= 0) return null;
  const hasHistory = device?.history && Object.keys(device.history).length > 0;
  if (!hasHistory) return device?.isOnline ? 100 : 0;
  const intervals = buildUpIntervalsFromHistory(
    device.history, !!device.isOnline, nowMs,
    toMs(device.updated_at ?? device.lastSeen ?? device.realtime?.serverReceivedAt ?? device.realtime?.timestamp ?? null)
  );
  return Math.max(0, Math.min(100, Math.round((sumOverlapMs(intervals, startMs, clampedEnd) / durationMs) * 100)));
};

// ---------------- chart ----------------
type ChartBar = { label: string; subLabel?: string; value: number | null; isFuture?: boolean };

const UptimeBarChart = ({ bars, yTitle, xTitle, isDarkMode, textColor, variant = "actual", minSlotWidth = 0, showValues = false }: {
  bars: ChartBar[]; yTitle: string; xTitle?: string; isDarkMode: boolean; textColor: string; variant?: "actual" | "predicted"; minSlotWidth?: number; showValues?: boolean;
}) => {
  const baseWidth = width - 88;
  const startX = 44;
  const chartWidth = Math.max(baseWidth, minSlotWidth * bars.length + startX + 8);
  const endX = chartWidth - 8;
  const slot = (endX - startX) / bars.length;
  const barW = Math.max(6, Math.min(24, slot * 0.55));
  const rotateLabels = bars.length > 12;
  const top = showValues ? 22 : 12;
  const plotH = 140;
  const axisY = top + plotH;
  const labelArea = rotateLabels ? 34 : bars.some((b) => b.subLabel) ? 30 : 18;
  const chartHeight = axisY + labelArea + (xTitle ? 18 : 4);
  const gridColor = isDarkMode ? "#2D3B34" : "#E2E8F0";

  const svg = (
    <Svg width={chartWidth} height={chartHeight}>
      <SvgText x={12} y={top + plotH / 2} fill={textColor} fontSize={10} fontFamily="Chirp-Bold" textAnchor="middle" transform={`rotate(-90, 12, ${top + plotH / 2})`}>{yTitle}</SvgText>
      {[100, 80, 60, 40, 20, 0].map((v) => {
        const y = top + plotH * (1 - v / 100);
        return (
          <React.Fragment key={`g${v}`}>
            <SvgText x={startX - 6} y={y + 3} fill={textColor} fontSize={9} fontFamily="Chirp-Medium" textAnchor="end">{v}</SvgText>
            <Line x1={startX} y1={y} x2={endX} y2={y} stroke={gridColor} strokeWidth={1} strokeDasharray={v === 0 ? undefined : "4,4"} />
          </React.Fragment>
        );
      })}
      {bars.map((b, i) => {
        const cx = startX + slot * i + slot / 2;
        const hasValue = !b.isFuture && b.value !== null && b.value !== undefined;
        const v = hasValue ? (b.value as number) : 0;
        const h = hasValue ? Math.max(4, (v / 100) * plotH) : 4;
        const y = axisY - h;
        let fill = variant === "predicted" ? "#3B82F6" : v >= 70 ? "#00C48A" : v >= 40 ? "#F59E0B" : "#EF4444";
        if (!hasValue) fill = gridColor;
        return (
          <React.Fragment key={`b${i}`}>
            <Rect x={cx - barW / 2} y={y} width={barW} height={h} rx={Math.min(barW / 2, 6)} fill={fill} opacity={variant === "predicted" && hasValue ? 0.85 : 1} />
            {showValues && hasValue && <SvgText x={cx} y={y - 5} fill={textColor} fontSize={9} fontFamily="Chirp-Bold" textAnchor="middle">{`${v}%`}</SvgText>}
            {rotateLabels ? (
              <SvgText x={cx + 3} y={axisY + 6} fill={textColor} fontSize={8} fontFamily="Chirp-Medium" textAnchor="end" transform={`rotate(-90, ${cx + 3}, ${axisY + 6})`}>{b.label}</SvgText>
            ) : (
              <>
                <SvgText x={cx} y={axisY + 13} fill={textColor} fontSize={10} fontFamily="Chirp-Bold" textAnchor="middle">{b.label}</SvgText>
                {b.subLabel ? <SvgText x={cx} y={axisY + 25} fill={textColor} fontSize={8} fontFamily="Chirp-Medium" textAnchor="middle">{b.subLabel}</SvgText> : null}
              </>
            )}
          </React.Fragment>
        );
      })}
      {xTitle ? <SvgText x={startX + (endX - startX) / 2} y={chartHeight - 4} fill={textColor} fontSize={10} fontFamily="Chirp-Bold" textAnchor="middle">{xTitle}</SvgText> : null}
    </Svg>
  );

  if (chartWidth > baseWidth) {
    return (
      <YStack>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>{svg}</ScrollView>
        <XStack justifyContent="flex-end" alignItems="center" gap={4} marginTop={4}>
          <Feather name="chevrons-right" size={10} color={textColor} />
          <TText fontFamily="Chirp-Medium" fontSize={10} color={textColor}>Scroll for more hours</TText>
        </XStack>
      </YStack>
    );
  }
  return svg;
};

const SyncNotice = ({ visible, isDarkMode }: any) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fadeAnim, { toValue: visible ? 1 : 0, duration: 250, useNativeDriver: true }).start(); }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", top: 120, alignSelf: "center", zIndex: 200, opacity: fadeAnim, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, flexDirection: "row", alignItems: "center" }}>
      <ActivityIndicator size="small" color="#00C48A" style={{ marginRight: 12 }} />
      <TText fontFamily="Chirp-Bold" fontSize={12} color={isDarkMode ? "#A7F3D0" : "#064E3B"}>Updating city grid...</TText>
    </Animated.View>
  );
};

type Range = "Today" | "This Week" | "This Month";

const ElectricityScreen = ({ navigation }: any) => {
  const { theme, isDarkMode, toggleDarkMode } = useTheme();
  const cardBg = isDarkMode ? "#121A16" : "#FFFFFF";
  const softBg = isDarkMode ? "#1A221E" : "#F8FAFC";
  const divider = isDarkMode ? "#2D3B34" : "#E2E8F0";

  const [activeTab, setActiveTab] = useState<"map" | "communities" | "stats">("map");
  const [selectedCity, setSelectedCity] = useState("Ibadan");
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [mapRegion, setMapRegion] = useState<any>(null);

  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedSearchItem, setSelectedSearchItem] = useState<any | null>(null);
  const [isMapSearchFocused, setIsMapSearchFocused] = useState(false);

  const [communitySearchQuery, setCommunitySearchQuery] = useState("");
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [defaultLocation, setDefaultLocation] = useState<any | null>(null);
  const [recentMapSearch, setRecentMapSearch] = useState<any | null>(null);

  const [isLocModalVisible, setIsLocModalVisible] = useState(false);
  const [homeModalTab, setHomeModalTab] = useState<"analytics" | "address">("analytics");
  const [homeChartTimeRange, setHomeChartTimeRange] = useState<Range>("Today");
  const [chartTimeRange, setChartTimeRange] = useState<Range>("Today");

  const [locSearchQuery, setLocSearchQuery] = useState("");
  const [locSearchResults, setLocSearchResults] = useState<any[]>([]);
  const [isLocSearching, setIsLocSearching] = useState(false);
  const [selectedLocResult, setSelectedLocResult] = useState<any>(null);
  const [isSavingLoc, setIsSavingLoc] = useState(false);

  const [apiSearchResults, setApiSearchResults] = useState<any[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [sessionToken, setSessionToken] = useState(uuidv4());

  const [showSyncNotice, setShowSyncNotice] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(width)).current;
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);

  useEffect(() => {
    const c = CITY_DATA[selectedCity] || CITY_DATA.Ibadan;
    setMapRegion({ latitude: c.lat, longitude: c.lng, latitudeDelta: c.latDelta, longitudeDelta: c.lngDelta });
    setMapSearchQuery("");
    setSelectedAreaId(null);
    setSelectedSearchItem(null);
  }, [selectedCity]);

  useEffect(() => { const t = setTimeout(() => setShowSyncNotice(false), 4000); return () => clearTimeout(t); }, []);
  // 30s tick is enough for live status/charts and keeps the screen smooth
  useEffect(() => { const t = setInterval(() => setCurrentTime(Date.now()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => setIsConnected(!!state.isConnected && state.isInternetReachable !== false));
    return () => unsubscribe();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const session = await AuthService.getCurrentSession();
          if (session) setUser(session.user);
          setLocalAvatar(await AsyncStorage.getItem("global_avatar"));
          setLocalName(await AsyncStorage.getItem("global_name"));
          const savedLoc = await AsyncStorage.getItem("strompulse_default_location");
          if (savedLoc) setDefaultLocation(JSON.parse(savedLoc));
          const savedRecent = await AsyncStorage.getItem("strompulse_recent_map_search");
          if (savedRecent) setRecentMapSearch(JSON.parse(savedRecent));
        } catch (e) {}
      })();
    }, [])
  );

  const displayAvatar = localAvatar || user?.avatar_url || user?.user_metadata?.avatar_url || null;
  const fullName = localName || user?.full_name || "Stromer";

  const toggleSidebar = (open: boolean) => {
    if (open) {
      setIsSidebarOpen(true);
      Animated.timing(sidebarAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(sidebarAnim, { toValue: width, duration: 250, useNativeDriver: true }).start(() => setIsSidebarOpen(false));
    }
  };

  const handleLogoutPress = () => {
    toggleSidebar(false);
    Alert.alert("Log Out", "Are you sure you want to log out of your account?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: async () => { try { await AuthService.logout(); } catch (err) {} } },
    ], { cancelable: true });
  };

  const { devices, loading: devicesLoading } = useAllGridDevices();

  const getNearestNode = (lat: number, lng: number, nodes: any[]) => {
    if (!nodes || nodes.length === 0) return null;
    let nearest = nodes[0];
    let min = Infinity;
    nodes.forEach((n) => { const d = getDistanceFromLatLonInKm(lat, lng, n.lat, n.lng); if (d < min) { min = d; nearest = n; } });
    return nearest;
  };

  const gridItems = Object.keys(DEVICE_LOCATIONS).map((id) => {
    const liveDevice = devices.find((d) => d.id === id || d.id?.toUpperCase() === id.toUpperCase());
    const meta: any = (DEVICE_LOCATIONS as any)[id];
    const connectionState = liveDevice ? liveDevice.connectionState || (liveDevice.isOnline ? "online" : "offline") : "offline";
    let isOnline = connectionState === "online";
    let isChecking = connectionState === "checking";
    if (!isConnected) { isOnline = false; isChecking = true; }
    const realUptime = liveDevice?.uptime !== undefined ? liveDevice.uptime : isOnline ? 100 : 0;
    const outOfCoverage = !liveDevice;
    const isPartial = isOnline && realUptime > 0 && realUptime < 100;
    let finalStatusText = outOfCoverage ? "Out of Coverage" : isChecking ? "Checking Status" : isOnline ? "Presently Stable" : "Power Outage";
    if (isPartial && isConnected) finalStatusText = "Partial Stability";
    if (!isConnected) finalStatusText = "Checking Status";
    return {
      id, name: meta.name, type: meta.type, lat: meta.lat, lng: meta.lng, roads: meta.roads || [], city: meta.city || "Ibadan",
      isOnline, isChecking, connectionState: isConnected ? connectionState : "checking", uptime: realUptime,
      outOfCoverage, isPartial, finalStatusText, history: liveDevice?.history, fullDeviceData: liveDevice,
    };
  });
  const cityGridItems = gridItems.filter((g) => g.city === selectedCity);

  let defaultLocStatus: any = null;
  if (defaultLocation && gridItems.length > 0) {
    defaultLocStatus = defaultLocation.isCustom ? getNearestNode(defaultLocation.lat, defaultLocation.lng, gridItems) : gridItems.find((g) => g.id === defaultLocation.id);
  }
  const homeDevice = defaultLocStatus?.fullDeviceData || null;

  // ---------- analytics data ----------
  const getCityPct = (sMs: number, eMs: number, nowMs: number) => {
    let total = 0, counted = 0;
    cityGridItems.forEach((item) => {
      if (item.fullDeviceData) {
        const pct = calculateIntervalUptime(item.fullDeviceData, sMs, eMs, nowMs);
        if (pct !== null) { total += pct; counted++; }
      }
    });
    return counted > 0 ? Math.round(total / counted) : null;
  };

  const pctFor = (source: "city" | "home", s: number, e: number, nowMs: number) =>
    source === "home" ? (homeDevice ? calculateIntervalUptime(homeDevice, s, e, nowMs) : null) : getCityPct(s, e, nowMs);

  const buildRangeBars = (range: Range, source: "city" | "home"): ChartBar[] => {
    const now = new Date(currentTime);
    const nowMs = now.getTime();
    if (range === "Today") {
      const sod = startOfDay(now);
      return Array.from({ length: 24 }, (_, h) => {
        const s = new Date(sod.getFullYear(), sod.getMonth(), sod.getDate(), h).getTime();
        const isFuture = s >= nowMs;
        return { label: formatHourLabel(h), value: isFuture ? null : pctFor(source, s, s + 3600000, nowMs), isFuture };
      });
    }
    if (range === "This Week") {
      const sow = startOfIsoWeek(now);
      return DAY_NAMES.map((name, i) => {
        const d = new Date(sow.getFullYear(), sow.getMonth(), sow.getDate() + i);
        const s = d.getTime();
        const e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
        const isFuture = s >= nowMs;
        return { label: name, subLabel: `${d.getDate()} ${MONTHS[d.getMonth()]}`, value: isFuture ? null : pctFor(source, s, e, nowMs), isFuture };
      });
    }
    const y = now.getFullYear(), m = now.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const ranges: [number, number][] = [];
    for (let st = 1; st <= lastDay; st += 7) ranges.push([st, Math.min(st + 6, lastDay)]);
    return ranges.map(([a, b], i) => {
      const s = new Date(y, m, a).getTime();
      const e = new Date(y, m, b + 1).getTime();
      const isFuture = s > nowMs;
      return { label: `Wk ${i + 1}`, subLabel: a === b ? `${a} ${MONTHS[m]}` : `${a}–${b} ${MONTHS[m]}`, value: isFuture ? null : pctFor(source, s, e, nowMs), isFuture };
    });
  };

  // Prediction = average uptime for the same weekday over the previous 4 weeks
  const buildPrediction = (source: "city" | "home") => {
    const now = new Date(currentTime);
    const nowMs = now.getTime();
    const thisMon = startOfIsoWeek(now);
    const nextMon = new Date(thisMon.getFullYear(), thisMon.getMonth(), thisMon.getDate() + 7);
    const bars: ChartBar[] = DAY_NAMES.map((name, i) => {
      const target = new Date(nextMon.getFullYear(), nextMon.getMonth(), nextMon.getDate() + i);
      const samples: number[] = [];
      for (let w = 1; w <= 4; w++) {
        const d = new Date(target.getFullYear(), target.getMonth(), target.getDate() - 7 * w);
        const s = d.getTime();
        if (s >= nowMs) continue;
        const e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
        const v = pctFor(source, s, e, nowMs);
        if (v !== null && v !== undefined) samples.push(v);
      }
      return { label: name, subLabel: `${target.getDate()} ${MONTHS[target.getMonth()]}`, value: samples.length ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : null };
    });
    return { bars, ...getIsoWeek(nextMon) };
  };

  const xTitleFor = (r: Range) => (r === "Today" ? "Hour of day" : r === "This Week" ? "Day of week" : "Week of month");

  const renderRangeSelector = (value: Range, onChange: (r: Range) => void) => (
    <XStack backgroundColor={isDarkMode ? "#121A16" : "#F1F5F9"} borderRadius={12} padding={4} alignSelf="flex-start">
      {(["Today", "This Week", "This Month"] as Range[]).map((r) => (
        <TouchableOpacity key={r} onPress={() => onChange(r)} style={{ paddingVertical: 6, paddingHorizontal: 12, backgroundColor: value === r ? "#00C48A" : "transparent", borderRadius: 8 }}>
          <TText fontSize={11} fontFamily="Chirp-Bold" color={value === r ? "#FFFFFF" : theme.textSecondary}>{r === "Today" ? "Today" : r === "This Week" ? "This week" : "This month"}</TText>
        </TouchableOpacity>
      ))}
    </XStack>
  );

  const renderRangeSummary = (bars: ChartBar[], range: Range) => {
    const withData = bars.filter((b) => !b.isFuture && b.value !== null && b.value !== undefined);
    const avg = withData.length ? Math.round(withData.reduce((a, b) => a + (b.value as number), 0) / withData.length) : null;
    const best = withData.length ? withData.reduce((a, b) => ((b.value as number) > (a.value as number) ? b : a)) : null;
    const worst = withData.length ? withData.reduce((a, b) => ((b.value as number) < (a.value as number) ? b : a)) : null;
    const word = range === "Today" ? "HOUR" : range === "This Week" ? "DAY" : "WEEK";
    const pc = (v: number | null) => (v === null ? theme.textSecondary : v >= 70 ? "#00C48A" : v >= 40 ? "#F59E0B" : "#EF4444");
    return (
      <XStack gap={10} marginTop={16} paddingTop={16} borderTopWidth={1} borderTopColor={divider}>
        {[
          { label: "AVERAGE", value: avg !== null ? `${avg}%` : "—", color: pc(avg) },
          { label: `BEST ${word}`, value: best ? `${best.label} · ${best.value}%` : "—", color: "#00C48A" },
          { label: `WORST ${word}`, value: worst ? `${worst.label} · ${worst.value}%` : "—", color: "#EF4444" },
        ].map((x) => (
          <YStack key={x.label} flex={1} alignItems="center">
            <TText fontFamily="Chirp-Bold" fontSize={9} color={theme.textSecondary} letterSpacing={0.8} marginBottom={4}>{x.label}</TText>
            <TText fontFamily="Chirp-Heavy" fontSize={12} color={x.color} textAlign="center" numberOfLines={1}>{x.value}</TText>
          </YStack>
        ))}
      </XStack>
    );
  };

  const renderAnalyticsCard = (title: string, subtitle: string, range: Range, setRange: (r: Range) => void, source: "city" | "home") => {
    const bars = buildRangeBars(range, source);
    return (
    <YStack backgroundColor={cardBg} borderRadius={24} padding={20} borderWidth={1} borderColor={divider} marginBottom={16}>
      <XStack alignItems="center" gap={12} marginBottom={16}>
        <YStack width={36} height={36} borderRadius={12} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center">
          <Feather name="bar-chart-2" size={18} color="#00C48A" />
        </YStack>
        <YStack flex={1}>
          <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary}>{title}</TText>
          <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>{subtitle}</TText>
        </YStack>
      </XStack>
      <YStack marginBottom={16}>{renderRangeSelector(range, setRange)}</YStack>
      <UptimeBarChart bars={bars} yTitle="Uptime (%)" xTitle={xTitleFor(range)} isDarkMode={isDarkMode} textColor={theme.textSecondary} minSlotWidth={range === "Today" ? 20 : 0} />
      <XStack gap={14} marginTop={12} flexWrap="wrap">
        {[{ c: "#00C48A", l: "70%+" }, { c: "#F59E0B", l: "40–69%" }, { c: "#EF4444", l: "<40%" }, { c: divider, l: "No data" }].map((x) => (
          <XStack key={x.l} alignItems="center" gap={6}>
            <YStack width={8} height={8} borderRadius={4} backgroundColor={x.c} />
            <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary}>{x.l}</TText>
          </XStack>
        ))}
      </XStack>
      {source === "home" && renderRangeSummary(bars, range)}
    </YStack>
    );
  };

  const renderPredictionCard = (source: "city" | "home") => {
    const { bars, week, year } = buildPrediction(source);
    const hasAny = bars.some((b) => b.value !== null);
    return (
      <YStack backgroundColor={cardBg} borderRadius={24} padding={20} borderWidth={1} borderColor={divider} marginBottom={16}>
        <XStack alignItems="center" gap={12} marginBottom={16}>
          <YStack width={36} height={36} borderRadius={12} backgroundColor={isDarkMode ? "rgba(59,130,246,0.15)" : "#EFF6FF"} justifyContent="center" alignItems="center">
            <Feather name="trending-up" size={16} color="#3B82F6" />
          </YStack>
          <YStack flex={1}>
            <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary}>Prediction for Next Week (Week {week}, {year})</TText>
            <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>Based on the last 4 weeks of grid history</TText>
          </YStack>
        </XStack>
        {hasAny ? (
          <UptimeBarChart bars={bars} yTitle="Expected Uptime (%)" xTitle="Day" isDarkMode={isDarkMode} textColor={theme.textSecondary} variant="predicted" showValues />
        ) : (
          <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} textAlign="center" paddingVertical={24}>Not enough history yet to predict next week.</TText>
        )}
      </YStack>
    );
  };

  // ---------- home address ----------
  const saveDefaultLocation = async () => {
    if (!selectedLocResult) return;
    setIsSavingLoc(true);
    try {
      let toSave = { ...selectedLocResult, city: selectedCity };
      if (selectedLocResult.isGooglePlace && (!toSave.lat || !toSave.lng)) {
        const loc = await fetchPlaceLocation(selectedLocResult.id);
        if (!loc) { Alert.alert("Couldn't get address", "Please try another address."); return; }
        if (!isInsideCity(loc.lat, loc.lng, selectedCity)) { Alert.alert("Outside coverage", `Please choose an address inside ${selectedCity}.`); return; }
        toSave = { ...toSave, lat: loc.lat, lng: loc.lng };
      }
      setDefaultLocation(toSave);
      await AsyncStorage.setItem("strompulse_default_location", JSON.stringify(toSave));
      setLocSearchQuery("");
      setLocSearchResults([]);
      setSelectedLocResult(null);
      setHomeModalTab("analytics");
      if (!defaultLocation) setIsLocModalVisible(false);
    } catch (e) {
      Alert.alert("Error", "Couldn't save your home address. Please try again.");
    } finally {
      setIsSavingLoc(false);
    }
  };

  // Change Home Address search (Google, restricted to city)
  useEffect(() => {
    const t = setTimeout(async () => {
      const q = locSearchQuery.trim();
      if (q.length > 2) {
        setIsLocSearching(true);
        try {
          const results = await cityAutocomplete(q, selectedCity);
          setLocSearchResults(results.map((r: any) => ({ id: r.id, name: r.fullText, title: r.title, subtitle: r.subtitle, isGooglePlace: true, isCustom: true })));
        } catch { setLocSearchResults([]); } finally { setIsLocSearching(false); }
      } else setLocSearchResults([]);
    }, 400);
    return () => clearTimeout(t);
  }, [locSearchQuery, selectedCity]);

  // ---------- map search ----------
  useEffect(() => {
    const t = setTimeout(async () => {
      const q = mapSearchQuery.trim();
      if (q.length > 2 && !selectedSearchItem) {
        setIsSearchingApi(true);
        try {
          const results = await cityAutocomplete(q, selectedCity, sessionToken);
          setApiSearchResults(results.map((r: any) => ({ id: r.id, displayTitle: r.title, subtitle: r.subtitle, isGooglePlace: true, finalStatusText: r.subtitle || `Street in ${selectedCity}` })));
        } catch { setApiSearchResults([]); } finally { setIsSearchingApi(false); }
      } else setApiSearchResults([]);
    }, 400);
    return () => clearTimeout(t);
  }, [mapSearchQuery, selectedCity]);

  const handleSelectSearchResult = async (item: any) => {
    Keyboard.dismiss();
    setIsMapSearchFocused(false);
    setMapSearchQuery(item.displayTitle);

    let lat = item.lat, lng = item.lng;
    let areaId = item.isGooglePlace ? null : item.id;

    if (item.isGooglePlace && (!lat || !lng)) {
      try {
        const loc = await fetchPlaceLocation(item.id, sessionToken);
        if (loc) { lat = loc.lat; lng = loc.lng; }
      } catch (e) {} finally { setSessionToken(uuidv4()); }
    }
    if (lat && lng && !isInsideCity(lat, lng, selectedCity)) {
      Alert.alert("Outside coverage", `That address is outside ${selectedCity}. Please search within ${selectedCity}.`);
      return;
    }
    if (lat && lng && !areaId) {
      const nearest = getNearestNode(lat, lng, cityGridItems.length ? cityGridItems : gridItems);
      if (nearest) areaId = nearest.id;
    }
    setSelectedAreaId(areaId);
    const chosen = { ...item, lat, lng };
    setSelectedSearchItem(chosen);
    // Zoom is locked for users, so focus the result at a fixed street-level view; clearing the search returns to the city view
    if (lat && lng) setMapRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.03, longitudeDelta: 0.03 });
    setRecentMapSearch(chosen);
    AsyncStorage.setItem("strompulse_recent_map_search", JSON.stringify(chosen));
  };

  const resetCityRegion = () => {
    const c = CITY_DATA[selectedCity] || CITY_DATA.Ibadan;
    setMapRegion({ latitude: c.lat, longitude: c.lng, latitudeDelta: c.latDelta, longitudeDelta: c.lngDelta });
  };

  const clearMapSearch = () => {
    resetCityRegion();
    setMapSearchQuery("");
    setSelectedAreaId(null);
    setSelectedSearchItem(null);
    setApiSearchResults([]);
  };

  const combinedSearchResults: any[] = [];
  if (mapSearchQuery.trim().length > 0 && !selectedSearchItem) {
    const q = mapSearchQuery.toLowerCase().trim();
    const seen = new Set<string>();
    cityGridItems.forEach((item) => {
      if (item.name.toLowerCase().includes(q) && !seen.has(`a-${item.id}`)) { seen.add(`a-${item.id}`); combinedSearchResults.push({ ...item, displayTitle: item.name, isStreet: false }); }
      item.roads.forEach((road: string) => {
        if (road.toLowerCase().includes(q) && !seen.has(`r-${road}`)) { seen.add(`r-${road}`); combinedSearchResults.push({ ...item, displayTitle: road, isStreet: true }); }
      });
    });
    apiSearchResults.forEach((r) => combinedSearchResults.push(r));
  }

  const onRefresh = async () => { setRefreshing(true); setCurrentTime(Date.now()); setTimeout(() => setRefreshing(false), 1000); };

  if (devicesLoading && devices.length === 0) {
    return (
      <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} justifyContent="center" alignItems="center">
        <ActivityIndicator size="large" color="#00C48A" />
      </YStack>
    );
  }

  const selectedAreaData = selectedAreaId ? gridItems.find((i) => i.id === selectedAreaId) : null;
  const showSearchDropdown = isMapSearchFocused && !selectedSearchItem && (mapSearchQuery.length > 0 || !!recentMapSearch);

  const statusColor = (item: any) => item?.isChecking ? "#F59E0B" : item?.outOfCoverage ? theme.textSecondary : item?.isPartial ? "#F59E0B" : item?.isOnline ? "#00C48A" : "#EF4444";

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} />
      <SyncNotice visible={showSyncNotice} isDarkMode={isDarkMode} />

      <SafeAreaView style={{ flex: 1 }}>
        <XStack alignItems="center" justifyContent="space-between" paddingHorizontal={24} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={16} borderBottomWidth={1} borderBottomColor={divider}>
          <Image source={require("../../assets/images/strompulselogo.png")} style={{ width: 40, height: 40, resizeMode: "contain" }} />
          <TText style={{ fontFamily: "SoraTitle-Bold", fontSize: 23 }} color={theme.textPrimary}>Strompulse</TText>
          <TouchableOpacity onPress={() => toggleSidebar(true)}>
            <YStack width={42} height={42} justifyContent="center" alignItems="flex-end">
              <Feather name="menu" size={24} color={theme.textPrimary} />
            </YStack>
          </TouchableOpacity>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C48A" />}>
          <XStack alignItems="center" justifyContent="center" paddingHorizontal={24} marginBottom={16} marginTop={16}>
            <XStack alignItems="center" gap={6} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} paddingHorizontal={12} paddingVertical={6} borderRadius={16} borderWidth={1} borderColor={isDarkMode ? "#047857" : "#A7F3D0"}>
              <YStack width={6} height={6} borderRadius={3} backgroundColor="#00C48A" />
              <TText fontFamily="Chirp-Bold" fontSize={11} color="#00C48A" letterSpacing={0.5}>LIVE GRID STATUS</TText>
            </XStack>
          </XStack>

          {/* City selector */}
          <YStack zIndex={10000} marginHorizontal={24} marginBottom={16}>
            <YStack position="absolute" top={-8} left={20} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} paddingHorizontal={4} zIndex={10}>
              <TText fontSize={11} fontFamily="Chirp-Heavy" color={theme.textPrimary} letterSpacing={0.5}>SELECT YOUR CITY</TText>
            </YStack>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setIsCityDropdownOpen(!isCityDropdownOpen)}>
              <XStack backgroundColor={cardBg} borderRadius={20} paddingHorizontal={16} paddingVertical={12} alignItems="center" justifyContent="space-between" borderWidth={1.5} borderColor="#00C48A">
                <XStack alignItems="center" gap={10}>
                  <Ionicons name="location-outline" size={18} color="#00C48A" />
                  <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary}>{selectedCity}</TText>
                </XStack>
                <YStack width={28} height={28} borderRadius={14} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center">
                  <Feather name={isCityDropdownOpen ? "chevron-up" : "chevron-down"} size={14} color="#00C48A" />
                </YStack>
              </XStack>
            </TouchableOpacity>
            {isCityDropdownOpen && (
              <YStack position="absolute" top={64} left={0} right={0} backgroundColor={softBg} borderRadius={16} padding={8} borderWidth={1} borderColor="#00C48A">
                {CITIES.map((city: any, idx: number) => (
                  <TouchableOpacity key={idx} disabled={!city.available} onPress={() => { setSelectedCity(city.name); setIsCityDropdownOpen(false); }}>
                    <XStack alignItems="center" justifyContent="space-between" padding={12} backgroundColor={selectedCity === city.name ? (isDarkMode ? "rgba(0,196,138,0.1)" : "#F0FDF4") : "transparent"} borderRadius={12}>
                      <TText fontFamily="Chirp-Bold" fontSize={14} color={city.available ? theme.textPrimary : theme.textSecondary}>{city.name} {!city.available && "(Coming Soon)"}</TText>
                      {selectedCity === city.name && <Feather name="check-circle" size={16} color="#00C48A" />}
                      {!city.available && <Feather name="lock" size={14} color={theme.textSecondary} />}
                    </XStack>
                  </TouchableOpacity>
                ))}
              </YStack>
            )}
          </YStack>

          {/* Main navigation: three distinct containers with selected-state highlighting */}
          <XStack marginHorizontal={24} marginBottom={20} gap={10}>
            {(["map", "communities", "stats"] as const).map((tab) => {
              const isActive = activeTab === tab;
              const cfg = { map: { icon: "home", label: "Home" }, communities: { icon: "grid", label: "Communities" }, stats: { icon: "bar-chart-2", label: "Analytics" } }[tab];
              return (
                <TouchableOpacity key={tab} activeOpacity={0.8} onPress={() => setActiveTab(tab)} style={{ flex: 1 }}>
                  <XStack paddingVertical={12} paddingHorizontal={6} alignItems="center" justifyContent="center" borderRadius={16} borderWidth={1.5} borderColor={isActive ? "#00C48A" : divider} backgroundColor={isActive ? "#00C48A" : cardBg} gap={6}>
                    <Feather name={cfg.icon as any} size={14} color={isActive ? "#FFFFFF" : theme.textSecondary} />
                    <TText fontFamily={isActive ? "Chirp-Heavy" : "Chirp-Bold"} fontSize={12} color={isActive ? "#FFFFFF" : theme.textSecondary} numberOfLines={1}>{cfg.label}</TText>
                  </XStack>
                </TouchableOpacity>
              );
            })}
          </XStack>

          {activeTab === "map" && (
            <YStack zIndex={9000} marginHorizontal={24} marginBottom={24}>
              {/* Same floating label style as "SELECT YOUR CITY" */}
              <YStack marginTop={8}>
              <YStack position="absolute" top={-8} left={20} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} paddingHorizontal={4} zIndex={10}>
                <TText fontSize={11} fontFamily="Chirp-Heavy" color={theme.textPrimary} letterSpacing={0.5}>SELECT YOUR HOME ADDRESS</TText>
              </YStack>
              {!defaultLocation ? (
                <TouchableOpacity onPress={() => { setHomeModalTab("address"); setIsLocModalVisible(true); }}>
                  <XStack backgroundColor={cardBg} borderRadius={20} paddingHorizontal={16} paddingVertical={14} alignItems="center" justifyContent="space-between" borderWidth={1.5} borderColor="#00C48A">
                    <XStack alignItems="center" gap={12}>
                      <Feather name="home" size={16} color="#00C48A" />
                      <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary}>Set Home Address</TText>
                    </XStack>
                    <YStack width={32} height={32} borderRadius={16} backgroundColor="#00C48A" justifyContent="center" alignItems="center">
                      <Feather name="arrow-right" size={14} color="#FFF" />
                    </YStack>
                  </XStack>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => { setHomeModalTab("analytics"); setIsLocModalVisible(true); }}>
                  <XStack backgroundColor={cardBg} borderRadius={20} paddingHorizontal={16} paddingVertical={14} alignItems="center" justifyContent="space-between" borderWidth={1.5} borderColor="#00C48A">
                    <XStack alignItems="center" gap={12} flex={1}>
                      {defaultLocStatus?.isChecking ? <ActivityIndicator size="small" color="#F59E0B" /> : <Feather name={defaultLocStatus?.isOnline ? "zap" : "zap-off"} size={16} color={statusColor(defaultLocStatus)} />}
                      <YStack flex={1} paddingRight={12}>
                        <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary} marginBottom={2}>{defaultLocStatus?.finalStatusText || "Checking Status"}</TText>
                        <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} numberOfLines={1}>Home · {defaultLocation.name}</TText>
                      </YStack>
                    </XStack>
                    <YStack width={32} height={32} borderRadius={16} backgroundColor="#00C48A" justifyContent="center" alignItems="center">
                      <Feather name="arrow-right" size={14} color="#FFF" />
                    </YStack>
                  </XStack>
                </TouchableOpacity>
              )}
              </YStack>

              <YStack height={450} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={divider} marginTop={16}>
                <CustomMapView
                  showCoverage={true}
                  region={mapRegion}
                  minZoomLevel={10}
                  zoomEnabled={false}
                  scrollEnabled={true}
                  mapBoundaries={CITY_DATA[selectedCity]}
                  markers={cityGridItems.map((item) => ({ id: item.id, title: item.name, connectionState: item.connectionState, latitude: item.lat, longitude: item.lng }))}
                  onMarkerPress={(id: string) => {
                    const tapped = gridItems.find((i) => i.id === id);
                    if (tapped) navigation.navigate("CommunityZonesScreen", { areaId: tapped.id, areaName: tapped.name, isOnline: tapped.isOnline, uptime: tapped.uptime });
                  }}
                />

                <XStack position="absolute" top={16} left={16} right={16} zIndex={100} backgroundColor={softBg} borderRadius={16} paddingHorizontal={16} height={52} alignItems="center" borderWidth={1} borderColor={divider}>
                  <Feather name="search" size={18} color={theme.textSecondary} />
                  <TextInput
                    placeholder={`Search streets in ${selectedCity}...`}
                    placeholderTextColor={theme.textSecondary}
                    style={{ flex: 1, marginLeft: 12, fontSize: 14, fontFamily: "Chirp-Medium", color: theme.textPrimary }}
                    value={mapSearchQuery}
                    onFocus={() => setIsMapSearchFocused(true)}
                    onChangeText={(t) => { setMapSearchQuery(t); setSelectedSearchItem(null); setSelectedAreaId(null); setIsMapSearchFocused(true); }}
                    returnKeyType="search"
                  />
                  {isSearchingApi && <ActivityIndicator size="small" color="#00C48A" style={{ marginRight: 8 }} />}
                  {mapSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={clearMapSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Feather name="x-circle" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  )}
                </XStack>

                {showSearchDropdown && (
                  <YStack position="absolute" top={76} left={16} right={16} zIndex={101} backgroundColor={softBg} borderRadius={16} borderWidth={1} borderColor={divider} maxHeight={260} overflow="hidden">
                    <ScrollView keyboardShouldPersistTaps="handled">
                      {mapSearchQuery.length === 0 && recentMapSearch ? (
                        <YStack>
                          <TText paddingHorizontal={16} paddingTop={16} paddingBottom={8} fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={1.5}>RECENT SEARCH</TText>
                          <XStack padding={16} alignItems="center">
                            <TouchableOpacity style={{ flex: 1, flexDirection: "row", alignItems: "center" }} onPress={() => handleSelectSearchResult(recentMapSearch)}>
                              <YStack width={32} height={32} borderRadius={16} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center" marginRight={16}>
                                <Feather name="clock" size={14} color="#00C48A" />
                              </YStack>
                              <YStack flex={1}>
                                <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary} numberOfLines={1}>{recentMapSearch.displayTitle}</TText>
                                <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} numberOfLines={1}>{recentMapSearch.finalStatusText || "View on map"}</TText>
                              </YStack>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setRecentMapSearch(null); AsyncStorage.removeItem("strompulse_recent_map_search"); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                              <Feather name="trash-2" size={16} color={theme.textSecondary} />
                            </TouchableOpacity>
                          </XStack>
                        </YStack>
                      ) : isSearchingApi && combinedSearchResults.length === 0 ? (
                        <YStack padding={24} alignItems="center">
                          <ActivityIndicator size="small" color="#00C48A" />
                          <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} marginTop={12}>Searching {selectedCity}...</TText>
                        </YStack>
                      ) : combinedSearchResults.length === 0 ? (
                        <YStack padding={24} alignItems="center">
                          <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} textAlign="center">
                            {mapSearchQuery.trim().length < 3 ? "Type at least 3 letters" : `No matching address in ${selectedCity}.`}
                          </TText>
                        </YStack>
                      ) : (
                        combinedSearchResults.map((item, idx) => (
                          <TouchableOpacity key={`${item.id}-${idx}`} onPress={() => handleSelectSearchResult(item)}>
                            <XStack padding={16} alignItems="center" borderBottomWidth={idx === combinedSearchResults.length - 1 ? 0 : 1} borderBottomColor={divider}>
                              <YStack width={32} height={32} borderRadius={16} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center" marginRight={16}>
                                <Feather name={item.isGooglePlace || item.isStreet ? "map-pin" : "grid"} size={14} color="#00C48A" />
                              </YStack>
                              <YStack flex={1}>
                                <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary} numberOfLines={1}>{item.displayTitle}</TText>
                                <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} numberOfLines={1}>{item.finalStatusText || "View on map"}</TText>
                              </YStack>
                            </XStack>
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  </YStack>
                )}

                {selectedSearchItem && selectedAreaData && (
                  <YStack position="absolute" bottom={16} left={16} right={16} zIndex={100} backgroundColor={cardBg} borderRadius={20} padding={16} borderWidth={1} borderColor="#00C48A">
                    <XStack alignItems="center">
                      <YStack width={36} height={36} borderRadius={18} backgroundColor={`${statusColor(selectedAreaData)}22`} justifyContent="center" alignItems="center" marginRight={12}>
                        <Feather name={selectedAreaData.isOnline ? "zap" : "zap-off"} size={16} color={statusColor(selectedAreaData)} />
                      </YStack>
                      <YStack flex={1} paddingRight={8}>
                        <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary} numberOfLines={1}>{selectedSearchItem.displayTitle}</TText>
                        <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} numberOfLines={1}>{selectedAreaData.finalStatusText} · nearest: {selectedAreaData.name}</TText>
                      </YStack>
                      <TouchableOpacity onPress={() => navigation.navigate("CommunityZonesScreen", { areaId: selectedAreaData.id, areaName: selectedAreaData.name, isOnline: selectedAreaData.isOnline, uptime: selectedAreaData.uptime })}>
                        <YStack width={32} height={32} borderRadius={16} backgroundColor="#00C48A" justifyContent="center" alignItems="center">
                          <Feather name="arrow-right" size={14} color="#FFF" />
                        </YStack>
                      </TouchableOpacity>
                    </XStack>
                  </YStack>
                )}
              </YStack>

              {/* Get your hardware — below the map */}
              <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate("RequestDeviceScreen")} style={{ marginTop: 16 }}>
                <XStack backgroundColor={cardBg} borderRadius={24} padding={18} alignItems="center" borderWidth={1} borderColor={divider}>
                  <Image source={require("../../assets/images/stromdevice.png")} style={{ width: 44, height: 44, resizeMode: "contain", marginRight: 16 }} />
                  <YStack flex={1}>
                    <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} marginBottom={2}>Get Personal Hardware</TText>
                    <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Track your home power with 100% accuracy</TText>
                  </YStack>
                  <YStack width={32} height={32} borderRadius={16} backgroundColor="#00C48A" justifyContent="center" alignItems="center">
                    <Feather name="arrow-right" size={14} color="#FFF" />
                  </YStack>
                </XStack>
              </TouchableOpacity>
            </YStack>
          )}

          {activeTab === "communities" && (
            <YStack paddingHorizontal={24}>
              <XStack backgroundColor={cardBg} borderRadius={16} paddingHorizontal={16} height={50} alignItems="center" borderWidth={1} borderColor={divider}>
                <Feather name="search" size={16} color={theme.textSecondary} />
                <TextInput placeholder={`Search communities in ${selectedCity}...`} placeholderTextColor={theme.textSecondary} style={{ flex: 1, marginLeft: 12, color: theme.textPrimary, fontFamily: "Chirp-Medium" }} value={communitySearchQuery} onChangeText={setCommunitySearchQuery} />
              </XStack>
              <YStack marginTop={16} backgroundColor={cardBg} borderRadius={24} borderWidth={1} borderColor={divider} overflow="hidden">
                {(() => {
                  const list = cityGridItems.filter((i) => i.name.toLowerCase().includes(communitySearchQuery.toLowerCase()));
                  if (list.length === 0) return <TText padding={20} fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} textAlign="center">No communities found in {selectedCity}.</TText>;
                  return list.map((item, index) => {
                    const color = statusColor(item);
                    let icon: any = item.isOnline ? "zap" : "zap-off";
                    if (item.outOfCoverage) icon = "help-circle";
                    let text = item.finalStatusText;
                    if (!item.isChecking && !item.outOfCoverage && !item.isPartial) text = item.isOnline ? "Power is presently available" : "Power outage presently";
                    return (
                      <TouchableOpacity key={item.id} onPress={() => navigation.navigate("CommunityZonesScreen", { areaId: item.id, areaName: item.name, isOnline: item.isOnline, uptime: item.uptime })}>
                        <XStack padding={16} alignItems="center" borderBottomWidth={index === list.length - 1 ? 0 : 1} borderColor={divider}>
                          <YStack width={40} height={40} borderRadius={20} backgroundColor={`${color}22`} justifyContent="center" alignItems="center" marginRight={16}>
                            {item.isChecking ? <ActivityIndicator size="small" color={color} /> : <Feather name={icon} size={18} color={color} />}
                          </YStack>
                          <YStack flex={1}>
                            <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} marginBottom={4}>{item.name}</TText>
                            <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>{text}</TText>
                          </YStack>
                          <YStack width={32} height={32} borderRadius={16} backgroundColor="#00C48A" justifyContent="center" alignItems="center">
                            <Feather name="arrow-right" size={14} color="#FFF" />
                          </YStack>
                        </XStack>
                      </TouchableOpacity>
                    );
                  });
                })()}
              </YStack>
            </YStack>
          )}

          {activeTab === "stats" && (
            <YStack paddingHorizontal={24}>
              {renderAnalyticsCard(`${selectedCity} Analytics`, "Average electricity uptime across the city", chartTimeRange, setChartTimeRange, "city")}
              {renderPredictionCard("city")}

              <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4} marginTop={8}>HARDWARE</TText>
              <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate("RequestDeviceScreen")}>
                <XStack backgroundColor={cardBg} borderRadius={24} padding={18} alignItems="center" borderWidth={1} borderColor={divider}>
                  <Image source={require("../../assets/images/stromdevice.png")} style={{ width: 44, height: 44, resizeMode: "contain", marginRight: 16 }} />
                  <YStack flex={1}>
                    <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} marginBottom={2}>Get Personal Hardware</TText>
                    <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Track home power flow privately</TText>
                  </YStack>
                  <YStack width={32} height={32} borderRadius={16} backgroundColor="#00C48A" justifyContent="center" alignItems="center">
                    <Feather name="arrow-right" size={14} color="#FFF" />
                  </YStack>
                </XStack>
              </TouchableOpacity>
            </YStack>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ---------- HOME MODAL ---------- */}
      <Modal visible={isLocModalVisible} animationType="slide" transparent onRequestClose={() => setIsLocModalVisible(false)}>
        <YStack flex={1} backgroundColor="rgba(0,0,0,0.6)" justifyContent="flex-end">
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsLocModalVisible(false)} />
          <YStack backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} borderTopLeftRadius={32} borderTopRightRadius={32} paddingHorizontal={24} paddingTop={16} height={height * 0.88}>
            <XStack alignItems="center" justifyContent="center" marginBottom={16}>
              <YStack width={40} height={4} borderRadius={2} backgroundColor={divider} />
              <TouchableOpacity onPress={() => setIsLocModalVisible(false)} style={{ position: "absolute", right: 0 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </XStack>

            {/* Two distinct, highlighted containers instead of the old "Home Dashboard" label */}
            <XStack gap={10} marginBottom={20}>
              {([{ key: "analytics", icon: "bar-chart-2", label: "Analytics" }, { key: "address", icon: "home", label: "Change Home Address" }] as const).map((t) => {
                const active = homeModalTab === t.key;
                const disabled = t.key === "analytics" && !defaultLocation;
                return (
                  <TouchableOpacity key={t.key} style={{ flex: 1 }} disabled={disabled} onPress={() => setHomeModalTab(t.key)}>
                    <XStack paddingVertical={12} borderRadius={16} borderWidth={1.5} borderColor={active ? "#00C48A" : divider} backgroundColor={active ? "#00C48A" : cardBg} alignItems="center" justifyContent="center" gap={6} opacity={disabled ? 0.5 : 1}>
                      <Feather name={t.icon as any} size={14} color={active ? "#FFF" : theme.textSecondary} />
                      <TText fontFamily="Chirp-Bold" fontSize={12} color={active ? "#FFF" : theme.textSecondary}>{t.label}</TText>
                    </XStack>
                  </TouchableOpacity>
                );
              })}
            </XStack>

            {homeModalTab === "analytics" && defaultLocation ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <XStack backgroundColor={cardBg} borderRadius={20} padding={16} alignItems="center" borderWidth={1} borderColor="#00C48A" marginBottom={16}>
                  <YStack width={40} height={40} borderRadius={20} backgroundColor={`${statusColor(defaultLocStatus)}22`} justifyContent="center" alignItems="center" marginRight={12}>
                    <Feather name="home" size={18} color={statusColor(defaultLocStatus)} />
                  </YStack>
                  <YStack flex={1}>
                    <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary} numberOfLines={1}>{defaultLocation.name}</TText>
                    <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>{defaultLocStatus?.finalStatusText || "Checking Status"}{defaultLocStatus && defaultLocation.isCustom ? ` · via ${defaultLocStatus.name}` : ""}</TText>
                  </YStack>
                </XStack>

                {renderAnalyticsCard("Electricity Analytics", "How much electricity your home area has had", homeChartTimeRange, setHomeChartTimeRange, "home")}
                {renderPredictionCard("home")}
              </ScrollView>
            ) : (
              <YStack flex={1}>
                {/* Search + confirm stay pinned at the top so users never scroll to save */}
                <XStack backgroundColor={cardBg} borderRadius={16} paddingHorizontal={16} height={56} alignItems="center" borderWidth={1} borderColor={divider}>
                  <Feather name="search" size={16} color={theme.textSecondary} />
                  <TextInput style={{ flex: 1, marginLeft: 12, color: theme.textPrimary, fontFamily: "Chirp-Medium", fontSize: 15 }} placeholder={`Search your address in ${selectedCity}...`} placeholderTextColor={theme.textSecondary} value={locSearchQuery} onChangeText={(t) => { setLocSearchQuery(t); setSelectedLocResult(null); }} />
                  {isLocSearching && <ActivityIndicator size="small" color="#00C48A" />}
                  {locSearchQuery.length > 0 && !isLocSearching && (
                    <TouchableOpacity onPress={() => { setLocSearchQuery(""); setSelectedLocResult(null); }}>
                      <Feather name="x-circle" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  )}
                </XStack>

                <XStack marginTop={12} alignItems="center" gap={10}>
                  <XStack flex={1} alignItems="center" gap={8} backgroundColor={selectedLocResult ? (isDarkMode ? "rgba(0,196,138,0.08)" : "#F0FDF4") : "transparent"} borderRadius={14} paddingHorizontal={selectedLocResult ? 12 : 0} height={52}>
                    <Feather name={selectedLocResult ? "check-circle" : "info"} size={14} color={selectedLocResult ? "#00C48A" : theme.textSecondary} />
                    <TText flex={1} fontFamily={selectedLocResult ? "Chirp-Bold" : "Chirp-Medium"} fontSize={12} color={selectedLocResult ? theme.textPrimary : theme.textSecondary} numberOfLines={2}>
                      {selectedLocResult ? (selectedLocResult.name || selectedLocResult.title) : "Search or pick an address below"}
                    </TText>
                  </XStack>
                  <TouchableOpacity onPress={saveDefaultLocation} disabled={!selectedLocResult || isSavingLoc}>
                    <YStack backgroundColor={selectedLocResult ? "#00C48A" : (isDarkMode ? "#1A221E" : "#E2E8F0")} height={52} paddingHorizontal={18} borderRadius={14} justifyContent="center" alignItems="center">
                      {isSavingLoc ? <ActivityIndicator color="#FFF" /> : (
                        <TText fontFamily="Chirp-Bold" fontSize={14} color={selectedLocResult ? "#FFF" : theme.textSecondary}>{defaultLocation ? "Confirm" : "Save"}</TText>
                      )}
                    </YStack>
                  </TouchableOpacity>
                </XStack>

                <ScrollView style={{ flex: 1, marginTop: 4 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
                {locSearchResults.length > 0 && (
                  <YStack marginTop={20}>
                    <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} marginBottom={12} letterSpacing={1.5}>ADDRESSES IN {selectedCity.toUpperCase()}</TText>
                    <YStack backgroundColor={cardBg} borderRadius={20} borderWidth={1} borderColor={divider} overflow="hidden">
                      {locSearchResults.map((item, idx) => {
                        const sel = selectedLocResult?.id === item.id;
                        return (
                          <TouchableOpacity key={item.id} onPress={() => setSelectedLocResult(item)}>
                            <XStack padding={16} alignItems="center" borderBottomWidth={idx === locSearchResults.length - 1 ? 0 : 1} borderColor={divider} backgroundColor={sel ? (isDarkMode ? "rgba(0,196,138,0.08)" : "#F0FDF4") : "transparent"}>
                              <Feather name="map-pin" size={14} color="#00C48A" style={{ marginRight: 12 }} />
                              <YStack flex={1}>
                                <TText fontFamily="Chirp-Bold" fontSize={14} color={theme.textPrimary} numberOfLines={1}>{item.title}</TText>
                                {!!item.subtitle && <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} numberOfLines={1}>{item.subtitle}</TText>}
                              </YStack>
                              {sel && <Feather name="check-circle" size={18} color="#00C48A" />}
                            </XStack>
                          </TouchableOpacity>
                        );
                      })}
                    </YStack>
                  </YStack>
                )}

                <YStack marginTop={20}>
                  <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} marginBottom={12} letterSpacing={1.5}>STROMPULSE COVERAGE AREAS</TText>
                  <YStack backgroundColor={cardBg} borderRadius={20} borderWidth={1} borderColor={divider} overflow="hidden">
                    {(() => {
                      const list = cityGridItems.filter((i) => i.name.toLowerCase().includes(locSearchQuery.toLowerCase()));
                      if (list.length === 0) return <TText padding={16} fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>No coverage areas match.</TText>;
                      return list.map((item, idx) => {
                        const sel = selectedLocResult?.id === item.id;
                        return (
                          <TouchableOpacity key={item.id} onPress={() => setSelectedLocResult({ id: item.id, name: item.name, lat: item.lat, lng: item.lng, isCustom: false })}>
                            <XStack padding={16} alignItems="center" borderBottomWidth={idx === list.length - 1 ? 0 : 1} borderColor={divider} backgroundColor={sel ? (isDarkMode ? "rgba(0,196,138,0.08)" : "#F0FDF4") : "transparent"}>
                              <Feather name="grid" size={14} color="#00C48A" style={{ marginRight: 12 }} />
                              <TText flex={1} fontFamily="Chirp-Bold" fontSize={14} color={theme.textPrimary}>{item.name}</TText>
                              {sel && <Feather name="check-circle" size={18} color="#00C48A" />}
                            </XStack>
                          </TouchableOpacity>
                        );
                      });
                    })()}
                  </YStack>
                </YStack>

                </ScrollView>
              </YStack>
            )}
          </YStack>
        </YStack>
      </Modal>

      {/* ---------- SIDEBAR ---------- */}
      {isSidebarOpen && (
        <YStack position="absolute" top={0} left={0} right={0} bottom={0} zIndex={99999}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} activeOpacity={1} onPress={() => toggleSidebar(false)} />
          <Animated.View style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: width * 0.78, backgroundColor: cardBg, transform: [{ translateX: sidebarAnim }], paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 24 : 50, paddingHorizontal: 20, borderLeftWidth: 1, borderLeftColor: divider }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <TouchableOpacity onPress={() => toggleSidebar(false)} style={{ alignSelf: "flex-end", padding: 8, marginBottom: 12 }}>
                <Feather name="x" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} onPress={() => { toggleSidebar(false); navigation.navigate("Profile"); }} style={{ flexDirection: "row", alignItems: "center", marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: isDarkMode ? "#1F2E27" : "#F1F5F9" }}>
                {displayAvatar ? (
                  <Image source={{ uri: displayAvatar }} style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: "#00C48A", marginRight: 14 }} />
                ) : (
                  <YStack width={56} height={56} borderRadius={28} backgroundColor="#064E3B" justifyContent="center" alignItems="center" borderWidth={2} borderColor="#00C48A" marginRight={14}>
                    <TText fontFamily="Chirp-Heavy" fontSize={22} color="#FFFFFF">{fullName.charAt(0).toUpperCase()}</TText>
                  </YStack>
                )}
                <YStack flex={1}>
                  <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary} numberOfLines={1}>{fullName}</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={12} color="#00C48A" marginTop={2}>View Profile →</TText>
                </YStack>
              </TouchableOpacity>

              <YStack gap={4} marginBottom={28} paddingBottom={20} borderBottomWidth={1} borderBottomColor={isDarkMode ? "#1F2E27" : "#F1F5F9"}>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("Profile"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="user" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Profile</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("RequestDeviceScreen"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="cpu" size={20} color="#00C48A" />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color="#00C48A">Become a Stromer</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("MySubscriptionsScreen"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="bookmark" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>My Subscriptions</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("AboutScreen"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="info" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>About Strompulse</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("PrivacySecurityScreen"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="shield" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Privacy and Security</TText>
                </TouchableOpacity>
              </YStack>

              <YStack gap={4}>
                <XStack paddingVertical={14} alignItems="center" justifyContent="space-between">
                  <XStack alignItems="center" gap={16}>
                    <Feather name="moon" size={20} color={theme.textPrimary} />
                    <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Dark Mode</TText>
                  </XStack>
                  <Switch value={isDarkMode} onValueChange={() => toggleDarkMode()} trackColor={{ false: theme.border, true: "#00C48A" }} thumbColor="#FFFFFF" />
                </XStack>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("SettingsScreen", { currentName: fullName, currentImage: displayAvatar }); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="settings" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Settings</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { toggleSidebar(false); navigation.navigate("HelpSupportScreen"); }} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Feather name="help-circle" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Help Center</TText>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleLogoutPress} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 }}>
                  <Feather name="log-out" size={20} color="#EF4444" />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color="#EF4444">Log out</TText>
                </TouchableOpacity>
              </YStack>
            </ScrollView>
          </Animated.View>
        </YStack>
      )}
    </YStack>
  );
};

export default ElectricityScreen;