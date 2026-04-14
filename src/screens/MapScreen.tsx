/**
 * Map Screen - Dark Mode Grid & Geographic Webs
 * Matches SRD: Shows colored polygonal webs for communities based on real-time power status
 */

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import { MaterialIcons } from "@expo/vector-icons";
import AuthService from "../services/authService";
import { useUserDevices } from "../hooks/useDeviceData";
import { Loading, ErrorMessage } from "../components/UIComponents";
import { Device } from "../types";

const { width: screenWidth } = Dimensions.get("screen");

// Exact SRD Dark Theme Colors
const THEME = {
  background: "#12141D",
  cardBg: "#1E202B",
  textPrimary: "#FFFFFF",
  textSecondary: "#8E92A4",
  success: "#00E676",
  error: "#FF3B30",
  warning: "#FFCC00", // Unstable
  border: "#2C2F3F",
};

// Default map center (Ibadan, Nigeria)
const DEFAULT_LATITUDE = 7.3775;
const DEFAULT_LONGITUDE = 3.9465;
const DEFAULT_LATITUDE_DELTA = 0.15;
const DEFAULT_LONGITUDE_DELTA = 0.15;

// Custom Google Maps Dark Theme (Hides labels & POIs for a clean grid look)
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
 * Math helper to generate a polygonal "web" around a coordinate
 * We use the index to vary the shape so the webs look organic and unique
 */
const generateWebPolygon = (lat: number, lng: number, index: number) => {
  const radius = 0.015; // Roughly 1.5km spread
  const points = [];
  const sides = 5 + (index % 3); // Create 5, 6, or 7-sided webs

  for (let i = 0; i < sides; i++) {
    // Add deterministic variance based on index so the shape doesn't jiggle on refresh
    const angle = (i * 2 * Math.PI) / sides + index;
    const variance = 0.7 + ((i * index) % 5) / 10;

    points.push({
      latitude: lat + radius * variance * Math.cos(angle),
      longitude: lng + radius * variance * 1.1 * Math.sin(angle), // 1.1 adjusts for map projection aspect ratio
    });
  }
  return points;
};

const MapScreen: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const mapRef = useRef<MapView>(null);

  // Fetch user
  useEffect(() => {
    const getUser = async () => {
      const session = await AuthService.getCurrentSession();
      if (session) setUserId(session.user.id);
    };
    getUser();
  }, []);

  // Fetch devices (Real-time hook)
  const { devices, loading, error } = useUserDevices(userId || "");

  // Generate the polygon coordinates once per device so they don't redraw unnecessarily
  const deviceWebs = useMemo(() => {
    return devices.map((d, index) => ({
      ...d,
      polygon: generateWebPolygon(d.latitude, d.longitude, index),
    }));
  }, [devices.length]); // Only re-calculate if the number of devices changes, not on status change

  // Map Real-time Status to colors
  const getDeviceColors = (status: string) => {
    if (status === "ON")
      return { border: THEME.success, fill: "rgba(0, 230, 118, 0.2)" };
    if (status === "OFF")
      return { border: THEME.error, fill: "rgba(255, 59, 48, 0.2)" };
    return { border: THEME.warning, fill: "rgba(255, 204, 0, 0.2)" }; // Unstable/Unknown
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
      {/* NOTE: We intentionally omit PROVIDER_GOOGLE here so it uses Apple Maps on iOS 
        and the default Google map on Android seamlessly without needing an API key for Expo Go. 
      */}
      <MapView
        ref={mapRef}
        style={styles.map}
        customMapStyle={darkMapStyle}
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
              {/* The Geographic Web */}
              <Polygon
                coordinates={webPolygon}
                strokeColor={colors.border}
                fillColor={colors.fill}
                strokeWidth={2}
                tappable={true}
                onPress={() => setSelectedDevice(device)}
              />

              {/* The Area Label Tag */}
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

      {/* Selected Area Info Card (Replaces the generic Modal) */}
      {selectedDevice && (
        <View style={styles.floatingCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {selectedDevice.address.split(",")[0]}
            </Text>
            <TouchableOpacity onPress={() => setSelectedDevice(null)}>
              <MaterialIcons
                name="close"
                size={24}
                color={THEME.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Status:</Text>
            <Text
              style={[
                styles.cardStatusText,
                {
                  color:
                    selectedDevice.status === "ON"
                      ? THEME.success
                      : THEME.error,
                },
              ]}
            >
              {selectedDevice.status === "ON"
                ? "Power Restored"
                : "Power Outage"}
            </Text>
          </View>

          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Confidence:</Text>
            <Text style={styles.cardValue}>95%</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor:
                  selectedDevice.status === "ON" ? THEME.success : THEME.error,
              },
            ]}
          >
            <Text style={styles.actionButtonText}>View Community</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
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
    backgroundColor: THEME.cardBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  labelText: {
    color: THEME.textPrimary,
    fontSize: 12,
    fontWeight: "bold",
    marginRight: 6,
  },
  labelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  floatingCard: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: THEME.textPrimary,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  cardLabel: {
    color: THEME.textSecondary,
    fontSize: 14,
    width: 90,
  },
  cardValue: {
    color: THEME.textPrimary,
    fontSize: 14,
    fontWeight: "500",
  },
  cardStatusText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  actionButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#000000", // Dark text on bright colored button per SRD
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default MapScreen;
