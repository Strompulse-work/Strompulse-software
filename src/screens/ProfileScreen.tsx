import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Switch,
  Image,
  Alert,
  SafeAreaView,
  ActivityIndicator
} from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import AuthService from "../services/authService";
import { useTheme } from "../theme/ThemeContext";
import { User } from "../types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ProfileScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode, toggleDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<string>("Locating...");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>("Explorer");

  // Real-time updates from Settings Screen
  useEffect(() => {
    if (route.params?.updatedName) {
      setFullName(route.params.updatedName);
      setUser((prev: any) => ({ ...prev, full_name: route.params.updatedName }));
    }
    if (route.params?.updatedImage !== undefined) {
      setAvatarUri(route.params.updatedImage);
    }
  }, [route.params?.updatedName, route.params?.updatedImage]);

  useEffect(() => {
    const initializeProfile = async () => {
      try {
        const session = await AuthService.getCurrentSession();
        if (session) {
          setUser(session.user);
          setFullName(session.user.full_name || "Afolabi Taiwo Glory"); // Default fallback
          if (!avatarUri && session.user.avatar_url) {
            setAvatarUri(session.user.avatar_url);
          }
        }

        // Check local storage for real-time overrides
        const localName = await AsyncStorage.getItem("global_name");
        const localAvatar = await AsyncStorage.getItem("global_avatar");
        if (localName) setFullName(localName);
        if (localAvatar) setAvatarUri(localAvatar);

        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setCurrentLocation("Ibadan, Oyo State");
          return;
        }

        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        let response = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (response && response.length > 0) {
          const address = response[0];
          const locality = address.district || address.subregion || address.city || "Ibadan";
          const region = address.region || "Oyo State";
          setCurrentLocation(`${locality}, ${region}`);
        } else {
          setCurrentLocation("Ibadan, Oyo State");
        }
      } catch (err) {
        console.error("Error initializing profile data:", err);
        setCurrentLocation("Ibadan, Oyo State");
      } finally {
        setLoading(false);
      }
    };

    initializeProfile();
  }, []);

  const handleLogoutPress = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out of your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await AuthService.logout();
            } catch (err) {
              console.error("Error logging out:", err);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#00C48A" />
      </View>
    );
  }

  const MenuCard = ({ icon, title, rightElement, onPress, isLast = false, isDestructive = false }: any) => (
    <TouchableOpacity
      style={[styles.menuItem, !isLast && styles.menuItemBorder]}
      onPress={onPress}
      disabled={!onPress && !rightElement}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <MaterialCommunityIcons name={icon} size={22} color={isDestructive ? "#EF4444" : theme.textPrimary} style={{ marginRight: 16 }} />
        <Text style={[styles.menuTitle, isDestructive && { color: "#EF4444" }]}>{title}</Text>
      </View>
      {rightElement ? (
        rightElement
      ) : (
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      )}
    </TouchableOpacity>
  );

  const MenuGroup = ({ children }: any) => (
    <View style={styles.menuGroup}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      {/* Clean Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("Notifications")}>
          <MaterialCommunityIcons name="bell" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Centered Avatar Section (No Edit Button) */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <MaterialCommunityIcons name="check-decagram" size={14} color="#FFF" />
            </View>
          </View>

          <Text style={styles.userName}>{fullName}</Text>
          <Text style={styles.userLocation}>{currentLocation}</Text>
        </View>

        {/* Menu Groups */}
        <MenuGroup>
          <MenuCard icon="clock-time-four" title="My Activity" onPress={() => navigation.navigate("MyActivityScreen")} />
          <MenuCard icon="bookmark" title="My Subscriptions" isLast={true} onPress={() => navigation.navigate("MySubscriptionsScreen")} />
        </MenuGroup>

        <MenuGroup>
          <MenuCard icon="cog" title="Edit Profile" onPress={() => navigation.navigate("SettingsScreen", { currentName: fullName, currentImage: avatarUri })} />
          <MenuCard icon="shield-check" title="Privacy & Security" onPress={() => navigation.navigate("PrivacySecurityScreen")} />
          <MenuCard
            icon="theme-light-dark"
            title="Dark Mode"
            isLast={true}
            rightElement={
              <Switch
                value={isDarkMode}
                onValueChange={() => toggleDarkMode()}
                trackColor={{ false: theme.border, true: "#00C48A" }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </MenuGroup>

        <MenuGroup>
          <MenuCard icon="information" title="About Strompulse" onPress={() => navigation.navigate("AboutScreen")} />
          <MenuCard icon="help-circle" title="Help & Support" isLast={true} onPress={() => navigation.navigate("HelpSupportScreen")} />
        </MenuGroup>

        <MenuGroup>
          <MenuCard
            icon="logout-variant"
            title="Log out"
            isLast={true}
            isDestructive={true}
            onPress={handleLogoutPress}
          />
        </MenuGroup>


      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme: any, isDarkMode: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#F4F6F8" },
  container: { flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#F4F6F8" },
  center: { justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    paddingBottom: 10,
  },
  iconBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "SoraTitle-Bold", color: theme.textPrimary },

  scrollContent: { paddingBottom: 40 },

  profileSection: { alignItems: "center", marginBottom: 32, marginTop: 10 },
  avatarContainer: { position: "relative", marginBottom: 16 },
  avatarImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: "#00C48A" },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#064E3B",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#00C48A",
  },
  avatarText: { fontSize: 40, fontFamily: "Chirp-Heavy", color: "#FFFFFF" },
  cameraBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "#00C48A",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: isDarkMode ? "#0B0F0D" : "#F4F6F8",
  },
  userName: { fontSize: 20, fontFamily: "Chirp-Bold", color: theme.textPrimary, marginBottom: 4 },
  userLocation: { fontSize: 13, fontFamily: "Chirp-Medium", color: theme.textSecondary, marginBottom: 0 },

  menuGroup: {
    backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? "#1F2E27" : "#F1F5F9",
  },
  menuItemLeft: { flexDirection: "row", alignItems: "center" },
  menuTitle: { fontSize: 14, fontFamily: "Chirp-Bold", color: theme.textPrimary },

  versionText: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Chirp-Medium",
    color: theme.textSecondary,
    marginTop: 10,
  },
});

export default ProfileScreen;