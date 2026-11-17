// Communities — groups of friends/family (like WhatsApp groups) for sharing journeys and SOS.
// Save as: src/screens/CommunitiesScreen.tsx  (route name: "CommunitiesScreen")
import React, { useCallback, useState } from "react";
import {
  StatusBar, SafeAreaView, Platform, ScrollView, TouchableOpacity, TextInput, Modal,
  Alert, ActivityIndicator, Switch, KeyboardAvoidingView, RefreshControl,
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../theme/ThemeContext";
import AuthService from "../services/authService";
import { CONTACTS_KEY, isValidPhone, normalizePhone } from "../utils/securityConfig";
import { phoneKey } from "../utils/myIdentity";
import { loadGroups, saveGroup, deleteGroup, leaveGroup, SafetyGroup, GroupMember, GROUP_EMOJIS } from "../utils/safetyGroups";

const PALETTE = ["#00C48A", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#0EA5E9"];
const colorFor = (s: string) => PALETTE[Math.abs([...s].reduce((a, c) => a + c.charCodeAt(0), 0)) % PALETTE.length];

const CommunitiesScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const cardBg = isDarkMode ? "#121A16" : "#FFFFFF";
  const divider = isDarkMode ? "#2D3B34" : "#E2E8F0";
  const soft = isDarkMode ? "#1A221E" : "#F8FAFC";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mine, setMine] = useState<SafetyGroup[]>([]);
  const [memberOf, setMemberOf] = useState<SafetyGroup[]>([]);
  const [offline, setOffline] = useState(false);
  const [myContacts, setMyContacts] = useState<any[]>([]);
  const [ownerName, setOwnerName] = useState("Stromer");

  // editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(GROUP_EMOJIS[0]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [alertOnSos, setAlertOnSos] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // viewer (groups I'm in)
  const [viewing, setViewing] = useState<SafetyGroup | null>(null);

  const refresh = async () => {
    const res = await loadGroups();
    setMine(res.mine);
    setMemberOf(res.memberOf);
    setOffline(res.offline);
  };

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const saved = await AsyncStorage.getItem(CONTACTS_KEY);
          setMyContacts(saved ? JSON.parse(saved) : []);
          const session = await AuthService.getCurrentSession();
          const local = await AsyncStorage.getItem("global_name");
          setOwnerName((session?.user as any)?.full_name || local || "Stromer");
          await refresh();
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  };

  const openEditor = (g?: SafetyGroup) => {
    setEditId(g?.id);
    setName(g?.name || "");
    setEmoji(g?.emoji || GROUP_EMOJIS[0]);
    setMembers(g?.members ? [...g.members] : []);
    setAlertOnSos(!!g?.alert_on_sos);
    setNewName("");
    setNewPhone("");
    setEditorOpen(true);
  };

  const hasMember = (phone: string) => members.some((m) => phoneKey(m.phone) === phoneKey(phone));
  const toggleMember = (c: { name: string; phone: string }) => {
    if (hasMember(c.phone)) setMembers((prev) => prev.filter((m) => phoneKey(m.phone) !== phoneKey(c.phone)));
    else setMembers((prev) => [...prev, { name: c.name, phone: normalizePhone(c.phone) }]);
  };

  const addFromPhonebook = async () => {
    try {
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;
      const number = contact.phoneNumbers?.find((p) => p.number)?.number;
      if (!number) { Alert.alert("No phone number", "This contact doesn't have a phone number saved."); return; }
      const n = contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Contact";
      if (hasMember(number)) { Alert.alert("Already added", `${n} is already in this community.`); return; }
      setMembers((prev) => [...prev, { name: n, phone: normalizePhone(number) }]);
    } catch {
      Alert.alert("Phonebook unavailable", "Allow access to your contacts in Settings, or add the number manually.");
    }
  };

  const addByNumber = () => {
    const phone = newPhone.trim();
    if (!isValidPhone(phone) || phone.replace(/\D/g, "").length < 10) {
      Alert.alert("Invalid number", "Enter a full phone number, e.g. 08031234567.");
      return;
    }
    if (hasMember(phone)) { Alert.alert("Already added", "That number is already in this community."); return; }
    setMembers((prev) => [...prev, { name: newName.trim() || phone, phone: normalizePhone(phone) }]);
    setNewName("");
    setNewPhone("");
  };

  const onSave = async () => {
    if (!name.trim()) { Alert.alert("Name required", "Give your community a name, e.g. Family."); return; }
    if (members.length === 0) { Alert.alert("Add members", "Add at least one person to this community."); return; }
    setSaving(true);
    try {
      await saveGroup({ id: editId, name, emoji, members, alert_on_sos: alertOnSos }, ownerName);
      setEditorOpen(false);
      await refresh();
    } catch (e: any) {
      const msg = String(e?.message || "");
      const code = String(e?.code || "");
      Alert.alert(
        "Couldn't save community",
        code === "42501" || /row-level security|JWT|not authenticated/i.test(msg)
          ? "Your login needs refreshing. Sign out and sign back in, then try again."
          : code === "42P01" || code === "PGRST205" || /does not exist|schema cache/i.test(msg)
          ? "The Communities table hasn't been set up yet. Run safety_v2.sql in Supabase, then try again."
          : `Check your internet connection and try again.${msg ? `\n\n(${msg})` : ""}`
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!editId) return;
    Alert.alert("Delete community?", `"${name}" will be removed for everyone in it.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await deleteGroup(editId); setEditorOpen(false); await refresh(); }
        catch { Alert.alert("Couldn't delete", "Check your internet connection and try again."); }
      } },
    ]);
  };

  const onLeave = (g: SafetyGroup) => {
    Alert.alert("Leave community?", `You'll stop receiving journey and SOS alerts shared with "${g.name}".`, [
      { text: "Cancel", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: async () => {
        try { await leaveGroup(g.id); setViewing(null); await refresh(); }
        catch { Alert.alert("Couldn't leave", "Check your internet connection and try again."); }
      } },
    ]);
  };

  const Avatars = ({ list }: { list: GroupMember[] }) => (
    <XStack>
      {list.slice(0, 5).map((m, i) => (
        <YStack key={m.phone} width={26} height={26} borderRadius={13} backgroundColor={colorFor(m.name)} justifyContent="center" alignItems="center" marginLeft={i === 0 ? 0 : -8} borderWidth={2} borderColor={cardBg}>
          <TText fontFamily="Chirp-Heavy" fontSize={10} color="#FFF">{m.name.charAt(0).toUpperCase()}</TText>
        </YStack>
      ))}
      {list.length > 5 && (
        <YStack width={26} height={26} borderRadius={13} backgroundColor={divider} justifyContent="center" alignItems="center" marginLeft={-8} borderWidth={2} borderColor={cardBg}>
          <TText fontFamily="Chirp-Bold" fontSize={9} color={theme.textPrimary}>+{list.length - 5}</TText>
        </YStack>
      )}
    </XStack>
  );

  const GroupCard = ({ g, owned }: { g: SafetyGroup; owned: boolean }) => (
    <TouchableOpacity activeOpacity={0.85} onPress={() => (owned ? openEditor(g) : setViewing(g))}>
      <XStack backgroundColor={cardBg} borderRadius={20} borderWidth={1} borderColor={owned ? "#00C48A" : divider} padding={14} alignItems="center" marginBottom={10}>
        <YStack width={46} height={46} borderRadius={23} backgroundColor={isDarkMode ? "rgba(0,196,138,0.12)" : "#ECFDF5"} justifyContent="center" alignItems="center" marginRight={12}>
          <TText fontSize={22}>{g.emoji || "👥"}</TText>
        </YStack>
        <YStack flex={1}>
          <XStack alignItems="center" gap={6}>
            <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} numberOfLines={1} flexShrink={1}>{g.name}</TText>
            {g.alert_on_sos && (
              <YStack backgroundColor={isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2"} paddingHorizontal={6} paddingVertical={2} borderRadius={6}>
                <TText fontFamily="Chirp-Bold" fontSize={8} color="#EF4444">SOS</TText>
              </YStack>
            )}
          </XStack>
          <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={2} numberOfLines={1}>
            {owned ? `${g.members.length} member${g.members.length === 1 ? "" : "s"}` : `Created by ${g.owner_name || "a contact"} · ${g.members.length} members`}
          </TText>
          <YStack marginTop={8}><Avatars list={g.members} /></YStack>
        </YStack>
        <Feather name="chevron-right" size={18} color={theme.textSecondary} />
      </XStack>
    </TouchableOpacity>
  );

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={16}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: cardBg, borderRadius: 12, borderWidth: 1, borderColor: divider }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16} flex={1}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Communities</TText>
            <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2} letterSpacing={1}>SHARE JOURNEYS & SOS WITH YOUR CIRCLES</TText>
          </YStack>
        </XStack>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C48A" />}
        >
          <TouchableOpacity activeOpacity={0.85} onPress={() => openEditor()}>
            <XStack backgroundColor="#00C48A" borderRadius={20} paddingVertical={16} justifyContent="center" alignItems="center" gap={8} marginBottom={20}>
              <Feather name="plus-circle" size={18} color="#FFF" />
              <TText fontFamily="Chirp-Bold" fontSize={15} color="#FFF">Create a Community</TText>
            </XStack>
          </TouchableOpacity>

          {offline && (
            <XStack backgroundColor={isDarkMode ? "rgba(245,158,11,0.12)" : "#FEF3C7"} borderRadius={14} padding={12} gap={8} alignItems="center" marginBottom={16}>
              <Feather name="wifi-off" size={14} color="#F59E0B" />
              <TText flex={1} fontFamily="Chirp-Medium" fontSize={12} color={theme.textPrimary}>Showing saved communities. Connect to the internet to see the latest.</TText>
            </XStack>
          )}

          {loading ? (
            <YStack paddingVertical={40} alignItems="center"><ActivityIndicator color="#00C48A" /></YStack>
          ) : (
            <>
              <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>MY COMMUNITIES ({mine.length})</TText>
              {mine.length === 0 ? (
                <YStack backgroundColor={cardBg} borderRadius={20} borderWidth={1} borderColor={divider} borderStyle="dashed" padding={20} alignItems="center" marginBottom={24}>
                  <TText fontSize={28} marginBottom={8}>👨‍👩‍👧</TText>
                  <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary} marginBottom={4}>No communities yet</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} textAlign="center" lineHeight={18}>
                    Create groups like Family, Roommates or Work. Then share a journey or SOS with everyone in the group at once.
                  </TText>
                </YStack>
              ) : (
                <YStack marginBottom={14}>{mine.map((g) => <GroupCard key={g.id} g={g} owned />)}</YStack>
              )}

              <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>COMMUNITIES YOU'RE IN ({memberOf.length})</TText>
              {memberOf.length === 0 ? (
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} marginLeft={4} lineHeight={18}>
                  When someone adds your verified phone number to their community, it appears here.
                </TText>
              ) : (
                memberOf.map((g) => <GroupCard key={g.id} g={g} owned={false} />)
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ---------- Create / edit community ---------- */}
      <Modal visible={editorOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditorOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
            <XStack alignItems="center" justifyContent="space-between" paddingHorizontal={20} paddingTop={20} paddingBottom={12}>
              <TouchableOpacity onPress={() => setEditorOpen(false)}><TText fontFamily="Chirp-Bold" fontSize={14} color={theme.textSecondary}>Cancel</TText></TouchableOpacity>
              <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary}>{editId ? "Edit Community" : "New Community"}</TText>
              <TouchableOpacity onPress={onSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#00C48A" /> : <TText fontFamily="Chirp-Heavy" fontSize={14} color="#00C48A">Save</TText>}
              </TouchableOpacity>
            </XStack>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
              <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={8} marginTop={8}>NAME</TText>
              <XStack backgroundColor={cardBg} borderRadius={16} paddingHorizontal={14} height={52} alignItems="center" borderWidth={1} borderColor={divider} marginBottom={12}>
                <TText fontSize={20} marginRight={10}>{emoji}</TText>
                <TextInput style={{ flex: 1, fontFamily: "Chirp-Medium", fontSize: 15, color: theme.textPrimary }} placeholder="e.g. Family, Roommates, Work" placeholderTextColor={theme.textSecondary} value={name} onChangeText={setName} maxLength={40} />
              </XStack>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
                {GROUP_EMOJIS.map((e) => (
                  <TouchableOpacity key={e} onPress={() => setEmoji(e)}>
                    <YStack width={42} height={42} borderRadius={21} justifyContent="center" alignItems="center" backgroundColor={emoji === e ? "rgba(0,196,138,0.15)" : cardBg} borderWidth={1} borderColor={emoji === e ? "#00C48A" : divider}>
                      <TText fontSize={18}>{e}</TText>
                    </YStack>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <XStack backgroundColor={cardBg} borderRadius={18} borderWidth={1} borderColor={alertOnSos ? "#EF4444" : divider} padding={14} alignItems="center" marginBottom={20}>
                <YStack width={36} height={36} borderRadius={18} backgroundColor={isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2"} justifyContent="center" alignItems="center" marginRight={12}>
                  <Feather name="alert-triangle" size={16} color="#EF4444" />
                </YStack>
                <YStack flex={1} paddingRight={8}>
                  <TText fontFamily="Chirp-Heavy" fontSize={14} color={theme.textPrimary}>Alert this community on SOS</TText>
                  <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>Everyone here also gets your SOS, with your live location</TText>
                </YStack>
                <Switch value={alertOnSos} onValueChange={setAlertOnSos} trackColor={{ false: divider, true: "#EF4444" }} thumbColor="#FFF" />
              </XStack>

              <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={8}>MEMBERS ({members.length})</TText>
              {members.length > 0 && (
                <XStack flexWrap="wrap" gap={8} marginBottom={14}>
                  {members.map((m) => (
                    <XStack key={m.phone} backgroundColor={isDarkMode ? "rgba(0,196,138,0.12)" : "#ECFDF5"} borderRadius={16} paddingLeft={10} paddingRight={6} paddingVertical={6} alignItems="center" gap={6}>
                      <TText fontFamily="Chirp-Bold" fontSize={12} color={theme.textPrimary}>{m.name}</TText>
                      <TouchableOpacity onPress={() => toggleMember(m)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Feather name="x" size={13} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </XStack>
                  ))}
                </XStack>
              )}

              <TouchableOpacity onPress={addFromPhonebook}>
                <XStack backgroundColor={cardBg} borderRadius={16} borderWidth={1} borderColor="#00C48A" paddingVertical={12} justifyContent="center" alignItems="center" gap={8} marginBottom={12}>
                  <Feather name="book" size={14} color="#00C48A" />
                  <TText fontFamily="Chirp-Bold" fontSize={13} color="#00C48A">Add from Phonebook</TText>
                </XStack>
              </TouchableOpacity>

              <XStack gap={8} marginBottom={20}>
                <YStack flex={1} backgroundColor={cardBg} borderRadius={14} borderWidth={1} borderColor={divider} paddingHorizontal={12} height={46} justifyContent="center">
                  <TextInput style={{ fontFamily: "Chirp-Medium", fontSize: 13, color: theme.textPrimary }} placeholder="Name" placeholderTextColor={theme.textSecondary} value={newName} onChangeText={setNewName} />
                </YStack>
                <YStack flex={1.3} backgroundColor={cardBg} borderRadius={14} borderWidth={1} borderColor={divider} paddingHorizontal={12} height={46} justifyContent="center">
                  <TextInput style={{ fontFamily: "Chirp-Medium", fontSize: 13, color: theme.textPrimary }} placeholder="Phone number" keyboardType="phone-pad" placeholderTextColor={theme.textSecondary} value={newPhone} onChangeText={setNewPhone} />
                </YStack>
                <TouchableOpacity onPress={addByNumber}>
                  <YStack width={46} height={46} borderRadius={14} backgroundColor="#00C48A" justifyContent="center" alignItems="center">
                    <Feather name="plus" size={18} color="#FFF" />
                  </YStack>
                </TouchableOpacity>
              </XStack>

              {myContacts.length > 0 && (
                <>
                  <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={8}>FROM MY NETWORK</TText>
                  <YStack backgroundColor={cardBg} borderRadius={18} borderWidth={1} borderColor={divider} overflow="hidden" marginBottom={20}>
                    {myContacts.map((c, i) => {
                      const on = hasMember(c.phone);
                      return (
                        <TouchableOpacity key={c.id || c.phone} onPress={() => toggleMember(c)}>
                          <XStack alignItems="center" padding={12} borderTopWidth={i === 0 ? 0 : 1} borderColor={divider}>
                            <YStack width={34} height={34} borderRadius={17} backgroundColor={isDarkMode ? c.bgDark || soft : c.bg || soft} justifyContent="center" alignItems="center" marginRight={10}>
                              <TText fontFamily="Chirp-Heavy" fontSize={13} color={c.color || "#00C48A"}>{c.initial || c.name?.charAt(0)}</TText>
                            </YStack>
                            <YStack flex={1}>
                              <TText fontFamily="Chirp-Bold" fontSize={13} color={theme.textPrimary}>{c.name}</TText>
                              <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>{c.phone}</TText>
                            </YStack>
                            <YStack width={24} height={24} borderRadius={12} borderWidth={2} borderColor={on ? "#00C48A" : divider} backgroundColor={on ? "#00C48A" : "transparent"} justifyContent="center" alignItems="center">
                              {on && <Feather name="check" size={13} color="#FFF" />}
                            </YStack>
                          </XStack>
                        </TouchableOpacity>
                      );
                    })}
                  </YStack>
                </>
              )}

              <XStack backgroundColor={soft} borderRadius={14} padding={12} gap={8} marginBottom={20}>
                <Feather name="info" size={13} color={theme.textSecondary} style={{ marginTop: 2 }} />
                <TText flex={1} fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} lineHeight={16}>
                  Members on StromPulse see this community and who else is in it. They receive in-app alerts when you share with the community, as long as their phone number is verified in the app.
                </TText>
              </XStack>

              {editId && (
                <TouchableOpacity onPress={onDelete}>
                  <XStack borderRadius={16} borderWidth={1} borderColor="#EF4444" paddingVertical={14} justifyContent="center" alignItems="center" gap={8}>
                    <Feather name="trash-2" size={14} color="#EF4444" />
                    <TText fontFamily="Chirp-Bold" fontSize={14} color="#EF4444">Delete Community</TText>
                  </XStack>
                </TouchableOpacity>
              )}
            </ScrollView>
          </YStack>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------- View a community I'm in ---------- */}
      <Modal visible={!!viewing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setViewing(null)}>
        <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} padding={20}>
          <XStack justifyContent="space-between" alignItems="center" marginBottom={20}>
            <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary}>{viewing?.emoji} {viewing?.name}</TText>
            <TouchableOpacity onPress={() => setViewing(null)}><Feather name="x" size={22} color={theme.textPrimary} /></TouchableOpacity>
          </XStack>
          <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} marginBottom={16}>
            Created by {viewing?.owner_name || "a contact"}. You'll get journey shares{viewing?.alert_on_sos ? " and SOS alerts" : ""} sent to this community.
          </TText>
          <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={8}>MEMBERS ({viewing?.members.length || 0})</TText>
          <ScrollView>
            <YStack backgroundColor={cardBg} borderRadius={18} borderWidth={1} borderColor={divider} overflow="hidden" marginBottom={20}>
              {viewing?.members.map((m, i) => (
                <XStack key={m.phone} alignItems="center" padding={12} borderTopWidth={i === 0 ? 0 : 1} borderColor={divider}>
                  <YStack width={34} height={34} borderRadius={17} backgroundColor={colorFor(m.name)} justifyContent="center" alignItems="center" marginRight={10}>
                    <TText fontFamily="Chirp-Heavy" fontSize={13} color="#FFF">{m.name.charAt(0).toUpperCase()}</TText>
                  </YStack>
                  <TText flex={1} fontFamily="Chirp-Bold" fontSize={13} color={theme.textPrimary}>{m.name}</TText>
                </XStack>
              ))}
            </YStack>
            {viewing && (
              <TouchableOpacity onPress={() => onLeave(viewing)}>
                <XStack borderRadius={16} borderWidth={1} borderColor="#EF4444" paddingVertical={14} justifyContent="center" alignItems="center" gap={8}>
                  <Feather name="log-out" size={14} color="#EF4444" />
                  <TText fontFamily="Chirp-Bold" fontSize={14} color="#EF4444">Leave Community</TText>
                </XStack>
              </TouchableOpacity>
            )}
          </ScrollView>
        </YStack>
      </Modal>
    </YStack>
  );
};

export default CommunitiesScreen;