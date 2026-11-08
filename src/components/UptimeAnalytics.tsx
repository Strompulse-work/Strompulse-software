// Shared uptime analytics: helpers + the detailed bar chart used across StromPulse.
// Save as: src/components/UptimeAnalytics.tsx
import React from "react";
import { Dimensions, ScrollView, TouchableOpacity } from "react-native";
import { XStack, YStack, Text as TText } from "tamagui";
import { Feather } from "@expo/vector-icons";
import Svg, { Rect, Text as SvgText, Line } from "react-native-svg";
import { parseStromTimestamp } from "../hooks/useDeviceData";

const { width } = Dimensions.get("window");

export const MAX_TRUSTED_GAP_MS = 4 * 60 * 60 * 1000;
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type Range = "Today" | "This Week" | "This Month";
export type ChartBar = { label: string; subLabel?: string; value: number | null; isFuture?: boolean };

// ---------------- date helpers ----------------
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const startOfIsoWeek = (d: Date) => {
  const s = startOfDay(d);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() - ((s.getDay() + 6) % 7));
};
export const getIsoWeek = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7), year: d.getUTCFullYear() };
};
export const formatHourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
export const xTitleFor = (r: Range) => (r === "Today" ? "Hour of day" : r === "This Week" ? "Day of week" : "Week of month");

// ---------------- uptime maths ----------------
// Each history entry = one "power ON" session. The KEY is when power was restored.
// Fields inside the entry (last_seen / timestamp / durationSeconds) describe when that session ENDED
// and are updated by the device while it runs — they must never be used as the session start.
// (Using entry.timestamp as the start is what made 12am–noon drop to 0% later in the day.)
const SESSION_FALLBACK_MAX_MS = 24 * 60 * 60 * 1000;
const toMs = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v; // seconds or ms
  const d = parseStromTimestamp(String(v));
  return d ? d.getTime() : null;
};
export const buildUpIntervalsFromHistory = (historyNode: any, isOnline: boolean, nowMs: number, lastSeenMs: number | null = null) => {
  if (!historyNode) return [];
  const sessions = Object.keys(historyNode)
    .map((key) => {
      const entry = historyNode[key];
      const obj = entry && typeof entry === "object" ? entry : {};
      const start = toMs(key) ?? toMs(obj.start) ?? toMs(obj.started_at) ?? toMs(obj.restored_at);
      if (start === null) return null;
      let end = toMs(obj.last_seen) ?? toMs(obj.ended_at) ?? toMs(obj.end);
      if (end === null && typeof obj.durationSeconds === "number") end = start + obj.durationSeconds * 1000;
      if (end === null) {
        const ts = toMs(obj.timestamp);
        if (ts !== null && ts > start) end = ts;
      }
      return { start, end: end !== null && end > start ? end : null };
    })
    .filter((s): s is { start: number; end: number | null } => !!s && !Number.isNaN(s.start))
    .sort((a, b) => a.start - b.start);

  const intervals: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < sessions.length; i++) {
    const { start, end: recordedEnd } = sessions[i];
    const nextStart = i < sessions.length - 1 ? sessions[i + 1].start : null;
    let end: number;
    if (nextStart === null) {
      // Latest session: still running if the device is online right now
      // Offline: it ended at the recorded end, or at the device's last heartbeat
      end = isOnline ? nowMs : recordedEnd ?? (lastSeenMs !== null && lastSeenMs > start ? lastSeenMs : start);
    } else if (recordedEnd !== null) {
      end = Math.min(recordedEnd, nextStart);
    } else {
      // No end recorded: assume power stayed on until the next restore (capped so one bad gap can't fill a whole day)
      end = Math.min(nextStart, start + SESSION_FALLBACK_MAX_MS);
    }
    end = Math.min(end, nowMs);
    if (end > start) intervals.push({ start, end });
  }
  return intervals;
};

export const sumOverlapMs = (intervals: Array<{ start: number; end: number }>, rangeStart: number, rangeEnd: number) => {
  let total = 0;
  for (const iv of intervals) {
    const s = Math.max(iv.start, rangeStart);
    const e = Math.min(iv.end, rangeEnd);
    if (e > s) total += e - s;
  }
  return total;
};

/** % of [startMs, endMs) the device had power. null = interval is in the future. */
export const calculateIntervalUptime = (device: any, startMs: number, endMs: number, nowMs: number) => {
  if (!device || startMs >= nowMs) return null;
  const clampedEnd = Math.min(endMs, nowMs);
  const durationMs = clampedEnd - startMs;
  if (durationMs <= 0) return null;
  const hasHistory = device?.history && Object.keys(device.history).length > 0;
  if (!hasHistory) return device?.isOnline ? 100 : 0;
  const intervals = buildUpIntervalsFromHistory(
    device.history, !!device.isOnline, nowMs,
    toMs(device.updated_at ?? device.lastSeen ?? device.realtime?.serverReceivedAt ?? device.realtime?.timestamp ?? null)
  );
  return Math.max(0, Math.min(100, Math.round((sumOverlapMs(intervals, startMs, clampedEnd) / durationMs) * 100)));
};

