import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

const CITIES = [
  { id: 1, name: "Ibadan", state: "Oyo State", status: "pilot" },
  { id: 2, name: "Lagos", state: "Lagos State", status: "locked" },
  { id: 3, name: "Abeokuta", state: "Ogun State", status: "locked" },
  { id: 4, name: "Osogbo", state: "Osun State", status: "locked" },
  { id: 5, name: "Ilorin", state: "Kwara State", status: "locked" },
];

const CitiesScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />

      <View style={styles.headerContainer}>
        
        <Text style={styles.headerTitle}>Communities</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>SELECT YOUR CITY</Text>

        <View style={styles.grid}>
          {CITIES.map((city, index) => {
            const isPilot = city.status === "pilot";

            return (
              <TouchableOpacity
                key={city.id}
                style={[
                  styles.cityCard,
                  !isPilot && styles.lockedCard,
                  isPilot && { borderColor: theme.success, borderWidth: 2 }, // Highlight active
                ]}
                activeOpacity={isPilot ? 0.7 : 1}
                onPress={() =>
                  isPilot &&
                  navigation.navigate("CityCommunities", { city: city.name })
                }
              >
                <View style={styles.cardHeader}>
                  <Text
                    style={[
                      styles.cityName,
                      !isPilot && { color: theme.textSecondary },
                    ]}
                  >
                    {city.name}
                  </Text>
                  {!isPilot && (
                    <Feather name="lock" size={16} color={theme.textTertiary} />
                  )}
                </View>
                <Text style={styles.stateName}>{city.state}</Text>

                {isPilot ? (
                  <View style={styles.activeFooter}>
                    <View style={styles.pilotBadge}>
                      <View style={styles.pilotDot} />
                      <Text style={styles.pilotText}>PILOT CITY</Text>
                    </View>
                    <View style={styles.arrowButton}>
                      <Feather
                        name="arrow-right"
                        size={20}
                        color={theme.background}
                      />
                    </View>
                  </View>
                ) : (
                  <Text style={styles.comingSoonText}>COMING SOON</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const getStyles = (theme: any, isDarkMode: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    headerContainer: {
      paddingHorizontal: 20,
      paddingTop: Platform.OS === "ios" ? 60 : 30,
      paddingBottom: 10,
    },
    screenStep: {
      color: theme.textTertiary,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.5,
      marginBottom: 8,
      textAlign: "center",
    },
    headerTitle: { fontSize: 32, fontWeight: "800", color: theme.textPrimary },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    sectionLabel: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
      marginTop: 20,
      marginBottom: 12,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    cityCard: {
      width: "100%",
      backgroundColor: theme.cardBg,
      borderRadius: 24,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    lockedCard: { width: "48%", opacity: 0.7 },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    cityName: { fontSize: 24, fontWeight: "700", color: theme.textPrimary },
    stateName: { fontSize: 14, color: theme.textSecondary, marginBottom: 20 },
    activeFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginTop: 10,
    },
    pilotBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDarkMode ? "rgba(5, 150, 105, 0.2)" : theme.successBg,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
    },
    pilotDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.success,
      marginRight: 6,
    },
    pilotText: {
      color: theme.success,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    arrowButton: {
      backgroundColor: theme.success,
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
    },
    comingSoonText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.textTertiary,
      letterSpacing: 0.5,
      marginTop: 10,
    },
  });

export default CitiesScreen;
