import React, { useState, useEffect, useRef } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  StatusBar, 
  RefreshControl, 
  Animated, 
  Easing, 
  TextInput, 
  ActivityIndicator, 
  Image, 
  SafeAreaView, 
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  Keyboard,
  Linking,
  Alert
} from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Circle as SvgCircle } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";
import { useAllGridDevices } from "../hooks/useDeviceData";
import { Loading } from "../components/UIComponents";
import CustomMapView from "../components/CustomMapView";
import AuthService from "../services/authService";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { height, width } = Dimensions.get("window");
const HEADER_HEIGHT = height * 0.35; 

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

// NOTE: local timestamp parsing / staleness logic has been REMOVED from
// this screen. Online, offline, AND checking state all come straight
// from useAllGridDevices() (liveDevice.connectionState), which uses a
// tracker SHARED across every screen in the app (hooks/useDeviceData.ts)
// — so a device confirmed online here stays confirmed on every other
// screen too, and a device still in its confirmation window shows a
// neutral "Checking..." state instead of a false "Power Outage".

const CHECKING_COLOR = "#F59E0B";

const MarqueeBanner = ({ text, isDarkMode }: { text: string, isDarkMode: boolean }) => {
  const moveAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.timing(moveAnim, { toValue: 1, duration: 10000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, [moveAnim]);

  const translateX = moveAnim.interpolate({ inputRange: [0, 1], outputRange: [width - 40, -450] });

  return (
    <View style={[{ flexDirection: "row", alignItems: "center", marginHorizontal: 20, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, overflow: "hidden", marginBottom: 30, backgroundColor: isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5" }]}>
      <MaterialCommunityIcons name="lightning-bolt" size={18} color="#00C48A" style={{ marginRight: 12, zIndex: 2 }} />
      <View style={{ flex: 1, overflow: "hidden", justifyContent: "center" }}>
        <Animated.View style={{ transform: [{ translateX }], width: 600 }}>
          <Text style={{ fontSize: 12, fontFamily: "Sora_600SemiBold", color: isDarkMode ? "#A7F3D0" : "#064E3B" }} numberOfLines={1}>{text}</Text>
        </Animated.View>
      </View>
    </View>
  );
};

const ElectricityScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode); 
  
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"map" | "areas" | "stats">("map");
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [greeting, setGreeting] = useState("Good day");
  
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedStreetName, setSelectedStreetName] = useState<string | null>(null);
  const [pinnedItems, setPinnedItems] = useState<Array<{areaId: string, streetName: string | null}>>([]);
  const [communitySearchQuery, setCommunitySearchQuery] = useState("");
  const [communityFilter, setCommunityFilter] = useState<"All" | "Stable" | "Outage">("All");

  const [analyticsTime, setAnalyticsTime] = useState<"Today" | "This Week" | "This Month">("Today");
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [apiSearchResults, setApiSearchResults] = useState<any[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);

  const [defaultLocation, setDefaultLocation] = useState<{ id: string, name: string, lat: number, lng: number, isCustom: boolean } | null>(null);
  const [isLocModalVisible, setIsLocModalVisible] = useState(false);
  const [locSearchQuery, setLocSearchQuery] = useState("");
  const [locSearchResults, setLocSearchResults] = useState<any[]>([]);
  const [isLocSearching, setIsLocSearching] = useState(false);
  const [selectedLocResult, setSelectedLocResult] = useState<any>(null);

  // --- NEW: Reporting States ---
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportArea, setReportArea] = useState("");
  const [reportStatus, setReportStatus] = useState<"stable" | "outage" | null>(null);

  useEffect(() => {
    const initializeProfileAndLocation = async () => {
      try {
        const session = await AuthService.getCurrentSession();
        if (session) setUser(session.user);
        const savedLoc = await AsyncStorage.getItem("strompulse_default_location");
        if (savedLoc) setDefaultLocation(JSON.parse(savedLoc));
      } catch (err) {}
    };
    initializeProfileAndLocation();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const fetchLocalCache = async () => {
        try {
          const cachedAvatar = await AsyncStorage.getItem("global_avatar");
          const cachedName = await AsyncStorage.getItem("global_name");
          setLocalAvatar(cachedAvatar);
          setLocalName(cachedName);
        } catch (e) {}
      };
      fetchLocalCache();
    }, [])
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
    return () => clearInterval(timer);
  }, []);

  const displayAvatar = localAvatar || user?.avatar_url || user?.user_metadata?.avatar_url || null;
  const displayName = localName || user?.full_name || "Explorer";

  const renderProfileAvatar = () => {
    if (displayAvatar) {
      return <Image source={{ uri: displayAvatar }} style={styles.profileAvatar} />;
    } else {
      const initial = displayName.charAt(0).toUpperCase();
      return (
        <View style={styles.profileAvatarFallback}>
          <Text style={styles.profileAvatarFallbackText}>{initial}</Text>
        </View>
      );
    }
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

  // FIX: connectionState ('online' | 'offline' | 'checking') comes straight
  // from the hook — one shared source of truth across every screen.
  const gridItems = Object.keys(DEVICE_LOCATIONS).map((id) => {
    const liveDevice = devices.find((d) => d.id === id || d.id?.toUpperCase() === id.toUpperCase());
    const meta = DEVICE_LOCATIONS[id];

    const connectionState: 'online' | 'offline' | 'checking' = liveDevice
      ? (liveDevice.connectionState || (liveDevice.isOnline ? 'online' : 'offline'))
      : 'offline';
    const isOnline = connectionState === 'online';
    const isChecking = connectionState === 'checking';
    const realUptime = liveDevice?.uptime !== undefined ? liveDevice.uptime : (isOnline ? 100 : 0);
    const outOfCoverage = !liveDevice; 
    const isPartial = isOnline && realUptime > 0 && realUptime < 100;
    
    let finalStatusText = outOfCoverage
      ? "Out of Coverage"
      : isChecking
      ? "Checking Status"
      : isOnline
      ? "Presently Stable"
      : "Power Outage";
    if (isPartial) finalStatusText = "Partial Stability";

    return { 
      id, name: meta.name, type: meta.type, lat: meta.lat, lng: meta.lng, roads: meta.roads, city: "Ibadan", 
      isOnline, isChecking, connectionState, uptime: realUptime, outOfCoverage, isPartial, finalStatusText 
    };
  });

  let defaultLocStatus = null;
  if (defaultLocation && gridItems.length > 0) {
    if (defaultLocation.isCustom) {
      defaultLocStatus = getNearestNode(defaultLocation.lat, defaultLocation.lng, gridItems);
    } else {
      defaultLocStatus = gridItems.find(g => g.id === defaultLocation.id);
    }
  }

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (locSearchQuery.trim().length > 2) {
        setIsLocSearching(true);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locSearchQuery + ", Ibadan")}&format=json&addressdetails=1&limit=5&countrycodes=ng`, { headers: { 'User-Agent': 'StrompulseApp/1.0' } });
          const data = await res.json();
          const formatted = data.map((d: any) => ({
            id: d.place_id.toString(), name: d.name || d.display_name.split(',')[0], lat: parseFloat(d.lat), lng: parseFloat(d.lon), isCustom: true
          }));
          setLocSearchResults(formatted);
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
          const formattedResults = data.map((d: any) => ({
            id: d.place_id.toString(), displayTitle: d.name || d.display_name.split(',')[0], lat: parseFloat(d.lat), lng: parseFloat(d.lon),
          }));
          setApiSearchResults(formattedResults);
        } catch (error) {} finally { setIsSearchingApi(false); }
      } else { setApiSearchResults([]); }
    }, 600); 
    return () => clearTimeout(delayDebounceFn);
  }, [mapSearchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleSendReport = () => {
    if (!reportArea || !reportStatus) return;
    const statusText = reportStatus === "stable" ? "Presently Stable" : "Power Outage";
    const message = `Hello Strompulse, I want to report a power update:\n*Area:* ${reportArea}\n*Status:* ${statusText}`;
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    
    Linking.openURL(url).catch(() => {
      Alert.alert("WhatsApp not found", "Please make sure WhatsApp is installed on your device to send this report.");
    });
    
    setIsReportModalVisible(false);
    setReportArea("");
    setReportStatus(null);
  };

  if (devicesLoading && devices.length === 0) {
    return (
      <View style={[styles.containerDetails, { justifyContent: "center", alignItems: "center" }]}>
        <Loading />
      </View>
    );
  }

  const totalDevices = gridItems.length;
  const onlineDevices = gridItems.filter(item => item.isOnline).length;
  const avgUptime = totalDevices > 0 ? Math.round(gridItems.reduce((acc, d) => acc + d.uptime, 0) / totalDevices) : 0;

  const dynamicInsightOne = {
    title: onlineDevices < totalDevices ? "Partial Stability" : "Steadier today",
    desc: onlineDevices < totalDevices ? "Grid is recovering with moderate outages." : "Public reports indicate more consistent conditions across the city.",
    icon: "wave", color: "#00C48A", bg: isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5", cardBg: isDarkMode ? "#1A221E" : "#FFFFFF"
  };

  const combinedSearchResults: any[] = [];
  if (mapSearchQuery.trim().length > 0) {
    const query = mapSearchQuery.toLowerCase().trim();
    gridItems.forEach(item => {
      if (item.name.toLowerCase().includes(query) || query.includes(item.name.toLowerCase())) {
        combinedSearchResults.push({ ...item, displayTitle: item.name, isStreet: false });
      }
      item.roads.forEach(road => {
        if (road.toLowerCase().includes(query) || query.includes(road.toLowerCase())) {
          combinedSearchResults.push({ ...item, displayTitle: road, isStreet: true });
        }
      });
    });

    apiSearchResults.forEach(apiItem => {
      const isDuplicate = combinedSearchResults.some(local => local.displayTitle.toLowerCase() === apiItem.displayTitle.toLowerCase());
      if (!isDuplicate) {
        const nearestNode = getNearestNode(apiItem.lat, apiItem.lng, gridItems);
        combinedSearchResults.push({ ...nearestNode, displayTitle: apiItem.displayTitle, isStreet: true });
      }
    });
  }

  // FIX: checking devices are excluded from BOTH the "Stable" and "Outage"
  // buckets (they show up under "All" only) — neither label is accurate
  // for a device we haven't confirmed yet.
  const filteredCommunities = gridItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(communitySearchQuery.toLowerCase());
    let matchesFilter = true;
    if (communityFilter === "Stable") matchesFilter = item.isOnline && !item.isPartial;
    if (communityFilter === "Outage") matchesFilter = (!item.isOnline && !item.isChecking) || item.isPartial;
    return matchesSearch && matchesFilter;
  });

  const selectedAreaData = selectedAreaId ? gridItems.find(item => item.id === selectedAreaId) : null;

  const handlePinPress = () => {
    if (selectedAreaId) {
      const existingPinIndex = pinnedItems.findIndex((pin) => pin.areaId === selectedAreaId && pin.streetName === selectedStreetName);
      if (existingPinIndex >= 0) {
        setPinnedItems(prev => prev.filter((_, i) => i !== existingPinIndex));
      } else {
        setPinnedItems(prev => [...prev, { areaId: selectedAreaId, streetName: selectedStreetName }]);
      }
    }
  };

  const removePin = (areaId: string, streetName: string | null) => {
    setPinnedItems(prev => prev.filter(pin => !(pin.areaId === areaId && pin.streetName === streetName)));
  };

  const isCurrentlyPinned = selectedAreaId ? pinnedItems.some(pin => pin.areaId === selectedAreaId && pin.streetName === selectedStreetName) : false;

  // FIX: AreaCard now takes isChecking and renders a distinct amber
  // "checking" state (spinner instead of icon) instead of ever falsely
  // showing red "Power Outage" during the confirmation window.
  const AreaCard = ({ id, name, status, isOnline, isChecking, isPartial, outOfCoverage, uptime }: any) => {
    let color = isOnline ? "#00C48A" : "#EF4444";
    let bgColor = isOnline ? (isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5") : (isDarkMode ? "rgba(239,68,68,0.1)" : "#FEE2E2");
    let statusIcon = "lightning-bolt";

    if (isPartial) { color = "#F59E0B"; bgColor = isDarkMode ? "rgba(245,158,11,0.15)" : "#FEF3C7"; } 
    if (outOfCoverage) { color = "#94A3B8"; bgColor = isDarkMode ? "#2D3B34" : "#F1F5F9"; }
    if (isChecking && !outOfCoverage) { color = CHECKING_COLOR; bgColor = isDarkMode ? "rgba(245,158,11,0.15)" : "#FEF3C7"; }

    return (
      <View style={styles.areaCard}>
        <View style={[styles.areaIconBox, { backgroundColor: bgColor }]}>
           {isChecking && !outOfCoverage ? (
             <ActivityIndicator size="small" color={CHECKING_COLOR} />
           ) : (
             <MaterialCommunityIcons name={statusIcon as any} size={24} color={color} />
           )}
        </View>

        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.areaName} numberOfLines={1}>{name}</Text>
          <View style={styles.areaStatusRow}>
            <View style={[styles.areaStatusDot, { backgroundColor: color }]} />
            <Text style={[styles.areaStatusText, { color }]}>{status}</Text>
          </View>
        </View>

        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => navigation.navigate("CommunityZonesScreen", { areaId: id, isOnline: isOnline, uptime: uptime })}
          style={styles.areaDetailsBtnEnd}
        >
          <Text style={styles.areaDetailsBtnTextEnd}>Details</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const CurvedLineChart = () => {
    const endY = 120 - (avgUptime * 1.2); 
    const pathData = analyticsTime === "Today" 
      ? `M 0 100 C 40 110, 80 40, 140 60 C 200 80, 240 100, 320 ${endY}`
      : analyticsTime === "This Week"
      ? `M 0 80 C 50 40, 100 120, 160 50 C 220 20, 260 80, 320 ${endY}`
      : `M 0 50 C 60 80, 120 20, 180 60 C 240 100, 280 40, 320 ${endY}`;

    const xAxisLabels = analyticsTime === "Today" ? ["Morning", "Afternoon", "Evening", "Night"] : analyticsTime === "This Week" ? ["Mon", "Wed", "Fri", "Sun"] : ["Week 1", "Week 2", "Week 3", "Week 4"];

    return (
      <View style={styles.curvedChartContainer}>
        <View style={styles.chartTopRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={styles.chartIconBox}>
              <MaterialCommunityIcons name="chart-bell-curve-cumulative" size={18} color="#00C48A" />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.chartTitleText}>City Power Flow</Text>
              <Text style={styles.chartSubtitleText}>{analyticsTime}'s public trend</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.timeframeBtn} onPress={() => setAnalyticsTime(analyticsTime === "Today" ? "This Week" : "Today")}>
            <Text style={styles.timeframeText}>{analyticsTime}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.svgContainer}>
          <Svg width="100%" height="150" viewBox="0 0 320 150">
            <Defs>
              <SvgGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#00C48A" stopOpacity="1" />
                <Stop offset="0.5" stopColor="#3B82F6" stopOpacity="1" />
                <Stop offset="1" stopColor="#8B5CF6" stopOpacity="1" />
              </SvgGradient>
            </Defs>
            <Path d={pathData} fill="none" stroke="url(#grad)" strokeWidth="4" strokeLinecap="round" />
            <SvgCircle cx="140" cy={analyticsTime === "Today" ? "60" : "50"} r="6" fill={isDarkMode ? "#121A16" : "#FFF"} stroke="#3B82F6" strokeWidth="3" />
            <SvgCircle cx="320" cy={endY} r="6" fill={isDarkMode ? "#121A16" : "#FFF"} stroke="#8B5CF6" strokeWidth="3" />
          </Svg>
          <View style={styles.chartXAxis}>
            {xAxisLabels.map((label, index) => <Text key={index} style={styles.chartXText}>{label}</Text>)}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.containerDetails}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <Image source={require("../../assets/images/gridstrom3.png")} style={styles.bgImageParallax} resizeMode="cover" />
      <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView style={styles.floatingHeaderDetails}>
        <View style={styles.headerContainer}>
          <View style={styles.headerLeftColumn}>
            <Text style={styles.greetingText}>{greeting},</Text>
            <Text style={styles.heroGreeting}>{displayName.split(' ')[0]}</Text>
            
            <TouchableOpacity style={styles.citySelectorPill} onPress={() => setIsCityDropdownOpen(!isCityDropdownOpen)}>
              <View style={styles.liveDotGreen} />
              <Text style={styles.citySelectorText}>Ibadan</Text>
              <MaterialCommunityIcons name={isCityDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            {isCityDropdownOpen && (
              <View style={styles.dropdownContainer}>
                <TouchableOpacity style={styles.dropdownItem} onPress={() => setIsCityDropdownOpen(false)}>
                  <View>
                    <Text style={styles.dropdownItemText}>Ibadan</Text>
                    <Text style={styles.dropdownItemSub}>Available now</Text>
                  </View>
                  <MaterialCommunityIcons name="check" size={18} color="#00C48A" />
                </TouchableOpacity>
                <View style={styles.dropdownItem}>
                  <View>
                    <Text style={[styles.dropdownItemText, { color: isDarkMode ? "#94A3B8" : "#94A3B8" }]}>Lagos</Text>
                    <Text style={styles.dropdownItemSub}>Coming soon</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
          
          <View style={styles.headerRightColumn}>
            <TouchableOpacity style={styles.profileAvatarContainer} onPress={() => navigation.navigate("Profile")}>
              {renderProfileAvatar()}
            </TouchableOpacity>
            <TouchableOpacity style={styles.privateLoginBtn} onPress={() => navigation.navigate("PrivateDashboard")}>
              <MaterialCommunityIcons name="lock" size={20} color="#FFF" style={{ marginRight: 4 }} />
              <Text style={styles.privateLoginText}>STROMER Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ flexGrow: 1 }}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C48A" />}
      >
        <View style={{ height: HEADER_HEIGHT }} />

        <View style={styles.sheetContentDetails}>
          
          <View style={styles.defaultLocContainer}>
            {!defaultLocation ? (
              <TouchableOpacity activeOpacity={0.8} onPress={() => setIsLocModalVisible(true)} style={styles.defLocCardEmpty}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={styles.defLocIconBoxEmpty}>
                    <MaterialCommunityIcons name="map-marker-radius" size={20} color="#EF4444" />
                    <View style={styles.defLocIconDot} />
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.defLocEmptyTitle}>Select your default location</Text>
                    <Text style={styles.defLocEmptySub}>Tap to see live power status</Text>
                  </View>
                </View>
                <Text style={styles.defLocSetBtnText}>Set ›</Text>
              </TouchableOpacity>
            ) : (
              // FIX: default-location card now has a third visual state for
              // 'checking' — amber, with a spinner instead of the lightning
              // bolt / plug-off icon, instead of ever falsely showing red.
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsLocModalVisible(true)}
                style={[
                  styles.defLocCardActive,
                  {
                    backgroundColor: defaultLocStatus?.isChecking
                      ? (isDarkMode ? "rgba(245,158,11,0.12)" : "#FEF3C7")
                      : defaultLocStatus?.isOnline
                      ? (isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5")
                      : (isDarkMode ? "rgba(239,68,68,0.1)" : "#FEE2E2"),
                    borderColor: defaultLocStatus?.isChecking
                      ? (isDarkMode ? "#92400E" : "#FDE68A")
                      : defaultLocStatus?.isOnline
                      ? (isDarkMode ? "#064E3B" : "#A7F3D0")
                      : (isDarkMode ? "#7F1D1D" : "#FECACA"),
                  },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <View style={styles.defLocIconBoxActive}>
                    {defaultLocStatus?.isChecking ? (
                      <ActivityIndicator size="small" color={CHECKING_COLOR} />
                    ) : (
                      <MaterialCommunityIcons name={defaultLocStatus?.isOnline ? "lightning-bolt" : "power-plug-off"} size={22} color={defaultLocStatus?.isOnline ? "#00C48A" : "#EF4444"} />
                    )}
                    <View style={[styles.defLocStatusDotActive, { backgroundColor: defaultLocStatus?.isChecking ? CHECKING_COLOR : defaultLocStatus?.isOnline ? "#00C48A" : "#EF4444" }]} />
                  </View>
                  <View style={{ marginLeft: 12, flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.defLocActiveTitle, { color: defaultLocStatus?.isChecking ? CHECKING_COLOR : defaultLocStatus?.isOnline ? (isDarkMode ? "#A7F3D0" : "#064E3B") : (isDarkMode ? "#FECACA" : "#7F1D1D") }]}>
                      {defaultLocStatus?.finalStatusText || "Unknown Status"}
                    </Text>
                    <Text style={[styles.defLocActiveSub, { color: defaultLocStatus?.isChecking ? CHECKING_COLOR : defaultLocStatus?.isOnline ? (isDarkMode ? "#6EE7B7" : "#047857") : (isDarkMode ? "#FCA5A5" : "#991B1B") }]} numberOfLines={1}>
                      {defaultLocation.name} · updated just now
                    </Text>
                  </View>
                </View>
                <View style={[styles.defLocChangeBtn, { backgroundColor: defaultLocStatus?.isChecking ? (isDarkMode ? "rgba(245,158,11,0.2)" : "#FDE68A") : defaultLocStatus?.isOnline ? (isDarkMode ? "rgba(0,196,138,0.2)" : "#D1FAE5") : (isDarkMode ? "rgba(239,68,68,0.2)" : "#FEE2E2") }]}>
                  <MaterialCommunityIcons name="target" size={14} color={defaultLocStatus?.isChecking ? CHECKING_COLOR : defaultLocStatus?.isOnline ? "#00C48A" : "#EF4444"} style={{ marginRight: 4 }} />
                  <Text style={[styles.defLocChangeText, { color: defaultLocStatus?.isChecking ? CHECKING_COLOR : defaultLocStatus?.isOnline ? (isDarkMode ? "#A7F3D0" : "#064E3B") : (isDarkMode ? "#FECACA" : "#7F1D1D") }]}>Change ›</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modernTabBar}>
              <TouchableOpacity style={[styles.modernTabBtn, activeTab === "map" && styles.modernTabBtnActive]} onPress={() => setActiveTab("map")}>
                <MaterialCommunityIcons name="compass-outline" size={16} color={activeTab === "map" ? "#FFF" : theme.textSecondary} />
                <Text style={[styles.modernTabBtnText, activeTab === "map" && styles.modernTabBtnTextActive]}>Grid Map</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modernTabBtn, activeTab === "areas" && styles.modernTabBtnActive]} onPress={() => setActiveTab("areas")}>
                <MaterialCommunityIcons name="account-group-outline" size={16} color={activeTab === "areas" ? "#FFF" : theme.textSecondary} />
                <Text style={[styles.modernTabBtnText, activeTab === "areas" && styles.modernTabBtnTextActive]}>Communities</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modernTabBtn, activeTab === "stats" && styles.modernTabBtnActive]} onPress={() => setActiveTab("stats")}>
                <MaterialCommunityIcons name="chart-pie" size={16} color={activeTab === "stats" ? "#FFF" : theme.textSecondary} />
                <Text style={[styles.modernTabBtnText, activeTab === "stats" && styles.modernTabBtnTextActive]}>Analytics</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* MAP TAB */}
          {activeTab === "map" && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              <View style={styles.searchBar}>
                <Feather name="search" size={18} color={theme.textSecondary} />
                <TextInput 
                  placeholder="Search area or address"
                  placeholderTextColor={theme.textSecondary}
                  style={styles.searchInput}
                  value={mapSearchQuery}
                  onChangeText={(text) => {
                    setMapSearchQuery(text);
                    if (selectedAreaId) { setSelectedAreaId(null); setSelectedStreetName(null); }
                  }}
                />
                <TouchableOpacity onPress={handlePinPress} style={[styles.pinIconBtn, isCurrentlyPinned && { backgroundColor: "#00C48A" }]}>
                  <MaterialCommunityIcons name={isCurrentlyPinned ? "pin" : "pin-outline"} size={18} color={isCurrentlyPinned ? "#FFF" : theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {mapSearchQuery.length > 0 && !selectedAreaData && (
                <ScrollView style={styles.mapDropdownResults} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
                  {isSearchingApi && combinedSearchResults.length === 0 ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#00C48A" />
                        <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8, fontFamily: "Sora_400Regular" }}>Scanning map databases...</Text>
                    </View>
                  ) : combinedSearchResults.length === 0 ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: theme.textSecondary, fontFamily: "Sora_400Regular" }}>No exact street found in Ibadan.</Text>
                    </View>
                  ) : (
                    combinedSearchResults.map((item, idx) => (
                      <TouchableOpacity 
                        key={`${item.id}-${idx}`} style={styles.mapResultItem} 
                        onPress={() => {
                          setSelectedAreaId(item.id);
                          if (item.isStreet) setSelectedStreetName(item.displayTitle);
                          else setSelectedStreetName(null);
                          setMapSearchQuery(item.displayTitle);
                        }}
                      >
                        <View style={styles.resultItemIconBox}>
                          <MaterialCommunityIcons name={item.isStreet ? "map-marker-path" : "home-city"} size={16} color="#064E3B" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.resultItemTitle} numberOfLines={1}>{item.displayTitle}</Text>
                          <Text style={styles.resultItemSub}>{item.finalStatusText}</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}

              {pinnedItems.length > 0 && (
                <View style={styles.activeFilterRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {pinnedItems.map((pin) => {
                      const areaData = gridItems.find(item => item.id === pin.areaId);
                      if (!areaData) return null;
                      return (
                        <TouchableOpacity key={`${pin.areaId}-${pin.streetName || 'base'}`} style={styles.activeFilterPill} onPress={() => { setSelectedAreaId(pin.areaId); setSelectedStreetName(pin.streetName); }}>
                          <Text style={styles.activeFilterPillText}>{pin.streetName || areaData.name}</Text>
                          <TouchableOpacity onPress={() => removePin(pin.areaId, pin.streetName)} style={{ marginLeft: 6 }}>
                            <MaterialCommunityIcons name="close" size={14} color="#00C48A" />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <View style={styles.mapContainerCard}>
                <View style={styles.mapGraphicWrapper}>
                  <CustomMapView 
                    showCoverage={true}
                    onMarkerPress={(id) => { setSelectedAreaId(id); setSelectedStreetName(null); }}
                    markers={gridItems.map((item) => ({ id: item.id, title: item.name, description: item.finalStatusText, isOnline: item.isOnline, isChecking: item.isChecking, connectionState: item.connectionState, latitude: item.lat, longitude: item.lng }))}
                  />
                  {!selectedAreaData && (
                    <View style={styles.mapLegend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: "#00C48A" }]} />
                        <Text style={styles.legendText}>Presently Stable</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
                        <Text style={styles.legendText}>Power Outage</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: CHECKING_COLOR }]} />
                        <Text style={styles.legendText}>Checking</Text>
                      </View>
                    </View>
                  )}
                  {selectedAreaData && (
                    <View style={styles.mapPinnedBottomCard}>
                      <View style={styles.pinnedTopRow}>
                        <View style={[styles.pinnedIconBox, { backgroundColor: selectedAreaData.isChecking ? (isDarkMode ? "rgba(245,158,11,0.15)" : "#FEF3C7") : selectedAreaData.isOnline ? (isDarkMode ? "rgba(0,196,138,0.15)" : "#D1FAE5") : (isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2") }]}>
                          {selectedAreaData.isChecking ? (
                            <ActivityIndicator size="small" color={CHECKING_COLOR} />
                          ) : (
                            <MaterialCommunityIcons name={selectedAreaData.isOnline ? "lightning-bolt" : "power-plug-off"} size={20} color={selectedAreaData.isOnline ? "#00C48A" : "#EF4444"} />
                          )}
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.pinnedAreaName}>{selectedStreetName || selectedAreaData.name}</Text>
                          <Text style={styles.pinnedStatusText}>{selectedAreaData.finalStatusText}</Text>
                        </View>
                      </View>
                      <TouchableOpacity style={styles.travelCardBtnLargeMap} onPress={() => navigation.navigate("CommunityZonesScreen", { areaId: selectedAreaData.id, isOnline: selectedAreaData.isOnline, uptime: selectedAreaData.uptime })}>
                        <Text style={styles.travelCardBtnTextLarge}>View Community Details</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* COMMUNITIES TAB */}
          {activeTab === "areas" && (
            <View style={{ paddingBottom: 20 }}>
              
              {/* Report Power Status Prompt Card */}
              <TouchableOpacity activeOpacity={0.8} onPress={() => setIsReportModalVisible(true)} style={styles.reportPromptCard}>
                <View style={styles.reportPromptIconBox}>
                  <Text style={{ fontSize: 20 }}>📢</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={styles.reportPromptTitle}>Report Power Status</Text>
                  <Text style={styles.reportPromptSub}>Help your neighbours — takes 10 seconds</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={isDarkMode ? "#64748B" : "#94A3B8"} />
              </TouchableOpacity>

              <View style={[styles.searchBar, { marginHorizontal: 20, marginBottom: 20 }]}>
                <Feather name="search" size={18} color={theme.textSecondary} />
                <TextInput placeholder="Search communities..." placeholderTextColor={theme.textSecondary} style={styles.searchInput} value={communitySearchQuery} onChangeText={setCommunitySearchQuery} />
              </View>

              <View style={styles.filterPillsRow}>
                <TouchableOpacity style={[styles.filterPill, communityFilter === "All" ? styles.filterPillActiveAll : styles.filterPillInactive]} onPress={() => setCommunityFilter("All")}>
                  <Text style={[styles.filterPillText, communityFilter === "All" && styles.filterPillTextActiveAll]}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterPill, communityFilter === "Stable" ? styles.filterPillActive : styles.filterPillInactive]} onPress={() => setCommunityFilter("Stable")}>
                  <View style={[styles.legendDot, { backgroundColor: "#00C48A" }]} />
                  <Text style={[styles.filterPillText, communityFilter === "Stable" && { color: "#00C48A" }]}>Presently Stable</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterPill, communityFilter === "Outage" ? styles.filterPillActive : styles.filterPillInactive]} onPress={() => setCommunityFilter("Outage")}>
                  <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
                  <Text style={[styles.filterPillText, communityFilter === "Outage" && { color: "#EF4444" }]}>Power Outage</Text>
                </TouchableOpacity>
              </View>

              {filteredCommunities.length > 0 ? (
                filteredCommunities.map((item) => (
                  <AreaCard key={item.id} id={item.id} name={item.name} status={item.finalStatusText} isOnline={item.isOnline} isChecking={item.isChecking} isPartial={item.isPartial} outOfCoverage={item.outOfCoverage} uptime={item.uptime} />
                ))
              ) : (
                <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 40 }}><Text style={{ fontSize: 13, fontFamily: "Sora_500Medium", color: theme.textSecondary }}>No communities match your search.</Text></View>
              )}
            </View>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === "stats" && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              <CurvedLineChart />
              <Text style={styles.sectionHeader}>Today's insights</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.insightsScroll}>
                <View style={[styles.insightCard, { backgroundColor: dynamicInsightOne.cardBg }]}>
                  <View style={[styles.insightIconBox, { backgroundColor: dynamicInsightOne.bg }]}><MaterialCommunityIcons name={dynamicInsightOne.icon as any} size={18} color={dynamicInsightOne.color} /></View>
                  <Text style={[styles.insightCardTitle, { color: dynamicInsightOne.color }]}>{dynamicInsightOne.title}</Text>
                  <Text style={styles.insightCardDesc}>{dynamicInsightOne.desc}</Text>
                </View>
                <View style={[styles.insightCard, { backgroundColor: isDarkMode ? "#1A221E" : "#F5F3FF" }]}>
                  <View style={[styles.insightIconBox, { backgroundColor: isDarkMode ? "rgba(139,92,246,0.15)" : "#EDE9FE" }]}><MaterialCommunityIcons name="clock-outline" size={18} color={isDarkMode ? "#A78BFA" : "#8B5CF6"} /></View>
                  <Text style={[styles.insightCardTitle, { color: isDarkMode ? "#A78BFA" : "#8B5CF6" }]}>Peak activity window</Text>
                  <Text style={styles.insightCardDesc}>Higher activity is usually expected during evening hours.</Text>
                </View>
                <View style={[styles.insightCard, { backgroundColor: isDarkMode ? "#1A221E" : "#F0F9FF", marginRight: 20 }]}>
                  <View style={[styles.insightIconBox, { backgroundColor: isDarkMode ? "rgba(2,132,199,0.15)" : "#E0F2FE" }]}><MaterialCommunityIcons name="rhombus-outline" size={18} color={isDarkMode ? "#38BDF8" : "#0284C7"} /></View>
                  <Text style={[styles.insightCardTitle, { color: isDarkMode ? "#38BDF8" : "#0284C7" }]}>Current power outages</Text>
                  <Text style={styles.insightCardDesc}>A few communities currently have public power-outage notices.</Text>
                </View>
              </ScrollView>
              <Text style={styles.sectionHeader}>Neighbourhood outlook</Text>
              <View style={styles.outlookCard}>
                {gridItems.slice(0, 4).map((item, index) => (
                  <View key={item.id} style={[styles.outlookRow, index !== 3 && { borderBottomWidth: 1, borderBottomColor: isDarkMode ? "#2D3B34" : "#F1F5F9" }]}>
                    <View style={styles.outlookLeft}><Text style={styles.outlookName}>{item.name}</Text><Text style={styles.outlookStatus}>{item.finalStatusText}</Text></View>
                    <View style={styles.outlookBarContainer}><View style={[styles.outlookBarFill, { width: `${item.uptime}%`, backgroundColor: item.isOnline ? "#00C48A" : item.isChecking ? CHECKING_COLOR : (item.isPartial ? "#F59E0B" : "#EF4444") }]} /></View>
                    <MaterialCommunityIcons name="sine-wave" size={20} color={item.isOnline ? "#00C48A" : item.isChecking ? CHECKING_COLOR : "#EF4444"} style={{ marginLeft: 16, opacity: 0.6 }} />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Sticky Request Device Footer */}
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate("RequestDeviceScreen")} style={styles.requestWrapper}>
            <LinearGradient colors={["#00C48A", "#064E3B"]} style={styles.requestCardGradient}>
               <View style={styles.requestIconBoxDark}><MaterialCommunityIcons name="power-plug" size={28} color="#00C48A" /></View>
               <View style={styles.requestTextArea}>
                  <Text style={styles.requestTitleLight}>Request a Personal Device</Text>
                  <Text style={styles.requestDescLight}>Available nationwide. Order from any city in Nigeria and view your power status and analytics on the Strompulse app.</Text>
                  <View style={styles.requestBtnLight}>
                     <Text style={styles.requestBtnTextLight}>Request Device</Text>
                     <MaterialCommunityIcons name="arrow-right" size={16} color="#00C48A" style={{ marginLeft: 4 }} />
                  </View>
               </View>
            </LinearGradient>
          </TouchableOpacity>

          <MarqueeBanner text="Coming next: Lagos · Abuja · Osogbo · Abeokuta · Ilorin" isDarkMode={isDarkMode} />
        </View>
      </ScrollView>

      {/* --- REPORT POWER STATUS MODAL --- */}
      <Modal visible={isReportModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsReportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismissArea} onPress={() => setIsReportModalVisible(false)} />
          <View style={[styles.modalContent, { height: 'auto', paddingBottom: Platform.OS === 'ios' ? 40 : 24 }]}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View>
                <View style={styles.modalDragIndicator} />
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsReportModalVisible(false)}>
                  <MaterialCommunityIcons name="close" size={20} color={isDarkMode ? "#94A3B8" : "#64748B"} />
                </TouchableOpacity>

                <Text style={styles.modalTitle}>Report Power Status</Text>
                <Text style={styles.modalSubtitle}>Your report helps other Stromers see what's really happening in your area.</Text>

                <Text style={styles.modalLabel}>YOUR AREA</Text>
                <View style={styles.modalInputWrapper}>
                  <TextInput 
                    style={styles.modalInput}
                    placeholder="e.g. UI / Abadina"
                    placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
                    value={reportArea}
                    onChangeText={setReportArea}
                  />
                </View>

                <View style={styles.reportToggleRow}>
                  <TouchableOpacity 
                    style={[styles.reportToggleBtn, reportStatus === "stable" && styles.reportToggleBtnStable]}
                    onPress={() => setReportStatus("stable")}
                  >
                    <View style={[styles.reportToggleDot, { backgroundColor: "#00C48A" }]} />
                    <Text style={[styles.reportToggleText, reportStatus === "stable" && { color: "#064E3B" }]}>Presently Stable</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.reportToggleBtn, reportStatus === "outage" && styles.reportToggleBtnOutage]}
                    onPress={() => setReportStatus("outage")}
                  >
                    <View style={[styles.reportToggleDot, { backgroundColor: "#EF4444" }]} />
                    <Text style={[styles.reportToggleText, reportStatus === "outage" && { color: "#7F1D1D" }]}>Power Outage</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={[styles.modalSubmitBtn, (!reportArea || !reportStatus) && styles.modalSubmitBtnDisabled, { marginTop: 24 }]} 
                  activeOpacity={0.8} 
                  disabled={!reportArea || !reportStatus}
                  onPress={handleSendReport}
                >
                  <MaterialCommunityIcons name="whatsapp" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.modalSubmitText}>Send via WhatsApp</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </View>
      </Modal>

      {/* --- DEFAULT LOCATION MODAL --- */}
      <Modal visible={isLocModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsLocModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismissArea} onPress={() => setIsLocModalVisible(false)} />
          <View style={styles.modalContent}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View>
                <View style={styles.modalDragIndicator} />
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsLocModalVisible(false)}>
                  <MaterialCommunityIcons name="close" size={20} color={isDarkMode ? "#94A3B8" : "#64748B"} />
                </TouchableOpacity>

                <Text style={styles.modalTitle}>Set Your Default Location</Text>
                <Text style={styles.modalSubtitle}>Enter your street, estate or area — this is what you'll see live status for every time you open Strompulse.</Text>

                <Text style={styles.modalLabel}>YOUR STREET OR AREA</Text>
                <View style={[styles.modalInputWrapper, selectedLocResult && { borderColor: "#00C48A", backgroundColor: isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5" }]}>
                  <TextInput 
                    style={styles.modalInput}
                    placeholder="e.g. Oyo Road, Bodija"
                    placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
                    value={selectedLocResult ? selectedLocResult.name : locSearchQuery}
                    onChangeText={(text) => {
                      if (selectedLocResult) setSelectedLocResult(null);
                      setLocSearchQuery(text);
                    }}
                  />
                  {selectedLocResult && (
                    <TouchableOpacity style={{ padding: 4 }} onPress={() => { setSelectedLocResult(null); setLocSearchQuery(""); }}>
                      <MaterialCommunityIcons name="close-circle" size={20} color={isDarkMode ? "#A7F3D0" : "#00C48A"} />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity 
                  style={[styles.modalSubmitBtn, !selectedLocResult && styles.modalSubmitBtnDisabled]} 
                  activeOpacity={0.8} 
                  disabled={!selectedLocResult}
                  onPress={saveDefaultLocation}
                >
                  <Text style={styles.modalSubmitText}>Set as My Default Location</Text>
                </TouchableOpacity>

                <Text style={styles.modalSectionLabel}>Or pick a known area</Text>
              </View>
            </TouchableWithoutFeedback>

            <ScrollView 
              style={{ flex: 1, marginTop: 10 }} 
              showsVerticalScrollIndicator={false} 
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {locSearchQuery.length > 2 && !selectedLocResult ? (
                isLocSearching ? (
                  <ActivityIndicator size="small" color="#00C48A" style={{ marginTop: 20 }} />
                ) : locSearchResults.length > 0 ? (
                  locSearchResults.map((loc, idx) => (
                    <TouchableOpacity key={`search-${idx}`} style={styles.modalListItem} onPress={() => setSelectedLocResult(loc)}>
                      <View style={styles.modalListIconBox}><MaterialCommunityIcons name="map-marker-outline" size={16} color={isDarkMode ? "#A7F3D0" : "#064E3B"} /></View>
                      <Text style={styles.modalListName}>{loc.name}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.modalListEmpty}>No exact areas found in Ibadan.</Text>
                )
              ) : (
                gridItems.map((item) => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={[styles.modalAreaCard, selectedLocResult?.id === item.id && { borderColor: "#00C48A", backgroundColor: isDarkMode ? "rgba(0,196,138,0.05)" : "#F0FDF4" }]}
                    onPress={() => setSelectedLocResult({ ...item, isCustom: false })}
                  >
                    <View style={styles.modalAreaIconBox}>
                      <MaterialCommunityIcons name="crosshairs-gps" size={16} color={isDarkMode ? "#94A3B8" : "#94A3B8"} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.modalAreaName}>{item.name}</Text>
                      <Text style={styles.modalAreaSub}>Ibadan {item.type}</Text>
                    </View>
                    <Text style={[styles.modalAreaStatus, { color: item.isOnline ? "#00C48A" : item.isChecking ? CHECKING_COLOR : "#EF4444" }]}>
                      {item.finalStatusText}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const getStyles = (theme: any, isDarkMode: boolean) => StyleSheet.create({
  containerDetails: { flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#D0DDE5" },
  scrollContent: { paddingBottom: 100 },
  bgImageParallax: { ...StyleSheet.absoluteFillObject, width: "100%", height: HEADER_HEIGHT + 60 },
  
  floatingHeaderDetails: { position: "absolute", top: Platform.OS === 'android' ? StatusBar.currentHeight : 20, left: 0, right: 0, zIndex: 100 },
  headerContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20 },
  headerLeftColumn: { position: "relative", zIndex: 50 },
  greetingText: { fontSize: 13, fontFamily: "Sora_600SemiBold", color: "rgba(255,255,255,0.8)", marginBottom: 2 },
  heroGreeting: { fontSize: 28, fontFamily: "Sora_800ExtraBold", color: "#FFFFFF", letterSpacing: -0.5, marginBottom: 12 },
  
  citySelectorPill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start" },
  liveDotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#00C48A", marginRight: 6 },
  citySelectorText: { fontSize: 12, fontFamily: "Sora_700Bold", color: "#FFFFFF" },
  
  dropdownContainer: { position: "absolute", top: 85, left: 0, width: 150, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10, zIndex: 100 },
  dropdownItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: isDarkMode ? "#2D3B34" : "#F1F5F9" },
  dropdownItemText: { fontSize: 13, fontFamily: "Sora_700Bold", color: isDarkMode ? "#F8FAFC" : "#1E293B" },
  dropdownItemSub: { fontSize: 9, fontFamily: "Sora_500Medium", marginTop: 2, color: isDarkMode ? "#94A3B8" : "#64748B" },

  headerRightColumn: { alignItems: "flex-end" },
  profileAvatarContainer: { shadowColor: "#00C48A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5, marginBottom: 8 },
  profileAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: "#00C48A" },
  profileAvatarFallback: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: "#00C48A", backgroundColor: "#064E3B", justifyContent: "center", alignItems: "center" },
  profileAvatarFallbackText: { fontSize: 18, fontFamily: "Sora_700Bold", color: "#FFF" },
  privateLoginBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#00C48A", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, shadowColor: "#00C48A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4 },
  privateLoginText: { fontSize: 11, fontFamily: "Sora_700Bold", color: "#FFF" },

  sheetContentDetails: { backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingTop: 30, minHeight: height - HEADER_HEIGHT + 40 },
  
  // --- DEFAULT LOCATION UI STYLES ---
  defaultLocContainer: { paddingHorizontal: 20, marginBottom: 24 },
  defLocCardEmpty: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 24, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", backgroundColor: isDarkMode ? "#1A221E" : "#F8FAFC" },
  defLocIconBoxEmpty: { width: 40, height: 40, borderRadius: 20, backgroundColor: isDarkMode ? "rgba(239,68,68,0.1)" : "#FEE2E2", justifyContent: "center", alignItems: "center", position: "relative" },
  defLocIconDot: { position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: isDarkMode ? "#1A221E" : "#F8FAFC", borderWidth: 2, borderColor: "#00C48A" },
  defLocEmptyTitle: { fontSize: 13, fontFamily: "Sora_700Bold", color: isDarkMode ? "#F8FAFC" : "#1E293B" },
  defLocEmptySub: { fontSize: 11, fontFamily: "Sora_500Medium", color: isDarkMode ? "#94A3B8" : "#64748B", marginTop: 2 },
  defLocSetBtnText: { fontSize: 12, fontFamily: "Sora_600SemiBold", color: isDarkMode ? "#94A3B8" : "#64748B" },

  defLocCardActive: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 24, borderWidth: 1 },
  defLocIconBoxActive: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", position: "relative" },
  defLocStatusDotActive: { position: "absolute", bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: isDarkMode ? "#1A221E" : "#FFFFFF" },
  defLocActiveTitle: { fontSize: 15, fontFamily: "Sora_800ExtraBold" },
  defLocActiveSub: { fontSize: 11, fontFamily: "Sora_500Medium", marginTop: 2 },
  defLocChangeBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  defLocChangeText: { fontSize: 11, fontFamily: "Sora_700Bold" },

  // --- REPORT PROMPT UI STYLES ---
  reportPromptCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 20, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", backgroundColor: isDarkMode ? "#1A221E" : "#F8FAFC" },
  reportPromptIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : "#FFFFFF", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  reportPromptTitle: { fontSize: 14, fontFamily: "Sora_700Bold", color: isDarkMode ? "#F8FAFC" : "#1E293B", marginBottom: 2 },
  reportPromptSub: { fontSize: 11, fontFamily: "Sora_500Medium", color: isDarkMode ? "#94A3B8" : "#64748B" },

  // --- MODAL STYLES ---
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalDismissArea: { flex: 1 },
  modalContent: { backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 12, height: height * 0.8 },
  modalDragIndicator: { width: 40, height: 4, borderRadius: 2, backgroundColor: isDarkMode ? "#2D3B34" : "#E2E8F0", alignSelf: "center", marginBottom: 16 },
  modalCloseBtn: { position: "absolute", top: 10, right: 2, width: 36, height: 36, borderRadius: 18, backgroundColor: isDarkMode ? "#1A221E" : "#F1F5F9", justifyContent: "center", alignItems: "center", zIndex: 10 },
  modalTitle: { fontSize: 20, fontFamily: "Sora_800ExtraBold", color: isDarkMode ? "#F8FAFC" : "#1E293B", marginBottom: 8, paddingRight: 40 },
  modalSubtitle: { fontSize: 12, fontFamily: "Sora_400Regular", color: isDarkMode ? "#94A3B8" : "#64748B", lineHeight: 18, marginBottom: 24, paddingRight: 20 },
  modalLabel: { fontSize: 10, fontFamily: "Sora_700Bold", color: isDarkMode ? "#64748B" : "#94A3B8", letterSpacing: 1, marginBottom: 8 },
  modalInputWrapper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", borderRadius: 16, paddingHorizontal: 16, height: 56, marginBottom: 16, backgroundColor: isDarkMode ? "#1A221E" : "#F8FAFC" },
  modalInput: { flex: 1, fontSize: 14, fontFamily: "Sora_500Medium", color: isDarkMode ? "#F8FAFC" : "#1E293B" },
  modalSubmitBtn: { flexDirection: "row", backgroundColor: "#00C48A", height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 24 },
  modalSubmitBtnDisabled: { backgroundColor: isDarkMode ? "#1A221E" : "#E2E8F0" },
  modalSubmitText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Sora_700Bold" },
  modalSectionLabel: { fontSize: 12, fontFamily: "Sora_600SemiBold", color: isDarkMode ? "#94A3B8" : "#64748B", marginBottom: 12 },
  
  // Modal Toggles (Reporting)
  reportToggleRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  reportToggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", height: 56, borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF" },
  reportToggleBtnStable: { borderColor: "#00C48A", backgroundColor: isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5" },
  reportToggleBtnOutage: { borderColor: "#EF4444", backgroundColor: isDarkMode ? "rgba(239,68,68,0.1)" : "#FEE2E2" },
  reportToggleDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  reportToggleText: { fontSize: 13, fontFamily: "Sora_600SemiBold", color: isDarkMode ? "#94A3B8" : "#64748B" },

  modalListItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: isDarkMode ? "#2D3B34" : "#F1F5F9" },
  modalListIconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5", justifyContent: "center", alignItems: "center", marginRight: 12 },
  modalListName: { fontSize: 13, fontFamily: "Sora_600SemiBold", color: isDarkMode ? "#F8FAFC" : "#1E293B", flex: 1 },
  modalListEmpty: { fontSize: 12, fontFamily: "Sora_500Medium", color: isDarkMode ? "#64748B" : "#94A3B8", textAlign: "center", marginTop: 20 },
  
  modalAreaCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 20, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", marginBottom: 12, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF" },
  modalAreaIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: isDarkMode ? "#2D3B34" : "#F1F5F9", justifyContent: "center", alignItems: "center" },
  modalAreaName: { fontSize: 14, fontFamily: "Sora_700Bold", color: isDarkMode ? "#F8FAFC" : "#1E293B" },
  modalAreaSub: { fontSize: 10, fontFamily: "Sora_500Medium", color: isDarkMode ? "#94A3B8" : "#64748B", marginTop: 2 },
  modalAreaStatus: { fontSize: 11, fontFamily: "Sora_700Bold" },

  modernTabBar: { flexDirection: "row", alignItems: "center" },
  modernTabBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 24, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", marginRight: 10, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" },
  modernTabBtnActive: { backgroundColor: "#00C48A", borderColor: "#00C48A", shadowColor: "#00C48A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  modernTabBtnText: { fontSize: 13, fontFamily: "Sora_600SemiBold", color: isDarkMode ? "#94A3B8" : "#64748B", marginLeft: 6 },
  modernTabBtnTextActive: { color: "#FFFFFF" },

  searchBar: { flexDirection: "row", alignItems: "center", borderRadius: 16, paddingHorizontal: 16, height: 54, borderWidth: 1, backgroundColor: isDarkMode ? "#1A221E" : "#F8FAFC", borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 14, fontFamily: "Sora_500Medium", color: isDarkMode ? "#F8FAFC" : "#1E293B" },
  pinIconBtn: { padding: 8, borderRadius: 12, backgroundColor: isDarkMode ? "#2D3B34" : "#F1F5F9" },

  activeFilterRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  activeFilterPill: { flexDirection: "row", alignItems: "center", backgroundColor: isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: isDarkMode ? "#00C48A" : "#A7F3D0" },
  activeFilterPillText: { fontSize: 12, fontFamily: "Sora_600SemiBold", color: isDarkMode ? "#A7F3D0" : "#064E3B", marginRight: 8 },

  mapContainerCard: { borderRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 15, elevation: 3, borderWidth: 1, marginBottom: 20, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" },
  mapGraphicWrapper: { height: 350, borderRadius: 24, overflow: "hidden", position: "relative" },
  mapLegend: { position: "absolute", top: 16, left: 16, backgroundColor: isDarkMode ? "rgba(26,34,30,0.9)" : "rgba(255,255,255,0.9)", borderRadius: 12, padding: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendText: { fontSize: 11, fontFamily: "Sora_600SemiBold", color: isDarkMode ? "#CBD5E1" : "#475569" },

  mapDropdownResults: { position: "absolute", top: 60, left: 0, right: 0, borderRadius: 16, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 15, maxHeight: 250, zIndex: 50, borderWidth: 1, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" },
  mapResultItem: { flexDirection: "row", padding: 12, alignItems: "center", borderBottomWidth: 1, borderBottomColor: isDarkMode ? "#2D3B34" : "#F1F5F9" },
  resultItemIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5", justifyContent: "center", alignItems: "center", marginRight: 14 },
  resultItemTitle: { fontSize: 14, fontFamily: "Sora_700Bold", color: isDarkMode ? "#F8FAFC" : "#1E293B" },
  resultItemSub: { fontSize: 11, fontFamily: "Sora_500Medium", color: isDarkMode ? "#94A3B8" : "#64748B" },

  mapPinnedBottomCard: { position: "absolute", bottom: 16, left: 16, right: 16, borderRadius: 20, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10, borderWidth: 1, backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderColor: isDarkMode ? "#2D3B34" : "transparent" },
  pinnedTopRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  pinnedIconBox: { width: 44, height: 44, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  pinnedAreaName: { fontSize: 16, fontFamily: "Sora_800ExtraBold", marginBottom: 4, color: isDarkMode ? "#F8FAFC" : "#1E293B" },
  pinnedStatusText: { fontSize: 11, fontFamily: "Sora_500Medium", color: isDarkMode ? "#94A3B8" : "#64748B" },
  travelCardBtnLargeMap: { backgroundColor: "#064E3B", height: 48, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  travelCardBtnTextLarge: { color: "#FFF", fontSize: 13, fontFamily: "Sora_700Bold" },

  filterPillsRow: { flexDirection: "row", alignItems: "center", marginBottom: 20, paddingHorizontal: 20, gap: 10 },
  filterPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, marginRight: 8 },
  filterPillActiveAll: { backgroundColor: "#00C48A" },
  filterPillTextActiveAll: { color: "#FFFFFF" },
  filterPillActive: { backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderWidth: 1, borderColor: "#00C48A", elevation: 2, shadowColor: "#00C48A", shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  filterPillInactive: { backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" },
  filterPillText: { fontSize: 11, fontFamily: "Sora_600SemiBold", color: isDarkMode ? "#94A3B8" : "#64748B" },

  areaCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderWidth: isDarkMode ? 1 : 0, borderColor: isDarkMode ? "#2D3B34" : "transparent" },
  areaTopRow: { flexDirection: "row", alignItems: "center", width: "100%" },
  areaIconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  areaName: { fontSize: 16, fontFamily: "Sora_700Bold", marginBottom: 4, color: isDarkMode ? "#F8FAFC" : "#1E293B" },
  areaStatusRow: { flexDirection: "row", alignItems: "center" },
  areaStatusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  areaStatusText: { fontSize: 12, fontFamily: "Sora_600SemiBold" },
  areaDetailsBtnEnd: { backgroundColor: "#00C48A", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  areaDetailsBtnTextEnd: { color: "#FFFFFF", fontSize: 12, fontFamily: "Sora_700Bold" },

  sectionHeader: { fontSize: 13, fontFamily: "Sora_800ExtraBold", marginLeft: 24, marginBottom: 16, marginTop: 10, color: isDarkMode ? "#E2E8F0" : "#475569" },
  curvedChartContainer: { marginHorizontal: 20, borderRadius: 24, padding: 20, marginBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 15, elevation: 3, borderWidth: 1, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" },
  chartTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  chartIconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: "center", alignItems: "center", backgroundColor: isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5" },
  chartTitleText: { fontSize: 14, fontFamily: "Sora_700Bold", color: isDarkMode ? "#F8FAFC" : "#1E293B" },
  chartSubtitleText: { fontSize: 10, fontFamily: "Sora_500Medium", marginTop: 2, color: isDarkMode ? "#94A3B8" : "#64748B" },
  timeframeBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: isDarkMode ? "#2D3B34" : "#F8FAFC" },
  timeframeText: { fontSize: 11, fontFamily: "Sora_600SemiBold", marginRight: 6, color: isDarkMode ? "#E2E8F0" : "#475569" },
  svgContainer: { height: 160, width: "100%" },
  chartXAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingHorizontal: 10 },
  chartXText: { fontSize: 10, fontFamily: "Sora_600SemiBold", color: isDarkMode ? "#64748B" : "#94A3B8" },

  insightsScroll: { paddingLeft: 20, marginBottom: 24 },
  insightCard: { width: 140, borderRadius: 20, padding: 16, marginRight: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "transparent" },
  insightIconBox: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  insightCardTitle: { fontSize: 12, fontFamily: "Sora_700Bold", marginBottom: 6 },
  insightCardDesc: { fontSize: 10, fontFamily: "Sora_500Medium", lineHeight: 15, color: isDarkMode ? "#94A3B8" : "#64748B" },

  outlookCard: { marginHorizontal: 20, borderRadius: 24, padding: 20, marginBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 15, elevation: 3, borderWidth: 1, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" },
  outlookRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  outlookLeft: { width: 90 },
  outlookName: { fontSize: 12, fontFamily: "Sora_700Bold", marginBottom: 4, color: isDarkMode ? "#F8FAFC" : "#1E293B" },
  outlookStatus: { fontSize: 9, fontFamily: "Sora_500Medium", color: isDarkMode ? "#94A3B8" : "#64748B" },
  outlookBarContainer: { flex: 1, height: 4, borderRadius: 2, marginLeft: 16, overflow: "hidden", backgroundColor: isDarkMode ? "#2D3B34" : "#F1F5F9" },
  outlookBarFill: { height: "100%", borderRadius: 2 },

  requestWrapper: { marginHorizontal: 20, marginBottom: 20 },
  requestCardGradient: { flexDirection: "row", borderRadius: 24, padding: 20, shadowColor: "#00C48A", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 5 },
  requestIconBoxDark: { width: 56, height: 56, borderRadius: 16, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", marginRight: 16 },
  requestTextArea: { flex: 1 },
  requestTitleLight: { fontSize: 16, fontFamily: "Sora_800ExtraBold", color: "#FFFFFF", marginBottom: 6 },
  requestDescLight: { fontSize: 11, fontFamily: "Sora_400Regular", color: "rgba(255,255,255,0.85)", lineHeight: 16, marginBottom: 16 },
  requestBtnLight: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  requestBtnTextLight: { fontSize: 12, fontFamily: "Sora_700Bold", color: "#00C48A" },
});

export default ElectricityScreen;