import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  SafeAreaView
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import * as Contacts from "expo-contacts";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthService from "../services/authService";
import { useFocusEffect } from "@react-navigation/native";

const STORAGE_KEY = "strompulse_emergency_contacts";

const ContactsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = getStyles(theme, isDarkMode);

  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      const initializeData = async () => {
        try {
          const session = await AuthService.getCurrentSession();
          if (session) setUser(session.user);

          const saved = await AsyncStorage.getItem(STORAGE_KEY);
          if (saved) {
            setAllContacts(JSON.parse(saved));
          }
        } catch (e) {
          console.error("Error loading contacts", e);
        }
      };
      initializeData();
    }, [])
  );

  const openContactPicker = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status === "granted") {
        const contact = await Contacts.presentContactPickerAsync();
        
        if (contact) {
          if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) {
            Alert.alert("No Phone Number", "This contact doesn't have a phone number saved.");
            return;
          }

          const phone = contact.phoneNumbers[0].number;
          
          const name = contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown";
          const initial = name !== "Unknown" ? name.charAt(0).toUpperCase() : "#";

          const colors = ["#00C48A", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"];
          const bgsLight = ["#ECFDF5", "#DBEAFE", "#F3E8FF", "#FEF3C7", "#FEE2E2"];
          const bgsDark = [
            "rgba(0,196,138,0.15)", 
            "rgba(59,130,246,0.15)", 
            "rgba(139,92,246,0.15)", 
            "rgba(245,158,11,0.15)", 
            "rgba(239,68,68,0.15)"
          ];
          
          const randomIdx = Math.floor(Math.random() * colors.length);
          const color = colors[randomIdx];
          const bg = isDarkMode ? bgsDark[randomIdx] : bgsLight[randomIdx];

          const newContact = {
            id: contact.id || Math.random().toString(),
            initial,
            name,
            phone,
            color,
            bg,
            isEmergency: false // Default to General Contact
          };

          addContactToStrompulse(newContact);
        }
      } else {
        Alert.alert("Permission Required", "We need access to your phonebook to add contacts.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addContactToStrompulse = async (contact: any) => {
    if (allContacts.some(c => c.phone === contact.phone)) {
      Alert.alert("Already Added", `${contact.name} is already in your Strompulse contacts.`);
      return;
    }
    const newContacts = [...allContacts, contact];
    setAllContacts(newContacts);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newContacts));
  };

  const toggleEmergencyStatus = async (id: string) => {
    const newContacts = allContacts.map(c => 
      c.id === id ? { ...c, isEmergency: !c.isEmergency } : c
    );
    setAllContacts(newContacts);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newContacts));
  };

  const deleteContact = async (id: string) => {
    const newContacts = allContacts.filter(c => c.id !== id);
    setAllContacts(newContacts);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newContacts));
  };

  const userName = user?.full_name?.split(' ')[0]?.toLowerCase() || user?.user_metadata?.username || "stromer";
  const uniqueId = user?.id?.substring(0, 4) || "7x3k";
  const dynamicInviteLink = `strompulse.de/invite/${userName}-${uniqueId}`;

  const emergencyNetwork = allContacts.filter(c => c.isEmergency);
  const generalContacts = allContacts.filter(c => !c.isEmergency);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.7} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Contacts</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          <TouchableOpacity style={styles.addContactBtn} activeOpacity={0.8} onPress={openContactPicker}>
            <MaterialCommunityIcons name="plus-circle" size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.addContactBtnText}>Add Contact from Phone</Text>
          </TouchableOpacity>

          {/* EMERGENCY NETWORK */}
          <Text style={styles.sectionTitle}>MY EMERGENCY NETWORK (SOS)</Text>
          <Text style={styles.sectionDesc}>These contacts will receive a WhatsApp broadcast when you trigger an SOS.</Text>
          
          <View style={styles.contactsList}>
            {emergencyNetwork.map((contact) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactLeft}>
                  <View style={styles.avatarContainer}>
                    <View style={[styles.avatar, { backgroundColor: contact.bg }]}>
                      <Text style={[styles.avatarText, { color: contact.color }]}>{contact.initial}</Text>
                    </View>
                    <View style={styles.onlineIndicator} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName} numberOfLines={1}>{contact.name}</Text>
                    <Text style={styles.contactSub}>{contact.phone}</Text>
                  </View>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity onPress={() => toggleEmergencyStatus(contact.id)} style={[styles.actionPill, { backgroundColor: isDarkMode ? "rgba(245,158,11,0.15)" : "#FEF3C7" }]}>
                    <MaterialCommunityIcons name="shield-off" size={16} color="#F59E0B" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteContact(contact.id)} style={[styles.actionPill, { backgroundColor: isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2", marginLeft: 8 }]}>
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {emergencyNetwork.length === 0 && (
              <Text style={styles.emptyText}>No emergency contacts. Add general contacts to your emergency network below.</Text>
            )}
          </View>

          {/* GENERAL CONTACTS */}
          <Text style={styles.sectionTitle}>GENERAL CONTACTS (JOURNEY SHARE)</Text>
          <Text style={styles.sectionDesc}>Available for Journey Sharing and tracking.</Text>

          <View style={styles.contactsList}>
            {generalContacts.map((contact) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactLeft}>
                  <View style={styles.avatarContainer}>
                    <View style={[styles.avatar, { backgroundColor: contact.bg }]}>
                      <Text style={[styles.avatarText, { color: contact.color }]}>{contact.initial}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName} numberOfLines={1}>{contact.name}</Text>
                    <Text style={styles.contactSub}>{contact.phone}</Text>
                  </View>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity onPress={() => toggleEmergencyStatus(contact.id)} style={[styles.actionPill, { backgroundColor: isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5", paddingHorizontal: 12 }]}>
                    <MaterialCommunityIcons name="shield-check" size={14} color="#00C48A" style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 11, fontFamily: "Sora_700Bold", color: "#00C48A" }}>Add to SOS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteContact(contact.id)} style={[styles.actionPill, { backgroundColor: isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2", marginLeft: 8 }]}>
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {generalContacts.length === 0 && (
              <Text style={styles.emptyText}>No general contacts added.</Text>
            )}
          </View>

          <Text style={styles.sectionTitle}>YOUR INVITE LINK</Text>
          <View style={styles.inviteInputContainer}>
            <Text style={styles.inviteLinkText} numberOfLines={1}>{dynamicInviteLink}</Text>
            <TouchableOpacity style={styles.copyButtonContainer} activeOpacity={0.7}>
              <Text style={styles.copyButtonText}>Copy</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const getStyles = (theme: any, isDarkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDarkMode ? "#0B0F0D" : "#F4F6F8" },
  safeArea: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingTop: Platform.OS === "ios" ? 20 : 10, marginBottom: 24 },
  backButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0", justifyContent: "center", alignItems: "center", backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", marginRight: 16 },
  headerTitle: { fontSize: 20, fontFamily: "Sora_800ExtraBold", color: theme.textPrimary },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  
  addContactBtn: { flexDirection: "row", backgroundColor: "#00C48A", borderRadius: 16, paddingVertical: 16, justifyContent: "center", alignItems: "center", marginBottom: 32, shadowColor: "#00C48A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  addContactBtnText: { fontSize: 14, fontFamily: "Sora_700Bold", color: "#FFFFFF" },

  sectionTitle: { fontSize: 11, fontFamily: "Sora_700Bold", color: theme.textSecondary, letterSpacing: 1.5, marginBottom: 4, marginLeft: 4 },
  sectionDesc: { fontSize: 11, fontFamily: "Sora_400Regular", color: theme.textSecondary, marginBottom: 16, marginLeft: 4, lineHeight: 16 },
  contactsList: { marginBottom: 32 },
  emptyText: { fontSize: 12, fontFamily: "Sora_500Medium", color: theme.textSecondary, paddingLeft: 4, paddingBottom: 10 },
  
  contactCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: isDarkMode ? "#1F2E27" : "#E2E8F0", padding: 16, marginBottom: 12 },
  contactLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatarContainer: { position: "relative", marginRight: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 20, fontFamily: "Sora_700Bold" },
  onlineIndicator: { position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: "#00C48A", borderWidth: 2, borderColor: isDarkMode ? "#121A16" : "#FFFFFF" },
  contactName: { fontSize: 15, fontFamily: "Sora_700Bold", color: theme.textPrimary, marginBottom: 4 },
  contactSub: { fontSize: 12, fontFamily: "Sora_500Medium", color: theme.textSecondary },
  
  actionRow: { flexDirection: "row", alignItems: "center" },
  actionPill: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 36, borderRadius: 12, paddingHorizontal: 12 },
  
  inviteInputContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: isDarkMode ? "#121A16" : "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: isDarkMode ? "#1F2E27" : "#E2E8F0", paddingLeft: 16, paddingRight: 8, paddingVertical: 8, marginBottom: 20 },
  inviteLinkText: { flex: 1, fontSize: 13, fontFamily: "Sora_500Medium", color: theme.textSecondary, marginRight: 12 },
  copyButtonContainer: { backgroundColor: isDarkMode ? "rgba(59,130,246,0.15)" : "#EFF6FF", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  copyButtonText: { fontSize: 12, fontFamily: "Sora_700Bold", color: "#2563EB" },
});

export default ContactsScreen;