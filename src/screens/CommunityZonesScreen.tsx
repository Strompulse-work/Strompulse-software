import React, { useState, useEffect } from "react";
import {
  StatusBar,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Dimensions
} from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Rect, Text as SvgText, Line } from "react-native-svg";
import { useTheme } from "../theme/ThemeContext";
import { useAllGridDevices, computeHistoryAnalytics, formatDurationShort, parseStromTimestamp } from "../hooks/useDeviceData";
import { DEVICE_LOCATIONS } from "../constants/gridLocations";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { firebaseDb } from "../config/firebase";
import { ref, push, update, increment } from "firebase/database";
import AuthService from "../services/authService";

const { height, width } = Dimensions.get("window");

const CHECKING_COLOR = "#F59E0B";

// ---------------------------------------------------------------------------
// REAL-TIME UPTIME CALCULATION
// ---------------------------------------------------------------------------
// Firebase only ever stores a restoration EVENT under `history/<timestamp>` —
// a snapshot taken the instant power came BACK on. There is no record of when
// an outage started, only when it ended.
//
// A restoration event only ever happens after an outage (that's what it's
// restoring from), so the gap between any two consecutive restorations always
// contains an unlogged outage somewhere inside it — we just don't know where.
// Assuming the WHOLE gap was "up" badly overstates uptime: a single Friday-
// night restoration could retroactively paint an entire dead Sunday-to-
// Thursday week green, because nothing contradicted it... until this fix.
//
// Instead, a gap is only trusted as continuous uptime when it's short enough
// that an unnoticed flicker is plausible — capped at one reporting bucket
// (4 hours, the smallest interval this app charts). Anything longer gets NO
// credit: it's treated as unknown/not-up rather than guessed as up, so the
// chart never claims uptime the data can't back up.
//
// The one exception is the device's CURRENT state: the most recent
// restoration's "up" interval extends all the way to "now" only if the
// device is confirmed online right now — nothing has happened since to
// contradict that.
// ---------------------------------------------------------------------------

const MAX_TRUSTED_GAP_MS = 4 * 60 * 60 * 1000; // 4 hours

const buildUpIntervalsFromHistory = (
  historyNode: any,
  isOnline: boolean,
  nowMs: number
): Array<{ start: number; end: number }> => {
  if (!historyNode) return [];

  const events = Object.keys(historyNode)
    .map((key) => {
      const entry = historyNode[key];
      const tsSource = entry && typeof entry === "object" && entry.timestamp ? entry.timestamp : key;
      const parsed = parseStromTimestamp(String(tsSource));
      return parsed ? parsed.getTime() : null;
    })
    .filter((ts): ts is number => typeof ts === "number" && !Number.isNaN(ts))
    .sort((a, b) => a - b);

  if (events.length === 0) return [];

  const intervals: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < events.length; i++) {
    const start = events[i];
    const isLast = i === events.length - 1;

    if (isLast) {
      // Only the most recent restoration can extend to "now" — and only if
      // the device is confirmed online right now. Nothing since has
      // contradicted that.
      const end = isOnline ? nowMs : start;
      if (end > start) intervals.push({ start, end });
      continue;
    }

    // A restoration always follows an outage, so this gap necessarily
    // contains one somewhere. Trust it only if it's short enough to
    // plausibly be a single brief flicker.
    const gap = events[i + 1] - start;
    const end = gap <= MAX_TRUSTED_GAP_MS ? events[i + 1] : start;
    if (end > start) intervals.push({ start, end });
  }
  return intervals;
};

const sumOverlapMs = (
  intervals: Array<{ start: number; end: number }>,
  rangeStart: number,
  rangeEnd: number
): number => {
  let total = 0;
  for (const iv of intervals) {
    const overlapStart = Math.max(iv.start, rangeStart);
    const overlapEnd = Math.min(iv.end, rangeEnd);
    if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
  }
  return total;
};

const formatFriendlyRestorationTime = (date: Date): string => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / (24 * 60 * 60 * 1000));

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const meridiem = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const timeStr = `${hours}:${minutes}:${seconds}${meridiem}`;

  if (diffDays === 0) return `today at ${timeStr}`;
  if (diffDays === 1) return `yesterday at ${timeStr}`;

  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
  return `on ${dateStr} at ${timeStr}`;
};

