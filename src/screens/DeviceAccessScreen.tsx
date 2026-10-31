// NEW SCREEN: link a personal StromPulse device with its access code and view its live data.
// Register in your navigator as "DeviceAccessScreen".
import React, { useEffect, useRef, useState, useCallback } from "react";
import { StatusBar, SafeAreaView, Platform, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Keyboard } from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { ref, get, onValue, off } from "firebase/database";
import * as Crypto from "expo-crypto";
import { firebaseDb } from "../config/firebase";
import { useTheme } from "../theme/ThemeContext";
import { getDeviceConnectionState, parseStromTimestamp, HeartbeatTracker } from "../hooks/useDeviceData";

const LINKED_KEY = "strompulse_linked_devices";
const ATTEMPTS_KEY = "strompulse_access_attempts";
const CODE_REGEX = /^[A-Z0-9]{6,12}$/;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000;
const MAX_TRUSTED_GAP_MS = 4 * 60 * 60 * 1000;

type LinkedDevice = { deviceId: string; label: string; linkedAt: number };

const cleanCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

// % of today the device had power, based on its history restore timestamps
const todayUptime = (history: Record<string, any> | null, isOnline: boolean) => {
  if (!history || Object.keys(history).length === 0) return null;
  const now = Date.now();
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const events = Object.keys(history)
    .map((k) => {
      const e = history[k];
      const p = parseStromTimestamp(e && typeof e === "object" && e.timestamp ? e.timestamp : k);
      return p ? p.getTime() : null;
    })
    .filter((x): x is number => x !== null)
    .sort((a, b) => a - b);
  let up = 0;
  events.forEach((s, i) => {
    let e = i === events.length - 1 ? (isOnline ? now : s) : events[i + 1];
    if (i < events.length - 1 && e - s > MAX_TRUSTED_GAP_MS) e = s;
    const os = Math.max(s, start), oe = Math.min(e, now);
    if (oe > os) up += oe - os;
  });
  return Math.round((up / (now - start)) * 100);
};

const timeAgo = (date: Date | null) => {
  if (!date) return "—";
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return date.toLocaleDateString();
};

// Live view of one linked device
const DeviceCard = ({ device, onRemove, theme, isDarkMode }: any) => {
  const [node, setNode] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  const trackerRef = useRef<HeartbeatTracker>({});

  useEffect(() => {
    // Devices may live under /PowerMonitor/{id} or directly under /{id}
    const primary = ref(firebaseDb, `PowerMonitor/${device.deviceId}`);
    const fallback = ref(firebaseDb, device.deviceId);
    let fallbackActive = false;
    const onFallback = (snap: any) => { setNode(snap.val()); setLoading(false); };
    const onPrimary = (snap: any) => {
      if (snap.exists()) { setNode(snap.val()); setLoading(false); }
      else if (!fallbackActive) { fallbackActive = true; onValue(fallback, onFallback, () => setLoading(false)); }
    };
    onValue(primary, onPrimary, () => setLoading(false));
    const t = setInterval(() => setTick((x) => x + 1), 10000); // re-evaluate heartbeat
    return () => { off(primary, "value", onPrimary); if (fallbackActive) off(fallback, "value", onFallback); clearInterval(t); };
  }, [device.deviceId]);

  const realtime = node?.realtime || null;
  const state = getDeviceConnectionState(realtime, device.deviceId, trackerRef.current);
  const isOnline = state === "online";
  const lastUpdate = realtime?.serverReceivedAt ? new Date(realtime.serverReceivedAt) : parseStromTimestamp(realtime?.timestamp);
  const uptime = todayUptime(node?.history || null, isOnline);
  const color = loading ? "#F59E0B" : isOnline ? "#00C48A" : "#EF4444";
  const softBg = isDarkMode ? "#1A221E" : "#F8FAFC";

  return (
    <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} borderWidth={1.5} borderColor={color} padding={20} marginBottom={16}>
      <XStack alignItems="center" marginBottom={16}>
        <YStack width={44} height={44} borderRadius={22} backgroundColor={`${color}22`} justifyContent="center" alignItems="center" marginRight={14}>
          {loading ? <ActivityIndicator size="small" color={color} /> : <Feather name={isOnline ? "zap" : "zap-off"} size={20} color={color} />}
        </YStack>
        <YStack flex={1}>
          <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary} numberOfLines={1}>{device.label}</TText>
          <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>{device.deviceId}</TText>
        </YStack>
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="trash-2" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </XStack>

      <TText fontFamily="Chirp-Heavy" fontSize={20} color={color} marginBottom={12}>
        {loading ? "Connecting..." : !node ? "No data from device yet" : isOnline ? "Power is ON" : "Power is OFF"}
      </TText>

      <XStack gap={10}>
        {[
          { label: "VOLTAGE", value: realtime?.voltage !== undefined ? `${Math.round(Number(realtime.voltage))} V` : "—" },
          { label: "TODAY", value: uptime !== null ? `${uptime}% on` : "—" },
          { label: "LAST UPDATE", value: timeAgo(lastUpdate) },
        ].map((s) => (
          <YStack key={s.label} flex={1} backgroundColor={softBg} borderRadius={14} padding={12} alignItems="center">
            <TText fontFamily="Chirp-Bold" fontSize={9} color={theme.textSecondary} letterSpacing={0.8} marginBottom={4}>{s.label}</TText>
            <TText fontFamily="Chirp-Heavy" fontSize={13} color={theme.textPrimary} textAlign="center">{s.value}</TText>
          </YStack>
        ))}
      </XStack>
    </YStack>
  );
};

const DeviceAccessScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const cardBg = isDarkMode ? "#121A16" : "#FFFFFF";
  const divider = isDarkMode ? "#2D3B34" : "#E2E8F0";

  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [checking, setChecking] = useState(false);
  const [linked, setLinked] = useState<LinkedDevice[]>([]);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(LINKED_KEY).then((raw) => setLinked(raw ? JSON.parse(raw) : []));
    }, [])
  );

  const saveLinked = async (list: LinkedDevice[]) => {
    setLinked(list);
    await AsyncStorage.setItem(LINKED_KEY, JSON.stringify(list));
  };

  const checkLockout = async () => {
    const raw = await AsyncStorage.getItem(ATTEMPTS_KEY);
    const a = raw ? JSON.parse(raw) : { count: 0, since: 0 };
    if (a.count >= MAX_ATTEMPTS && Date.now() - a.since < LOCKOUT_MS) {
      return Math.ceil((LOCKOUT_MS - (Date.now() - a.since)) / 1000);
    }
    if (a.count >= MAX_ATTEMPTS) await AsyncStorage.removeItem(ATTEMPTS_KEY);
    return 0;
  };

  const recordFailure = async () => {
    const raw = await AsyncStorage.getItem(ATTEMPTS_KEY);
    const a = raw ? JSON.parse(raw) : { count: 0, since: Date.now() };
    await AsyncStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ count: a.count + 1, since: a.count === 0 ? Date.now() : a.since }));
  };

  const linkDevice = async () => {
    const c = cleanCode(code);
    if (!CODE_REGEX.test(c)) {
      Alert.alert("Invalid code", "Access codes are 6–12 letters and numbers. Check the card that came with your device.");
      return;
    }
    const wait = await checkLockout();
    if (wait > 0) {
      Alert.alert("Too many attempts", `Please wait ${wait} seconds and try again.`);
      return;
    }
    Keyboard.dismiss();
    setChecking(true);
    try {
      // Codes are stored as SHA-256 hashes, so even if the database is read directly the real codes are never exposed
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, c);
      const snap = await get(ref(firebaseDb, `accessCodes/${hash}`));
      const entry = snap.val();
      const deviceId = typeof entry === "string" ? entry : entry?.deviceId;
      if (!snap.exists() || !deviceId || entry?.active === false) {
        await recordFailure();
        Alert.alert("Code not recognised", "That access code doesn't match any StromPulse device. Codes are not case-sensitive.");
        return;
      }
      await AsyncStorage.removeItem(ATTEMPTS_KEY);
      if (linked.some((d) => d.deviceId === deviceId)) {
        Alert.alert("Already linked", "This device is already on your list.");
        return;
      }
      const name = label.trim() || entry?.label || `My Device (${deviceId})`;
      await saveLinked([...linked, { deviceId, label: name, linkedAt: Date.now() }]);
      setCode("");
      setLabel("");
      Alert.alert("Device linked", `${name} is now connected. Live data will appear below.`);
    } catch (e: any) {
      Alert.alert("Couldn't check code", e?.message?.includes("permission") ? "Access to device data was denied. Please contact StromPulse support." : "Check your internet connection and try again.");
    } finally {
      setChecking(false);
    }
  };

  const removeDevice = (deviceId: string) => {
    Alert.alert("Remove device?", "You can link it again later with the same access code.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => saveLinked(linked.filter((d) => d.deviceId !== deviceId)) },
    ]);
  };

  const canSubmit = CODE_REGEX.test(cleanCode(code)) && !checking;

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={20}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: divider }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>My Devices</TText>
            <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2} letterSpacing={1}>LINK WITH YOUR ACCESS CODE</TText>
          </YStack>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          <YStack backgroundColor={cardBg} borderRadius={24} borderWidth={1} borderColor="#00C48A" padding={20} marginBottom={28}>
            <XStack alignItems="center" gap={12} marginBottom={16}>
              <YStack width={40} height={40} borderRadius={20} backgroundColor={isDarkMode ? "rgba(0,196,138,0.12)" : "#ECFDF5"} justifyContent="center" alignItems="center">
                <Feather name="key" size={18} color="#00C48A" />
              </YStack>
              <YStack flex={1}>
                <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary}>Add a device</TText>
                <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Enter the access code that came with your StromPulse device</TText>
              </YStack>
            </XStack>

            <TText fontFamily="Chirp-Bold" fontSize={12} color={theme.textPrimary} marginBottom={6}>Access code</TText>
            <XStack backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} borderRadius={16} paddingHorizontal={16} height={56} alignItems="center" borderWidth={1} borderColor={divider} marginBottom={12}>
              <TextInput
                style={{ flex: 1, fontFamily: "Chirp-Heavy", fontSize: 18, letterSpacing: 3, color: theme.textPrimary }}
                placeholder="e.g. A7K29XQ4"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                value={code}
                onChangeText={(t) => setCode(cleanCode(t))}
                onSubmitEditing={linkDevice}
              />
            </XStack>

            <TText fontFamily="Chirp-Bold" fontSize={12} color={theme.textPrimary} marginBottom={6}>Name (optional)</TText>
            <XStack backgroundColor={isDarkMode ? "#1A221E" : "#F8FAFC"} borderRadius={16} paddingHorizontal={16} height={52} alignItems="center" borderWidth={1} borderColor={divider} marginBottom={16}>
              <TextInput style={{ flex: 1, fontFamily: "Chirp-Medium", fontSize: 15, color: theme.textPrimary }} placeholder="e.g. Home, Shop, Mum's house" placeholderTextColor={theme.textSecondary} value={label} onChangeText={setLabel} maxLength={30} />
            </XStack>

            <TouchableOpacity onPress={linkDevice} disabled={!canSubmit}>
              <YStack backgroundColor={canSubmit ? "#00C48A" : (isDarkMode ? "#1A221E" : "#E2E8F0")} borderRadius={16} height={52} justifyContent="center" alignItems="center">
                {checking ? <ActivityIndicator color="#FFF" /> : <TText fontFamily="Chirp-Bold" fontSize={15} color={canSubmit ? "#FFF" : theme.textSecondary}>Link Device</TText>}
              </YStack>
            </TouchableOpacity>
          </YStack>

          <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>LINKED DEVICES ({linked.length})</TText>
          {linked.length === 0 ? (
            <YStack backgroundColor={cardBg} borderRadius={20} borderWidth={1} borderColor={divider} borderStyle="dashed" padding={24} alignItems="center">
              <Feather name="cpu" size={24} color={theme.textSecondary} />
              <TText fontFamily="Chirp-Medium" fontSize={13} color={theme.textSecondary} textAlign="center" marginTop={10}>No devices linked yet.</TText>
              <TouchableOpacity onPress={() => navigation.navigate("RequestDeviceScreen")}>
                <TText fontFamily="Chirp-Bold" fontSize={13} color="#00C48A" marginTop={10}>Don't have a device? Get one</TText>
              </TouchableOpacity>
            </YStack>
          ) : (
            linked.map((d) => <DeviceCard key={d.deviceId} device={d} theme={theme} isDarkMode={isDarkMode} onRemove={() => removeDevice(d.deviceId)} />)
          )}
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default DeviceAccessScreen;