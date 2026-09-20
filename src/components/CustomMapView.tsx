import React, { useRef, useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from "react-native-maps";
import { useTheme } from "../theme/ThemeContext";

const MINIMAL_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#e9e9e9" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
];

const STATUS_COLORS = {
  online: { solid: "#00C48A", coverage: "rgba(0, 196, 138, 0.25)" },
  checking: { solid: "#F59E0B", coverage: "rgba(245, 158, 11, 0.25)" },
  offline: { solid: "#EF4444", coverage: "rgba(239, 68, 68, 0.25)" },
};

const getMarkerStatusColors = (marker: any) => {
  if (marker.connectionState === "checking" || marker.isChecking) {
    return STATUS_COLORS.checking;
  }
  if (marker.connectionState === "online" || marker.isOnline) {
    return STATUS_COLORS.online;
  }
  return STATUS_COLORS.offline;
};

// Added region to props for panning capability
const CustomMapView = ({ 
  markers = [], 
  style, 
  showCoverage = false, 
  onMarkerPress,
  region 
}: { 
  markers?: any[]; 
  style?: any; 
  showCoverage?: boolean; 
  onMarkerPress?: (id: string) => void;
  region?: any;
}) => {
  const { isDarkMode } = useTheme();
  const mapRef = useRef<MapView>(null);

  // Smoothly pan to region whenever a search result updates the region prop
  useEffect(() => {
    if (region && mapRef.current) {
      mapRef.current.animateToRegion(region, 800);
    }
  }, [region]);

  const initialRegion = {
    latitude: 7.4000,
    longitude: 3.8800,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
  };

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={initialRegion}
        customMapStyle={isDarkMode ? [] : MINIMAL_MAP_STYLE}
        showsUserLocation={true}
        showsMyLocationButton={false}
        pitchEnabled={false}
      >
        {markers.map((marker, index) => {
          const statusColors = getMarkerStatusColors(marker);

          return (
            <React.Fragment key={marker.id || index}>
              {showCoverage && (
                <Circle
                  center={{ latitude: marker.latitude, longitude: marker.longitude }}
                  radius={1800}
                  fillColor={statusColors.coverage}
                  strokeColor={"transparent"}
                />
              )}

              <Marker
                coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                onPress={() => onMarkerPress && onMarkerPress(marker.id)}
              >
                <View style={styles.markerWrapper}>
                  <View style={[styles.markerDot, { backgroundColor: statusColors.solid }]} />
                  <Text style={styles.markerText}>{marker.title}</Text>
                </View>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Modern Floating Legend Card */}
      <View style={[
        styles.legendContainer, 
        { 
          backgroundColor: isDarkMode ? "rgba(18, 26, 22, 0.95)" : "rgba(255, 255, 255, 0.95)",
          borderColor: isDarkMode ? "#2D3B34" : "#F1F5F9"
        }
      ]}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS.online.solid }]} />
          <Text style={[styles.legendText, { color: isDarkMode ? "#F8FAFC" : "#1E293B" }]}>Power Stable</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS.checking.solid }]} />
          <Text style={[styles.legendText, { color: isDarkMode ? "#F8FAFC" : "#1E293B" }]}>Checking</Text>
        </View>
        <View style={[styles.legendRow, { marginBottom: 0 }]}>
          <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS.offline.solid }]} />
          <Text style={[styles.legendText, { color: isDarkMode ? "#F8FAFC" : "#1E293B" }]}>Power Outage</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  markerWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  markerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  markerText: {
    marginTop: 4,
    fontSize: 10,
    fontFamily: "Chirp-Bold", // Updated to match the premium profile vibe
    color: "#FFFFFF", 
    textShadowColor: "rgba(0, 0, 0, 0.7)", 
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3, 
  },
  // New Legend Styles
  legendContainer: {
    position: "absolute",
    top: 80, // Placed exactly under the 52px search bar
    left: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 5,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    fontSize: 11,
    fontFamily: "Chirp-Medium",
  }
});

export default CustomMapView;