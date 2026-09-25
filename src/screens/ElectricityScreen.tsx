import React, { useState, useEffect, useRef } from "react";
import {
  Platform, StatusBar, RefreshControl, Animated,
  TextInput, ActivityIndicator, Image, SafeAreaView, Dimensions,
  Modal, TouchableOpacity, ScrollView, Linking, Alert, Switch
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather, Ionicons } from "@expo/vector-icons";
import Svg, { Rect, Text as SvgText, Line } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";
import { useAllGridDevices, computeAggregatedHistoryAnalytics, parseStromTimestamp } from "../hooks/useDeviceData";
import { Loading } from "../components/UIComponents";
import CustomMapView from "../components/CustomMapView";
import AuthService from "../services/authService";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { height, width } = Dimensions.get("window");

// --- Base Database (Anchor Nodes) ---
const DEVICE_LOCATIONS: Record<string, { name: string; type: string; lat: number; lng: number; roads: string[] }> = {
  "STROM001": { name: "Jericho Quarters", type: "estate", lat: 7.3970, lng: 3.8650, roads: ["Kudeti", "Onireke", "Jericho GRA"] },
  "STROM002": { name: "Agodi GRA", type: "estate", lat: 7.4080, lng: 3.9050, roads: ["Parliament", "Secretariat", "Ikolaba"] },
  "STROM003": { name: "Bodija Estate", type: "estate", lat: 7.4100, lng: 3.9000, roads: ["Awolowo Road", "Osuntokun", "Housing Corp"] },
  "STROM004": { name: "Challenge", type: "area", lat: 7.3600, lng: 3.8800, roads: ["Ring Rd", "Lagos Ibadan Exp", "Molete"] },
  "STROM005": { name: "Mokola", type: "area", lat: 7.3950, lng: 3.8850, roads: ["Sabo", "Queen Elizabeth Road", "Oremeji"] },
  "STROM006": { name: "Oluyole Estate", type: "estate", lat: 7.3500, lng: 3.8650, roads: ["Mobil", "Adeoyo", "Ring Road"] },
  "STROM007": { name: "Ring Road Area", type: "area", lat: 7.3650, lng: 3.8600, roads: ["State Hospital", "Liberty Stadium", "Oni and Sons"] },
  "STROM008": { name: "UI Campus", type: "school", lat: 7.4420, lng: 3.9000, roads: ["Bello", "Tafawa Balewa Way", "Agbowa"] },
  "STROM009": { name: "Mapo Hall", type: "area", lat: 7.3750, lng: 3.8950, roads: ["Bere", "Oja Oba Market", "Oje"] },
  "STROM010": { name: "Eleyele", type: "area", lat: 7.4050, lng: 3.8550, roads: ["Waterworks", "Jericho Rd", "Polytechnic Rd"] },
  "STROM011": { name: "MONATAN", type: "area", lat: 7.3880, lng: 3.8750, roads: ["New Ife Road", "Old Ife Road"] },
  "STROM012": { name: "OKETEDO", type: "area", lat: 7.3780, lng: 3.9100, roads: ["Oyo Road", "Agbowo Road"] },
};

const CITIES = [
  { name: "Ibadan", available: true },
  { name: "Abuja", available: false },
  { name: "Port Harcourt", available: false },
  { name: "Abeokuta", available: false },
  { name: "Osogbo", available: false },
  { name: "Ilorin", available: false },
];

const CHECKING_COLOR = "#F59E0B";

// ---------------------------------------------------------------------------
// REAL-TIME UPTIME CALCULATION
// ---------------------------------------------------------------------------
// Firebase only ever stores a restoration EVENT under `history/<timestamp>`
// (confirmed shape: { latitude, longitude, status: 1, timestamp, voltage } —
// a snapshot taken the instant power came back, with no duration/end field
// of its own). There is no record of when an outage started, only when it
// ended. Given that, the most honest thing we can compute per device is:
//
//   - Each restoration event implies an "up" interval starting at its own
//     timestamp and running until the NEXT restoration event (if one
//     exists), because a later restoration only happens after another
//     outage occurred in between.
//   - The most recent restoration's "up" interval only extends all the way
//     to "now" if the device is CURRENTLY online. If it's currently
//     offline, we stop that interval at its own timestamp — we have no
//     record of when the current outage began, so we never claim uptime we
//     can't back up with data.
//   - A device with no restoration history at all falls back to its
//     current live state for the whole window (100% if online, 0% if not).
//
// This recalculates from whatever `device.history`/`device.isOnline` looks
// like at render time, so as Firebase pushes new restorations or the
// connection hook flips a device on/off, the next render produces fresh
// percentages — no static/mock data involved.
// ---------------------------------------------------------------------------

const buildUpIntervalsFromHistory = (
  historyNode: any,
  isOnline: boolean,
  nowMs: number
): Array<{ start: number; end: number }> => {
  if (!historyNode) return [];

  const events = Object.keys(historyNode)
    .map((key) => {
      const entry = historyNode[key];
      const tsSource = entry && typeof entry === "object" && entry.timestamp ? entry.timestamp : key;
      const parsed = parseStromTimestamp(String(tsSource));
      return parsed ? parsed.getTime() : null;
    })
    .filter((ts): ts is number => typeof ts === "number" && !Number.isNaN(ts))
    .sort((a, b) => a - b);

  if (events.length === 0) return [];

  const intervals: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < events.length; i++) {
    const start = events[i];
    const isLast = i === events.length - 1;
    const end = isLast ? (isOnline ? nowMs : start) : events[i + 1];
    if (end > start) intervals.push({ start, end });
  }
  return intervals;
};

const sumOverlapMs = (
  intervals: Array<{ start: number; end: number }>,
  rangeStart: number,
  rangeEnd: number
): number => {
  let total = 0;
  for (const iv of intervals) {
    const overlapStart = Math.max(iv.start, rangeStart);
    const overlapEnd = Math.min(iv.end, rangeEnd);
    if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
  }
  return total;
};

// Real, Firebase-driven uptime % (0-100) for a device within [startMs, endMs).
// Returns null when the interval hasn't happened yet, so callers can render it
// as a neutral/future bar instead of a fake 0%.
const calculateIntervalUptime = (device: any, startMs: number, endMs: number, nowMs: number): number | null => {
  if (startMs >= nowMs) return null;

  const clampedEnd = Math.min(endMs, nowMs);
  const durationMs = clampedEnd - startMs;
  if (durationMs <= 0) return null;

  const hasHistory = device?.history && Object.keys(device.history).length > 0;
  if (!hasHistory) {
    return device?.isOnline ? 100 : 0;
  }

  const intervals = buildUpIntervalsFromHistory(device.history, !!device.isOnline, nowMs);
  const upMs = sumOverlapMs(intervals, startMs, clampedEnd);
  const pct = Math.round((upMs / durationMs) * 100);
  return Math.max(0, Math.min(100, pct));
};

