import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  Image,
  SafeAreaView,
} from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../theme/ThemeContext";

const EditProfileScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);

  const [fullName, setFullName] = useState(route.params?.currentName || "Explorer");
  const [phone, setPhone] = useState("+1 (555) 000 0000"); // Match reference styling
  const [profileImage, setProfileImage] = useState(route.params?.currentImage || null);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (profileImage) {
        await AsyncStorage.setItem("global_avatar", profileImage);
      } else {
        await AsyncStorage.removeItem("global_avatar");
      }
      if (fullName) {
        await AsyncStorage.setItem("global_name", fullName);
      }
    } catch (error) {
      console.error("Error caching profile data:", error);
    }

    setTimeout(() => {
      setSaving(false);
      navigation.navigate("Profile", {
        updatedName: fullName,
        updatedImage: profileImage,
      });
    }, 800);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity style={styles.iconBtn}>
          <MaterialCommunityIcons name="bell" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>{fullName.charAt(0).toUpperCase() || "E"}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.cameraBadge} onPress={pickImage}>
              <MaterialCommunityIcons name="camera" size={14} color="#FFF" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={pickImage}>
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Input Fields (Icons on the Right) */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Full Name</Text>
          <View style={styles.textInputWrapper}>
            <TextInput
              style={styles.textInput}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor={theme.textSecondary}
            />
            <Feather name="user" size={18} color={theme.textPrimary} />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Phone Number</Text>
          <View style={styles.textInputWrapper}>
            <TextInput
              style={styles.textInput}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="Enter phone number"
              placeholderTextColor={theme.textSecondary}
            />
            <Feather name="phone" size={18} color={theme.textPrimary} />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={styles.textInputWrapper}>
            <TextInput
              style={styles.textInput}
              value="alex.morgan@example.com"
              editable={false}
              placeholderTextColor={theme.textSecondary}
            />
            <Feather name="mail" size={18} color={theme.textPrimary} />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Primary Location</Text>
          <View style={styles.textInputWrapper}>
            <TextInput
              style={styles.textInput}
              value="Ibadan, Oyo State"
              editable={false}
              placeholderTextColor={theme.textSecondary}
            />
            <Feather name="map-pin" size={18} color={theme.textPrimary} />
          </View>
        </View>

        <Text style={styles.versionText}>Version 3.0.0 (Build 1042)</Text>

      </ScrollView>

      {/* Sticky Bottom CTA */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <Text style={styles.footerBtnText}>Saving changes...</Text>
          ) : (
            <Text style={styles.footerBtnText}>Save Profile</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const getStyles = (theme: any, isDarkMode: boolean) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#F4F6F8" },
    
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'android' ? 20 : 10,
      paddingBottom: 20,
    },
    iconBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
    headerTitle: { fontSize: 16, fontFamily: "Sora_700Bold", color: theme.textPrimary },
    
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    
    avatarSection: { alignItems: "center", marginBottom: 32, marginTop: 10 },
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
    avatarPlaceholderText: { fontSize: 40, fontFamily: "Sora_800ExtraBold", color: "#FFFFFF" },
    cameraBadge: {
      position: "absolute",
      bottom: 2,
      right: 2,
      backgroundColor: "#00C48A",
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: isDarkMode ? "#0B0F0D" : "#F4F6F8",
    },
    changePhotoText: { fontSize: 13, fontFamily: "Sora_600SemiBold", color: theme.textSecondary },

    inputGroup: { marginBottom: 20 },
    inputLabel: { fontSize: 13, fontFamily: "Sora_600SemiBold", color: theme.textSecondary, marginBottom: 8, marginLeft: 4 },
    textInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF",
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 56,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.02,
      shadowRadius: 5,
      elevation: 1,
    },
    textInput: { flex: 1, fontSize: 15, fontFamily: "Sora_500Medium", color: theme.textPrimary },

    versionText: {
      textAlign: "center",
      fontSize: 12,
      fontFamily: "Sora_500Medium",
      color: theme.textSecondary,
      marginTop: 20,
    },

    footer: { 
      paddingHorizontal: 20, 
      paddingVertical: Platform.OS === "ios" ? 24 : 16, 
      backgroundColor: isDarkMode ? "#0B0F0D" : "#F4F6F8", 
    },
    footerBtn: { 
      flexDirection: "row", 
      backgroundColor: "#00C48A", 
      borderRadius: 16, 
      paddingVertical: 18, 
      alignItems: "center", 
      justifyContent: "center", 
      shadowColor: "#00C48A", 
      shadowOffset: { width: 0, height: 6 }, 
      shadowOpacity: 0.2, 
      shadowRadius: 10, 
      elevation: 5 
    },
    footerBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Sora_700Bold" },
  });

export default EditProfileScreen;