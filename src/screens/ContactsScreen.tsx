import React, { useState, useCallback, useMemo } from "react";
import {
  StatusBar, ScrollView, TouchableOpacity, Platform, Alert, SafeAreaView, Switch,
  FlatList, TextInput, ActivityIndicator, Share
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import * as Contacts from "expo-contacts";
import * as Linking from "expo-linking";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthService from "../services/authService";
import { supabase } from "../config/supabase";
import { useFocusEffect } from "@react-navigation/native";
import { CONTACTS_KEY, normalizePhone } from "../utils/securityConfig";

// ---- Where StromPulse users' phone numbers live in Supabase. Change these two lines if your table/column differ. ----
const STROMPULSE_USERS_TABLE = "profiles";
const STROMPULSE_PHONE_COLUMN = "phone";
const MAX_EMERGENCY = 3;

const COLORS = ["#00C48A", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"];
const BGS_LIGHT = ["#ECFDF5", "#DBEAFE", "#F3E8FF", "#FEF3C7", "#FEE2E2"];
const BGS_DARK = ["rgba(0,196,138,0.15)", "rgba(59,130,246,0.15)", "rgba(139,92,246,0.15)", "rgba(245,158,11,0.15)", "rgba(239,68,68,0.15)"];

const phoneKey = (phone: string) => normalizePhone(phone, false);

// Every common way a Nigerian number might be stored: +2348012345678, 2348012345678, 08012345678
const phoneVariants = (phone: string) => {
  const d = phoneKey(phone);
  const out = new Set<string>([`+${d}`, d]);
  if (d.startsWith("234")) out.add(`0${d.slice(3)}`);
  return Array.from(out);
};

/** Returns a map of normalized phone -> StromPulse user id for the numbers that are registered. */
const lookupStrompulseUsers = async (phones: string[]): Promise<Record<string, string>> => {
  const found: Record<string, string> = {};
  const variants = Array.from(new Set(phones.flatMap(phoneVariants)));
  for (let i = 0; i < variants.length; i += 150) {
    const chunk = variants.slice(i, i + 150);
    try {
      const { data, error } = await supabase.from(STROMPULSE_USERS_TABLE).select(`id, ${STROMPULSE_PHONE_COLUMN}`).in(STROMPULSE_PHONE_COLUMN, chunk);
      if (error) { console.warn("[Contacts lookup]", error.message); return found; }
      (data || []).forEach((row: any) => {
        const p = row[STROMPULSE_PHONE_COLUMN];
        if (p) found[phoneKey(String(p))] = row.id;
      });
    } catch (e) {
      return found;
    }
  }
  return found;
};

const ContactsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const cardBg = isDarkMode ? "#121A16" : "#FFFFFF";
  const divider = isDarkMode ? "#2D3B34" : "#E2E8F0";

  const [savedContacts, setSavedContacts] = useState<any[]>([]);
  const [phoneContacts, setPhoneContacts] = useState<any[]>([]);
  const [registered, setRegistered] = useState<Record<string, string>>({});
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"My Network" | "Phone Contacts">("My Network");

  const persist = async (list: any[]) => {
    setSavedContacts(list);
    await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(list));
  };

  // Mark saved contacts that are on StromPulse (and keep their StromPulse user id for in-app alerts)
  const applyRegistered = (list: any[], reg: Record<string, string>) =>
    list.map((c) => {
      const uid = reg[phoneKey(c.phone)];
      return { ...c, isOnStrompulse: !!uid || !!c.isOnStrompulse, strompulseUserId: uid || c.strompulseUserId || null };
    });

  const loadPhoneContacts = async (currentSaved: any[]) => {
    setPhoneLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") { setPermissionDenied(true); return; }
      setPermissionDenied(false);
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers], sort: Contacts.SortTypes.FirstName });
      const list = (data || [])
        .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0 && c.phoneNumbers[0].number)
        .map((c) => ({
          id: c.id,
          name: c.name || [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown",
          phone: c.phoneNumbers![0].number as string,
        }));
      setPhoneContacts(list);

      const reg = await lookupStrompulseUsers([...list.map((c) => c.phone), ...currentSaved.map((c) => c.phone)]);
      setRegistered(reg);
      if (currentSaved.length) {
        const updated = applyRegistered(currentSaved, reg);
        if (JSON.stringify(updated) !== JSON.stringify(currentSaved)) persist(updated);
      }
    } catch (e) {
      console.warn("Error loading phone contacts", e);
    } finally {
      setPhoneLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const session = await AuthService.getCurrentSession();
          if (session) setUser(session.user);
          const saved = await AsyncStorage.getItem(CONTACTS_KEY);
          const list = saved ? JSON.parse(saved) : [];
          setSavedContacts(list);
          loadPhoneContacts(list);
        } catch (e) {
          console.warn("Error loading contacts", e);
        }
      })();
    }, [])
  );

  const savedKeys = useMemo(() => new Set(savedContacts.map((c) => phoneKey(c.phone))), [savedContacts]);
  const emergencyCount = savedContacts.filter((c) => c.isEmergency).length;

  const addContact = async (pc: any, regOverride?: Record<string, string>) => {
    const key = phoneKey(pc.phone);
    if (savedKeys.has(key)) return;
    const idx = Math.abs(key.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0)) % COLORS.length;
    const uid = (regOverride || registered)[key] || null;
    const newContact = {
      id: pc.id || key,
      name: pc.name,
      initial: pc.name && pc.name !== "Unknown" ? pc.name.charAt(0).toUpperCase() : "#",
      phone: pc.phone,
      color: COLORS[idx], bg: BGS_LIGHT[idx], bgDark: BGS_DARK[idx],
      isEmergency: false,
      isOnStrompulse: !!uid,
      strompulseUserId: uid,
    };
    const next = [...savedContacts, newContact];
    await persist(next);
    if (emergencyCount < MAX_EMERGENCY) {
      Alert.alert("Contact added", `Make ${pc.name.split(" ")[0]} an emergency contact? They'll be alerted when you send SOS.`, [
        { text: "Not now", style: "cancel" },
        { text: "Yes, add to SOS", onPress: () => persist(next.map((c) => (c.id === newContact.id ? { ...c, isEmergency: true } : c))) },
      ]);
    }
  };

  // Native phonebook picker — always available, even if the full list can't load
  const openContactPicker = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Allow access to your contacts to add emergency contacts.", [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;
      const number = contact.phoneNumbers?.find((p) => p.number)?.number;
      if (!number) {
        Alert.alert("No phone number", "This contact doesn't have a phone number saved.");
        return;
      }
      const name = contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown";
      if (savedKeys.has(phoneKey(number))) {
        Alert.alert("Already added", `${name} is already in your network.`);
        return;
      }
      // Check if they're on StromPulse before saving
      let reg = registered;
      if (!reg[phoneKey(number)]) {
        const found = await lookupStrompulseUsers([number]);
        if (Object.keys(found).length) { reg = { ...registered, ...found }; setRegistered(reg); }
      }
      await addContact({ id: contact.id, name, phone: number }, reg);
    } catch (e) {
      console.warn("Contact picker error", e);
    }
  };

  const toggleEmergency = async (id: string) => {
    const target = savedContacts.find((c) => c.id === id);
    if (!target) return;
    if (!target.isEmergency && emergencyCount >= MAX_EMERGENCY) {
      Alert.alert("Slots full", `You can have up to ${MAX_EMERGENCY} emergency contacts. Turn one off first.`);
      return;
    }
    await persist(savedContacts.map((c) => (c.id === id ? { ...c, isEmergency: !c.isEmergency } : c)));
  };

  const removeContact = (id: string) => {
    const target = savedContacts.find((c) => c.id === id);
    Alert.alert("Remove contact?", `${target?.name || "This contact"} will no longer receive your alerts.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => persist(savedContacts.filter((c) => c.id !== id)) },
    ]);
  };

  // ---------- invite ----------
  const userName = user?.full_name?.split(" ")[0]?.toLowerCase() || user?.user_metadata?.username || "stromer";
  const uniqueId = user?.id?.substring(0, 4) || "join";
  const inviteLink = `https://strompulse.com/invite/${userName}-${uniqueId}`;
  const inviteMessage = `Join me on StromPulse — live electricity updates and safety alerts for your area. ${inviteLink}`;

  const copyInvite = async () => {
    await Clipboard.setStringAsync(inviteLink);
    Alert.alert("Copied", "Invite link copied to clipboard.");
  };
  const shareInvite = () => Share.share({ message: inviteMessage }).catch(() => {});
  const whatsappInvite = (phone?: string) => {
    const target = phone ? `phone=${normalizePhone(phone, false)}&` : "";
    Linking.openURL(`whatsapp://send?${target}text=${encodeURIComponent(inviteMessage)}`).catch(() => Alert.alert("WhatsApp not found", "Install WhatsApp or use Share instead."));
  };
  const smsInvite = (phone?: string) => {
    const sep = Platform.OS === "ios" ? "&" : "?";
    Linking.openURL(`sms:${phone || ""}${sep}body=${encodeURIComponent(inviteMessage)}`).catch(() => {});
  };

  // ---------- UI pieces ----------
  const Avatar = ({ c, size = 44 }: any) => {
    const key = phoneKey(c.phone);
    const idx = Math.abs(key.split("").reduce((a: number, ch: string) => a + ch.charCodeAt(0), 0)) % COLORS.length;
    const color = c.color || COLORS[idx];
    const bg = isDarkMode ? (c.bgDark || BGS_DARK[idx]) : (c.bg || BGS_LIGHT[idx]);
    const initial = c.initial || (c.name && c.name !== "Unknown" ? c.name.charAt(0).toUpperCase() : "#");
    return (
      <YStack width={size} height={size} borderRadius={size / 2} backgroundColor={bg} justifyContent="center" alignItems="center">
        <TText fontSize={size * 0.4} fontFamily="Chirp-Heavy" color={color}>{initial}</TText>
      </YStack>
    );
  };

  const StrompulseBadge = () => (
    <XStack alignItems="center" gap={4} backgroundColor={isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5"} paddingHorizontal={6} paddingVertical={2} borderRadius={6} alignSelf="flex-start" marginTop={4}>
      <Feather name="zap" size={9} color="#00C48A" />
      <TText fontSize={9} fontFamily="Chirp-Bold" color="#00C48A" letterSpacing={0.4}>ON STROMPULSE</TText>
    </XStack>
  );

  const filteredPhone = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? phoneContacts.filter((c) => c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, ""))) : phoneContacts;
    // StromPulse users first
    return [...list].sort((a, b) => Number(!!registered[phoneKey(b.phone)]) - Number(!!registered[phoneKey(a.phone)]));
  }, [phoneContacts, search, registered]);

  const emergencyList = savedContacts.filter((c) => c.isEmergency);
  const otherList = savedContacts.filter((c) => !c.isEmergency);

  const renderSavedRow = (contact: any) => (
    <XStack key={contact.id} backgroundColor={cardBg} borderRadius={20} padding={16} alignItems="center" borderWidth={contact.isEmergency ? 1.5 : 1} borderColor={contact.isEmergency ? "#00C48A" : divider} marginBottom={12}>
      <YStack marginRight={14} position="relative">
        <Avatar c={contact} />
        {contact.isEmergency && (
          <YStack position="absolute" bottom={-2} right={-2} width={18} height={18} borderRadius={9} backgroundColor="#EF4444" justifyContent="center" alignItems="center" borderWidth={2} borderColor={cardBg}>
            <Feather name="alert-triangle" size={8} color="#FFF" />
          </YStack>
        )}
      </YStack>
      <YStack flex={1} paddingRight={8}>
        <TText fontSize={15} fontFamily="Chirp-Bold" color={theme.textPrimary} numberOfLines={1}>{contact.name}</TText>
        <TText fontSize={12} fontFamily="Chirp-Medium" color={theme.textSecondary}>{contact.phone}</TText>
        {contact.isOnStrompulse ? <StrompulseBadge /> : (
          <TouchableOpacity onPress={() => whatsappInvite(contact.phone)}>
            <TText fontSize={10} fontFamily="Chirp-Bold" color="#3B82F6" marginTop={4}>Not on StromPulse · Invite</TText>
          </TouchableOpacity>
        )}
      </YStack>
      <YStack alignItems="center" marginRight={12}>
        <TText fontSize={9} fontFamily="Chirp-Bold" color={contact.isEmergency ? "#00C48A" : theme.textSecondary} marginBottom={4} letterSpacing={0.5}>SOS ALERT</TText>
        <Switch value={!!contact.isEmergency} onValueChange={() => toggleEmergency(contact.id)} trackColor={{ false: divider, true: "#00C48A" }} thumbColor="#FFFFFF" />
      </YStack>
      <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => removeContact(contact.id)}>
        <Feather name="trash-2" size={18} color={theme.textSecondary} />
      </TouchableOpacity>
    </XStack>
  );

  const Header = (
    <>
      <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={20}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: divider }}>
          <Feather name="chevron-left" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <YStack marginLeft={16}>
          <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Emergency Contacts</TText>
          <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2} letterSpacing={1}>{emergencyCount} OF {MAX_EMERGENCY} SOS SLOTS USED</TText>
        </YStack>
      </XStack>

      <XStack marginHorizontal={24} marginBottom={20} gap={10}>
        {(["My Network", "Phone Contacts"] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity key={tab} activeOpacity={0.8} onPress={() => setActiveTab(tab)} style={{ flex: 1 }}>
              <XStack paddingVertical={12} borderRadius={16} borderWidth={1.5} borderColor={isActive ? "#00C48A" : divider} backgroundColor={isActive ? "#00C48A" : cardBg} alignItems="center" justifyContent="center" gap={6}>
                <Feather name={tab === "My Network" ? "users" : "book"} size={14} color={isActive ? "#FFF" : theme.textSecondary} />
                <TText fontFamily="Chirp-Bold" fontSize={12} color={isActive ? "#FFF" : theme.textSecondary}>{tab === "My Network" ? `My Network (${savedContacts.length})` : "Phone Contacts"}</TText>
              </XStack>
            </TouchableOpacity>
          );
        })}
      </XStack>
    </>
  );

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        {Header}

        {activeTab === "Phone Contacts" ? (
          <YStack flex={1}>
            <TouchableOpacity activeOpacity={0.8} onPress={openContactPicker} style={{ marginHorizontal: 24, marginBottom: 12 }}>
              <XStack backgroundColor={cardBg} borderRadius={16} padding={14} alignItems="center" justifyContent="center" borderWidth={1} borderColor="#00C48A" borderStyle="dashed" gap={8}>
                <Feather name="plus" size={16} color="#00C48A" />
                <TText fontSize={14} fontFamily="Chirp-Bold" color="#00C48A">Add from Phonebook</TText>
              </XStack>
            </TouchableOpacity>
            <XStack marginHorizontal={24} marginBottom={12} backgroundColor={cardBg} borderRadius={16} paddingHorizontal={16} height={50} alignItems="center" borderWidth={1} borderColor={divider}>
              <Feather name="search" size={16} color={theme.textSecondary} />
              <TextInput style={{ flex: 1, marginLeft: 12, color: theme.textPrimary, fontFamily: "Chirp-Medium", fontSize: 14 }} placeholder="Search name or number..." placeholderTextColor={theme.textSecondary} value={search} onChangeText={setSearch} />
              {phoneLoading && <ActivityIndicator size="small" color="#00C48A" />}
            </XStack>
            <XStack marginHorizontal={24} marginBottom={12} alignItems="center" gap={6}>
              <Feather name="zap" size={11} color="#00C48A" />
              <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>Contacts already on StromPulse are shown first.</TText>
            </XStack>

            {permissionDenied ? (
              <YStack marginHorizontal={24} backgroundColor={cardBg} borderRadius={20} padding={24} alignItems="center" borderWidth={1} borderColor={divider}>
                <Feather name="lock" size={24} color={theme.textSecondary} />
                <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} textAlign="center" marginVertical={12}>Allow access to your contacts to choose emergency contacts.</TText>
                <TouchableOpacity onPress={() => Linking.openSettings()}>
                  <YStack backgroundColor="#00C48A" borderRadius={14} paddingHorizontal={20} paddingVertical={10}>
                    <TText fontFamily="Chirp-Bold" fontSize={13} color="#FFF">Open Settings</TText>
                  </YStack>
                </TouchableOpacity>
              </YStack>
            ) : (
              <FlatList
                data={filteredPhone}
                keyExtractor={(item, i) => `${item.id}-${i}`}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={20}
                ListEmptyComponent={phoneLoading ? (
                  <YStack alignItems="center" marginTop={24}><ActivityIndicator color="#00C48A" /><TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} marginTop={8}>Loading your contacts...</TText></YStack>
                ) : (
                  <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} textAlign="center" marginTop={24}>{search ? "No contacts match your search." : "No contacts to show. Use \"Add from Phonebook\" above."}</TText>
                )}
                renderItem={({ item }) => {
                  const key = phoneKey(item.phone);
                  const isAdded = savedKeys.has(key);
                  const saved = isAdded ? savedContacts.find((c) => phoneKey(c.phone) === key) : null;
                  const onApp = !!registered[key];
                  return (
                    <XStack paddingVertical={12} alignItems="center" borderBottomWidth={1} borderColor={isDarkMode ? "#1F2E27" : "#F1F5F9"}>
                      <YStack marginRight={14}><Avatar c={item} size={40} /></YStack>
                      <YStack flex={1} paddingRight={8}>
                        <TText fontSize={14} fontFamily="Chirp-Bold" color={theme.textPrimary} numberOfLines={1}>{item.name}</TText>
                        <TText fontSize={12} fontFamily="Chirp-Medium" color={theme.textSecondary}>{item.phone}</TText>
                        {onApp && <StrompulseBadge />}
                      </YStack>
                      {saved?.isEmergency ? (
                        <XStack alignItems="center" gap={4} backgroundColor="rgba(239,68,68,0.12)" paddingHorizontal={10} paddingVertical={6} borderRadius={12}>
                          <Feather name="alert-triangle" size={11} color="#EF4444" />
                          <TText fontSize={11} fontFamily="Chirp-Bold" color="#EF4444">SOS</TText>
                        </XStack>
                      ) : isAdded ? (
                        <XStack alignItems="center" gap={4} paddingHorizontal={10} paddingVertical={6}>
                          <Feather name="check" size={13} color="#00C48A" />
                          <TText fontSize={11} fontFamily="Chirp-Bold" color="#00C48A">Added</TText>
                        </XStack>
                      ) : (
                        <TouchableOpacity onPress={() => addContact(item)}>
                          <XStack alignItems="center" gap={4} backgroundColor="#00C48A" paddingHorizontal={12} paddingVertical={7} borderRadius={12}>
                            <Feather name="plus" size={12} color="#FFF" />
                            <TText fontSize={11} fontFamily="Chirp-Bold" color="#FFF">Add</TText>
                          </XStack>
                        </TouchableOpacity>
                      )}
                    </XStack>
                  );
                }}
              />
            )}
          </YStack>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
            <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>EMERGENCY CONTACTS ({emergencyCount}/{MAX_EMERGENCY})</TText>
            {emergencyList.length > 0 ? emergencyList.map(renderSavedRow) : (
              <YStack backgroundColor={cardBg} padding={20} borderRadius={20} alignItems="center" borderWidth={1} borderColor={divider} borderStyle="dashed" marginBottom={12}>
                <TText fontSize={13} fontFamily="Chirp-Medium" color={theme.textSecondary} textAlign="center">No emergency contacts yet. Turn on "SOS Alert" for up to {MAX_EMERGENCY} people below, or add them from Phone Contacts.</TText>
              </YStack>
            )}

            <XStack backgroundColor={isDarkMode ? "rgba(59,130,246,0.08)" : "#EFF6FF"} borderRadius={16} padding={14} gap={10} marginBottom={28} alignItems="flex-start">
              <Feather name="info" size={14} color="#3B82F6" style={{ marginTop: 2 }} />
              <TText flex={1} fontSize={12} fontFamily="Chirp-Medium" color={theme.textSecondary} lineHeight={18}>
                Emergency contacts get your SOS and journey alerts. Contacts marked "On StromPulse" receive an instant in-app alert. Everyone else gets WhatsApp when you're online, or SMS when you're offline.
              </TText>
            </XStack>

            <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>OTHER CONTACTS</TText>
            {otherList.length > 0 ? otherList.map(renderSavedRow) : (
              <TouchableOpacity onPress={openContactPicker}>
                <XStack backgroundColor={cardBg} borderRadius={20} padding={16} alignItems="center" justifyContent="center" borderWidth={1} borderColor={divider} borderStyle="dashed" marginBottom={12} gap={8}>
                  <Feather name="plus" size={16} color="#00C48A" />
                  <TText fontSize={14} fontFamily="Chirp-Bold" color="#00C48A">Add from Phonebook</TText>
                </XStack>
              </TouchableOpacity>
            )}

            {/* Invite */}
            <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4} marginTop={20}>INVITE TO STROMPULSE</TText>
            <XStack backgroundColor={cardBg} borderRadius={20} borderWidth={1} borderColor={divider} paddingHorizontal={16} paddingVertical={12} marginBottom={12} alignItems="center">
              <TText flex={1} fontSize={13} fontFamily="Chirp-Medium" color={theme.textSecondary} marginRight={12} numberOfLines={1}>{inviteLink}</TText>
              <TouchableOpacity onPress={copyInvite} style={{ backgroundColor: isDarkMode ? "rgba(0,196,138,0.12)" : "#ECFDF5", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 }}>
                <TText fontSize={13} fontFamily="Chirp-Bold" color="#00C48A">Copy</TText>
              </TouchableOpacity>
            </XStack>
            <XStack backgroundColor={cardBg} borderRadius={20} padding={20} borderWidth={1} borderColor={divider} justifyContent="space-around">
              <TouchableOpacity style={{ alignItems: "center" }} onPress={() => whatsappInvite()}>
                <MaterialCommunityIcons name="whatsapp" size={24} color="#25D366" />
                <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textPrimary} marginTop={8}>WhatsApp</TText>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: "center" }} onPress={() => smsInvite()}>
                <Feather name="message-square" size={22} color="#3B82F6" />
                <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textPrimary} marginTop={8}>SMS</TText>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: "center" }} onPress={shareInvite}>
                <Feather name="share-2" size={22} color="#F59E0B" />
                <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textPrimary} marginTop={8}>Share</TText>
              </TouchableOpacity>
            </XStack>
          </ScrollView>
        )}
      </SafeAreaView>
    </YStack>
  );
};

export default ContactsScreen;