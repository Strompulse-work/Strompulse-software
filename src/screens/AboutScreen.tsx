import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Image,
  SafeAreaView,
} from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";

const AboutScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);

  // Black icons for light mode, white for dark mode to maintain the clean aesthetic
  const monochromeIconColor = isDarkMode ? "#FFFFFF" : "#000000";
  const monochromeBgColor = isDarkMode ? "#1A221E" : "#F4F6F8";

  const capabilities = [
    {
      id: "1",
      icon: "transmission-tower",
      title: "Grid Tracking",
      desc: "Live area mapping",
    },
    {
      id: "2",
      icon: "shield-home",
      title: "Safety First",
      desc: "Secure emergency SOS",
    },
    {
      id: "3",
      icon: "chart-arc",
      title: "Live Analytics",
      desc: "Real-time node data",
    },
    {
      id: "4",
      icon: "bell-ring",
      title: "Instant Alerts",
      desc: "Push notifications",
    },
  ];

  const ActionLink = ({ icon, title, isLast }: any) => (
    <TouchableOpacity style={[styles.actionLink, !isLast && styles.actionLinkBorder]} activeOpacity={0.7}>
      <View style={styles.actionLinkLeft}>
        <MaterialCommunityIcons name={icon} size={22} color={theme.textPrimary} />
        <Text style={styles.actionLinkText}>{title}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={theme.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Sweeping Gradient Header */}
      <LinearGradient 
        colors={isDarkMode ? ["#022C22", "#0B0F0D"] : ["#00C48A", "#064E3B"]} 
        style={styles.headerBackground}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Floating Top Navigation */}
        <View style={styles.topNav}>
          <TouchableOpacity style={styles.navBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>App Info</Text>
          <View style={styles.navSpacer} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Main Hero Logo Card */}
          <View style={styles.heroCard}>
            <View style={styles.logoWrapper}>
              <Image 
                source={require("../../assets/images/strompulselogo.png")} 
                style={styles.logoImage} 
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>Strompulse</Text>
            <Text style={styles.appSub}>The smart power grid companion.</Text>
          </View>

          {/* Mission Quote Section */}
          <View style={styles.quoteSection}>
            <MaterialCommunityIcons name="format-quote-open" size={32} color={monochromeIconColor} style={styles.quoteIcon} />
            <Text style={styles.quoteText}>
              Empowering communities with real-time grid intelligence and seamless safety networks.
            </Text>
          </View>

          {/* Bento Box Capabilities Grid */}
          <Text style={styles.sectionHeader}>CORE CAPABILITIES</Text>
          <View style={styles.bentoGrid}>
            {capabilities.map((item) => (
              <View key={item.id} style={styles.bentoCard}>
                <View style={[styles.bentoIconBox, { backgroundColor: monochromeBgColor }]}>
                  <MaterialCommunityIcons name={item.icon as any} size={24} color={monochromeIconColor} />
                </View>
                <Text style={styles.bentoTitle}>{item.title}</Text>
                <Text style={styles.bentoDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>

          {/* Action Links */}
          <Text style={styles.sectionHeader}>RESOURCES</Text>
          <View style={styles.actionLinksContainer}>
            <ActionLink icon="web" title="Visit Website" />
            <ActionLink icon="file-document-outline" title="Terms of Service" />
            <ActionLink icon="shield-lock-outline" title="Privacy Policy" isLast={true} />
          </View>

          {/* Footer Copyright */}
          <View style={styles.footer}>
            <Text style={styles.copyrightText}>© 2026 Strompulse Technologies.</Text>
            <Text style={styles.copyrightText}>All rights reserved in Nigeria.</Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const getStyles = (theme: any, isDarkMode: boolean) =>
  StyleSheet.create({
    container: { 
      flex: 1, 
      backgroundColor: isDarkMode ? "#0B0F0D" : "#F4F6F8" 
    },
    safeArea: {
      flex: 1,
    },
    
    // Gradient Background
    headerBackground: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 280,
      borderBottomLeftRadius: 40,
      borderBottomRightRadius: 40,
    },
    
    // Top Navigation
    topNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'android' ? 20 : 10,
      marginBottom: 24,
    },
    navBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.2)",
      justifyContent: "center",
      alignItems: "center",
    },
    navTitle: {
      fontSize: 18,
      fontFamily: "SoraTitle-Bold",
      color: "#FFFFFF",
    },
    navSpacer: {
      width: 44,
    },

    scrollContent: { 
      paddingBottom: 40,
    },
    
    // Hero Logo Card
    heroCard: {
      backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF",
      marginHorizontal: 20,
      borderRadius: 32,
      padding: 32,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 5,
      marginBottom: 32,
      borderWidth: 1,
      borderColor: isDarkMode ? "#1F2E27" : "transparent",
    },
    logoWrapper: {
      width: 90,
      height: 90,
      borderRadius: 28,
      backgroundColor: isDarkMode ? "#1A221E" : "#F8FAFC",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0",
    },
    logoImage: {
      width: 55,
      height: 55,
    },
    appName: { 
      fontSize: 26, 
      fontFamily: "Sora_800ExtraBold", 
      color: theme.textPrimary, 
      marginBottom: 6 
    },
    appSub: {
      fontSize: 13,
      fontFamily: "Sora_500Medium",
      color: theme.textSecondary,
    },

    // Mission Quote
    quoteSection: {
      marginHorizontal: 30,
      marginBottom: 40,
      alignItems: "center",
    },
    quoteIcon: {
      marginBottom: 12,
      opacity: 0.9,
    },
    quoteText: {
      fontSize: 16,
      fontFamily: "Sora_600SemiBold",
      color: theme.textPrimary,
      textAlign: "center",
      lineHeight: 26,
    },

    // Bento Grid Section
    sectionHeader: { 
      fontSize: 12, 
      fontFamily: "Sora_800ExtraBold", 
      color: theme.textSecondary, 
      letterSpacing: 1.5,
      marginLeft: 24, 
      marginBottom: 16,
    },
    bentoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 16,
      justifyContent: "space-between",
      marginBottom: 32,
    },
    bentoCard: {
      width: "47%",
      backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF",
      borderRadius: 24,
      padding: 20,
      marginBottom: 16,
      alignItems: "flex-start",
      borderWidth: 1,
      borderColor: isDarkMode ? "#1F2E27" : "#E2E8F0",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.02,
      shadowRadius: 10,
      elevation: 1,
    },
    bentoIconBox: {
      width: 48,
      height: 48,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    bentoTitle: {
      fontSize: 14,
      fontFamily: "Sora_700Bold",
      color: theme.textPrimary,
      marginBottom: 6,
    },
    bentoDesc: {
      fontSize: 11,
      fontFamily: "Sora_500Medium",
      color: theme.textSecondary,
      lineHeight: 16,
    },

    // Action Links
    actionLinksContainer: {
      backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF",
      marginHorizontal: 20,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: isDarkMode ? "#1F2E27" : "#E2E8F0",
      marginBottom: 40,
    },
    actionLink: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 18,
      paddingHorizontal: 20,
    },
    actionLinkBorder: {
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? "#1F2E27" : "#F1F5F9",
    },
    actionLinkLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    actionLinkText: {
      fontSize: 14,
      fontFamily: "Sora_600SemiBold",
      color: theme.textPrimary,
      marginLeft: 14,
    },

    // Footer
    footer: {
      alignItems: "center",
      paddingBottom: 20,
    },
    copyrightText: { 
      textAlign: "center", 
      fontSize: 12, 
      fontFamily: "Sora_500Medium", 
      color: theme.textTertiary,
      lineHeight: 20,
    },
  });

export default AboutScreen;