type PctFn = (startMs: number, endMs: number, nowMs: number) => number | null;

/** Bars for Today (24 hours), This Week (Mon–Sun with dates) or This Month (weeks). */
export const buildRangeBars = (range: Range, nowMs: number, pctFor: PctFn): ChartBar[] => {
  const now = new Date(nowMs);
  if (range === "Today") {
    const sod = startOfDay(now);
    return Array.from({ length: 24 }, (_, h) => {
      const s = new Date(sod.getFullYear(), sod.getMonth(), sod.getDate(), h).getTime();
      const isFuture = s >= nowMs;
      return { label: formatHourLabel(h), value: isFuture ? null : pctFor(s, s + 3600000, nowMs), isFuture };
    });
  }
  if (range === "This Week") {
    const sow = startOfIsoWeek(now);
    return DAY_NAMES.map((name, i) => {
      const d = new Date(sow.getFullYear(), sow.getMonth(), sow.getDate() + i);
      const s = d.getTime();
      const e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
      const isFuture = s >= nowMs;
      return { label: name, subLabel: `${d.getDate()} ${MONTHS[d.getMonth()]}`, value: isFuture ? null : pctFor(s, e, nowMs), isFuture };
    });
  }
  const y = now.getFullYear(), m = now.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const ranges: [number, number][] = [];
  for (let st = 1; st <= lastDay; st += 7) ranges.push([st, Math.min(st + 6, lastDay)]);
  return ranges.map(([a, b], i) => {
    const s = new Date(y, m, a).getTime();
    const e = new Date(y, m, b + 1).getTime();
    const isFuture = s > nowMs;
    return { label: `Wk ${i + 1}`, subLabel: a === b ? `${a} ${MONTHS[m]}` : `${a}–${b} ${MONTHS[m]}`, value: isFuture ? null : pctFor(s, e, nowMs), isFuture };
  });
};

/** Next week's prediction = average uptime of the same weekday over the previous 4 weeks. */
export const buildNextWeekPrediction = (nowMs: number, pctFor: PctFn) => {
  const now = new Date(nowMs);
  const thisMon = startOfIsoWeek(now);
  const nextMon = new Date(thisMon.getFullYear(), thisMon.getMonth(), thisMon.getDate() + 7);
  const bars: ChartBar[] = DAY_NAMES.map((name, i) => {
    const target = new Date(nextMon.getFullYear(), nextMon.getMonth(), nextMon.getDate() + i);
    const samples: number[] = [];
    for (let w = 1; w <= 4; w++) {
      const d = new Date(target.getFullYear(), target.getMonth(), target.getDate() - 7 * w);
      const s = d.getTime();
      if (s >= nowMs) continue;
      const e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
      const v = pctFor(s, e, nowMs);
      if (v !== null && v !== undefined) samples.push(v);
    }
    return { label: name, subLabel: `${target.getDate()} ${MONTHS[target.getMonth()]}`, value: samples.length ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : null };
  });
  return { bars, ...getIsoWeek(nextMon) };
};

/** Average of the bars that have data (used for summary stats). */
export const averageOf = (bars: ChartBar[]) => {
  const vals = bars.filter((b) => !b.isFuture && b.value !== null).map((b) => b.value as number);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
};

