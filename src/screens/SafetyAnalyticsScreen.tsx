// Safety Analytics — history of the user's safety activity (SOS, journeys, location shares,
// alerts received) for today / this week / this month.
// Save as: src/screens/SafetyAnalyticsScreen.tsx  (route name: "SafetyAnalyticsScreen")
import React, { useCallback, useMemo, useState } from "react";
import { StatusBar, SafeAreaView, Platform, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, RefreshControl } from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import Svg, { Rect, Line, Text as SvgText } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../theme/ThemeContext";
import { supabase } from "../config/supabase";
import { CONTACTS_KEY } from "../utils/securityConfig";
import { getMyIdentity, isAlertForMe, phoneKey } from "../utils/myIdentity";
import { getSafetyHistory, SafetyEvent } from "../utils/safetyHistory";
import { loadGroups } from "../utils/safetyGroups";

type Range = "Today" | "This Week" | "This Month";
type Kind = "sos" | "journey" | "arrived" | "location" | "delay" | "received";
type Item = { id: string; kind: Kind; at: number; title: string; who: string[]; group?: string; sent: boolean };

const { width } = Dimensions.get("window");
const COLORS: Record<Kind, string> = { sos: "#EF4444", journey: "#00C48A", arrived: "#10B981", location: "#3B82F6", delay: "#F59E0B", received: "#8B5CF6" };
const ICONS: Record<Kind, any> = { sos: "alert-triangle", journey: "navigation", arrived: "check-circle", location: "map-pin", delay: "clock", received: "bell" };
const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const startOf = (r: Range) => {
  const n = new Date();
  if (r === "Today") return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  if (r === "This Week") { const d = new Date(n.getFullYear(), n.getMonth(), n.getDate()); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
  return new Date(n.getFullYear(), n.getMonth(), 1).getTime();
};

const kindOf = (a: any): Kind => {
  const t = (a.type || "").toLowerCase();
  const title = (a.title || "").toLowerCase();
  if (t === "emergency") return title.includes("sos") ? "sos" : "delay";
  if (t === "journey_start") return "journey";
  if (t === "journey_end") return title.includes("arrived") ? "arrived" : "journey";
  if (t.includes("location")) return "location";
  return "location";
};

const fmtTime = (ms: number) => {
  const d = new Date(ms);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return same ? time : `${d.toLocaleDateString([], { day: "numeric", month: "short" })} · ${time}`;
};

const fmtDuration = (ms: number) => {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const SafetyAnalyticsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const cardBg = isDarkMode ? "#121A16" : "#FFFFFF";
  const divider = isDarkMode ? "#2D3B34" : "#E2E8F0";
  const soft = isDarkMode ? "#1A221E" : "#F1F5F9";

  const [range, setRange] = useState<Range>("This Week");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [local, setLocal] = useState<SafetyEvent[]>([]);
  const [offline, setOffline] = useState(false);

  const load = async () => {
    const me = await getMyIdentity();
    const names = new Map<string, string>();
    try {
      const saved = JSON.parse((await AsyncStorage.getItem(CONTACTS_KEY)) || "[]");
      saved.forEach((c: any) => names.set(phoneKey(c.phone), c.name));
    } catch {}
    try {
      const { mine } = await loadGroups();
      mine.forEach((g) => g.members.forEach((m) => { if (!names.has(phoneKey(m.phone))) names.set(phoneKey(m.phone), m.name); }));
    } catch {}
    const nameOf = (p: string) => names.get(phoneKey(p)) || p;

    const since = new Date(startOf("This Month") - 7 * 86400000).toISOString();
    const history = await getSafetyHistory();
    setLocal(history);
    try {
      const { data, error } = await supabase
        .from("alerts")
        .select("id, type, title, created_at, user_id, recipient_phones, data")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const list: Item[] = [];
      (data || []).forEach((a: any) => {
        const at = new Date(a.created_at).getTime();
        const meta = a.data || {};
        if (me.userId && a.user_id === me.userId) {
          const phones: string[] = Array.isArray(a.recipient_phones) ? a.recipient_phones : [];
          const who: string[] = Array.isArray(meta.recipientNames) && meta.recipientNames.length ? meta.recipientNames : phones.map(nameOf);
          list.push({ id: a.id, kind: kindOf(a), at, title: a.title, who, group: meta.groupName || undefined, sent: true });
        } else if (isAlertForMe(a, me)) {
          list.push({ id: a.id, kind: "received", at, title: a.title, who: [meta.senderName || a.title], group: meta.groupName || undefined, sent: false });
        }
      });
      setItems(list);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  };

  useFocusEffect(useCallback(() => { load().finally(() => setLoading(false)); }, []));
  const onRefresh = async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } };

  const from = startOf(range);
  const inRange = useMemo(() => items.filter((i) => i.at >= from), [items, from]);
  const localInRange = useMemo(() => local.filter((e) => e.at >= from), [local, from]);
  const sent = inRange.filter((i) => i.sent);
  const count = (k: Kind) => inRange.filter((i) => i.kind === k).length;

  const journeyTimeMs = localInRange
    .filter((e) => e.type === "journey" && e.endedAt)
    .reduce((s, e) => s + Math.max(0, (e.endedAt as number) - e.at), 0);
  const cancelled = localInRange.filter((e) => e.type === "sos_cancelled").length;

  // Buckets for the chart
  const buckets = useMemo(() => {
    const now = new Date();
    if (range === "Today") {
      return Array.from({ length: 8 }, (_, i) => {
        const s = from + i * 3 * 3600000;
        const h = i * 3;
        return { label: `${h % 12 || 12}${h < 12 ? "a" : "p"}`, s, e: s + 3 * 3600000 };
      });
    }
    if (range === "This Week") {
      return DAY.map((label, i) => { const s = from + i * 86400000; return { label, s, e: s + 86400000 }; });
    }
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const s = new Date(now.getFullYear(), now.getMonth(), i + 1).getTime();
      return { label: `${i + 1}`, s, e: new Date(now.getFullYear(), now.getMonth(), i + 2).getTime() };
    });
  }, [range, from]);

  const stackKinds: Kind[] = ["sos", "journey", "location", "received"];
  const series = buckets.map((b) => {
    const inB = inRange.filter((i) => i.at >= b.s && i.at < b.e);
    const parts = stackKinds.map((k) => ({ k, n: inB.filter((i) => (k === "journey" ? i.kind === "journey" || i.kind === "arrived" : k === "sos" ? i.kind === "sos" || i.kind === "delay" : i.kind === k)).length }));
    return { ...b, parts, total: parts.reduce((s, p) => s + p.n, 0) };
  });
  const maxTotal = Math.max(1, ...series.map((s) => s.total));

  // Top people & communities
  const people = new Map<string, number>();
  sent.forEach((i) => i.who.forEach((w) => people.set(w, (people.get(w) || 0) + 1)));
  const topPeople = [...people.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const groupsUsed = new Map<string, number>();
  sent.forEach((i) => { if (i.group) i.group.split(", ").forEach((g) => groupsUsed.set(g, (groupsUsed.get(g) || 0) + 1)); });

  const chartW = width - 48 - 32;
  const chartH = 150;
  const left = 22;
  const slot = (chartW - left) / series.length;
  const barW = Math.max(4, Math.min(22, slot * 0.6));
  const showEvery = series.length > 14 ? 5 : 1;

  const Stat = ({ label, value, color, icon }: any) => (
    <YStack width="48%" backgroundColor={cardBg} borderRadius={18} borderWidth={1} borderColor={divider} padding={14} marginBottom={10}>
      <XStack alignItems="center" gap={6} marginBottom={6}>
        <YStack width={24} height={24} borderRadius={12} backgroundColor={`${color}1A`} justifyContent="center" alignItems="center">
          <Feather name={icon} size={12} color={color} />
        </YStack>
        <TText fontFamily="Chirp-Bold" fontSize={9} color={theme.textSecondary} letterSpacing={0.6} flexShrink={1}>{label}</TText>
      </XStack>
      <TText fontFamily="Chirp-Heavy" fontSize={22} color={theme.textPrimary}>{value}</TText>
    </YStack>
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
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary}>Safety Analytics</TText>
            <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2} letterSpacing={1}>YOUR SAFETY ACTIVITY AT A GLANCE</TText>
          </YStack>
        </XStack>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C48A" />}>
          <XStack backgroundColor={soft} borderRadius={14} padding={4} marginBottom={16}>
            {(["Today", "This Week", "This Month"] as Range[]).map((r) => (
              <TouchableOpacity key={r} style={{ flex: 1 }} onPress={() => setRange(r)}>
                <YStack paddingVertical={8} borderRadius={10} alignItems="center" backgroundColor={range === r ? "#00C48A" : "transparent"}>
                  <TText fontFamily="Chirp-Bold" fontSize={12} color={range === r ? "#FFF" : theme.textSecondary}>{r}</TText>
                </YStack>
              </TouchableOpacity>
            ))}
          </XStack>

          {offline && (
            <XStack backgroundColor={isDarkMode ? "rgba(245,158,11,0.12)" : "#FEF3C7"} borderRadius={14} padding={12} gap={8} alignItems="center" marginBottom={16}>
              <Feather name="wifi-off" size={14} color="#F59E0B" />
              <TText flex={1} fontFamily="Chirp-Medium" fontSize={12} color={theme.textPrimary}>Offline — showing activity saved on this phone only.</TText>
            </XStack>
          )}

          {loading ? (
            <YStack paddingVertical={60} alignItems="center"><ActivityIndicator color="#00C48A" /></YStack>
          ) : (
            <>
              <XStack flexWrap="wrap" justifyContent="space-between">
                <Stat label="SOS SENT" value={count("sos")} color="#EF4444" icon="alert-triangle" />
                <Stat label="JOURNEYS SHARED" value={count("journey")} color="#00C48A" icon="navigation" />
                <Stat label="SAFE ARRIVALS" value={count("arrived")} color="#10B981" icon="check-circle" />
                <Stat label="LOCATION SHARES" value={count("location")} color="#3B82F6" icon="map-pin" />
                <Stat label="ALERTS RECEIVED" value={count("received")} color="#8B5CF6" icon="bell" />
                <Stat label="TIME ON JOURNEYS" value={journeyTimeMs ? fmtDuration(journeyTimeMs) : "0 min"} color="#F59E0B" icon="clock" />
              </XStack>
              {(cancelled > 0 || count("delay") > 0) && (
                <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginBottom={12} marginLeft={4}>
                  {cancelled > 0 ? `${cancelled} SOS cancelled during the countdown. ` : ""}{count("delay") > 0 ? `${count("delay")} late-arrival alert${count("delay") === 1 ? "" : "s"} sent.` : ""}
                </TText>
              )}

              {/* Activity chart */}
              <YStack backgroundColor={cardBg} borderRadius={22} borderWidth={1} borderColor={divider} padding={16} marginBottom={16} marginTop={4}>
                <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} marginBottom={2}>Activity</TText>
                <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginBottom={12}>
                  {range === "Today" ? "Every 3 hours today" : range === "This Week" ? "Each day, Monday to Sunday" : "Each day this month"}
                </TText>
                <Svg width={chartW} height={chartH + 22}>
                  {[0, 0.5, 1].map((f) => {
                    const y = 8 + chartH * (1 - f);
                    return (
                      <React.Fragment key={f}>
                        <Line x1={left} y1={y} x2={chartW} y2={y} stroke={divider} strokeWidth={1} strokeDasharray={f === 0 ? undefined : "4,4"} />
                        <SvgText x={left - 6} y={y + 3} fontSize={9} fill={theme.textSecondary} textAnchor="end">{Math.round(maxTotal * f)}</SvgText>
                      </React.Fragment>
                    );
                  })}
                  {series.map((b, i) => {
                    const cx = left + slot * i + slot / 2;
                    let y = 8 + chartH;
                    return (
                      <React.Fragment key={i}>
                        {b.total === 0 ? (
                          <Rect x={cx - barW / 2} y={y - 3} width={barW} height={3} rx={1.5} fill={divider} />
                        ) : (
                          b.parts.filter((p) => p.n > 0).map((p) => {
                            const h = (p.n / maxTotal) * chartH;
                            y -= h;
                            return <Rect key={p.k} x={cx - barW / 2} y={y} width={barW} height={h} fill={COLORS[p.k]} rx={2} />;
                          })
                        )}
                        {i % showEvery === 0 && <SvgText x={cx} y={chartH + 22} fontSize={9} fill={theme.textSecondary} textAnchor="middle">{b.label}</SvgText>}
                      </React.Fragment>
                    );
                  })}
                </Svg>
                <XStack gap={12} flexWrap="wrap" marginTop={10}>
                  {[{ c: COLORS.sos, l: "SOS & delays" }, { c: COLORS.journey, l: "Journeys" }, { c: COLORS.location, l: "Location shares" }, { c: COLORS.received, l: "Received" }].map((x) => (
                    <XStack key={x.l} alignItems="center" gap={5}>
                      <YStack width={8} height={8} borderRadius={4} backgroundColor={x.c} />
                      <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary}>{x.l}</TText>
                    </XStack>
                  ))}
                </XStack>
              </YStack>

              {/* Who you shared with */}
              <YStack backgroundColor={cardBg} borderRadius={22} borderWidth={1} borderColor={divider} padding={16} marginBottom={16}>
                <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} marginBottom={12}>Who you shared with</TText>
                {topPeople.length === 0 ? (
                  <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary}>Nothing shared in this period.</TText>
                ) : topPeople.map(([n, c], i) => (
                  <XStack key={n} alignItems="center" paddingVertical={8} borderTopWidth={i === 0 ? 0 : 1} borderColor={soft}>
                    <YStack width={30} height={30} borderRadius={15} backgroundColor={isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5"} justifyContent="center" alignItems="center" marginRight={10}>
                      <TText fontFamily="Chirp-Heavy" fontSize={12} color="#00C48A">{n.charAt(0).toUpperCase()}</TText>
                    </YStack>
                    <TText flex={1} fontFamily="Chirp-Bold" fontSize={13} color={theme.textPrimary} numberOfLines={1}>{n}</TText>
                    <TText fontFamily="Chirp-Heavy" fontSize={13} color={theme.textSecondary}>{c}×</TText>
                  </XStack>
                ))}
                {groupsUsed.size > 0 && (
                  <XStack flexWrap="wrap" gap={8} marginTop={12}>
                    {[...groupsUsed.entries()].map(([g, c]) => (
                      <XStack key={g} backgroundColor={isDarkMode ? "rgba(139,92,246,0.15)" : "#F5F3FF"} borderRadius={12} paddingHorizontal={10} paddingVertical={5} gap={6} alignItems="center">
                        <Feather name="users" size={11} color="#8B5CF6" />
                        <TText fontFamily="Chirp-Bold" fontSize={11} color="#8B5CF6">{g} · {c}</TText>
                      </XStack>
                    ))}
                  </XStack>
                )}
              </YStack>

              {/* Timeline */}
              <TText fontFamily="Chirp-Bold" fontSize={11} color={theme.textSecondary} letterSpacing={1.5} marginBottom={10} marginLeft={4}>RECENT ACTIVITY</TText>
              {inRange.length === 0 ? (
                <YStack backgroundColor={cardBg} borderRadius={20} borderWidth={1} borderColor={divider} padding={20} alignItems="center">
                  <Feather name="activity" size={22} color={theme.textSecondary} />
                  <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} marginTop={8}>No safety activity {range === "Today" ? "today" : range === "This Week" ? "this week" : "this month"}.</TText>
                </YStack>
              ) : (
                <YStack backgroundColor={cardBg} borderRadius={20} borderWidth={1} borderColor={divider} overflow="hidden">
                  {inRange.slice(0, 30).map((it, i) => (
                    <XStack key={it.id} padding={12} alignItems="center" borderTopWidth={i === 0 ? 0 : 1} borderColor={soft}>
                      <YStack width={34} height={34} borderRadius={17} backgroundColor={`${COLORS[it.kind]}1A`} justifyContent="center" alignItems="center" marginRight={10}>
                        <Feather name={ICONS[it.kind]} size={15} color={COLORS[it.kind]} />
                      </YStack>
                      <YStack flex={1}>
                        <TText fontFamily="Chirp-Bold" fontSize={13} color={theme.textPrimary} numberOfLines={1}>{it.title}</TText>
                        <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} numberOfLines={1}>
                          {it.sent ? `To ${it.group ? `${it.group} · ` : ""}${it.who.slice(0, 3).join(", ")}${it.who.length > 3 ? ` +${it.who.length - 3}` : ""}` : `Received${it.group ? ` via ${it.group}` : ""}`}
                        </TText>
                      </YStack>
                      <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginLeft={8}>{fmtTime(it.at)}</TText>
                    </XStack>
                  ))}
                </YStack>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
};

export default SafetyAnalyticsScreen;