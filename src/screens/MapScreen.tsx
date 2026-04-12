/**
 * Map Screen - Device Location Visualization
 * Shows all devices on a map with real-time status indicators
 */

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  Dimensions,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { MaterialIcons } from "@expo/vector-icons";
import AuthService from "../services/authService";
import { useUserDevices } from "../hooks/useDeviceData";
import { Loading, ErrorMessage } from "../components/UIComponents";
import { Colors, GlobalStyles, Spacing } from "../styles/theme";
import { getStatusColor, formatAddress } from "../utils/helpers";
import { Device } from "../types";

const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");

// Default map center (Ibadan, Nigeria)
const DEFAULT_LATITUDE = 7.3775;
const DEFAULT_LONGITUDE = 3.9465;
const DEFAULT_LATITUDE_DELTA = 0.0922;
const DEFAULT_LONGITUDE_DELTA = 0.0421;

interface SelectedMarker {
  device: Device;
}

const MapScreen: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<SelectedMarker | null>(
    null,
  );
  const mapRef = useRef<MapView>(null);

  // Fetch user
  useEffect(() => {
    const getUser = async () => {
      const session = await AuthService.getCurrentSession();
      if (session) {
        setUserId(session.user.id);
      }
    };
    getUser();
  }, []);

  // Fetch devices
  const { devices, loading, error } = useUserDevices(userId || "");

  // Center map on first device or Ibadan
  useEffect(() => {
    if (mapRef.current && devices.length > 0) {
      const region = {
        latitude: devices[0].latitude,
        longitude: devices[0].longitude,
        latitudeDelta: DEFAULT_LATITUDE_DELTA * 2,
        longitudeDelta: DEFAULT_LONGITUDE_DELTA * 2,
      };
      mapRef.current.animateToRegion(region, 1000);
    }
  }, [devices]);

  if (!userId) {
    return (
      <View style={[GlobalStyles.container, GlobalStyles.center]}>
        <Loading />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[GlobalStyles.container, GlobalStyles.center]}>
        <Loading />
      </View>
    );
  }

  if (error) {
    return (
      <View style={GlobalStyles.container}>
        <ErrorMessage message={error} />
      </View>
    );
  }

  if (devices.length === 0) {
    return (
      <View style={[GlobalStyles.container, GlobalStyles.center]}>
        <MaterialIcons
          name="location-off"
          size={64}
          color={Colors.text.tertiary}
        />
        <Text
          style={[
            GlobalStyles.h3,
            { marginTop: Spacing.lg, color: Colors.text.secondary },
          ]}
        >
          No Devices to Display
        </Text>
      </View>
    );
  }

  return (
    <View style={GlobalStyles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: DEFAULT_LATITUDE,
          longitude: DEFAULT_LONGITUDE,
          latitudeDelta: DEFAULT_LATITUDE_DELTA,
          longitudeDelta: DEFAULT_LONGITUDE_DELTA,
        }}
        showsUserLocation={false}
        showsMyLocationButton={true}
      >
        {devices.map((device) => (
          <Marker
            key={device.id}
            coordinate={{
              latitude: device.latitude,
              longitude: device.longitude,
            }}
            title={device.device_id}
            description={device.address}
            onPress={() => setSelectedMarker({ device })}
          >
            <View style={styles.markerContainer}>
              <View
                style={[
                  styles.markerCircle,
                  {
                    backgroundColor: getStatusColor(device.status),
                  },
                ]}
              >
                <MaterialIcons
                  name={
                    device.status === "ON"
                      ? "check"
                      : device.status === "OFF"
                        ? "close"
                        : "signal-cellular-off"
                  }
                  size={16}
                  color="white"
                />
              </View>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Marker Details Modal */}
      <Modal
        visible={!!selectedMarker}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedMarker(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            {selectedMarker && (
              <>
                <View
                  style={[
                    GlobalStyles.rowBetween,
                    { marginBottom: Spacing.lg },
                  ]}
                >
                  <Text style={GlobalStyles.h2}>
                    {selectedMarker.device.device_id}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedMarker(null)}>
                    <MaterialIcons
                      name="close"
                      size={24}
                      color={Colors.text.primary}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.detailRow}>
                  <Text style={GlobalStyles.label}>Status</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: getStatusColor(
                          selectedMarker.device.status,
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {selectedMarker.device.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={GlobalStyles.label}>Address</Text>
                  <Text
                    style={[
                      GlobalStyles.body,
                      { flex: 1, textAlign: "right", marginLeft: Spacing.md },
                    ]}
                  >
                    {formatAddress(selectedMarker.device.address)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={GlobalStyles.label}>Last Seen</Text>
                  <Text style={GlobalStyles.body}>
                    {new Date(selectedMarker.device.last_seen).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={GlobalStyles.label}>Coordinates</Text>
                  <Text style={GlobalStyles.body}>
                    {selectedMarker.device.latitude.toFixed(4)},{" "}
                    {selectedMarker.device.longitude.toFixed(4)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={GlobalStyles.buttonPrimary}
                  onPress={() => setSelectedMarker(null)}
                >
                  <Text style={{ color: "white", fontWeight: "600" }}>
                    Close
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: Colors.status.on }]}
          />
          <Text style={styles.legendLabel}>Online</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: Colors.status.off }]}
          />
          <Text style={styles.legendLabel}>Offline</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: Colors.status.offline },
            ]}
          />
          <Text style={styles.legendLabel}>Dead</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  markerCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: screenHeight * 0.7,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statusBadge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: 20,
  },
  statusBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  legend: {
    position: "absolute",
    bottom: Spacing.lg,
    left: Spacing.lg,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: "row",
    gap: Spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: 12,
    color: Colors.text.primary,
    fontWeight: "500",
  },
});

export default MapScreen;
