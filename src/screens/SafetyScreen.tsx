/**
 * Map Screen (Leaflet WebView Bypass)
 * Features: Zero API Keys, Expo Go Compatible (iOS/Android), OpenStreetMap.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar,
} from "react-native";
import { WebView } from "react-native-webview";
import { Feather, Ionicons } from "@expo/vector-icons";
import AuthService from "../services/authService";
import { useUserDevices } from "../hooks/useDeviceData";
import { useTheme } from "../theme/ThemeContext";
import { Loading, ErrorMessage } from "../components/UIComponents";
import { Device } from "../types";

const DEFAULT_LATITUDE = 7.3775;
const DEFAULT_LONGITUDE = 3.9465;

const MapScreen: React.FC = () => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme);

  const [userId, setUserId] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const session = await AuthService.getCurrentSession();
      if (session) setUserId(session.user.id);
    };
    getUser();
  }, []);

  const { devices, loading, error } = useUserDevices(userId || "");

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

  // This HTML string is the invisible web browser that builds the map
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { padding: 0; margin: 0; background-color: ${theme.background}; }
        #map { width: 100vw; height: 100vh; }
        /* Remove Leaflet branding for a cleaner look */
        .leaflet-control-attribution { display: none; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        // Initialize Map
        const map = L.map('map', { zoomControl: false }).setView([${DEFAULT_LATITUDE}, ${DEFAULT_LONGITUDE}], 13);
        
        // Load OpenStreetMap Tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        // Inject React Native Device Data
        const devices = ${JSON.stringify(devices)};

        // Plot each device as a colored grid area
        devices.forEach(device => {
          const lat = device.latitude || ${DEFAULT_LATITUDE};
          const lng = device.longitude || ${DEFAULT_LONGITUDE};
          const isOnline = device.status === 1;
          
          const color = isOnline ? '${theme.success}' : '${theme.error}';
          
          // Create the Grid Circle
          const circle = L.circle([lat, lng], {
            color: color,
            fillColor: color,
            fillOpacity: 0.3,
            radius: 1200 // 1.2km grid radius
          }).addTo(map);

          // Create the center marker
          const marker = L.circleMarker([lat, lng], {
            color: color,
            fillColor: '#FFFFFF',
            fillOpacity: 1,
            radius: 6,
            weight: 3
          }).addTo(map);

          // Handle Taps and send data back to React Native
          const handleTap = () => {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_DEVICE', device: device }));
          };

          circle.on('click', handleTap);
          marker.on('click', handleTap);
        });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />

      <WebView
        originWhitelist={["*"]}
        source={{ html: mapHtml }}
        style={styles.map}
        scrollEnabled={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === "SELECT_DEVICE") {
              setSelectedDevice(data.device);
            }
          } catch (e) {
            console.error("WebView Message Error:", e);
          }
        }}
      />

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
                      selectedDevice.status === 1 ? theme.successBg : theme.errorBg,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        selectedDevice.status === 1 ? theme.success : theme.error,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusPillText,
                    {
                      color: selectedDevice.status === 1 ? theme.success : theme.error,
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

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { justifyContent: "center", alignItems: "center" },
    map: { flex: 1 },
    floatingCard: {
      position: "absolute",
      bottom: Platform.OS === "ios" ? 110 : 90,
      left: 20,
      right: 20,
      backgroundColor: theme.cardBg,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16 },
        android: { elevation: 8 },
      }),
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    cardHeaderLeft: { flexDirection: "row", alignItems: "center" },
    iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.background, justifyContent: "center", alignItems: "center", marginRight: 12 },
    cardTitle: { fontSize: 22, fontWeight: "800", color: theme.textPrimary, letterSpacing: -0.5 },
    closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.background, justifyContent: "center", alignItems: "center" },
    metricsContainer: { flexDirection: "row", alignItems: "center", backgroundColor: theme.background, borderRadius: 16, padding: 16, marginBottom: 20 },
    metricCol: { flex: 1 },
    metricDivider: { width: 1, height: 40, backgroundColor: theme.border, marginHorizontal: 16 },
    metricLabel: { color: theme.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6 },
    metricValue: { color: theme.textPrimary, fontSize: 16, fontWeight: "800" },
    statusPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
    statusPillText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
    actionButton: { flexDirection: "row", paddingVertical: 16, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    actionButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  });

export default MapScreen;