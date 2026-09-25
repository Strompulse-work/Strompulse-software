import React, { useState, useCallback } from "react";
import { 
  StatusBar, 
  ScrollView, 
  TouchableOpacity, 
  Platform, 
  Alert,
  SafeAreaView,
  Switch
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import * as Contacts from "expo-contacts";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthService from "../services/authService";
import { useFocusEffect } from "@react-navigation/native";

const STORAGE_KEY = "strompulse_emergency_contacts";

const ContactsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();

  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"Phone Contacts" | "On Strompulse">("Phone Contacts");

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
          const bgDark = bgsDark[randomIdx];
          const bg = isDarkMode ? bgDark : bgsLight[randomIdx];

          const newContact = {
            id: contact.id || Math.random().toString(),
            initial,
            name,
            phone,
            color,
            bg,
            bgDark,
            isEmergency: false 
          };

          addContactToStrompulse(newContact);
        }
      } else {
        Alert.alert("Permission Required", "We need access to your phonebook to pick contacts.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addContactToStrompulse = async (contact: any) => {
    // Normalize phone to prevent duplicates
    const normalizedPhone = contact.phone.replace(/[^0-9+]/g, '');
    if (allContacts.some(c => c.phone.replace(/[^0-9+]/g, '') === normalizedPhone)) {
      Alert.alert("Already Added", `${contact.name} is already in your Strompulse contacts.`);
      return;
    }
    const newContacts = [...allContacts, contact];
    setAllContacts(newContacts);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newContacts));
    
    // Automatically switch user to the Strompulse tab so they can see the newly added contact
    setActiveTab("On Strompulse");
  };

  const emergencyNetworkCount = allContacts.filter(c => c.isEmergency).length;

  const toggleEmergencyStatus = async (id: string) => {
    const targetContact = allContacts.find(c => c.id === id);
    if (!targetContact.isEmergency && emergencyNetworkCount >= 3) {
      Alert.alert("Slots Full", "You can only have up to 3 emergency contacts active at once.");
      return;
    }
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
  const dynamicInviteLink = `strompulse.com/invite/${userName}-${uniqueId}`;

  const copyToClipboard = () => {
    Alert.alert("Copied!", "Invite link copied to clipboard.");
  };

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      <SafeAreaView style={{ flex: 1 }}>
        
        {/* --- HEADER --- */}
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={24}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Contacts</TText>
            <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={2} textTransform="uppercase">{emergencyNetworkCount} OF 3 ALERT SLOTS USED</TText>
          </YStack>
        </XStack>

        {/* --- TABS --- */}
        <XStack marginHorizontal={24} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={16} padding={4} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} marginBottom={24}>
          {(["Phone Contacts", "On Strompulse"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity key={tab} activeOpacity={0.8} onPress={() => setActiveTab(tab)} style={{ flex: 1 }}>
                <YStack backgroundColor={isActive ? (isDarkMode ? "#2D3B34" : "#F1F5F9") : "transparent"} paddingVertical={10} borderRadius={12} alignItems="center" justifyContent="center">
                  <TText fontFamily={isActive ? "Chirp-Bold" : "Chirp-Medium"} fontSize={13} color={isActive ? theme.textPrimary : theme.textSecondary}>{tab}</TText>
                </YStack>
              </TouchableOpacity>
            );
          })}
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          
          {/* --- TAB 1: PHONE CONTACTS --- */}
          {activeTab === "Phone Contacts" && (
            <YStack marginBottom={32}>
              <TouchableOpacity activeOpacity={0.8} onPress={openContactPicker} style={{ width: "100%" }}>
                <XStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={20} padding={16} alignItems="center" justifyContent="center" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} marginBottom={16} borderStyle="dashed">
                  <Feather name="plus" size={18} color="#00C48A" style={{ marginRight: 8 }} />
                  <TText fontSize={14} fontFamily="Chirp-Bold" color="#00C48A">Add from Phonebook</TText>
                </XStack>
              </TouchableOpacity>
              
              <TText fontSize={13} fontFamily="Chirp-Medium" color={theme.textSecondary} textAlign="center" paddingHorizontal={16} lineHeight={20}>
                Add phone contacts you want to be on Strompulse from your device's native contacts.
              </TText>
            </YStack>
          )}

          {/* --- TAB 2: ON STROMPULSE --- */}
          {activeTab === "On Strompulse" && (
            <YStack marginBottom={32}>
              <TText fontSize={12} fontFamily="Chirp-Medium" color={theme.textSecondary} marginBottom={16}>
                Turn on "Alert" for anyone who should get notified when you send SOS — up to 3 slots.
              </TText>

              {allContacts.length > 0 ? (
                <YStack gap={12}>
                  {allContacts.map((contact) => (
                    <XStack 
                      key={contact.id} 
                      backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} 
                      borderRadius={20} 
                      padding={16} 
                      alignItems="center" 
                      justifyContent="space-between"
                      borderWidth={1} 
                      borderColor={contact.isEmergency ? "#00C48A" : (isDarkMode ? "#2D3B34" : "#F1F5F9")}
                    >
                      <XStack alignItems="center" flex={1}>
                        <YStack position="relative" marginRight={16}>
                          <YStack width={44} height={44} borderRadius={22} backgroundColor={isDarkMode ? (contact.bgDark || contact.bg) : contact.bg} justifyContent="center" alignItems="center">
                            <TText fontSize={18} fontFamily="Chirp-Heavy" color={contact.color}>{contact.initial}</TText>
                          </YStack>
                          {/* Little green dot indicator */}
                          <YStack position="absolute" bottom={0} right={0} width={12} height={12} borderRadius={6} backgroundColor="#00C48A" borderWidth={2} borderColor={isDarkMode ? "#121A16" : "#FFFFFF"} />
                        </YStack>
                        <YStack flex={1}>
                          <TText fontSize={15} fontFamily="Chirp-Bold" color={theme.textPrimary} marginBottom={2} numberOfLines={1}>
                            {contact.name}
                          </TText>
                          <TText fontSize={12} fontFamily="Chirp-Medium" color={theme.textSecondary}>
                            {contact.phone}
                          </TText>
                        </YStack>
                      </XStack>

                      <XStack alignItems="center" gap={16}>
                        <YStack alignItems="center" justifyContent="center">
                          <TText fontSize={9} fontFamily="Chirp-Bold" color={contact.isEmergency ? "#00C48A" : theme.textSecondary} marginBottom={4} letterSpacing={0.5}>ALERT</TText>
                          <Switch
                            value={contact.isEmergency}
                            onValueChange={() => toggleEmergencyStatus(contact.id)}
                            trackColor={{ false: isDarkMode ? "#2D3B34" : "#E2E8F0", true: "#00C48A" }}
                            thumbColor="#FFFFFF"
                          />
                        </YStack>
                        
                        {/* Remove Contact Button */}
                        <TouchableOpacity hitSlop={{top: 10, bottom: 10, left: 10, right: 10}} onPress={() => deleteContact(contact.id)}>
                          <Feather name="x" size={20} color={theme.textSecondary} opacity={0.6} />
                        </TouchableOpacity>
                      </XStack>
                    </XStack>
                  ))}
                </YStack>
              ) : (
                <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} padding={24} borderRadius={24} alignItems="center" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                  <TText fontSize={13} fontFamily="Chirp-Medium" color={theme.textSecondary} textAlign="center">
                    No contacts added yet. Switch to "Phone Contacts" to add your network.
                  </TText>
                </YStack>
              )}
            </YStack>
          )}

          {/* --- INVITE LINK SECTION --- */}
          <YStack>
            <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>
              YOUR INVITE LINK
            </TText>
            <XStack 
              backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} 
              borderRadius={20} 
              borderWidth={1} 
              borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} 
              paddingHorizontal={16} 
              paddingVertical={12} 
              marginBottom={24} 
              alignItems="center" 
              justifyContent="space-between"
            >
              <TText flex={1} fontSize={13} fontFamily="Chirp-Medium" color={theme.textSecondary} marginRight={12} numberOfLines={1}>
                {dynamicInviteLink}
              </TText>
              <TouchableOpacity onPress={copyToClipboard} activeOpacity={0.7} style={{ backgroundColor: isDarkMode ? "rgba(59,130,246,0.1)" : "#EFF6FF", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 }}>
                <TText fontSize={13} fontFamily="Chirp-Bold" color="#3B82F6">Copy</TText>
              </TouchableOpacity>
            </XStack>

            {/* Quick Share Actions */}
            <XStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} padding={20} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} justifyContent="space-between" alignItems="center">
              <TouchableOpacity style={{ alignItems: 'center' }}>
                <MaterialCommunityIcons name="whatsapp" size={24} color="#25D366" />
                <TText fontSize={11} fontFamily="Chirp-Bold" color="#25D366" marginTop={8}>WhatsApp</TText>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center' }}>
                <MaterialCommunityIcons name="message-processing" size={24} color="#3B82F6" />
                <TText fontSize={11} fontFamily="Chirp-Bold" color="#3B82F6" marginTop={8}>SMS</TText>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center' }}>
                <Feather name="link" size={22} color="#F59E0B" />
                <TText fontSize={11} fontFamily="Chirp-Bold" color="#F59E0B" marginTop={8}>Share Link</TText>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center' }}>
                <Feather name="copy" size={22} color="#8B5CF6" />
                <TText fontSize={11} fontFamily="Chirp-Bold" color="#8B5CF6" marginTop={8}>Copy Card</TText>
              </TouchableOpacity>
            </XStack>
          </YStack>

        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default ContactsScreen;