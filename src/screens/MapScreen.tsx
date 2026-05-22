/**
 * Map Screen
 * Dynamically switches between Light and Dark mode using ThemeContext.
 * Features: Minimalist map styling, dynamic power-grid webs, and floating detail widgets.
 */

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import { MaterialCommunityIcons, Feather, Ionicons } from "@expo/vector-icons";
import AuthService from "../services/authService";
import { useUserDevices } from "../hooks/useDeviceData";
import { useTheme } from "../theme/ThemeContext";
import { Loading, ErrorMessage } from "../components/UIComponents";
import { Device } from "../types";

const { width: screenWidth } = Dimensions.get("screen");

// Default map center (Ibadan, Nigeria)
const DEFAULT_LATITUDE = 7.3775;
const DEFAULT_LONGITUDE = 3.9465;
const DEFAULT_LATITUDE_DELTA = 0.15;
const DEFAULT_LONGITUDE_DELTA = 0.15;

// Minimalist Light Map Style (Hides POIs, clean roads, silver water)
const lightMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels.text.fill",
    stylers: [{ color: "#bdbdbd" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.arterial",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#dadada" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "road.local",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
  {
    featureType: "transit.line",
    elementType: "geometry",
    stylers: [{ color: "#e5e5e5" }],
  },
  {
    featureType: "transit.station",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c9c9c9" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
];

// Exact SRD Dark Map Style
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  {
    featureType: "administrative.country",
    elementType: "geometry.stroke",
    stylers: [{ color: "#4b6878" }],
  },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels.text.fill",
    stylers: [{ color: "#64779e" }],
  },
  {
    featureType: "administrative.province",
    elementType: "geometry.stroke",
    stylers: [{ color: "#4b6878" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry.stroke",
    stylers: [{ color: "#334e87" }],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#023e58" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#283d6a" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6f9ba5" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1d2c4d" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#304a7d" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#98a5be" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1d2c4d" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#2c6675" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#255763" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#b0d5ce" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#023e58" }],
  },
  {
    featureType: "transit",
    elementType: "labels.text.fill",
    stylers: [{ color: "#98a5be" }],
  },
  {
    featureType: "transit",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1d2c4d" }],
  },
  {
    featureType: "transit.line",
    elementType: "geometry.fill",
    stylers: [{ color: "#283d6a" }],
  },
  {
    featureType: "transit.station",
    elementType: "geometry",
    stylers: [{ color: "#3a4762" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0e1626" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4e6d70" }],
  },
];

/**
 * Math helper to generate an organic polygonal "web" around a coordinate
 */
const generateWebPolygon = (lat: number, lng: number, index: number) => {
  const radius = 0.015; // Roughly 1.5km spread
  const points = [];
  const sides = 5 + (index % 3); // Create 5, 6, or 7-sided webs

  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides + index;
    const variance = 0.7 + ((i * index) % 5) / 10;
    points.push({
      latitude: lat + radius * variance * Math.cos(angle),
      longitude: lng + radius * variance * 1.1 * Math.sin(angle), // 1.1 adjusts for projection
    });
  }
  return points;
};

const MapScreen: React.FC = () => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme);

  const [userId, setUserId] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const getUser = async () => {
      const session = await AuthService.getCurrentSession();
      if (session) setUserId(session.user.id);
    };
    getUser();
  }, []);

  const { devices, loading, error } = useUserDevices(userId || "");

  // Generate the polygon coordinates once per device
  const deviceWebs = useMemo(() => {
    return devices.map((d, index) => ({
      ...d,
      polygon: generateWebPolygon(d.latitude, d.longitude, index),
    }));
  }, [devices.length]);

  // Map Real-time Status to premium colors
  const getDeviceColors = (status: number) => {
    if (status === 1)
      return { border: theme.success, fill: theme.successBg };
    if (status === 0) return { border: theme.error, fill: theme.errorBg };
    return { border: theme.warning, fill: theme.warningBg };
  };

  if (!userId || loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Loading />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorMessage message={error} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />

      <MapView
        ref={mapRef}
        style={styles.map}
        customMapStyle={isDarkMode ? darkMapStyle : lightMapStyle}
        initialRegion={{
          latitude: DEFAULT_LATITUDE,
          longitude: DEFAULT_LONGITUDE,
          latitudeDelta: DEFAULT_LATITUDE_DELTA,
          longitudeDelta: DEFAULT_LONGITUDE_DELTA,
        }}
      >
        {devices.map((device, index) => {
          const colors = getDeviceColors(device.status);
          const webPolygon = deviceWebs[index]?.polygon || [];

          return (
            <React.Fragment key={device.id}>
              {/* Geographic Grid Area */}
              <Polygon
                coordinates={webPolygon}
                strokeColor={colors.border}
                fillColor={colors.fill}
                strokeWidth={2}
                tappable={true}
                onPress={() => setSelectedDevice(device)}
              />

              {/* Minimalist Area Label Tag */}
              <Marker
                coordinate={{
                  latitude: device.latitude,
                  longitude: device.longitude,
                }}
                onPress={() => setSelectedDevice(device)}
              >
                <View style={[styles.labelTag, { borderColor: colors.border }]}>
                  <Text style={styles.labelText}>
                    {device.address.split(",")[0]}
                  </Text>
                  <View
                    style={[
                      styles.labelDot,
                      { backgroundColor: colors.border },
                    ]}
                  />
                </View>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Advanced Floating Selected Area Card */}
      {selectedDevice && (
        <View style={styles.floatingCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="location" size={20} color={theme.textPrimary} />
              </View>
              <Text style={styles.cardTitle}>
                {selectedDevice.address.split(",")[0]}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedDevice(null)}
              style={styles.closeButton}
            >
              <Feather name="x" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.metricsContainer}>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>GRID STATUS</Text>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor:
                      selectedDevice.status === 1
                        ? theme.successBg
                        : theme.errorBg,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        selectedDevice.status === 1
                          ? theme.success
                          : theme.error,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusPillText,
                    {
                      color:
                        selectedDevice.status === 1
                          ? theme.success
                          : theme.error,
                    },
                  ]}
                >
                  {selectedDevice.status === 1 ? "RESTORED" : "OUTAGE"}
                </Text>
              </View>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>CONFIDENCE</Text>
              <Text style={styles.metricValue}>95%</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor:
                  selectedDevice.status === 1 ? theme.success : theme.error,
              },
            ]}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>View Community Data</Text>
            <Feather
              name="arrow-right"
              size={18}
              color="#FFFFFF"
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
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
    map: {
      flex: 1,
    },
    labelTag: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.cardBg,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1.5,
      ...Platform.select({
        ios: {
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: { elevation: 3 },
      }),
    },
    labelText: {
      color: theme.textPrimary,
      fontSize: 12,
      fontWeight: "700",
      marginRight: 8,
    },
    labelDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    floatingCard: {
      position: "absolute",
      bottom: Platform.OS === "ios" ? 110 : 90, // Adjusted to sit above bottom tabs
      left: 20,
      right: 20,
      backgroundColor: theme.cardBg,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
        },
        android: { elevation: 8 },
      }),
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    cardHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.background,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    cardTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.textPrimary,
      letterSpacing: -0.5,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.background,
      justifyContent: "center",
      alignItems: "center",
    },
    metricsContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.background,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
    },
    metricCol: {
      flex: 1,
    },
    metricDivider: {
      width: 1,
      height: 40,
      backgroundColor: theme.border,
      marginHorizontal: 16,
    },
    metricLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    metricValue: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "800",
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 6,
    },
    statusPillText: {
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    actionButton: {
      flexDirection: "row",
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    actionButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
  });

export default MapScreen;