const calculateIntervalUptime = (device: any, startMs: number, endMs: number, nowMs: number): number | null => {
  if (startMs >= nowMs) return null;

  const clampedEnd = Math.min(endMs, nowMs);
  const durationMs = clampedEnd - startMs;
  if (durationMs <= 0) return null;

  const hasHistory = device?.history && Object.keys(device.history).length > 0;
  if (!hasHistory) {
    return device?.isOnline ? 100 : 0;
  }

  const intervals = buildUpIntervalsFromHistory(device.history, !!device.isOnline, nowMs);
  const upMs = sumOverlapMs(intervals, startMs, clampedEnd);
  const pct = Math.round((upMs / durationMs) * 100);
  return Math.max(0, Math.min(100, pct));
};

const CommunityZonesScreen = ({ route, navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const [userVote, setUserVote] = useState<string | null>(null);
  const [chartTimeRange, setChartTimeRange] = useState<"Today" | "This Week">("Today");
  const [nowTick, setNowTick] = useState(Date.now());

  // FORCED GREEN DESIGN FOR ALL ACTION BUTTONS/ARROWS
  const solidActionBg = "#00C48A";
  const solidActionIcon = "#FFFFFF";

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { areaId, areaName } = route.params || {};
  const areaData = DEVICE_LOCATIONS[areaId] || { name: "Unknown Area", type: "area" };
  const displayTitle = areaName || areaData.name;

  const { devices, loading } = useAllGridDevices();

  const liveDevice = devices.find((d) =>
    d.id === areaId ||
    d.id?.toUpperCase() === areaId?.toUpperCase()
  );

  useEffect(() => {
    if (areaId) {
      AsyncStorage.getItem(`strompulse_vote_${areaId}`).then((val) => {
        if (val) setUserVote(val);
      });
    }
  }, [areaId]);

  const handleVote = async (vote: 'yes' | 'no') => {
    setUserVote(vote);
    await AsyncStorage.setItem(`strompulse_vote_${areaId}`, vote);

    try {
      const session = await AuthService.getCurrentSession();
      const userId = session?.user?.id || "anonymous";

      const votesRef = ref(firebaseDb, `AccuracyVotes/${areaId}`);
      await push(votesRef, {
        area_id: areaId,
        area_name: displayTitle,
        vote: vote,
        user_id: userId,
        created_at: Date.now()
      });

      const summaryRef = ref(firebaseDb, `AccuracyVotes_Summary/${areaId}`);
      await update(summaryRef, {
        area_name: displayTitle,
        [`${vote}Count`]: increment(1),
      });
    } catch (e) {
      console.warn("Failed to sync vote to Firebase backend:", e);
    }
  };

  if (loading && !liveDevice) {
    return (
      <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} justifyContent="center" alignItems="center">
        <ActivityIndicator size="large" color="#00C48A" />
      </YStack>
    );
  }

  const connectionState: 'online' | 'offline' | 'checking' = liveDevice
    ? (liveDevice.connectionState || (liveDevice.isOnline ? 'online' : 'offline'))
    : 'offline';
  const isOnline = connectionState === 'online';
  const isChecking = connectionState === 'checking';

  const realUptime = liveDevice?.uptime !== undefined ? liveDevice.uptime : (isOnline ? 100 : 0);
  const mainColor = isChecking ? CHECKING_COLOR : isOnline ? "#00C48A" : "#EF4444";

  const outOfCoverage = !liveDevice;
  const isPartial = isOnline && realUptime > 0 && realUptime < 100;

  let finalStatusText = outOfCoverage
    ? "Out of Coverage"
    : isChecking
    ? "Checking Status"
    : isOnline
    ? "Presently Stable"
    : "Power Outage";
  if (isPartial) finalStatusText = "Partial Stability";

  const historyAnalytics = computeHistoryAnalytics(liveDevice?.history, 'Today', isOnline);

  const renderAccuracyBarChart = () => {
    const now = nowTick;
    const nowDate = new Date(now);
    const currentDay = nowDate.getDay();

    const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
    const startOfWeek = startOfToday - (currentDay * 24 * 60 * 60 * 1000);

    const labelsToday = ["0-4", "4-8", "8-12", "12-16", "16-20", "20-24"];
    const labelsWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const intervalData = chartTimeRange === "Today"
      ? labelsToday.map((label, idx) => {
          const startMs = startOfToday + (idx * 4 * 3600 * 1000);
          const endMs = startMs + (4 * 3600 * 1000);
          if (startMs >= now) return { label, accuracy: 0, isFuture: true };

          const pct = liveDevice ? calculateIntervalUptime(liveDevice, startMs, endMs, now) : 0;
          return { label, accuracy: pct ?? 0, isFuture: false };
        })
      : labelsWeek.map((label, idx) => {
          const startMs = startOfWeek + (idx * 24 * 3600 * 1000);
          const endMs = startMs + (24 * 3600 * 1000);
          if (startMs >= now) return { label, accuracy: 0, isFuture: true };

          const pct = liveDevice ? calculateIntervalUptime(liveDevice, startMs, endMs, now) : 0;
          return { label, accuracy: pct ?? 0, isFuture: false };
        });

    const chartHeight = 190;
    const chartWidth = width - 48;
    const yAxisLabels = [100, 80, 60, 40, 20, 0];

    const barWidth = chartTimeRange === "Today" ? 22 : 18;
    const startX = 45;
    const availableWidth = chartWidth - startX - 20;
    const gap = availableWidth / intervalData.length;

    return (
      <YStack backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"} borderRadius={24} padding={20} marginBottom={24} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}>

        <XStack justifyContent="space-between" alignItems="flex-start" marginBottom={24}>
          <XStack alignItems="center" gap={12} flex={1}>
            <YStack width={36} height={36} borderRadius={10} backgroundColor={isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5"} justifyContent="center" alignItems="center">
              <MaterialCommunityIcons name="chart-bar" size={20} color="#00C48A" />
            </YStack>
            <YStack flex={1}>
              <TText fontFamily="Chirp-Heavy" fontSize={15} color={theme.textPrimary}>{displayTitle} Accuracy</TText>
              <TText fontFamily="Chirp-Medium" fontSize={11} color={theme.textSecondary} marginTop={2}>
                {chartTimeRange === "Today" ? "4-hour interval breakdown" : "Daily interval breakdown"}
              </TText>
            </YStack>
          </XStack>

          <XStack backgroundColor={isDarkMode ? "#1A221E" : "#F1F5F9"} borderRadius={10} padding={4}>
            <TouchableOpacity onPress={() => setChartTimeRange("Today")} style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: chartTimeRange === "Today" ? (isDarkMode ? "#2D3B34" : "#FFFFFF") : "transparent", borderRadius: 6 }}>
              <TText fontSize={10} fontFamily="Chirp-Bold" color={chartTimeRange === "Today" ? theme.textPrimary : theme.textSecondary}>Today</TText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setChartTimeRange("This Week")} style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: chartTimeRange === "This Week" ? (isDarkMode ? "#2D3B34" : "#FFFFFF") : "transparent", borderRadius: 6 }}>
              <TText fontSize={10} fontFamily="Chirp-Bold" color={chartTimeRange === "This Week" ? theme.textPrimary : theme.textSecondary}>This week</TText>
            </TouchableOpacity>
          </XStack>
        </XStack>

        <YStack height={chartHeight} width="100%">
          <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>

            <SvgText
              x={12}
              y={chartHeight / 2 - 10}
              fill={theme.textSecondary}
              fontSize={10}
              fontFamily="Chirp-Bold"
              transform={`rotate(-90, 12, ${chartHeight / 2 - 10})`}
              textAnchor="middle"
            >
              Uptime
            </SvgText>

            {yAxisLabels.map((val, idx) => {
              const yPos = 10 + (idx * 26);
              return (
                <React.Fragment key={`grid-${idx}`}>
                  <SvgText x={35} y={yPos + 4} fill={theme.textSecondary} fontSize={10} fontFamily="Chirp-Medium" textAnchor="end">
                    {val}
                  </SvgText>
                  <Line x1={45} y1={yPos} x2={chartWidth} y2={yPos} stroke={isDarkMode ? "#22302A" : "#F1F5F9"} strokeWidth="1" strokeDasharray="4,4" />
                </React.Fragment>
              );
            })}

            {intervalData.map((item, index) => {
              const xPos = startX + (gap * index) + (gap - barWidth) / 2;
              const maxBarHeight = 130;
              const barH = item.isFuture ? 6 : Math.max(6, (item.accuracy / 100) * maxBarHeight);
              const yPos = 10 + maxBarHeight - barH;

              let barColor = "#EF4444";
              if (item.accuracy >= 70) barColor = "#00C48A";
              else if (item.accuracy >= 40) barColor = "#F59E0B";

              if (item.isFuture) {
                barColor = isDarkMode ? "#2D3B34" : "#E2E8F0";
              }

              return (
                <React.Fragment key={`bar-${index}`}>
                  <Rect x={xPos} y={yPos} width={barWidth} height={barH} rx={barWidth / 2} fill={barColor} />
                  <SvgText x={xPos + barWidth / 2} y={chartHeight - 20} fill={theme.textSecondary} fontSize={10} fontFamily="Chirp-Medium" textAnchor="middle">
                    {item.label}
                  </SvgText>
                </React.Fragment>
              );
            })}

            <SvgText
              x={startX + (availableWidth / 2)}
              y={chartHeight - 4}
              fill={theme.textSecondary}
              fontSize={10}
              fontFamily="Chirp-Bold"
              textAnchor="middle"
            >
              {chartTimeRange === "Today" ? "hours" : "days"}
            </SvgText>
          </Svg>
        </YStack>
      </YStack>
    );
  };

  return (
    <YStack flex={1} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={isDarkMode ? "#0B0F0D" : "#F8FAFC"} />

      <SafeAreaView style={{ zIndex: 10 }}>
        <XStack alignItems="center" justifyContent="space-between" paddingHorizontal={24} paddingTop={Platform.OS === 'android' ? 10 : 0} paddingBottom={10}>
          <TouchableOpacity
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: isDarkMode ? "#1A221E" : "#FFFFFF", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: isDarkMode ? "#2D3B34" : "#E2E8F0" }}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={18} color={theme.textPrimary} />
          </TouchableOpacity>
          <TText fontFamily="Chirp-Heavy" fontSize={16} color={theme.textPrimary}>{displayTitle}</TText>
          <YStack width={42} />
        </XStack>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 10 }}>

        <XStack
          backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"}
          borderRadius={20}
          paddingHorizontal={16}
          paddingVertical={12}
          alignItems="center"
          justifyContent="space-between"
          borderWidth={1}
          borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}
          marginBottom={20}
        >
          <XStack alignItems="center" gap={10}>
            <YStack width={32} height={32} borderRadius={16} backgroundColor={isChecking ? (isDarkMode ? "rgba(245,158,11,0.15)" : "#FEF3C7") : isOnline ? (isDarkMode ? "rgba(0,196,138,0.15)" : "#D1FAE5") : (isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2")} justifyContent="center" alignItems="center">
              {isChecking ? <ActivityIndicator size="small" color="#F59E0B" /> : <Feather name={isOnline ? "zap" : "zap-off"} size={16} color={isOnline ? "#00C48A" : "#EF4444"} />}
            </YStack>
            <TText fontSize={13} fontFamily="Chirp-Bold" color={mainColor} letterSpacing={0.5}>
              {isChecking ? "CHECKING STATUS" : isOnline ? "POWER RESTORED" : "POWER OUTAGE"}
            </TText>
          </XStack>

          {userVote ? (
            <YStack backgroundColor={isDarkMode ? "#1A221E" : "#F1F5F9"} paddingHorizontal={10} paddingVertical={4} borderRadius={12}>
              <TText fontSize={11} fontFamily="Chirp-Bold" color="#00C48A">Voted: {userVote.toUpperCase()} ✓</TText>
            </YStack>
          ) : (
            <XStack alignItems="center" gap={8}>
              <TText fontSize={11} fontFamily="Chirp-Medium" color={theme.textSecondary}>Is this accurate?</TText>
              <XStack gap={6}>
                <TouchableOpacity onPress={() => handleVote('yes')}>
                  <YStack backgroundColor={isDarkMode ? "rgba(0,196,138,0.15)" : "#ECFDF5"} paddingHorizontal={10} paddingVertical={4} borderRadius={10}>
                    <TText fontSize={11} fontFamily="Chirp-Bold" color="#00C48A">Yes</TText>
                  </YStack>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleVote('no')}>
                  <YStack backgroundColor={isDarkMode ? "rgba(239,68,68,0.15)" : "#FEE2E2"} paddingHorizontal={10} paddingVertical={4} borderRadius={10}>
                    <TText fontSize={11} fontFamily="Chirp-Bold" color="#EF4444">No</TText>
                  </YStack>
                </TouchableOpacity>
              </XStack>
            </XStack>
          )}
        </XStack>

        <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate("RequestDeviceScreen")}>
          <XStack
            backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"}
            borderRadius={20}
            padding={16}
            alignItems="center"
            justifyContent="space-between"
            borderWidth={1}
            borderColor={isDarkMode ? "#2D3B34" : "#F1F5F9"}
            marginBottom={24}
          >
            <XStack alignItems="center" gap={12} flex={1}>
              <YStack width={36} height={36} borderRadius={18} backgroundColor={isDarkMode ? "rgba(0,196,138,0.1)" : "#ECFDF5"} justifyContent="center" alignItems="center">
                <Feather name="shield" size={16} color="#00C48A" />
              </YStack>
              <TText flex={1} fontSize={13} fontFamily="Chirp-Medium" color={theme.textPrimary} lineHeight={18}>
                Analytics is 70% accurate, If you need 100% accuracy, request personal strompulse device
              </TText>
            </XStack>
            <YStack width={32} height={32} borderRadius={16} backgroundColor={solidActionBg} justifyContent="center" alignItems="center" style={{ marginLeft: 8 }}>
              <Feather name="arrow-right" size={14} color={solidActionIcon} />
            </YStack>
          </XStack>
        </TouchableOpacity>

        <TText fontSize={12} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={1.5} marginBottom={12}>TODAY'S INSIGHTS</TText>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16, gap: 12 }}>
          {historyAnalytics.currentStreakMs !== null ? (
            <YStack width={160} borderRadius={20} padding={16} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"}>
              <YStack width={32} height={32} borderRadius={10} backgroundColor={isDarkMode ? "rgba(0,196,138,0.15)" : "#D1FAE5"} justifyContent="center" alignItems="center" marginBottom={12}>
                <Feather name="zap" size={16} color="#00C48A" />
              </YStack>
              <TText fontSize={12} fontFamily="Chirp-Bold" color="#00C48A" marginBottom={6}>Current streak</TText>
              <TText fontSize={11} fontFamily="Chirp-Regular" lineHeight={16} color={theme.textSecondary}>Stable for {formatDurationShort(historyAnalytics.currentStreakMs)} since last restoration.</TText>
            </YStack>
          ) : (
            <YStack width={160} borderRadius={20} padding={16} borderWidth={1} borderColor={isDarkMode ? "#7F1D1D" : "#FECACA"} backgroundColor={isDarkMode ? "rgba(239,68,68,0.05)" : "#FEF2F2"}>
              <YStack width={32} height={32} borderRadius={10} backgroundColor={isDarkMode ? "rgba(239,68,68,0.15)" : "#FECACA"} justifyContent="center" alignItems="center" marginBottom={12}>
                <Feather name="zap-off" size={16} color="#EF4444" />
              </YStack>
              <TText fontSize={12} fontFamily="Chirp-Bold" color="#EF4444" marginBottom={6}>Currently down</TText>
              <TText fontSize={11} fontFamily="Chirp-Regular" lineHeight={16} color={theme.textSecondary}>
                {historyAnalytics.latestRestorationAt ? `Last restored ${formatFriendlyRestorationTime(historyAnalytics.latestRestorationAt)}.` : "No restoration events recorded yet."}
              </TText>
            </YStack>
          )}
          <YStack width={160} borderRadius={20} padding={16} borderWidth={1} borderColor={isDarkMode ? "#2D3B34" : "#E2E8F0"} backgroundColor={isDarkMode ? "#121A16" : "#FFFFFF"}>
            <YStack width={32} height={32} borderRadius={10} backgroundColor={isDarkMode ? "rgba(139,92,246,0.15)" : "#EDE9FE"} justifyContent="center" alignItems="center" marginBottom={12}>
              <Feather name="refresh-cw" size={16} color={isDarkMode ? "#A78BFA" : "#8B5CF6"} />
            </YStack>
            <TText fontSize={12} fontFamily="Chirp-Bold" color={isDarkMode ? "#A78BFA" : "#8B5CF6"} marginBottom={6}>Restorations</TText>
            <TText fontSize={11} fontFamily="Chirp-Regular" lineHeight={16} color={theme.textSecondary}>{historyAnalytics.totalRestorationsInRange} power-restoration event recorded today.</TText>
          </YStack>
        </ScrollView>

        <TText fontSize={12} fontFamily="Chirp-Bold" color={theme.textSecondary} letterSpacing={1.5} marginBottom={12} marginTop={12}>PERFORMANCE ANALYTICS</TText>

        {renderAccuracyBarChart()}

      </ScrollView>
    </YStack>
  );
};

export default CommunityZonesScreen;