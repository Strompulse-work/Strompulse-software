import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  TextInput, 
  Platform, 
  Image, 
  KeyboardAvoidingView, 
  Keyboard, 
  TouchableWithoutFeedback,
  Alert,
  ActivityIndicator
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";

const SettingsScreen = ({ navigation, route }: any) => {
  const { theme, isDarkMode } = useTheme();
  
  const [name, setName] = useState(route.params?.currentName || "Afolabi Taiwo Glory");
  const [avatar, setAvatar] = useState(route.params?.currentImage || null);
  const [isSaving, setIsSaving] = useState(false);

  // --- Image Picker Logic ---
  const handlePickImage = async () => {
    // 1. Request permission to access the gallery
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Please allow Strompulse access to your photos to change your avatar.");
      return;
    }

    // 2. Launch the image gallery
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Only allow images
      allowsEditing: true, // Let the user crop it
      aspect: [1, 1], // Force a square crop for the circular avatar
      quality: 0.8, // Compress slightly for performance
    });

    // 3. If they picked an image (didn't cancel), update the avatar state
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setAvatar(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    setIsSaving(true);
    
    // Save new name and avatar to local storage so it persists app-wide
    await AsyncStorage.setItem("global_name", name);
    if (avatar) {
      await AsyncStorage.setItem("global_avatar", avatar);
    }

    setTimeout(() => {
      setIsSaving(false);
      // Route the new params back to the Profile screen to trigger a re-render
      navigation.navigate("Profile", { updatedName: name, updatedImage: avatar });
    }, 800); // Simulate API latency
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#F4F6F8" }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Settings</Text>
              <View style={styles.iconBtn} />
            </View>

            <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
              
              {/* Profile Editor */}
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>PROFILE INFORMATION</Text>
              
              <View style={[styles.card, { backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderColor: isDarkMode ? "#1F2E27" : "#F1F5F9" }]}>
                
                {/* Avatar Section */}
                <View style={styles.avatarSection}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.changePhotoBtn} onPress={handlePickImage}>
                    <Text style={styles.changePhotoText}>Change Photo</Text>
                  </TouchableOpacity>
                </View>

                {/* Input Fields */}
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Full Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDarkMode ? "#1A221E" : "#F8FAFC", color: theme.textPrimary, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter full name"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: isDarkMode ? "#00C48A" : "#00C48A", opacity: isSaving ? 0.7 : 1 }]} 
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 20 : 10, paddingBottom: 10 },
  iconBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "SoraTitle-Bold" },
  sectionTitle: { fontSize: 11, fontFamily: "Chirp-Bold", letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  card: { borderRadius: 24, padding: 20, borderWidth: 1, marginBottom: 24 },
  avatarSection: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  avatarImage: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#064E3B", justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 24, fontFamily: "Chirp-Heavy", color: "#FFFFFF" },
  changePhotoBtn: { marginLeft: 16, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "rgba(0,196,138,0.1)", borderRadius: 16 },
  changePhotoText: { color: "#00C48A", fontFamily: "Chirp-Bold", fontSize: 13 },
  inputLabel: { fontSize: 12, fontFamily: "Chirp-Bold", marginBottom: 8 },
  input: { height: 50, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, fontFamily: "Chirp-Medium", fontSize: 15 },
  saveBtn: { height: 56, borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", shadowColor: "#00C48A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  saveBtnText: { color: "#FFFFFF", fontFamily: "Chirp-Bold", fontSize: 15 }
});

export default SettingsScreen;