/**
 * Safety Settings Screen v2.0
 * Features: Privacy toggles, background triggers, and live message previews.
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
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

const SafetySettingsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme);

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
          <Feather name="chevron-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Safety Settings</Text>
          <Text style={styles.headerSubtitle}>TRIGGERS & PRIVACY</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Privacy Section */}
        <Text style={styles.sectionTitle}>PRIVACY</Text>
        <View style={styles.settingCard}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconBox, { backgroundColor: "rgba(0, 196, 138, 0.1)" }]}>
              <Feather name="map-pin" size={18} color="#00C48A" />
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
            <View style={[styles.iconBox, { backgroundColor: "rgba(234, 179, 8, 0.1)" }]}>
              <Feather name="lock" size={18} color="#EAB308" />
            </View>
            <View style={styles.textStack}>
              <Text style={styles.settingTitle}>Trigger Without App Open</Text>
              <Text style={styles.settingSub}>Activate SOS from background</Text>
            </View>
          </View>
          <Switch
            value={backgroundTrigger}
            onValueChange={setBackgroundTrigger}
            trackColor={{ false: theme.border, true: "#00C48A" }}
            thumbColor={"#FFFFFF"}
          />
        </View>

        {/* SOS Message Preview Section */}
        <Text style={styles.sectionTitle}>SOS MESSAGE PREVIEW</Text>
        <Text style={styles.previewHelperText}>Recipients will receive:</Text>
        
        <View style={styles.previewCard}>
          <Text style={styles.previewTextLine}>
            🚨 <Text style={{ fontWeight: "800" }}>EMERGENCY</Text> from <Text style={{ color: "#EF4444", fontWeight: "700" }}>Awoniyi</Text> via Strompulse
          </Text>
          <Text style={styles.previewTextLine}>
            📍 <Text style={{ color: "#00C48A", fontWeight: "700" }}>Carlton Gate Estate, Ibadan</Text>
          </Text>
          <Text style={styles.previewFooter}>Tap to track in Strompulse</Text>
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
      paddingHorizontal: 24,
      marginTop: Platform.OS === "ios" ? 60 : 40,
      marginBottom: 32,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.cardBg,
      marginRight: 16,
    },
    headerTextContainer: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "800",
      fontFamily: "Arial",
      color: theme.textPrimary,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 10,
      fontWeight: "800",
      fontFamily: "Arial",
      color: theme.textSecondary,
      letterSpacing: 1,
      marginTop: 2,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 40,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: "800",
      fontFamily: "Arial",
      color: theme.textSecondary,
      letterSpacing: 1,
      marginBottom: 12,
      marginTop: 8,
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
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
    },
    textStack: {
      flex: 1,
    },
    settingTitle: {
      fontSize: 16,
      fontWeight: "800",
      fontFamily: "Arial",
      color: theme.textPrimary,
      marginBottom: 4,
    },
    settingSub: {
      fontSize: 12,
      fontFamily: "Arial",
      color: theme.textSecondary,
    },
    previewHelperText: {
      fontSize: 13,
      fontFamily: "Arial",
      color: theme.textSecondary,
      marginBottom: 12,
      marginLeft: 4,
    },
    previewCard: {
      backgroundColor: "rgba(239, 68, 68, 0.05)",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(239, 68, 68, 0.2)",
      padding: 20,
    },
    previewTextLine: {
      fontSize: 14,
      fontFamily: "Arial",
      color: theme.textPrimary,
      lineHeight: 24,
      marginBottom: 8,
    },
    previewFooter: {
      fontSize: 12,
      fontFamily: "Arial",
      color: theme.textSecondary,
      marginTop: 8,
    },
  });

export default SafetySettingsScreen;