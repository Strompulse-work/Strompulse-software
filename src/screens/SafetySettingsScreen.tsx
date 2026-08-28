/**
 * Safety Settings Screen v3.0
 * Features: Matches prd2.png strictly with Sora typography and clean layout.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Platform,
  Switch,
  ScrollView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

const SafetySettingsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme);

  // States matching the PRD screenshot (Location ON, Background OFF)
  const [locationSharing, setLocationSharing] = useState(true);
  const [backgroundTrigger, setBackgroundTrigger] = useState(false);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safety Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Privacy Section */}
        <Text style={styles.sectionTitle}>PRIVACY</Text>
        <View style={styles.settingCard}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconBox, { backgroundColor: "#ECFDF5" }]}>
              <MaterialCommunityIcons name="map-marker-outline" size={22} color="#00C48A" />
            </View>
            <View style={styles.textStack}>
              <Text style={styles.settingTitle}>Location Sharing</Text>
              <Text style={styles.settingSub}>Shared during SOS & journey</Text>
            </View>
          </View>
          <Switch
            value={locationSharing}
            onValueChange={setLocationSharing}
            trackColor={{ false: theme.border, true: "#00C48A" }}
            thumbColor={"#FFFFFF"}
          />
        </View>

        {/* Background Trigger Section */}
        <Text style={styles.sectionTitle}>BACKGROUND TRIGGER</Text>
        <View style={styles.settingCard}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconBox, { backgroundColor: "#FEF3C7" }]}>
              <MaterialCommunityIcons name="lock-outline" size={22} color="#D97706" />
            </View>
            <View style={styles.textStack}>
              <Text style={styles.settingTitle}>Trigger Without App Open</Text>
              <Text style={styles.settingSub}>Android only in v2.0</Text>
            </View>
          </View>
          <Switch
            value={backgroundTrigger}
            onValueChange={setBackgroundTrigger}
            trackColor={{ false: theme.border, true: "#00C48A" }}
            thumbColor={"#FFFFFF"}
          />
        </View>

      </ScrollView>
    </View>
  );
};

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      marginTop: Platform.OS === "ios" ? 60 : 40,
      marginBottom: 32,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.cardBg,
      marginRight: 16,
    },
    headerTitle: {
      fontSize: 22,
      fontFamily: "Sora_700Bold",
      color: theme.textPrimary,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    sectionTitle: {
      fontSize: 11,
      fontFamily: "Sora_700Bold",
      color: theme.textSecondary,
      letterSpacing: 1.5,
      marginBottom: 12,
      marginLeft: 4,
    },
    settingCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.cardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      marginBottom: 24,
    },
    settingLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      paddingRight: 16,
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
    },
    textStack: {
      flex: 1,
      justifyContent: "center",
    },
    settingTitle: {
      fontSize: 15,
      fontFamily: "Sora_700Bold",
      color: theme.textPrimary,
      marginBottom: 4,
    },
    settingSub: {
      fontSize: 12,
      fontFamily: "Sora_400Regular",
      color: theme.textSecondary,
    },
  });

export default SafetySettingsScreen;