const SyncNotice = ({ visible, isDarkMode }: { visible: boolean; isDarkMode: boolean }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: visible ? 1 : 0, duration: 250, useNativeDriver: true }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute", top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 120 : 140,
      alignSelf: 'center', zIndex: 200, opacity: fadeAnim,
      backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF",
      borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0",
      paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20,
      flexDirection: "row", alignItems: "center",
      shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10
    }}>
      <ActivityIndicator size="small" color="#00C48A" style={{ marginRight: 12 }} />
      <TText fontFamily="Chirp-Bold" fontSize={12} color={isDarkMode ? "#A7F3D0" : "#064E3B"}>
        Updating city grid may take some seconds...
      </TText>
    </Animated.View>
  );
};

const ElectricityScreen = ({ navigation }: any) => {
  const { theme, isDarkMode, toggleDarkMode } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"map" | "communities" | "stats">("map");
  const [activeCategory, setActiveCategory] = useState<"All" | "Stable" | "Outage">("All");
  const [selectedCity, setSelectedCity] = useState("Ibadan");
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [greeting, setGreeting] = useState("Good morning");
  const [mapRegion, setMapRegion] = useState<any>(null);

  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedStreetName, setSelectedStreetName] = useState<string | null>(null);
  const [isMapSearchFocused, setIsMapSearchFocused] = useState(false);
  const [recentMapSearch, setRecentMapSearch] = useState<any | null>(null);

  const [communitySearchQuery, setCommunitySearchQuery] = useState("");
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [apiSearchResults, setApiSearchResults] = useState<any[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);
  const [defaultLocation, setDefaultLocation] = useState<any | null>(null);
  const [isLocModalVisible, setIsLocModalVisible] = useState(false);
  const [locSearchQuery, setLocSearchQuery] = useState("");
  const [locSearchResults, setLocSearchResults] = useState<any[]>([]);
  const [isLocSearching, setIsLocSearching] = useState(false);
  const [selectedLocResult, setSelectedLocResult] = useState<any>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(width)).current;

  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportArea, setReportArea] = useState("");
  const [reportStatus, setReportStatus] = useState<"stable" | "outage" | null>(null);
  const [showSyncNotice, setShowSyncNotice] = useState(true);

  const [chartTimeRange, setChartTimeRange] = useState<"Today" | "This Week">("Today");

  const solidActionBg = isDarkMode ? "#FFFFFF" : "#000000";
  const solidActionIcon = isDarkMode ? "#000000" : "#FFFFFF";

  useEffect(() => { const timer = setTimeout(() => setShowSyncNotice(false), 4000); return () => clearTimeout(timer); }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const fetchInitData = async () => {
        try {
          const session = await AuthService.getCurrentSession();
          if (session) setUser(session.user);
          setLocalAvatar(await AsyncStorage.getItem("global_avatar"));
          setLocalName(await AsyncStorage.getItem("global_name"));
          const savedLoc = await AsyncStorage.getItem("strompulse_default_location");
          if (savedLoc) setDefaultLocation(JSON.parse(savedLoc));

          const savedRecentSearch = await AsyncStorage.getItem("strompulse_recent_map_search");
          if (savedRecentSearch) setRecentMapSearch(JSON.parse(savedRecentSearch));
        } catch (e) {}
      };
      fetchInitData();
    }, [])
  );

  const displayAvatar = localAvatar || user?.avatar_url || user?.user_metadata?.avatar_url || null;
  const fullName = localName || user?.full_name || "Afolabi Taiwo Glory";
  const displayName = localName || user?.full_name || "Taiwo";

  const toggleSidebar = (open: boolean) => {
    if (open) {
      setIsSidebarOpen(true);
      Animated.timing(sidebarAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(sidebarAnim, {
        toValue: width,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setIsSidebarOpen(false));
    }
  };

  const handleLogoutPress = () => {
    toggleSidebar(false);
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out of your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await AuthService.logout();
            } catch (err) {
              console.error("Error logging out:", err);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const { devices, loading: devicesLoading } = useAllGridDevices();

  const getNearestNode = (lat: number, lng: number, nodesList: any[]) => {
    if (!nodesList || nodesList.length === 0) return null;
    let nearest = nodesList[0];
    let minDistance = Infinity;
    nodesList.forEach(node => {
      const R = 6371;
      const dLat = (node.lat - lat) * (Math.PI / 180);
      const dLon = (node.lng - lng) * (Math.PI / 180);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat * (Math.PI / 180)) * Math.cos(node.lat * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = R * c;
      if (dist < minDistance) { minDistance = dist; nearest = node; }
    });
    return nearest;
  };

  const gridItems = Object.keys(DEVICE_LOCATIONS).map((id) => {
    const liveDevice = devices.find((d) => d.id === id || d.id?.toUpperCase() === id.toUpperCase());
    const meta = DEVICE_LOCATIONS[id];
    const connectionState = liveDevice ? (liveDevice.connectionState || (liveDevice.isOnline ? 'online' : 'offline')) : 'offline';
    const isOnline = connectionState === 'online';
    const isChecking = connectionState === 'checking';
    const realUptime = liveDevice?.uptime !== undefined ? liveDevice.uptime : (isOnline ? 100 : 0);
    const outOfCoverage = !liveDevice;
    const isPartial = isOnline && realUptime > 0 && realUptime < 100;
    let finalStatusText = outOfCoverage ? "Out of Coverage" : isChecking ? "Checking Status" : isOnline ? "Presently Stable" : "Power Outage";
    if (isPartial) finalStatusText = "Partial Stability";
    return { id, name: meta.name, type: meta.type, lat: meta.lat, lng: meta.lng, roads: meta.roads, city: "Ibadan", isOnline, isChecking, connectionState, uptime: realUptime, outOfCoverage, isPartial, finalStatusText, history: liveDevice?.history };
  });

  let defaultLocStatus = null;
  if (defaultLocation && gridItems.length > 0) {
    defaultLocStatus = defaultLocation.isCustom ? getNearestNode(defaultLocation.lat, defaultLocation.lng, gridItems) : gridItems.find(g => g.id === defaultLocation.id);
  }

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (locSearchQuery.trim().length > 2) {
        setIsLocSearching(true);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locSearchQuery + ", Ibadan")}&format=json&addressdetails=1&limit=5&countrycodes=ng`, { headers: { 'User-Agent': 'StrompulseApp/1.0' } });
          const data = await res.json();
          setLocSearchResults(data.map((d: any) => ({ id: d.place_id.toString(), name: d.name || d.display_name.split(',')[0], lat: parseFloat(d.lat), lng: parseFloat(d.lon), isCustom: true })));
        } catch (error) {} finally { setIsLocSearching(false); }
      } else { setLocSearchResults([]); }
    }, 600);
    return () => clearTimeout(delayDebounceFn);
  }, [locSearchQuery]);

  const saveDefaultLocation = async () => {
    if (selectedLocResult) {
      setDefaultLocation(selectedLocResult);
      await AsyncStorage.setItem("strompulse_default_location", JSON.stringify(selectedLocResult));
      setIsLocModalVisible(false);
      setLocSearchQuery("");
      setSelectedLocResult(null);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (mapSearchQuery.trim().length > 2) {
        setIsSearchingApi(true);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(mapSearchQuery + ", Ibadan")}&format=json&addressdetails=1&limit=5&countrycodes=ng`, { headers: { 'User-Agent': 'StrompulseApp/1.0' } });
          const data = await res.json();
          setApiSearchResults(data.map((d: any) => ({ id: d.place_id.toString(), displayTitle: d.name || d.display_name.split(',')[0], lat: parseFloat(d.lat), lng: parseFloat(d.lon) })));
        } catch (error) {} finally { setIsSearchingApi(false); }
      } else { setApiSearchResults([]); }
    }, 600);
    return () => clearTimeout(delayDebounceFn);
  }, [mapSearchQuery]);

  const combinedSearchResults: any[] = [];
  if (mapSearchQuery.trim().length > 0) {
    const query = mapSearchQuery.toLowerCase().trim();
    gridItems.forEach(item => {
      if (item.name.toLowerCase().includes(query)) combinedSearchResults.push({ ...item, displayTitle: item.name, isStreet: false });
      item.roads.forEach(road => {
        if (road.toLowerCase().includes(query)) combinedSearchResults.push({ ...item, displayTitle: road, isStreet: true });
      });
    });
    apiSearchResults.forEach(apiItem => {
      if (!combinedSearchResults.some(local => local.displayTitle.toLowerCase() === apiItem.displayTitle.toLowerCase())) {
        const nearestNode = getNearestNode(apiItem.lat, apiItem.lng, gridItems);
        combinedSearchResults.push({ ...nearestNode, displayTitle: apiItem.displayTitle, isStreet: true });
      }
    });
  }

  const handleSelectSearchResult = (item: any) => {
    setSelectedAreaId(item.id);
    setSelectedStreetName(item.isStreet ? item.displayTitle : null);
    setMapSearchQuery(item.displayTitle);

    if (item.lat && item.lng) {
      setMapRegion({
        latitude: item.lat,
        longitude: item.lng,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      });
    }

    const searchToSave = { ...item, displayTitle: item.displayTitle };
    setRecentMapSearch(searchToSave);
    AsyncStorage.setItem("strompulse_recent_map_search", JSON.stringify(searchToSave));

    setIsMapSearchFocused(false);
  };

  const onRefresh = async () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); };

  const handleSendReport = () => {
    if (!reportArea || !reportStatus) return;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(`Hello Strompulse, I want to report a power update:\n*Area:* ${reportArea}\n*Status:* ${reportStatus === "stable" ? "Presently Stable" : "Power Outage"}`)}`).catch(() => Alert.alert("WhatsApp not found", "Please install WhatsApp to send this report."));
    setIsReportModalVisible(false); setReportArea(""); setReportStatus(null);
  };

  if (devicesLoading && devices.length === 0) {
    return <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} justifyContent="center" alignItems="center"><Loading /></YStack>;
  }

  const historyAnalytics = computeAggregatedHistoryAnalytics(gridItems.map((item) => ({ history: item.history, isOnline: item.isOnline })));

  const filteredCommunities = gridItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(communitySearchQuery.toLowerCase());
    let matchesFilter = true;
    if (activeCategory === "Stable") matchesFilter = item.isOnline && !item.isPartial;
    if (activeCategory === "Outage") matchesFilter = (!item.isOnline && !item.isChecking) || item.isPartial;
    return matchesSearch && matchesFilter;
  });

  const selectedAreaData = selectedAreaId ? gridItems.find(item => item.id === selectedAreaId) : null;
  const showSearchDropdown = (mapSearchQuery.length > 0 || (isMapSearchFocused && mapSearchQuery.length === 0 && recentMapSearch)) && !selectedAreaData;

  // --- STRICT REAL-TIME FIREBASE CALCULATION FOR ACCURACY BAR CHART ---
  const renderAccuracyBarChart = () => {
    const now = currentTime;
    const nowDate = new Date(now);
    const currentDay = nowDate.getDay();

    // Time Boundaries
    const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
    const startOfWeek = startOfToday - (currentDay * 24 * 60 * 60 * 1000);

    const labelsToday = ["0-4", "4-8", "8-12", "12-16", "16-20", "20-24"];
    const labelsWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Average a device-level uptime % across every grid item that has live data.
    const averageAcrossGrid = (startMs: number, endMs: number) => {
      let totalPct = 0;
      let counted = 0;
      gridItems.forEach((item) => {
        const liveDev = devices.find((d) => d.id === item.id || d.id?.toUpperCase() === item.id.toUpperCase());
        if (liveDev) {
          const pct = calculateIntervalUptime(liveDev, startMs, endMs, now);
          if (pct !== null) {
            totalPct += pct;
            counted++;
          }
        }
      });
      return counted > 0 ? Math.round(totalPct / counted) : 0;
    };

    // Calculate Bins by iterating over ALL valid Grid Items and averaging their exact math scores
    const intervalData = chartTimeRange === "Today"
      ? labelsToday.map((label, idx) => {
          const startMs = startOfToday + (idx * 4 * 3600 * 1000);
          const endMs = startMs + (4 * 3600 * 1000);
          if (startMs >= now) return { label, accuracy: 0, isFuture: true };
          return { label, accuracy: averageAcrossGrid(startMs, endMs), isFuture: false };
        })
      : labelsWeek.map((label, idx) => {
          const startMs = startOfWeek + (idx * 24 * 3600 * 1000);
          const endMs = startMs + (24 * 3600 * 1000);
          if (startMs >= now) return { label, accuracy: 0, isFuture: true };
          return { label, accuracy: averageAcrossGrid(startMs, endMs), isFuture: false };
        });

    const chartHeight = 190;
    const chartWidth = 320;
    const yAxisLabels = [100, 80, 60, 40, 20, 0];

    const barWidth = chartTimeRange === "Today" ? 28 : 22;
    const gap = chartTimeRange === "Today" ? 18 : 16;
    const startX = 55;
    const chartAreaWidth = intervalData.length * (barWidth + gap);

    return (
      <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} padding={20} marginBottom={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>

        {/* Header & Toggle */}
        <XStack justifyContent="space-between" alignItems="flex-start" marginBottom={20}>
          <XStack alignItems="center" gap={12} flex={1}>
            <YStack width={36} height={36} borderRadius={12} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center">
              <Feather name="bar-chart-2" size={18} color="#00C48A" />
            </YStack>
            <YStack flex={1}>
              <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary}>Grid Accuracy</TText>
            </YStack>
          </XStack>

          {/* Custom Toggle Switch */}
          <XStack backgroundColor={isDarkMode ? "#1A221E" : "#F1F5F9"} borderRadius={12} padding={4}>
            <TouchableOpacity onPress={() => setChartTimeRange("Today")} style={{ paddingVertical: 6, paddingHorizontal: 12, backgroundColor: chartTimeRange === "Today" ? (isDarkMode ? "#2D3B34" : "#FFFFFF") : "transparent", borderRadius: 8 }}>
              <TText fontSize={11} fontFamily="Chirp-Bold" color={chartTimeRange === "Today" ? theme.textPrimary : theme.textSecondary}>Today</TText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setChartTimeRange("This Week")} style={{ paddingVertical: 6, paddingHorizontal: 12, backgroundColor: chartTimeRange === "This Week" ? (isDarkMode ? "#2D3B34" : "#FFFFFF") : "transparent", borderRadius: 8 }}>
              <TText fontSize={11} fontFamily="Chirp-Bold" color={chartTimeRange === "This Week" ? theme.textPrimary : theme.textSecondary}>This week</TText>
            </TouchableOpacity>
          </XStack>
        </XStack>

        <YStack height={chartHeight} width="100%">
          <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>

            {/* Y Axis Label */}
            <SvgText
              x={12}
              y={chartHeight / 2 - 10}
              fill={theme.textSecondary}
              fontSize={10}
              fontFamily="Chirp-Bold"
              transform={`rotate(-90, 12, ${chartHeight / 2 - 10})`}
              textAnchor="middle"
            >
              Uptime
            </SvgText>

            {/* Y-Axis Grid Lines & Numbers */}
            {yAxisLabels.map((val, idx) => {
              const yPos = 20 + (idx * 22);
              return (
                <React.Fragment key={idx}>
                  <SvgText x={40} y={yPos + 4} fill={theme.textSecondary} fontSize={10} fontFamily="Chirp-Bold" textAnchor="end">
                    {val}
                  </SvgText>
                  <Line x1={48} y1={yPos} x2={chartWidth - 10} y2={yPos} stroke={isDarkMode ? "#22302A" : "#F1F5F9"} strokeWidth="1" />
                </React.Fragment>
              );
            })}

            {/* Bars for intervals */}
            {intervalData.map((item, index) => {
              const xPos = startX + index * (barWidth + gap);
              const maxBarHeight = 132;
              const barH = item.isFuture ? 4 : Math.max(6, (item.accuracy / 100) * maxBarHeight);
              const yPos = 20 + maxBarHeight - barH;

              let barColor = "#EF4444"; // Defaults to Red for 0%
              if (item.accuracy >= 70) {
                barColor = "#00C48A";
              } else if (item.accuracy >= 40) {
                barColor = "#F59E0B";
              }

              if (item.isFuture) {
                barColor = isDarkMode ? "#2D3B34" : "#E2E8F0";
              }

              return (
                <React.Fragment key={index}>
                  <Rect x={xPos} y={yPos} width={barWidth} height={barH} rx={6} fill={barColor} />
                  <SvgText x={xPos + barWidth / 2} y={chartHeight - 20} fill={theme.textSecondary} fontSize={9} fontFamily="Chirp-Bold" textAnchor="middle">
                    {item.label}
                  </SvgText>
                </React.Fragment>
              );
            })}

            {/* X Axis Label */}
            <SvgText
              x={startX + (chartAreaWidth / 2) - gap/2}
              y={chartHeight - 4}
              fill={theme.textSecondary}
              fontSize={10}
              fontFamily="Chirp-Bold"
              textAnchor="middle"
            >
              {chartTimeRange === "Today" ? "hours" : "days"}
            </SvgText>

          </Svg>
        </YStack>
      </YStack>
    );
  };

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} />
      <SyncNotice visible={showSyncNotice} isDarkMode={isDarkMode} />

      <SafeAreaView style={{ flex: 1 }}>

        {/* --- HEADER: Logo extreme left, centered title, hamburger right --- */}
        <XStack alignItems="center" justifyContent="space-between" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={8}>
          <Image source={require("../../assets/images/strompulselogo.png")} style={{ width: 40, height: 40, resizeMode: "contain" }} />

          <TText style={{ fontFamily: "Sora_700Bold", fontSize: 18 }} color={theme.textPrimary}>Strompulse</TText>

          <TouchableOpacity onPress={() => toggleSidebar(true)}>
            <YStack width={42} height={42} justifyContent="center" alignItems="flex-end">
              <Feather name="menu" size={24} color={theme.textPrimary} />
            </YStack>
          </TouchableOpacity>
        </XStack>

        {/* --- LIVE GRID STATUS (Left) & GREETING (Right) --- */}
        <XStack alignItems="center" justifyContent="space-between" paddingHorizontal={24} marginBottom={16}>
          <XStack alignItems="center" gap={6} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} paddingHorizontal={12} paddingVertical={6} borderRadius={16} borderWidth={1} borderColor={isDarkMode ? "#047857" : "#A7F3D0"}>
            <YStack width={6} height={6} borderRadius={3} backgroundColor="#00C48A" />
            <TText fontFamily="Chirp-Bold" fontSize={11} color="#00C48A" textTransform="uppercase" letterSpacing={0.5}>Live grid status</TText>
          </XStack>

          <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary}>
            {greeting}, {displayName.split(' ')[0]}
          </TText>
        </XStack>

        {/* --- CITY DROPDOWN WITH SELECT YOUR CITY LABEL --- */}
        <YStack zIndex={10000} marginHorizontal={24} marginBottom={24} position="relative">
          {/* Overlapping Text Label */}
          <YStack position="absolute" top={-8} left={20} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} paddingHorizontal={4} zIndex={10}>
             <TText fontSize={10} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={0.5}>SELECT YOUR CITY</TText>
          </YStack>

          <TouchableOpacity activeOpacity={0.8} onPress={() => setIsCityDropdownOpen(!isCityDropdownOpen)}>
            <XStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={20} paddingHorizontal={16} paddingVertical={12} alignItems="center" justifyContent="space-between" borderWidth={1.5} borderColor="#00C48A">
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
            <YStack position="absolute" top={64} left={0} right={0} backgroundColor={isDarkMode ? "#1A221E" : "#FFFFFF"} borderRadius={16} padding={8} shadowColor="#000" shadowOpacity={0.15} shadowRadius={15} shadowOffset={{width:0, height:6}} borderWidth={1} borderColor="#00C48A">
              {CITIES.map((city, idx) => (
                <TouchableOpacity key={idx} disabled={!city.available} onPress={() => { if (city.available) { setSelectedCity(city.name); setIsCityDropdownOpen(false); } }}>
                  <XStack alignItems="center" justifyContent="space-between" padding={12} backgroundColor={selectedCity === city.name ? (isDarkMode ? "rgba(0,196,138,0.1)" : "#F0FDF4") : "transparent"} borderRadius={12}>
                    <TText fontFamily="Chirp-Bold" fontSize={14} color={city.available ? theme.textPrimary : theme.textSecondary}>
                      {city.name} {!city.available && "(Coming Soon)"}
                    </TText>
                    {selectedCity === city.name && <Feather name="check-circle" size={16} color="#00C48A" />}
                    {!city.available && <Feather name="lock" size={14} color={theme.textSecondary} />}
                  </XStack>
                </TouchableOpacity>
              ))}
            </YStack>
          )}
        </YStack>

        {/* --- OVAL SEGMENTED TABS ("Communities") --- */}
        <XStack marginHorizontal={24} marginBottom={24} justifyContent="space-between" gap={8}>
          {(["map", "communities", "stats"] as const).map((tab) => {
            const isActive = activeTab === tab;
            let iconName = "map";
            let label = "Map";
            if (tab === "communities") { iconName = "grid"; label = "Communities"; }
            if (tab === "stats") { iconName = "bar-chart-2"; label = "Analytics"; }

            return (
              <TouchableOpacity key={tab} activeOpacity={0.8} onPress={() => setActiveTab(tab)} style={{ flex: 1 }}>
                <XStack
                  paddingVertical={10}
                  alignItems="center"
                  justifyContent="center"
                  borderRadius={24}
                  borderWidth={1}
                  borderColor={isActive ? "transparent" : (isDarkMode ? "#2D3B34" : "#E2E8F0")}
                  backgroundColor={isActive ? solidActionBg : "transparent"}
                  gap={6}
                >
                  <Feather name={iconName as any} size={14} color={isActive ? solidActionIcon : (isDarkMode ? "#64748B" : "#94A3B8")} />
                  <TText fontFamily={isActive ? "Chirp-Heavy" : "Chirp-Bold"} fontSize={12} color={isActive ? solidActionIcon : (isDarkMode ? "#64748B" : "#94A3B8")}>
                    {label}
                  </TText>
                </XStack>
              </TouchableOpacity>
            );
          })}
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C48A" />}>

          {/* DEFAULT LOCATION CARD */}
          <YStack paddingHorizontal={24} marginBottom={24}>
            {!defaultLocation ? (
              <TouchableOpacity activeOpacity={0.8} onPress={() => setIsLocModalVisible(true)}>
                <XStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={20} paddingHorizontal={16} paddingVertical={14} alignItems="center" justifyContent="space-between" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                  <XStack alignItems="center" gap={12}>
                    <YStack width={32} height={32} borderRadius={16} backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} justifyContent="center" alignItems="center">
                      <Feather name="home" size={14} color={theme.textSecondary} />
                    </YStack>
                    <YStack>
                      <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary}>Set Home Area</TText>
                      <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={2}>Quick-view your status</TText>
                    </YStack>
                  </XStack>
                  <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                </XStack>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity activeOpacity={0.8} onPress={() => setIsLocModalVisible(true)}>
                <XStack
                  backgroundColor={defaultLocStatus?.isOnline ? (isDarkMode ? "rgba(0,196,138,0.05)" : "#ECFDF5") : (isDarkMode ? "rgba(239,68,68,0.05)" : "#FEE2E2")}
                  borderRadius={20} paddingHorizontal={16} paddingVertical={14} alignItems="center" justifyContent="space-between"
                  borderWidth={1} borderColor={defaultLocStatus?.isOnline ? (isDarkMode ? "#064E3B" : "#A7F3D0") : (isDarkMode ? "#7F1D1D" : "#FECACA")}
                >
                  <XStack alignItems="center" gap={12} flex={1}>
                    <YStack width={36} height={36} borderRadius={18} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} justifyContent="center" alignItems="center" borderWidth={1} borderColor={defaultLocStatus?.isOnline ? (isDarkMode ? "#00C48A" : "#D1FAE5") : (isDarkMode ? "#EF4444" : "#FEE2E2")}>
                       <Feather name={defaultLocStatus?.isOnline ? "zap" : "zap-off"} size={16} color={defaultLocStatus?.isOnline ? "#00C48A" : "#EF4444"} />
                    </YStack>
                    <YStack flex={1} paddingRight={12}>
                      <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary} marginBottom={2}>{defaultLocStatus?.finalStatusText}</TText>
                      <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} numberOfLines={1}>{defaultLocation.name}</TText>
                    </YStack>
                  </XStack>
                  <YStack width={28} height={28} borderRadius={14} backgroundColor={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} justifyContent="center" alignItems="center">
                    <Feather name="edit-2" size={12} color={theme.textPrimary} />
                  </YStack>
                </XStack>
              </TouchableOpacity>
            )}
          </YStack>

          {/* MAP TAB */}
          {activeTab === "map" && (
            <YStack paddingHorizontal={24} paddingBottom={20} zIndex={9000}>
              <YStack position="relative" height={450} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>

                <YStack flex={1} backgroundColor={isDarkMode ? "#121A16" : "#F8FAFC"}>
                  <CustomMapView
                    showCoverage={true}
                    onMarkerPress={(id) => {
                      setSelectedAreaId(id);
                      setSelectedStreetName(null);
                      setIsMapSearchFocused(false);
                    }}
                    markers={gridItems.map((item) => ({ id: item.id, title: item.name, description: item.finalStatusText, isOnline: item.isOnline, isChecking: item.isChecking, connectionState: item.connectionState, latitude: item.lat, longitude: item.lng }))}
                  />
                </YStack>

                <XStack position="absolute" top={16} left={16} right={16} zIndex={100} backgroundColor={isDarkMode ? "#1A221E" : "#FFFFFF"} borderRadius={16} paddingHorizontal={16} height={52} alignItems="center" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                  <Feather name="search" size={18} color={theme.textSecondary} />
                  <TextInput
                    placeholder="Search grid..."
                    placeholderTextColor={theme.textSecondary}
                    style={{ flex: 1, marginLeft: 12, fontSize: 14, fontFamily: "Chirp-Medium", color: theme.textPrimary }}
                    value={mapSearchQuery}
                    onChangeText={(t) => {
                      setMapSearchQuery(t);
                      if(selectedAreaId) { setSelectedAreaId(null); setSelectedStreetName(null); }
                    }}
                    onFocus={() => {
                      setIsMapSearchFocused(true);
                      if (selectedAreaId) { setSelectedAreaId(null); setMapSearchQuery(""); }
                    }}
                  />
                  {(mapSearchQuery.length > 0 || isMapSearchFocused) && (
                    <TouchableOpacity onPress={() => { setMapSearchQuery(""); setIsMapSearchFocused(false); setSelectedAreaId(null); }}>
                      <Feather name="x-circle" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  )}
                </XStack>

                {showSearchDropdown && (
                  <YStack position="absolute" top={76} left={16} right={16} zIndex={101} backgroundColor={isDarkMode ? "#1A221E" : "#FFFFFF"} borderRadius={16} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} maxHeight={250} overflow="hidden">
                    <ScrollView keyboardShouldPersistTaps="handled">
                      {mapSearchQuery.length === 0 && recentMapSearch ? (
                        <YStack>
                          <TText paddingHorizontal={16} paddingTop={16} paddingBottom={8} fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={1.5}>RECENT SEARCH</TText>
                          <TouchableOpacity activeOpacity={0.7} onPress={() => handleSelectSearchResult(recentMapSearch)}>
                            <XStack padding={16} alignItems="center">
                              <YStack width={32} height={32} borderRadius={16} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center" marginRight={16}>
                                <Feather name="clock" size={14} color="#00C48A" />
                              </YStack>
                              <YStack flex={1}>
                                <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary} marginBottom={2} numberOfLines={1}>{recentMapSearch.displayTitle}</TText>
                                <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>{recentMapSearch.finalStatusText}</TText>
                              </YStack>
                              <TouchableOpacity onPress={() => { setRecentMapSearch(null); AsyncStorage.removeItem("strompulse_recent_map_search"); }} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                                <Feather name="trash-2" size={16} color={theme.textSecondary} />
                              </TouchableOpacity>
                            </XStack>
                          </TouchableOpacity>
                        </YStack>
                      ) : isSearchingApi && combinedSearchResults.length === 0 ? (
                        <YStack padding={24} alignItems="center">
                            <ActivityIndicator size="small" color="#00C48A" />
                            <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} marginTop={12}>Scanning...</TText>
                        </YStack>
                      ) : combinedSearchResults.length === 0 ? (
                        <YStack padding={24} alignItems="center">
                            <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>No exact street found.</TText>
                        </YStack>
                      ) : (
                        combinedSearchResults.map((item, idx) => (
                          <TouchableOpacity key={`${item.id}-${idx}`} onPress={() => handleSelectSearchResult(item)}>
                            <XStack padding={16} alignItems="center" borderBottomWidth={idx === combinedSearchResults.length - 1 ? 0 : 1} borderBottomColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                              <YStack width={32} height={32} borderRadius={16} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center" marginRight={16}>
                                <Feather name={item.isStreet ? "map-pin" : "grid"} size={14} color="#00C48A" />
                              </YStack>
                              <YStack flex={1}>
                                <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary} marginBottom={2} numberOfLines={1}>{item.displayTitle}</TText>
                                <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>{item.finalStatusText}</TText>
                              </YStack>
                            </XStack>
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  </YStack>
                )}

                {selectedAreaData && (
                  <YStack position="absolute" bottom={16} left={16} right={16} zIndex={101} backgroundColor={isDarkMode ? "rgba(18,26,22,0.95)" : "rgba(255,255,255,0.95)"} borderRadius={20} padding={16} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                    <XStack alignItems="center" justifyContent="space-between">
                      <XStack alignItems="center" flex={1} marginRight={12}>
                        <YStack width={44} height={44} borderRadius={22} backgroundColor={selectedAreaData.isChecking ? (isDarkMode ? "rgba(245,158,11,0.1)" : "#FEF3C7") : selectedAreaData.isOnline ? (isDarkMode ? "rgba(0,196,138,0.1)" : "#D1FAE5") : (isDarkMode ? "rgba(239,68,68,0.1)" : "#FEE2E2")} justifyContent="center" alignItems="center" marginRight={12}>
                          {selectedAreaData.isChecking ? <ActivityIndicator size="small" color={CHECKING_COLOR} /> : <Feather name={selectedAreaData.isOnline ? "zap" : "zap-off"} size={18} color={selectedAreaData.isOnline ? "#00C48A" : "#EF4444"} />}
                        </YStack>
                        <YStack flex={1}>
                          <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary} marginBottom={2} numberOfLines={1}>{selectedStreetName || selectedAreaData.name}</TText>
                          <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>{selectedAreaData.finalStatusText}</TText>
                        </YStack>
                      </XStack>
                      <TouchableOpacity onPress={() => navigation.navigate("CommunityZonesScreen", { areaId: selectedAreaData.id, areaName: selectedStreetName || selectedAreaData.name, isOnline: selectedAreaData.isOnline, uptime: selectedAreaData.uptime })}>
                        <YStack width={40} height={40} borderRadius={20} backgroundColor={solidActionBg} justifyContent="center" alignItems="center">
                          <Feather name="arrow-right" size={18} color={solidActionIcon} />
                        </YStack>
                      </TouchableOpacity>
                    </XStack>
                  </YStack>
                )}
              </YStack>
            </YStack>
          )}

          {/* COMMUNITIES TAB */}
          {activeTab === "communities" && (
            <YStack paddingBottom={20} paddingHorizontal={24}>

              <XStack marginBottom={20} gap={10}>
                {["All", "Stable", "Outage"].map(cat => {
                  const isActive = activeCategory === cat;
                  return (
                    <TouchableOpacity key={cat} activeOpacity={0.8} onPress={() => setActiveCategory(cat as any)}>
                      <XStack
                        backgroundColor={isActive ? solidActionBg : (isDarkMode ? "#1A221E" : "#FFFFFF")}
                        paddingHorizontal={16} paddingVertical={8} borderRadius={16} alignItems="center"
                        borderWidth={1} borderColor={isActive ? "transparent" : (isDarkMode ? "#2D3B34" : "#E2E8F0")}
                      >
                        <TText fontFamily="Chirp-Bold" fontSize={12} color={isActive ? solidActionIcon : theme.textSecondary}>{cat}</TText>
                      </XStack>
                    </TouchableOpacity>
                  );
                })}
              </XStack>

              <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={24}>
                <XStack padding={18} alignItems="center">
                  <Feather name="search" size={18} color={theme.textSecondary} />
                  <TextInput placeholder="Search communities..." placeholderTextColor={theme.textSecondary} style={{ flex: 1, marginLeft: 16, fontSize: 15, fontFamily: "Chirp-Medium", color: theme.textPrimary }} value={communitySearchQuery} onChangeText={setCommunitySearchQuery} />
                </XStack>
              </YStack>

              <XStack justifyContent="space-between" alignItems="center" marginBottom={12} paddingHorizontal={4}>
                <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5}>GRID REGIONS</TText>
                <TText fontFamily="Chirp-Bold" fontSize={10} color="#00C48A" letterSpacing={1}>~70% ACCURACY</TText>
              </XStack>

              <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                {filteredCommunities.map((item, index) => {
                  let color = item.isOnline ? "#00C48A" : "#EF4444";
                  let bg = item.isOnline ? (isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5") : (isDarkMode ? "rgba(239,68,68,0.1)" : "#FEE2E2");
                  let icon = item.isOnline ? "zap" : "zap-off";
                  if (item.isPartial) { color = "#F59E0B"; bg = isDarkMode ? "rgba(245,158,11,0.1)" : "#FEF3C7"; }
                  if (item.outOfCoverage) { color = theme.textSecondary; bg = isDarkMode ? "#1A221E" : "#F8FAFC"; icon = "help-circle"; }

                  return (
                    <TouchableOpacity key={item.id} onPress={() => navigation.navigate("CommunityZonesScreen", { areaId: item.id, areaName: item.name, isOnline: item.isOnline, uptime: item.uptime })}>
                      <XStack padding={16} alignItems="center" borderBottomWidth={index === filteredCommunities.length - 1 ? 0 : 1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                        <YStack width={40} height={40} borderRadius={20} backgroundColor={bg} justifyContent="center" alignItems="center" marginRight={16}>
                          <Feather name={icon as any} size={18} color={color} />
                        </YStack>
                        <YStack flex={1}>
                          <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} marginBottom={4}>{item.name}</TText>
                          <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>{item.finalStatusText}</TText>
                        </YStack>

                        <YStack width={32} height={32} borderRadius={16} backgroundColor={solidActionBg} justifyContent="center" alignItems="center">
                          <Feather name="arrow-right" size={14} color={solidActionIcon} />
                        </YStack>
                      </XStack>
                    </TouchableOpacity>
                  );
                })}
                {filteredCommunities.length === 0 && (
                  <YStack padding={24} alignItems="center">
                    <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary}>No communities match your search.</TText>
                  </YStack>
                )}
              </YStack>
            </YStack>
          )}

          {/* INSIGHTS / ANALYTICS TAB */}
          {activeTab === "stats" && (
            <YStack paddingBottom={20}>
              {renderAccuracyBarChart()}

              <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={28}>OVERVIEW</TText>
              <YStack marginHorizontal={24} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} marginBottom={32}>
                <XStack padding={18} alignItems="center">
                  <YStack width={32} height={32} borderRadius={16} backgroundColor={isDarkMode ? "rgba(139,92,246,0.1)" : "#F3E8FF"} justifyContent="center" alignItems="center">
                    <Feather name="refresh-cw" size={16} color={isDarkMode ? "#A78BFA" : "#8B5CF6"} />
                  </YStack>
                  <TText flex={1} marginLeft={16} fontFamily="Chirp-Medium" fontSize={15} color={theme.textPrimary}>Daily Restorations</TText>
                  <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary}>{historyAnalytics.totalRestorationsInRange}</TText>
                </XStack>
              </YStack>
            </YStack>
          )}

          {/* HARDWARE ITEM */}
          <YStack paddingHorizontal={24}>
            <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>HARDWARE</TText>
            <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate("RequestDeviceScreen")}>
              <XStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} padding={18} alignItems="center" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center" marginRight={16}>
                  <Feather name="cpu" size={18} color="#00C48A" />
                </YStack>
                <YStack flex={1}>
                  <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} marginBottom={2}>Get Personal Hardware</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Track home power flow privately</TText>
                </YStack>
                <YStack width={32} height={32} borderRadius={16} backgroundColor={solidActionBg} justifyContent="center" alignItems="center">
                  <Feather name="arrow-right" size={14} color={solidActionIcon} />
                </YStack>
              </XStack>
            </TouchableOpacity>
          </YStack>

        </ScrollView>
      </SafeAreaView>

      {/* --- X-INSPIRED RIGHT SIDEBAR DRAWER --- */}
      {isSidebarOpen && (
        <YStack position="absolute" top={0} left={0} right={0} bottom={0} zIndex={99999}>
          {/* Backdrop */}
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
            activeOpacity={1}
            onPress={() => toggleSidebar(false)}
          />

          {/* Sliding Panel from Right */}
       <Animated.View style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            width: width * 0.78,
            backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF",
            transform: [{ translateX: sidebarAnim }],
            paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 50,
            paddingHorizontal: 20,
            borderLeftWidth: 1,
            borderLeftColor: isDarkMode ? "#2D3B34" : "#E2E8F0",
            elevation: 20,
            shadowColor: "#000",
            shadowOffset: { width: -5, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 15,
          }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

              {/* Close Button */}
              <TouchableOpacity onPress={() => toggleSidebar(false)} style={{ alignSelf: "flex-end", padding: 8, marginBottom: 12 }}>
                <Feather name="x" size={24} color={theme.textPrimary} />
              </TouchableOpacity>

              {/* TOP SECTION: User Profile Picture & Full Name */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => { toggleSidebar(false); navigation.navigate("Profile"); }}
                style={{ flexDirection: "row", alignItems: "center", marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: isDarkMode ? "#1F2E27" : "#F1F5F9" }}
              >
                {displayAvatar ? (
                  <Image source={{ uri: displayAvatar }} style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: "#00C48A", marginRight: 14 }} />
                ) : (
                  <YStack width={56} height={56} borderRadius={28} backgroundColor="#064E3B" justifyContent="center" alignItems="center" borderWidth={2} borderColor="#00C48A" marginRight={14}>
                    <TText fontFamily="Chirp-Heavy" fontSize={22} color="#FFFFFF">
                      {fullName.charAt(0).toUpperCase()}
                    </TText>
                  </YStack>
                )}
                <YStack flex={1}>
                  <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary} numberOfLines={1}>{fullName}</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={12} color="#00C48A" marginTop={2}>View Profile →</TText>
                </YStack>
              </TouchableOpacity>

              {/* MIDDLE SECTION: Navigation Links */}
              <YStack gap={4} marginBottom={28} paddingBottom={20} borderBottomWidth={1} borderBottomColor={isDarkMode ? "#1F2E27" : "#F1F5F9"}>
                <TouchableOpacity
                  onPress={() => { toggleSidebar(false); navigation.navigate("Profile"); }}
                  style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}
                >
                  <Feather name="user" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Profile</TText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { toggleSidebar(false); navigation.navigate("RequestDeviceScreen"); }}
                  style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}
                >
                  <Feather name="cpu" size={20} color="#00C48A" />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color="#00C48A">Become a Stromer</TText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { toggleSidebar(false); navigation.navigate("AboutScreen"); }}
                  style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}
                >
                  <Feather name="info" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>About Strompulse</TText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { toggleSidebar(false); navigation.navigate("SafetySettingsScreen"); }}
                  style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}
                >
                  <Feather name="shield" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Privacy and Security</TText>
                </TouchableOpacity>
              </YStack>

              {/* LOWER SECTION: Dark mode toggle, Help center, Log out */}
              <YStack gap={4}>
                <XStack paddingVertical={14} alignItems="center" justifyContent="space-between">
                  <XStack alignItems="center" gap={16}>
                    <Feather name="moon" size={20} color={theme.textPrimary} />
                    <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Dark Mode</TText>
                  </XStack>
                  <Switch
                    value={isDarkMode}
                    onValueChange={() => toggleDarkMode()}
                    trackColor={{ false: theme.border, true: "#00C48A" }}
                    thumbColor="#FFFFFF"
                  />
                </XStack>

                <TouchableOpacity
                  onPress={() => {
                    toggleSidebar(false);
                    Linking.openURL("whatsapp://send?text=Hello%20Strompulse%20Support,%20I%20need%20help%20with...").catch(() => Alert.alert("WhatsApp not found", "Please install WhatsApp for support."));
                  }}
                  style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}
                >
                  <Feather name="help-circle" size={20} color={theme.textPrimary} />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary}>Help Center</TText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleLogoutPress}
                  style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 }}
                >
                  <Feather name="log-out" size={20} color="#EF4444" />
                  <TText fontFamily="Chirp-Bold" fontSize={15} color="#EF4444">Log out</TText>
                </TouchableOpacity>
              </YStack>

            </ScrollView>
          </Animated.View>
        </YStack>
      )}

      {/* HOME AREA MODAL */}
      <Modal visible={isLocModalVisible} animationType="slide" transparent={true}>
        <YStack flex={1} backgroundColor="rgba(0,0,0,0.6)" justifyContent="flex-end">
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsLocModalVisible(false)} />
          <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderTopLeftRadius={32} borderTopRightRadius={32} paddingHorizontal={24} paddingTop={24} height={height * 0.85}>
            <YStack width={40} height={4} borderRadius={2} backgroundColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} alignSelf="center" marginBottom={24} />
            <TText fontFamily="Chirp-Heavy" fontSize={22} color={theme.textPrimary} marginBottom={8}>Set Home Area</TText>
            <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} marginBottom={24}>Enter your street or estate to lock in your live dashboard.</TText>

            <XStack backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} borderRadius={16} paddingHorizontal={20} height={56} alignItems="center" marginBottom={16} borderWidth={1} borderColor={selectedLocResult ? "#00C48A" : (isDarkMode ? "#2D3B34" : "#E2E8F0")}>
              <TextInput style={{ flex: 1, fontFamily: "Chirp-Medium", fontSize: 15, color: theme.textPrimary }} placeholder="e.g. Oyo Road, Bodija" placeholderTextColor={theme.textSecondary} value={selectedLocResult ? selectedLocResult.name : locSearchQuery} onChangeText={(text) => { if(selectedLocResult) setSelectedLocResult(null); setLocSearchQuery(text); }} />
              {selectedLocResult && (
                <TouchableOpacity onPress={() => { setSelectedLocResult(null); setLocSearchQuery(""); }}>
                  <Feather name="x-circle" size={18} color="#00C48A" />
                </TouchableOpacity>
              )}
            </XStack>

            <TouchableOpacity onPress={saveDefaultLocation} disabled={!selectedLocResult}>
              <YStack backgroundColor={selectedLocResult ? solidActionBg : (isDarkMode ? "#1A221E" : "#E2E8F0")} height={56} borderRadius={16} justifyContent="center" alignItems="center" marginBottom={24}>
                <TText fontFamily="Chirp-Bold" fontSize={15} color={selectedLocResult ? solidActionIcon : theme.textSecondary}>Confirm Location</TText>
              </YStack>
            </TouchableOpacity>

            <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} marginBottom={12} textTransform="uppercase" letterSpacing={1.5}>OR SELECT FROM GRID</TText>

            <YStack backgroundColor={isDarkMode ? "#1A221E" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} flex={1} marginBottom={40}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {locSearchQuery.length > 2 && !selectedLocResult ? (
                  isLocSearching ? (
                    <ActivityIndicator size="small" color="#00C48A" style={{ marginTop: 24 }} />
                  ) : locSearchResults.length > 0 ? (
                    locSearchResults.map((loc, idx) => (
                      <TouchableOpacity key={`search-${idx}`} onPress={() => setSelectedLocResult(loc)}>
                        <XStack alignItems="center" padding={16} borderBottomWidth={idx === locSearchResults.length - 1 ? 0 : 1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                          <YStack width={36} height={36} borderRadius={18} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center" marginRight={12}>
                            <Feather name="map-pin" size={16} color="#00C48A" />
                          </YStack>
                          <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary} flex={1}>{loc.name}</TText>
                        </XStack>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} textAlign="center" marginTop={24}>No exact areas found.</TText>
                  )
                ) : (
                  gridItems.map((item, index) => (
                    <TouchableOpacity key={item.id} onPress={() => setSelectedLocResult({ ...item, isCustom: false })}>
                      <XStack backgroundColor={selectedLocResult?.id === item.id ? (isDarkMode ? "rgba(0,196,138,0.05)" : "#F0FDF4") : "transparent"} padding={16} alignItems="center" borderBottomWidth={index === gridItems.length - 1 ? 0 : 1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                        <YStack width={36} height={36} borderRadius={18} backgroundColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} justifyContent="center" alignItems="center" marginRight={16}>
                          <Feather name="target" size={16} color={theme.textSecondary} />
                        </YStack>
                        <YStack flex={1}>
                          <TText fontFamily="Chirp-Bold" fontSize={15} color={theme.textPrimary} marginBottom={2}>{item.name}</TText>
                          <TText fontFamily="Chirp-Medium" fontSize={12} color={item.isOnline ? "#00C48A" : (item.isChecking ? CHECKING_COLOR : "#EF4444")}>{item.finalStatusText}</TText>
                        </YStack>
                        {selectedLocResult?.id === item.id && <Feather name="check" size={18} color="#00C48A" />}
                      </XStack>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </YStack>
          </YStack>
        </YStack>
      </Modal>

      {/* REPORT MODAL */}
      <Modal visible={isReportModalVisible} animationType="slide" transparent={true}>
        <YStack flex={1} backgroundColor="rgba(0,0,0,0.6)" justifyContent="flex-end">
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsReportModalVisible(false)} />
          <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderTopLeftRadius={32} borderTopRightRadius={32} padding={24}>
            <YStack width={40} height={4} borderRadius={2} backgroundColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} alignSelf="center" marginBottom={24} />
            <TText fontFamily="Chirp-Heavy" fontSize={22} color={theme.textPrimary} marginBottom={8}>Report Power Status</TText>
            <TText fontFamily="Chirp-Medium" fontSize={14} color={theme.textSecondary} marginBottom={24}>Your report helps other Stromers see what's happening.</TText>

            <XStack backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} borderRadius={16} paddingHorizontal={20} height={56} alignItems="center" marginBottom={16} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"}>
              <TextInput style={{ flex: 1, fontFamily: "Chirp-Medium", fontSize: 15, color: theme.textPrimary }} placeholder="e.g. UI / Abadina" placeholderTextColor={theme.textSecondary} value={reportArea} onChangeText={setReportArea} />
            </XStack>

            <XStack gap={12} marginBottom={24}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => setReportStatus("stable")}>
                <XStack height={56} borderRadius={16} alignItems="center" justifyContent="center" backgroundColor={reportStatus === "stable" ? (isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5") : (isDarkMode ? "#1A221E" : "#FFF")} borderWidth={1} borderColor={reportStatus === "stable" ? "#00C48A" : (isDarkMode ? "#2D3B34" : "#E2E8F0")}>
                  <TText fontFamily="Chirp-Bold" fontSize={14} color={reportStatus === "stable" ? "#00C48A" : theme.textSecondary}>Stable</TText>
                </XStack>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => setReportStatus("outage")}>
                <XStack height={56} borderRadius={16} alignItems="center" justifyContent="center" backgroundColor={reportStatus === "outage" ? (isDarkMode ? "rgba(239,68,68,0.1)" : "#FEE2E2") : (isDarkMode ? "#1A221E" : "#FFF")} borderWidth={1} borderColor={reportStatus === "outage" ? "#EF4444" : (isDarkMode ? "#2D3B34" : "#E2E8F0")}>
                  <TText fontFamily="Chirp-Bold" fontSize={14} color={reportStatus === "outage" ? "#EF4444" : theme.textSecondary}>Outage</TText>
                </XStack>
              </TouchableOpacity>
            </XStack>

            <TouchableOpacity onPress={handleSendReport} disabled={!reportArea || !reportStatus}>
              <XStack backgroundColor={(!reportArea || !reportStatus) ? (isDarkMode ? "#1A221E" : "#E2E8F0") : solidActionBg} height={56} borderRadius={16} justifyContent="center" alignItems="center" marginBottom={Platform.OS === 'ios' ? 20 : 0}>
                <Feather name="send" size={18} color={(!reportArea || !reportStatus) ? theme.textSecondary : solidActionIcon} style={{ marginRight: 8 }} />
                <TText fontFamily="Chirp-Bold" fontSize={15} color={(!reportArea || !reportStatus) ? theme.textSecondary : solidActionIcon}>Send via WhatsApp</TText>
              </XStack>
            </TouchableOpacity>
          </YStack>
        </YStack>
      </Modal>

    </YStack>
  );
};

export default ElectricityScreen;