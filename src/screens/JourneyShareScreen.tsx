/**
 * Journey Share Screen v2.0
 * Features: Location preview, contact visibility row, and proactive safety messaging.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

const JourneyShareScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme);

  const alertContacts = [
    { id: 1, initial: "M", name: "Mum", color: "#F59E0B" },    // Orange
    { id: 2, initial: "T", name: "Tunde", color: "#3B82F6" },  // Blue
    { id: 3, initial: "S", name: "Sola", color: "#8B5CF6" },   // Purple
  ];

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
          <Text style={styles.headerTitle}>Journey Share</Text>
          <Text style={styles.headerSubtitle}>LET CONTACTS FOLLOW YOUR ROUTE</Text>
        </View>
      </View>

      {/* Location Preview Card */}
      <View style={styles.locationCard}>
        <View style={styles.locationIconWrapper}>
          <Feather name="map-pin" size={20} color="#00C48A" />
        </View>
        <Text style={styles.locationText}>Carlton Gate Estate, Ibadan</Text>
      </View>

      {/* Contacts Section */}
      <View style={styles.contactsSection}>
        <Text style={styles.sectionTitle}>SHARING WITH YOUR ALERT CONTACTS</Text>
        <View style={styles.avatarRow}>
          {alertContacts.map((contact) => (
            <View key={contact.id} style={styles.avatarContainer}>
              <View style={[styles.avatarCircle, { borderColor: contact.color }]}>
                <Text style={[styles.avatarText, { color: contact.color }]}>
                  {contact.initial}
                </Text>
              </View>
              <Text style={styles.avatarLabel}>{contact.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Pre-formatted Message Card */}
      <View style={styles.messageCard}>
        <MaterialCommunityIcons 
          name="message-processing" 
          size={16} 
          color={theme.textSecondary} 
          style={{ marginTop: 2, marginRight: 8 }} 
        />
        <Text style={styles.messageText}>
          <Text style={{ fontWeight: "700" }}>Message: </Text>
          "Hey, I'm heading out — follow my journey on Strompulse until I arrive."
        </Text>
      </View>

      {/* CTA Button */}
      <TouchableOpacity style={styles.startButton} activeOpacity={0.8}>
        <Text style={styles.startButtonText}>Start Journey Share</Text>
      </TouchableOpacity>
    </View>
  );
};

// Generate styles dynamically
const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingHorizontal: 24,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
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
    locationCard: {
      backgroundColor: theme.cardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 32,
      alignItems: "center",
      marginBottom: 32,
    },
    locationIconWrapper: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(0, 196, 138, 0.1)",
      borderWidth: 1,
      borderColor: "rgba(0, 196, 138, 0.3)",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    locationText: {
      fontSize: 14,
      fontWeight: "600",
      fontFamily: "Arial",
      color: theme.textSecondary,
    },
    contactsSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: "800",
      fontFamily: "Arial",
      color: theme.textSecondary,
      letterSpacing: 1,
      marginBottom: 16,
    },
    avatarRow: {
      flexDirection: "row",
      gap: 16,
    },
    avatarContainer: {
      alignItems: "center",
    },
    avatarCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(255, 255, 255, 0.02)",
      marginBottom: 8,
    },
    avatarText: {
      fontSize: 18,
      fontWeight: "800",
      fontFamily: "Arial",
    },
    avatarLabel: {
      fontSize: 12,
      fontFamily: "Arial",
      color: theme.textSecondary,
    },
    messageCard: {
      flexDirection: "row",
      backgroundColor: "rgba(0, 196, 138, 0.05)",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(0, 196, 138, 0.2)",
      padding: 16,
      marginBottom: 24,
    },
    messageText: {
      flex: 1,
      fontSize: 13,
      fontFamily: "Arial",
      color: theme.textSecondary,
      lineHeight: 20,
      fontStyle: "italic",
    },
    startButton: {
      backgroundColor: "#00C48A",
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    startButtonText: {
      fontSize: 16,
      fontWeight: "800",
      fontFamily: "Arial",
      color: "#12141D", // Dark text on the bright green button for high contrast
    },
  });

export default JourneyShareScreen;