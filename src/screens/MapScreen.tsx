/**
 * Map Screen
 * Features: Real-time STROM global grid monitoring, MapView integration, 
 * Dynamic Status Circles, matching FeedScreen locations, Sora typography,
 * and an interactive bottom details card on node selection.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  StatusBar,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { useAllGridDevices } from "../hooks/useDeviceData"; 
import { Loading } from "../components/UIComponents";

const { width, height } = Dimensions.get("window");

// Pre-defined 10 STROM Device coordinates matched exactly to FeedScreen locations
const IBADAN_GRID = [
  { id: "STROM001", name: "Jericho Quarters", latitude: 7.3933, longitude: 3.8661 },
  { id: "STROM002", name: "Agodi GRA", latitude: 7.4019, longitude: 3.9103 },
  { id: "STROM003", name: "Bodija Estate", latitude: 7.4326, longitude: 3.9115 },
  { id: "STROM004", name: "Challenge", latitude: 7.3512, longitude: 3.8778 },
  { id: "STROM005", name: "Mokola", latitude: 7.3964, longitude: 3.8921 },
  { id: "STROM006", name: "Oluyole Estate", latitude: 7.3456, longitude: 3.8550 },
  { id: "STROM007", name: "Ring Road Area", latitude: 7.3621, longitude: 3.8654 },
  { id: "STROM008", name: "UI Campus", latitude: 7.4443, longitude: 3.8995 },
  { id: "STROM009", name: "Mapo Hall", latitude: 7.3768, longitude: 3.8980 },
  { id: "STROM010", name: "Eleyele", latitude: 7.4111, longitude: 3.8552 },
];

interface GridNode {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  isOnline: boolean;
}

const MapScreen = () => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme);

  // State to track which node is currently selected/pressed
  const [selectedNode, setSelectedNode] = useState<GridNode | null>(null);

  // Fetch real-time global device statuses mapping exactly what FeedScreen sees
  const { devices, loading } = useAllGridDevices();

  if (loading && devices.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Loading />
      </View>
    );
  }

  // Merge hardcoded coordinates with real-time global statuses
  const gridData: GridNode[] = IBADAN_GRID.map((node) => {
    const realDevice = devices.find((d) => d.id === node.id);
    
    let isOnline = false;
    if (realDevice) {
      const rawStatus = String(realDevice.status).toLowerCase().trim();
      isOnline = rawStatus === "1" || rawStatus === "true" || rawStatus === "on";
    }

    return { ...node, isOnline };
  });

  // Keep the selected node state synced with real-time updates if it's open
  const activeSelectedNode = selectedNode 
    ? gridData.find((n) => n.id === selectedNode.id) || selectedNode 
    : null;

  // Calculate stats for the header widget
  const onlineCount = gridData.filter((d) => d.isOnline).length;
  const offlineCount = gridData.length - onlineCount;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />

      {/* Modern Floating Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Live Grid Map</Text>
        <Text style={styles.headerSubtitle}>Ibadan Territory</Text>
        
        {/* Status Legend Widget */}
        <View style={styles.legendCard}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
            <Text style={styles.legendText}>{onlineCount} Restored</Text>
          </View>
          <View style={styles.legendDivider} />
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.error }]} />
            <Text style={styles.legendText}>{offlineCount} Outage</Text>
          </View>
        </View>
      </View>

      {/* Main Map */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: 7.3964,
          longitude: 3.8921,
          latitudeDelta: 0.12,
          longitudeDelta: 0.12,
        }}
        customMapStyle={isDarkMode ? darkMapStyle : []}
        showsUserLocation={true}
        showsMyLocationButton={false}
        pitchEnabled={false}
        onPress={() => setSelectedNode(null)} // Close card if tapping on empty space on the map
      >
        {gridData.map((device) => {
          const colorMain = device.isOnline ? theme.success : theme.error;
          const colorFill = device.isOnline ? "rgba(0, 196, 138, 0.25)" : "rgba(239, 68, 68, 0.25)";

          return (
            <React.Fragment key={device.id}>
              {/* Coverage Circle */}
             {/* Coverage Circle */}
              <Circle
                center={{ latitude: device.latitude, longitude: device.longitude }}
                radius={1200}
                fillColor={colorFill}
                strokeColor={colorMain}
                strokeWidth={1.5}
                {...({
                  tappable: true,
                  onPress: (e: any) => {
                    if (e.stopPropagation) e.stopPropagation();
                    setSelectedNode(device);
                  }
                } as any)}
              />
              
              {/* Device Marker */}
              <Marker
                coordinate={{ latitude: device.latitude, longitude: device.longitude }}
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedNode(device);
                }}
              >
                <View style={[styles.markerBody, { borderColor: colorMain }]}>
                  <MaterialCommunityIcons 
                    name={device.isOnline ? "lightning-bolt" : "power-plug-off"} 
                    size={14} 
                    color={colorMain} 
                  />
                </View>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Floating Interactive bottom Detail Card */}
      {activeSelectedNode && (
        <View style={styles.detailCard}>
          {/* Card Top Row */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <View style={styles.locationIconWrapper}>
                <Ionicons name="location-sharp" size={18} color={theme.textPrimary} />
              </View>
              <Text style={styles.cardLocationName} numberOfLines={1}>
                {activeSelectedNode.name}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setSelectedNode(null)}
              activeOpacity={0.6}
            >
              <Ionicons name="close" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Grid Status Row Block */}
          <View style={styles.statusBlock}>
            <Text style={styles.statusBlockLabel}>GRID STATUS</Text>
            <View 
              style={[
                styles.statusBadge, 
                { backgroundColor: activeSelectedNode.isOnline ? theme.successBg : theme.errorBg }
              ]}
            >
              <View 
                style={[
                  styles.badgeDot, 
                  { backgroundColor: activeSelectedNode.isOnline ? theme.success : theme.error }
                ]} 
              />
              <Text 
                style={[
                  styles.badgeText, 
                  { color: activeSelectedNode.isOnline ? theme.success : theme.error }
                ]}
              >
                {activeSelectedNode.isOnline ? "RESTORED" : "OUTAGE"}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
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
      position: "absolute",
      top: Platform.OS === "ios" ? 60 : 40,
      left: 20,
      right: 20,
      zIndex: 10,
    },
    headerTitle: {
      fontSize: 28,
      fontFamily: "Sora_800ExtraBold",
      color: theme.textPrimary,
      letterSpacing: -0.5,
      textShadowColor: "rgba(0,0,0,0.1)",
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    headerSubtitle: {
      fontSize: 15,
      color: theme.textSecondary,
      fontFamily: "Sora_500Medium",
      marginTop: 4,
      marginBottom: 16,
    },
    legendCard: {
      flexDirection: "row",
      backgroundColor: theme.cardBg,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      alignSelf: "flex-start",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: { elevation: 4 },
      }),
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 8,
    },
    legendText: {
      fontSize: 13,
      fontFamily: "Sora_700Bold",
      color: theme.textPrimary,
    },
    legendDivider: {
      width: 1,
      height: "100%",
      backgroundColor: theme.border,
      marginHorizontal: 16,
    },
    map: {
      width: width,
      height: height,
    },
    markerBody: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.cardBg,
      borderWidth: 2,
      justifyContent: "center",
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        },
        android: { elevation: 3 },
      }),
    },
    // High fidelity detail panel modeled straight from mapcard.png
    // High fidelity detail panel modeled straight from mapcard.png
    detailCard: {
      position: "absolute",
      bottom: Platform.OS === "ios" ? 120 : 100, // Increased to clear the bottom navigation tab
      left: 16,
      right: 16,
      backgroundColor: theme.cardBg, // Respects dark/light colors automatically
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15,
          shadowRadius: 16,
        },
        android: { elevation: 8 },
      }),
    },
    cardHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    cardTitleGroup: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: 12,
    },
    locationIconWrapper: {
      marginRight: 10,
    },
    cardLocationName: {
      fontSize: 22,
      fontFamily: "Sora_700Bold",
      color: theme.textPrimary,
      letterSpacing: -0.3,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(120, 120, 120, 0.15)",
      justifyContent: "center",
      alignItems: "center",
    },
    statusBlock: {
      backgroundColor: "rgba(120, 120, 120, 0.06)",
      borderRadius: 16,
      padding: 16,
      alignItems: "flex-start",
    },
    statusBlockLabel: {
      fontSize: 11,
      fontFamily: "Sora_800ExtraBold",
      color: theme.textSecondary,
      letterSpacing: 1,
      marginBottom: 8,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    badgeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
    },
    badgeText: {
      fontSize: 12,
      fontFamily: "Sora_800ExtraBold",
      letterSpacing: 0.5,
    },
  });

// Minimalist dark style array for Google Maps
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "poi.park", elementType: "labels.text.stroke", stylers: [{ color: "#1b1b1b" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#4e4e4e" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] },
];

export default MapScreen;