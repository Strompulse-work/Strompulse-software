import React, { useState, useEffect } from "react";
import { StatusBar, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, ScrollView } from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { useAllGridDevices, computeHistoryAnalytics, formatDurationShort } from "../hooks/useDeviceData";
import { DEVICE_LOCATIONS } from "../constants/gridLocations";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { firebaseDb } from "../config/firebase";
import { ref, push, update, increment } from "firebase/database";
import AuthService from "../services/authService";
import {
  Range, UptimeBarChart, RangeSelector, ChartLegend, buildRangeBars, buildNextWeekPrediction,
  calculateIntervalUptime, averageOf, xTitleFor, startOfDay, startOfIsoWeek,
} from "../components/UptimeAnalytics";

const CHECKING_COLOR = "#F59E0B";

const formatFriendlyRestorationTime = (date: Date): string => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / (24 * 60 * 60 * 1000));
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const meridiem = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const timeStr = `${hours}:${minutes}${meridiem}`;
  if (diffDays === 0) return `today at ${timeStr}`;
  if (diffDays === 1) return `yesterday at ${timeStr}`;
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
  return `on ${dateStr} at ${timeStr}`;
};

const CommunityZonesScreen = ({ route, navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const cardBg = isDarkMode ? "#121A16" : "#FFFFFF";
  const divider = isDarkMode ? "#2D3B34" : "#F1F5F9";

  const [userVote, setUserVote] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("Today");
  const [nowTick, setNowTick] = useState(Date.now());

  // Re-evaluate charts every 30s (same refresh rate as the Electricity dashboard)
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const { areaId, areaName } = route.params || {};
  const areaData = DEVICE_LOCATIONS[areaId] || { name: "Unknown Area", type: "area" };
  const displayTitle = areaName || areaData.name;

  const { devices, loading } = useAllGridDevices();
  const liveDevice = devices.find((d) => d.id === areaId || d.id?.toUpperCase() === areaId?.toUpperCase());

  useEffect(() => {
    if (areaId) AsyncStorage.getItem(`strompulse_vote_${areaId}`).then((val) => { if (val) setUserVote(val); });
  }, [areaId]);

  const handleVote = async (vote: "yes" | "no") => {
    setUserVote(vote);
    await AsyncStorage.setItem(`strompulse_vote_${areaId}`, vote);
    try {
      const session = await AuthService.getCurrentSession();
      const userId = session?.user?.id || "anonymous";
      await push(ref(firebaseDb, `AccuracyVotes/${areaId}`), { area_id: areaId, area_name: displayTitle, vote, user_id: userId, created_at: Date.now() });
      await update(ref(firebaseDb, `AccuracyVotes_Summary/${areaId}`), { area_name: displayTitle, [`${vote}Count`]: increment(1) });
    } catch (e) {}
  };

  if (loading && !liveDevice) {
    return (
      <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} justifyContent="center" alignItems="center">
        <ActivityIndicator size="large" color="#00C48A" />
      </YStack>
    );
  }

  const connectionState = liveDevice ? (liveDevice.connectionState || (liveDevice.isOnline ? "online" : "offline")) : "offline";
  const isOnline = connectionState === "online";
  const isChecking = connectionState === "checking";
  const mainColor = isChecking ? CHECKING_COLOR : isOnline ? "#00C48A" : "#EF4444";
  const historyAnalytics = computeHistoryAnalytics(liveDevice?.history, "Today", isOnline);

  // ---------- analytics ----------
  const pctFor = (s: number, e: number, n: number) => (liveDevice ? calculateIntervalUptime(liveDevice, s, e, n) : null);
  const now = new Date(nowTick);
  const todayPct = pctFor(startOfDay(now).getTime(), nowTick + 1, nowTick);
  const weekPct = pctFor(startOfIsoWeek(now).getTime(), nowTick + 1, nowTick);
  const bars = buildRangeBars(range, nowTick, pctFor);
  const rangeAvg = averageOf(bars);
  const withData = bars.filter((b) => !b.isFuture && b.value !== null);
  const best = withData.length ? withData.reduce((a, b) => ((b.value as number) > (a.value as number) ? b : a)) : null;
  const worst = withData.length ? withData.reduce((a, b) => ((b.value as number) < (a.value as number) ? b : a)) : null;
  const prediction = buildNextWeekPrediction(nowTick, pctFor);
  const hasPrediction = prediction.bars.some((b) => b.value !== null);
  const rangeWord = range === "Today" ? "hour" : range === "This Week" ? "day" : "week";

  const pctColor = (v: number | null) => (v === null ? theme.textSecondary : v >= 70 ? "#00C48A" : v >= 40 ? "#F59E0B" : "#EF4444");

  const StatTile = ({ label, value, color, icon }: { label: string; value: string; color: string; icon: any }) => (
    <YStack flex={1} backgroundColor={cardBg} borderRadius={18} borderWidth={1} borderColor={divider} padding={14}>
      <XStack alignItems="center" gap={6} marginBottom={8}>
        <Feather name={icon} size={12} color={theme.textSecondary} />
        <TText fontFamily="Chirp-Bold" fontSize={9} color={theme.textSecondary} letterSpacing={0.8}>{label}</TText>
      </XStack>
      <TText fontFamily="Chirp-Heavy" fontSize={18} color={color} numberOfLines={1}>{value}</TText>
    </YStack>
  );

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} />

      <SafeAreaView style={{ zIndex: 10 }}>
        <XStack alignItems="center" paddingHorizontal={24} paddingTop={Platform.OS === "android" ? 20 : 10} paddingBottom={16}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}>
            <Feather name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <YStack marginLeft={16} flex={1}>
            <TText fontFamily="Chirp-Heavy" fontSize={18} color={theme.textPrimary} numberOfLines={1}>{displayTitle}</TText>
            <TText fontFamily="Chirp-Medium" fontSize={10} color={theme.textSecondary} marginTop={2} letterSpacing={1}>COMMUNITY ZONE · LIVE</TText>
          </YStack>
        </XStack>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 4 }}>
        {/* Live status + accuracy vote */}
        <YStack backgroundColor={cardBg} borderRadius={24} padding={20} borderWidth={1.5} borderColor={mainColor} marginBottom={16}>
          <XStack alignItems="center" gap={12} marginBottom={16}>
            <YStack width={44} height={44} borderRadius={22} backgroundColor={`${mainColor}22`} justifyContent="center" alignItems="center">
              {isChecking ? <ActivityIndicator size="small" color={CHECKING_COLOR} /> : <Feather name={isOnline ? "zap" : "zap-off"} size={20} color={mainColor} />}
            </YStack>
            <YStack flex={1}>
              <TText fontFamily="Chirp-Heavy" fontSize={20} color={mainColor}>{isChecking ? "Checking status..." : isOnline ? "Power is ON" : "Power is OFF"}</TText>
              <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} marginTop={2}>
                {historyAnalytics.currentStreakMs !== null
                  ? `Stable for ${formatDurationShort(historyAnalytics.currentStreakMs)}`
                  : historyAnalytics.latestRestorationAt ? `Last restored ${formatFriendlyRestorationTime(historyAnalytics.latestRestorationAt)}` : "No restoration events recorded yet"}
              </TText>
            </YStack>
          </XStack>

          <XStack paddingTop={14} borderTopWidth={1} borderTopColor={divider} alignItems="center" justifyContent="space-between">
            {userVote ? (
              <TText fontSize={12} fontFamily="Chirp-Bold" color="#00C48A">Thanks — you voted {userVote.toUpperCase()} ✓</TText>
            ) : (
              <>
                <TText fontSize={12} fontFamily="Chirp-Medium" color={theme.textSecondary}>Is this status accurate?</TText>
                <XStack gap={8}>
                  <TouchableOpacity onPress={() => handleVote("yes")}>
                    <YStack backgroundColor={isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5"} paddingHorizontal={14} paddingVertical={6} borderRadius={10}>
                      <TText fontSize={12} fontFamily="Chirp-Bold" color="#00C48A">Yes</TText>
                    </YStack>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleVote("no")}>
                    <YStack backgroundColor={isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2"} paddingHorizontal={14} paddingVertical={6} borderRadius={10}>
                      <TText fontSize={12} fontFamily="Chirp-Bold" color="#EF4444">No</TText>
                    </YStack>
                  </TouchableOpacity>
                </XStack>
              </>
            )}
          </XStack>
        </YStack>

        {/* Quick stats */}
        <XStack gap={10} marginBottom={16}>
          <StatTile label="TODAY" value={todayPct !== null ? `${todayPct}%` : "—"} color={pctColor(todayPct)} icon="sun" />
          <StatTile label="THIS WEEK" value={weekPct !== null ? `${weekPct}%` : "—"} color={pctColor(weekPct)} icon="calendar" />
          <StatTile
            label={historyAnalytics.currentStreakMs !== null ? "STREAK" : "STATUS"}
            value={historyAnalytics.currentStreakMs !== null ? formatDurationShort(historyAnalytics.currentStreakMs) : isChecking ? "Checking" : "Down"}
            color={mainColor}
            icon={historyAnalytics.currentStreakMs !== null ? "activity" : "alert-circle"}
          />
        </XStack>

        {/* Accuracy notice */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate("RequestDeviceScreen")}>
          <XStack backgroundColor={cardBg} borderRadius={20} padding={16} alignItems="center" borderWidth={1} borderColor={divider} marginBottom={24}>
            <YStack width={36} height={36} borderRadius={18} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center" marginRight={12}>
              <Feather name="shield" size={16} color="#00C48A" />
            </YStack>
            <TText flex={1} fontSize={13} fontFamily="Chirp-Medium" color={theme.textPrimary} lineHeight={18}>
              Community analytics is about 70% accurate. For 100% accuracy at your address, get a personal StromPulse device.
            </TText>
            <YStack width={32} height={32} borderRadius={16} backgroundColor="#00C48A" justifyContent="center" alignItems="center" marginLeft={8}>
              <Feather name="arrow-right" size={14} color="#FFFFFF" />
            </YStack>
          </XStack>
        </TouchableOpacity>

        {/* Detailed analytics — same chart as the Electricity dashboard */}
        <TText fontSize={11} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginLeft={4}>PERFORMANCE ANALYTICS</TText>
        <YStack backgroundColor={cardBg} borderRadius={24} padding={20} borderWidth={1} borderColor={divider} marginBottom={16}>
          <XStack alignItems="center" gap={12} marginBottom={16}>
            <YStack width={36} height={36} borderRadius={12} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center">
              <Feather name="bar-chart-2" size={18} color="#00C48A" />
            </YStack>
            <YStack flex={1}>
              <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary} numberOfLines={1}>{displayTitle} Uptime</TText>
              <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>
                {range === "Today" ? "Hourly breakdown for today" : range === "This Week" ? "Daily breakdown, Monday to Sunday" : "Weekly breakdown for this month"}
              </TText>
            </YStack>
          </XStack>
          <YStack marginBottom={16}><RangeSelector value={range} onChange={setRange} isDarkMode={isDarkMode} textSecondary={theme.textSecondary} /></YStack>
          <UptimeBarChart bars={bars} yTitle="Uptime (%)" xTitle={xTitleFor(range)} isDarkMode={isDarkMode} textColor={theme.textSecondary} minSlotWidth={range === "Today" ? 20 : 0} />
          <ChartLegend textSecondary={theme.textSecondary} divider={divider} />

          <XStack gap={10} marginTop={16} paddingTop={16} borderTopWidth={1} borderTopColor={divider}>
            {[
              { label: "AVERAGE", value: rangeAvg !== null ? `${rangeAvg}%` : "—", color: pctColor(rangeAvg) },
              { label: `BEST ${rangeWord.toUpperCase()}`, value: best ? `${best.label} · ${best.value}%` : "—", color: "#00C48A" },
              { label: `WORST ${rangeWord.toUpperCase()}`, value: worst ? `${worst.label} · ${worst.value}%` : "—", color: "#EF4444" },
            ].map((s) => (
              <YStack key={s.label} flex={1} alignItems="center">
                <TText fontFamily="Chirp-Bold" fontSize={9} color={theme.textSecondary} letterSpacing={0.8} marginBottom={4}>{s.label}</TText>
                <TText fontFamily="Chirp-Heavy" fontSize={12} color={s.color} textAlign="center" numberOfLines={1}>{s.value}</TText>
              </YStack>
            ))}
          </XStack>
        </YStack>

        {/* Prediction */}
        <YStack backgroundColor={cardBg} borderRadius={24} padding={20} borderWidth={1} borderColor={divider} marginBottom={16}>
          <XStack alignItems="center" gap={12} marginBottom={16}>
            <YStack width={36} height={36} borderRadius={12} backgroundColor={isDarkMode ? "rgba(59,130,246,0.15)" : "#EFF6FF"} justifyContent="center" alignItems="center">
              <Feather name="trending-up" size={16} color="#3B82F6" />
            </YStack>
            <YStack flex={1}>
              <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary}>Prediction for Next Week (Week {prediction.week}, {prediction.year})</TText>
              <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary}>Based on the last 4 weeks in {displayTitle}</TText>
            </YStack>
          </XStack>
          {hasPrediction ? (
            <UptimeBarChart bars={prediction.bars} yTitle="Expected Uptime (%)" xTitle="Day" isDarkMode={isDarkMode} textColor={theme.textSecondary} variant="predicted" showValues />
          ) : (
            <TText fontFamily="Chirp-Medium" fontSize={12} color={theme.textSecondary} textAlign="center" paddingVertical={24}>Not enough history yet to predict next week.</TText>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
};

export default CommunityZonesScreen;