import React, { useState, useCallback } from "react";
import {
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  SafeAreaView
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
            isEmergency: false 
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
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* --- MINIMALIST HEADER --- */}
        <XStack justifyContent="center" alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 20 : 10} paddingBottom={16} position="relative">
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ position: "absolute", left: 24, padding: 8, zIndex: 10 }}>
            <Feather name="arrow-left" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>My Contacts</TText>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 10 }}>
          
          {/* --- ADD CONTACT BUTTON --- */}
          <TouchableOpacity activeOpacity={0.8} onPress={openContactPicker}>
            <XStack 
              backgroundColor="#00C48A" 
              borderRadius={20} 
              paddingVertical={16} 
              justifyContent="center" 
              alignItems="center" 
              marginBottom={32}
            >
              <Feather name="user-plus" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <TText fontSize={15} fontFamily="Chirp-Bold" color="#FFFFFF">Add from Phonebook</TText>
            </XStack>
          </TouchableOpacity>

          {/* --- EMERGENCY NETWORK --- */}
          <YStack marginBottom={32}>
            <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={1.5} marginBottom={4} marginLeft={4}>
              MY EMERGENCY NETWORK (SOS)
            </TText>
            <TText fontSize={11} fontFamily="Chirp-Regular" color={theme.textSecondary} marginBottom={16} marginLeft={4} lineHeight={16}>
              These contacts will receive a WhatsApp broadcast when you trigger an SOS.
            </TText>
            
            {emergencyNetwork.length > 0 ? (
              <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                {emergencyNetwork.map((contact, index) => (
                  <XStack 
                    key={contact.id} 
                    padding={16} 
                    alignItems="center" 
                    justifyContent="space-between"
                    borderBottomWidth={index === emergencyNetwork.length - 1 ? 0 : 1}
                    borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}
                  >
                    <XStack alignItems="center" flex={1}>
                      <YStack position="relative" marginRight={16}>
                        <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? contact.bgDark : contact.bg} justifyContent="center" alignItems="center">
                          <TText fontSize={16} fontFamily="Chirp-Heavy" color={contact.color}>{contact.initial}</TText>
                        </YStack>
                        <YStack 
                          position="absolute" 
                          bottom={-2} 
                          right={-2} 
                          width={12} 
                          height={12} 
                          borderRadius={6} 
                          backgroundColor="#00C48A" 
                          borderWidth={2} 
                          borderColor={isDarkMode ? "#121A16" : "#FFFFFF"} 
                        />
                      </YStack>
                      <YStack flex={1}>
                        <TText fontSize={15} fontFamily="Chirp-Medium" color={theme.textPrimary} marginBottom={2} numberOfLines={1}>
                          {contact.name}
                        </TText>
                        <TText fontSize={12} fontFamily="Chirp-Regular" color={theme.textSecondary}>
                          {contact.phone}
                        </TText>
                      </YStack>
                    </XStack>

                    <XStack alignItems="center" gap={16}>
                      <TouchableOpacity onPress={() => toggleEmergencyStatus(contact.id)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                        <Feather name="shield-off" size={20} color="#F59E0B" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteContact(contact.id)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                        <Feather name="trash-2" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </XStack>
                  </XStack>
                ))}
              </YStack>
            ) : (
              <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} padding={24} borderRadius={24} alignItems="center" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                <TText fontSize={13} fontFamily="Chirp-Medium" color={theme.textSecondary} textAlign="center">
                  No emergency contacts. Add general contacts to your SOS network below.
                </TText>
              </YStack>
            )}
          </YStack>

          {/* --- GENERAL CONTACTS --- */}
          <YStack marginBottom={32}>
            <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={1.5} marginBottom={4} marginLeft={4}>
              GENERAL CONTACTS (JOURNEY SHARE)
            </TText>
            <TText fontSize={11} fontFamily="Chirp-Regular" color={theme.textSecondary} marginBottom={16} marginLeft={4} lineHeight={16}>
              Available for Journey Sharing and tracking.
            </TText>

            {generalContacts.length > 0 ? (
              <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} overflow="hidden" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                {generalContacts.map((contact, index) => (
                  <XStack 
                    key={contact.id} 
                    padding={16} 
                    alignItems="center" 
                    justifyContent="space-between"
                    borderBottomWidth={index === generalContacts.length - 1 ? 0 : 1}
                    borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}
                  >
                    <XStack alignItems="center" flex={1}>
                      <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? contact.bgDark : contact.bg} justifyContent="center" alignItems="center" marginRight={16}>
                        <TText fontSize={16} fontFamily="Chirp-Heavy" color={contact.color}>{contact.initial}</TText>
                      </YStack>
                      <YStack flex={1}>
                        <TText fontSize={15} fontFamily="Chirp-Medium" color={theme.textPrimary} marginBottom={2} numberOfLines={1}>
                          {contact.name}
                        </TText>
                        <TText fontSize={12} fontFamily="Chirp-Regular" color={theme.textSecondary}>
                          {contact.phone}
                        </TText>
                      </YStack>
                    </XStack>

                    <XStack alignItems="center" gap={16}>
                      <TouchableOpacity onPress={() => toggleEmergencyStatus(contact.id)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                        <Feather name="shield" size={20} color={theme.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteContact(contact.id)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                        <Feather name="trash-2" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </XStack>
                  </XStack>
                ))}
              </YStack>
            ) : (
              <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} padding={24} borderRadius={24} alignItems="center" borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>
                <TText fontSize={13} fontFamily="Chirp-Medium" color={theme.textSecondary} textAlign="center">
                  No general contacts added.
                </TText>
              </YStack>
            )}
          </YStack>

          {/* --- INVITE LINK --- */}
          <YStack>
            <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>
              YOUR INVITE LINK
            </TText>
            <XStack 
              backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} 
              borderRadius={24} 
              borderWidth={1} 
              borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"} 
              paddingHorizontal={16} 
              paddingVertical={16} 
              marginBottom={20} 
              alignItems="center" 
              justifyContent="space-between"
            >
              <TText flex={1} fontSize={14} fontFamily="Chirp-Medium" color={theme.textSecondary} marginRight={12} numberOfLines={1}>
                {dynamicInviteLink}
              </TText>
              <TouchableOpacity activeOpacity={0.7} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <TText fontSize={14} fontFamily="Chirp-Bold" color="#00C48A">Copy</TText>
              </TouchableOpacity>
            </XStack>
          </YStack>

        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default ContactsScreen;