// ---------------- chart ----------------
export const UptimeBarChart = ({ bars, yTitle, xTitle, isDarkMode, textColor, variant = "actual", minSlotWidth = 0, showValues = false, horizontalInset = 88 }: {
  bars: ChartBar[]; yTitle: string; xTitle?: string; isDarkMode: boolean; textColor: string; variant?: "actual" | "predicted"; minSlotWidth?: number; showValues?: boolean; horizontalInset?: number;
}) => {
  const baseWidth = width - horizontalInset;
  const startX = 44;
  const chartWidth = Math.max(baseWidth, minSlotWidth * bars.length + startX + 8);
  const endX = chartWidth - 8;
  const slot = (endX - startX) / bars.length;
  const barW = Math.max(6, Math.min(24, slot * 0.55));
  const rotateLabels = bars.length > 12;
  const top = showValues ? 22 : 12;
  const plotH = 140;
  const axisY = top + plotH;
  const labelArea = rotateLabels ? 34 : bars.some((b) => b.subLabel) ? 30 : 18;
  const chartHeight = axisY + labelArea + (xTitle ? 18 : 4);
  const gridColor = isDarkMode ? "#2D3B34" : "#E2E8F0";

  const svg = (
    <Svg width={chartWidth} height={chartHeight}>
      <SvgText x={12} y={top + plotH / 2} fill={textColor} fontSize={10} fontFamily="Chirp-Bold" textAnchor="middle" transform={`rotate(-90, 12, ${top + plotH / 2})`}>{yTitle}</SvgText>
      {[100, 80, 60, 40, 20, 0].map((v) => {
        const y = top + plotH * (1 - v / 100);
        return (
          <React.Fragment key={`g${v}`}>
            <SvgText x={startX - 6} y={y + 3} fill={textColor} fontSize={9} fontFamily="Chirp-Medium" textAnchor="end">{v}</SvgText>
            <Line x1={startX} y1={y} x2={endX} y2={y} stroke={gridColor} strokeWidth={1} strokeDasharray={v === 0 ? undefined : "4,4"} />
          </React.Fragment>
        );
      })}
      {bars.map((b, i) => {
        const cx = startX + slot * i + slot / 2;
        const hasValue = !b.isFuture && b.value !== null && b.value !== undefined;
        const v = hasValue ? (b.value as number) : 0;
        const h = hasValue ? Math.max(4, (v / 100) * plotH) : 4;
        const y = axisY - h;
        let fill = variant === "predicted" ? "#3B82F6" : v >= 70 ? "#00C48A" : v >= 40 ? "#F59E0B" : "#EF4444";
        if (!hasValue) fill = gridColor;
        return (
          <React.Fragment key={`b${i}`}>
            <Rect x={cx - barW / 2} y={y} width={barW} height={h} rx={Math.min(barW / 2, 6)} fill={fill} opacity={variant === "predicted" && hasValue ? 0.85 : 1} />
            {showValues && hasValue && <SvgText x={cx} y={y - 5} fill={textColor} fontSize={9} fontFamily="Chirp-Bold" textAnchor="middle">{`${v}%`}</SvgText>}
            {rotateLabels ? (
              <SvgText x={cx + 3} y={axisY + 6} fill={textColor} fontSize={8} fontFamily="Chirp-Medium" textAnchor="end" transform={`rotate(-90, ${cx + 3}, ${axisY + 6})`}>{b.label}</SvgText>
            ) : (
              <>
                <SvgText x={cx} y={axisY + 13} fill={textColor} fontSize={10} fontFamily="Chirp-Bold" textAnchor="middle">{b.label}</SvgText>
                {b.subLabel ? <SvgText x={cx} y={axisY + 25} fill={textColor} fontSize={8} fontFamily="Chirp-Medium" textAnchor="middle">{b.subLabel}</SvgText> : null}
              </>
            )}
          </React.Fragment>
        );
      })}
      {xTitle ? <SvgText x={startX + (endX - startX) / 2} y={chartHeight - 4} fill={textColor} fontSize={10} fontFamily="Chirp-Bold" textAnchor="middle">{xTitle}</SvgText> : null}
    </Svg>
  );

  if (chartWidth > baseWidth) {
    return (
      <YStack>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>{svg}</ScrollView>
        <XStack justifyContent="flex-end" alignItems="center" gap={4} marginTop={4}>
          <Feather name="chevrons-right" size={10} color={textColor} />
          <TText fontFamily="Chirp-Medium" fontSize={10} color={textColor}>Scroll for more hours</TText>
        </XStack>
      </YStack>
    );
  }
  return svg;
};

// ---------------- small shared UI ----------------
export const RangeSelector = ({ value, onChange, isDarkMode, textSecondary }: { value: Range; onChange: (r: Range) => void; isDarkMode: boolean; textSecondary: string }) => (
  <XStack backgroundColor={isDarkMode ? "#1A221E" : "#F1F5F9"} borderRadius={12} padding={4} alignSelf="flex-start">
    {(["Today", "This Week", "This Month"] as Range[]).map((r) => (
      <TouchableOpacity key={r} onPress={() => onChange(r)} style={{ paddingVertical: 6, paddingHorizontal: 12, backgroundColor: value === r ? "#00C48A" : "transparent", borderRadius: 8 }}>
        <TText fontSize={11} fontFamily="Chirp-Bold" color={value === r ? "#FFFFFF" : textSecondary}>{r === "Today" ? "Today" : r === "This Week" ? "This week" : "This month"}</TText>
      </TouchableOpacity>
    ))}
  </XStack>
);

export const ChartLegend = ({ textSecondary, divider }: { textSecondary: string; divider: string }) => (
  <XStack gap={14} marginTop={12} flexWrap="wrap">
    {[{ c: "#00C48A", l: "70%+" }, { c: "#F59E0B", l: "40–69%" }, { c: "#EF4444", l: "<40%" }, { c: divider, l: "No data" }].map((x) => (
      <XStack key={x.l} alignItems="center" gap={6}>
        <YStack width={8} height={8} borderRadius={4} backgroundColor={x.c} />
        <TText fontFamily="Chirp-Medium" fontSize={10} color={textSecondary}>{x.l}</TText>
      </XStack>
    ))}
  </XStack>
);