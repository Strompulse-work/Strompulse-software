import React from "react";
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

// FIX: shared with ElectricityScreen/CommunityZonesScreen so 'checking'
// devices (still in their confirmation window) render amber here too,
// instead of falling back to red just because marker.isOnline is false.
const STATUS_COLORS = {
  online: { solid: "#00C48A", coverage: "rgba(0, 196, 138, 0.25)" },
  checking: { solid: "#F59E0B", coverage: "rgba(245, 158, 11, 0.25)" },
  offline: { solid: "#EF4444", coverage: "rgba(239, 68, 68, 0.25)" },
};

// Accepts either the new `connectionState`/`isChecking` fields (preferred)
// or falls back to the old `isOnline`-only shape so this still works if a
// caller hasn't been updated to pass the extra fields.
const getMarkerStatusColors = (marker: any) => {
  if (marker.connectionState === "checking" || marker.isChecking) {
    return STATUS_COLORS.checking;
  }
  if (marker.connectionState === "online" || marker.isOnline) {
    return STATUS_COLORS.online;
  }
  return STATUS_COLORS.offline;
};

const CustomMapView = ({ markers = [], style, showCoverage = false, onMarkerPress }: { markers?: any[]; style?: any; showCoverage?: boolean; onMarkerPress?: (id: string) => void }) => {
  const { isDarkMode } = useTheme();

  const initialRegion = {
    latitude: 7.4000,
    longitude: 3.8800,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
  };

  return (
    <View style={[styles.container, style]}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={initialRegion}
        customMapStyle={isDarkMode ? [] : MINIMAL_MAP_STYLE}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {markers.map((marker, index) => {
          const statusColors = getMarkerStatusColors(marker);

          return (
            <React.Fragment key={marker.id || index}>
              {showCoverage && (
                <Circle
                  center={{ latitude: marker.latitude, longitude: marker.longitude }}
                  radius={1800}
                  // Bumped opacity from 0.08 to 0.25 for better visibility without being fully opaque
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
    fontFamily: "Sora_600SemiBold",
    color: "#FFFFFF", 
    textShadowColor: "rgba(0, 0, 0, 0.7)", 
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3, 
  }
});

export default CustomMapView;