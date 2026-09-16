/**
 * Custom Hooks for Data Fetching and Realtime Subscriptions
 * Hybrid Backend Upgrade: Static relationships from Supabase + Zero-Latency hardware stream from Firebase.
 * Includes Real-Time Heartbeat Logic for Online/Offline Status.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Device,
  PowerEvent,
  Outage,
  Community,
  CommunityStats,
  InsightsSummary,
} from "../types";
import {
  DeviceService,
  CommunityService,
  AnalyticsService,
} from "../services/deviceService";
import { supabase } from "../config/supabase";
import { ref, onValue, off } from "firebase/database";
import { firebaseDb } from "../config/firebase";

interface UseAsyncState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

// ============================================================================
// BASE DATABASE ANCHOR NODES MAPPING
// ============================================================================

export const DEVICE_LOCATIONS: Record<string, { name: string; type: string; lat: number; lng: number; roads: string[] }> = {
  "STROM001": { name: "Jericho Quarters", type: "estate", lat: 7.3970, lng: 3.8650, roads: ["Kudeti", "Onireke", "Jericho GRA"] },
  "STROM002": { name: "Agodi GRA", type: "estate", lat: 7.4080, lng: 3.9050, roads: ["Parliament", "Secretariat", "Ikolaba"] },
  "STROM003": { name: "Bodija Estate", type: "estate", lat: 7.4100, lng: 3.9000, roads: ["Awolowo Road", "Osuntokun", "Housing Corp"] },
  "STROM004": { name: "Challenge", type: "area", lat: 7.3600, lng: 3.8800, roads: ["Ring Rd", "Lagos Ibadan Exp", "Molete"] },
  "STROM005": { name: "Mokola", type: "area", lat: 7.3950, lng: 3.8850, roads: ["Sabo", "Queen Elizabeth Road", "Oremeji"] },
  "STROM006": { name: "Oluyole Estate", type: "estate", lat: 7.3500, lng: 3.8650, roads: ["Mobil", "Adeoyo", "Ring Road"] },
  "STROM007": { name: "Ring Road Area", type: "area", lat: 7.3650, lng: 3.8600, roads: ["State Hospital", "Liberty Stadium", "Oni and Sons"] },
  "STROM008": { name: "UI Campus", type: "school", lat: 7.4420, lng: 3.9000, roads: ["Bello", "Tafawa Balewa Way", "Agbowa"] },
  "STROM009": { name: "Mapo Hall", type: "area", lat: 7.3750, lng: 3.8950, roads: ["Bere", "Oja Oba Market", "Oje"] },
  "STROM010": { name: "Eleyele", type: "area", lat: 7.4050, lng: 3.8550, roads: ["Waterworks", "Jericho Rd", "Polytechnic Rd"] },
  "STROM011": { name: "MONATAN", type: "area", lat: 7.3880, lng: 3.8750, roads: ["New Ife Road", "Old Ife Road"] },
  "STROM012": { name: "OKETEDO", type: "area", lat: 7.3780, lng: 3.9100, roads: ["Oyo Road", "Agbowo Road"] },
};

// ============================================================================
// STROM DEVICE HEARTBEAT UTILITIES
// ============================================================================

const STROM_OFFLINE_THRESHOLD_SECONDS = 65; 
const STROM_DEVICE_UTC_OFFSET_MINUTES = 60; // WAT = UTC+1

export const parseStromTimestamp = (tsStr: string | number | undefined): Date | null => {
  if (!tsStr) return null;
  const str = String(tsStr);

  if (str.length === 14 && /^\d+$/.test(str)) {
    const day = parseInt(str.substring(0, 2), 10);
    const month = parseInt(str.substring(2, 4), 10) - 1; 
    const year = parseInt(str.substring(4, 8), 10);
    const hours = parseInt(str.substring(8, 10), 10);
    const minutes = parseInt(str.substring(10, 12), 10);
    const seconds = parseInt(str.substring(12, 14), 10);

    const utcMillis =
      Date.UTC(year, month, day, hours, minutes, seconds) -
      STROM_DEVICE_UTC_OFFSET_MINUTES * 60 * 1000;

    const parsed = new Date(utcMillis);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const fallbackDate = new Date(str);
  return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
};

export type ConnectionState = 'online' | 'offline' | 'checking';
export type HeartbeatTracker = Record<string, 'online' | 'offline'>;
const STROM_ONLINE_CONFIRM_SECONDS = 35; 

export const getDeviceConnectionState = (
  hardwareMetrics: any,
  deviceId: string,
  tracker: HeartbeatTracker,
  thresholdSeconds: number = STROM_OFFLINE_THRESHOLD_SECONDS,
  hasConnectivityIssue: boolean = false
): ConnectionState => {
  if (hasConnectivityIssue) return 'checking';
  if (!hardwareMetrics) return 'offline';

  const rawStatus = String(hardwareMetrics.status).trim();
  const reportedActive =
    rawStatus === "1" ||
    rawStatus.toLowerCase() === "true" ||
    rawStatus.toLowerCase() === "on";

  if (!reportedActive) {
    tracker[deviceId] = 'offline';
    return 'offline';
  }

  let secondsSinceUpdate: number | null = null;

  if (typeof hardwareMetrics.serverReceivedAt === "number") {
    secondsSinceUpdate = (Date.now() - hardwareMetrics.serverReceivedAt) / 1000;
  } else if (hardwareMetrics.timestamp) {
    const parsed = parseStromTimestamp(hardwareMetrics.timestamp);
    if (parsed) {
      secondsSinceUpdate = (Date.now() - parsed.getTime()) / 1000;
    }
  }

  if (secondsSinceUpdate === null) {
    tracker[deviceId] = 'offline';
    return 'offline';
  }

  const prevState = tracker[deviceId] || 'offline';

  if (prevState === 'online') {
    if (secondsSinceUpdate <= thresholdSeconds) return 'online';
    tracker[deviceId] = 'offline';
    return 'offline';
  }

  if (secondsSinceUpdate <= STROM_ONLINE_CONFIRM_SECONDS) {
    tracker[deviceId] = 'online';
    return 'online';
  }
  return 'offline';
};

export const checkIsDeviceOnline = (
  hardwareMetrics: any,
  deviceId: string,
  tracker: HeartbeatTracker,
  thresholdSeconds: number = STROM_OFFLINE_THRESHOLD_SECONDS,
  hasConnectivityIssue: boolean = false
): boolean => {
  return getDeviceConnectionState(hardwareMetrics, deviceId, tracker, thresholdSeconds, hasConnectivityIssue) === 'online';
};

const sharedHeartbeatTracker: HeartbeatTracker = {};

const safeTimeMillis = (value: any): number => {
  const parsed = parseStromTimestamp(value);
  return parsed ? parsed.getTime() : 0;
};

// ============================================================================
// HISTORY-BASED ANALYTICS
// ============================================================================

export type AnalyticsRange = 'Today';

export interface PowerFlowBucket {
  label: string;
  restorationCount: number;
  stabilityScore: number; 
  isStable: boolean;
  isFuture: boolean;
}

export interface HistoryAnalytics {
  bucketLabels: string[];
  buckets: PowerFlowBucket[];
  totalRestorationsInRange: number;
  latestRestorationAt: Date | null;
  currentStreakMs: number | null;
  hasAnyData: boolean;
  isCurrentlyOnline: boolean;
}

export const computeHistoryAnalytics = (
  historyNode: Record<string, any> | undefined | null,
  range: AnalyticsRange,
  isCurrentlyOnline: boolean
): HistoryAnalytics => {
  const rawKeys = historyNode ? Object.keys(historyNode) : [];
  const hasAnyData = rawKeys.length > 0;

  const restorationDates = rawKeys
    .map((key) => parseStromTimestamp(key))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const latestRestorationAt = restorationDates.length > 0 ? restorationDates[restorationDates.length - 1] : null;

  const currentStreakMs = isCurrentlyOnline && latestRestorationAt
    ? Date.now() - latestRestorationAt.getTime()
    : null;

  const WAT_OFFSET_MS = 60 * 60 * 1000; 
  const nowUtcMs = Date.now();
  const watWallClock = new Date(nowUtcMs + WAT_OFFSET_MS); 
  const watMidnightAsWallClock = Date.UTC(watWallClock.getUTCFullYear(), watWallClock.getUTCMonth(), watWallClock.getUTCDate());
  const startOfDay = watMidnightAsWallClock - WAT_OFFSET_MS; 

  const HOUR_LABELS = ['12 AM', '4 AM', '8 AM', '12 PM', '4 PM', '8 PM'];
  const bucketLabels = HOUR_LABELS;
  const bucketBoundaries: number[] = [0, 4, 8, 12, 16, 20, 24].map((h) => startOfDay + h * 3600 * 1000);

  let currentBucketIndex = bucketLabels.length - 1;
  for (let i = 0; i < bucketLabels.length; i++) {
    if (nowUtcMs >= bucketBoundaries[i] && nowUtcMs < bucketBoundaries[i + 1]) {
      currentBucketIndex = i;
      break;
    }
  }

  const upSinceMs = isCurrentlyOnline && latestRestorationAt ? latestRestorationAt.getTime() : null;

  const buckets: PowerFlowBucket[] = bucketLabels.map((label, i) => {
    const rangeStart = bucketBoundaries[i];
    const rangeEnd = bucketBoundaries[i + 1];
    const restorationCount = restorationDates.filter((d) => {
      const t = d.getTime();
      return t >= rangeStart && t < rangeEnd;
    }).length;

    const stabilityScore = hasAnyData ? Math.max(20, 100 - restorationCount * 25) : 0;

    const isFuture = rangeStart > nowUtcMs;
    const isCurrentBucket = i === currentBucketIndex;

    let isStable: boolean;
    if (isFuture) {
      isStable = false; 
    } else if (isCurrentBucket && isCurrentlyOnline) {
      isStable = true;
    } else if (isCurrentlyOnline && upSinceMs !== null && rangeEnd > upSinceMs) {
      isStable = true;
    } else {
      isStable = hasAnyData && restorationCount > 0;
    }

    return { label, restorationCount, stabilityScore, isStable, isFuture };
  });

  const totalRestorationsInRange = buckets.reduce((sum, b) => sum + b.restorationCount, 0);

  return { bucketLabels, buckets, totalRestorationsInRange, latestRestorationAt, currentStreakMs, hasAnyData, isCurrentlyOnline };
};

export const computeAggregatedHistoryAnalytics = (
  devicesWithHistory: Array<{ history?: Record<string, any> | undefined | null; isOnline: boolean }>
): HistoryAnalytics => {
  const perDevice = devicesWithHistory.map((d) => computeHistoryAnalytics(d.history, 'Today', d.isOnline));

  const bucketLabels = perDevice[0]?.bucketLabels || ['12 AM', '4 AM', '8 AM', '12 PM', '4 PM', '8 PM'];

  const buckets: PowerFlowBucket[] = bucketLabels.map((label, i) => {
    const scores = perDevice.map((pd) => pd.buckets[i]?.stabilityScore ?? 0);
    const stabilityScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;
    const restorationCount = perDevice.reduce((sum, pd) => sum + (pd.buckets[i]?.restorationCount || 0), 0);
    const isStable = perDevice.some((pd) => pd.buckets[i]?.isStable);
    const isFuture = perDevice.length > 0 && perDevice.every((pd) => pd.buckets[i]?.isFuture);
    return { label, restorationCount, stabilityScore, isStable, isFuture };
  });

  const totalRestorationsInRange = buckets.reduce((sum, b) => sum + b.restorationCount, 0);
  const hasAnyData = perDevice.some((pd) => pd.hasAnyData);

  const allRestorationDates = perDevice
    .map((pd) => pd.latestRestorationAt)
    .filter((d): d is Date => d !== null);
  const latestRestorationAt = allRestorationDates.length > 0
    ? new Date(Math.max(...allRestorationDates.map((d) => d.getTime())))
    : null;

  const allCurrentlyOnline = devicesWithHistory.length > 0 && devicesWithHistory.every((d) => d.isOnline);

  return { bucketLabels, buckets, totalRestorationsInRange, latestRestorationAt, currentStreakMs: null, hasAnyData, isCurrentlyOnline: allCurrentlyOnline };
};

export const formatDurationShort = (ms: number): string => {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export const useAsync = <T>(
  handler: () => Promise<any>,
  immediate: boolean = true,
): UseAsyncState<T> => {
  const [state, setState] = useState<UseAsyncState<T>>({
    loading: immediate,
    error: null,
    data: null,
  });

  const execute = useCallback(async () => {
    setState({ loading: true, error: null, data: null });
    try {
      const response = await handler();
      if (response.success) {
        setState({ loading: false, error: null, data: response.data });
      } else {
        setState({
          loading: false,
          error: response.error || "Unknown error",
          data: null,
        });
      }
    } catch (error) {
      setState({ loading: false, error: String(error), data: null });
    }
  }, [handler]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return state;
};

const extractPowerMonitorNode = (liveHardwareTree: any): Record<string, any> | null => {
  if (!liveHardwareTree) return null;

  if (liveHardwareTree.PowerMonitor) {
    return liveHardwareTree.PowerMonitor;
  }

  const deviceLikeEntries = Object.keys(liveHardwareTree).filter((key) =>
    /^STROM\d+$/i.test(key)
  );

  if (deviceLikeEntries.length === 0) return null;

  const rootAsDeviceMap: Record<string, any> = {};
  deviceLikeEntries.forEach((key) => {
    rootAsDeviceMap[key] = liveHardwareTree[key];
  });
  return rootAsDeviceMap;
};

export const useAllGridDevices = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastPowerMonitorNodeRef = useRef<Record<string, any> | null>(null);
  const supabaseDataRef = useRef<any[]>([]);
  const hasConnectivityIssueRef = useRef<boolean>(false);

  useEffect(() => {
    let firebaseListener: any;
    let pollInterval: any;
    const rootFirebaseRef = ref(firebaseDb, "/");

    const buildAndSetDevices = () => {
      const powerMonitorNode = lastPowerMonitorNodeRef.current;
      const supabaseData = supabaseDataRef.current || [];
      const hasConnectivityIssue = hasConnectivityIssueRef.current;

      // Base nodes list (Anchor nodes STROM001 - STROM012)
      const baseDeviceIds = Object.keys(DEVICE_LOCATIONS);
      const incomingIds = powerMonitorNode ? Object.keys(powerMonitorNode) : [];
      const allDistinctIds = Array.from(new Set([...baseDeviceIds, ...incomingIds]));

      const synchronizedDevices = allDistinctIds.map((deviceId) => {
        const hardwareMetrics = powerMonitorNode?.[deviceId]?.realtime || null;
        const dbDevice = supabaseData.find((d: any) => d.device_id === deviceId || d.id === deviceId) || {};

        const connectionState = getDeviceConnectionState(
          hardwareMetrics,
          deviceId,
          sharedHeartbeatTracker,
          STROM_OFFLINE_THRESHOLD_SECONDS,
          hasConnectivityIssue
        );

        const isOnline = connectionState === 'online';

        return {
          ...dbDevice,
          id: deviceId,
          isOnline,
          connectionState,
          status: hardwareMetrics?.status !== undefined
            ? Number(hardwareMetrics.status)
            : Number(dbDevice.status || 0),
          voltage: hardwareMetrics?.voltage !== undefined
            ? hardwareMetrics.voltage
            : (dbDevice.voltage || 0),
          updated_at: hardwareMetrics?.timestamp || dbDevice.last_seen || Date.now(),
          latitude: hardwareMetrics?.latitude || dbDevice.latitude,
          longitude: hardwareMetrics?.longitude || dbDevice.longitude,
          history: powerMonitorNode?.[deviceId]?.history || {},
        };
      });

      const sortedDevices = synchronizedDevices.sort(
        (a, b) => safeTimeMillis(b.updated_at) - safeTimeMillis(a.updated_at)
      );

      setDevices(sortedDevices);
      setLoading(false);
    };

    const fetchAndSyncDevices = async () => {
      try {
        const { data: supabaseData } = await supabase
          .from("devices")
          .select("*");

        supabaseDataRef.current = supabaseData || [];

        firebaseListener = onValue(
          rootFirebaseRef,
          (snapshot) => {
            const liveHardwareTree = snapshot.val();
            lastPowerMonitorNodeRef.current = extractPowerMonitorNode(liveHardwareTree);
            hasConnectivityIssueRef.current = false;
            setError(null);
            buildAndSetDevices();
          },
          (fbErr) => {
            console.error("Firebase Read Error:", fbErr.message);
            hasConnectivityIssueRef.current = true;
            setError(fbErr.message);
            buildAndSetDevices();
          }
        );

        pollInterval = setInterval(buildAndSetDevices, 2000);
      } catch (err: any) {
        setError(String(err?.message || err));
        setLoading(false);
      }
    };

    fetchAndSyncDevices();

    return () => {
      if (firebaseListener) {
        off(rootFirebaseRef, "value", firebaseListener);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  return { devices, loading, error };
};

export const useUserDevices = (userId: string) => {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastPowerMonitorNodeRef = useRef<Record<string, any> | null>(null);
  const supabaseDataRef = useRef<any[]>([]);
  const hasConnectivityIssueRef = useRef<boolean>(false); 

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let firebaseListener: any;
    let pollInterval: any;
    const rootFirebaseRef = ref(firebaseDb, "/");

    const buildAndSetDevices = () => {
      const powerMonitorNode = lastPowerMonitorNodeRef.current;
      const supabaseData = supabaseDataRef.current;
      const hasConnectivityIssue = hasConnectivityIssueRef.current;

      if (powerMonitorNode) {
        const synchronizedDevices = supabaseData.map((dbDevice: any) => {
          const hardwareMetrics = powerMonitorNode[dbDevice.device_id]?.realtime || {};
          const connectionState = getDeviceConnectionState(hardwareMetrics, dbDevice.device_id, sharedHeartbeatTracker, undefined, hasConnectivityIssue);
          const isOnline = connectionState === 'online';

          return {
            ...dbDevice,
            id: dbDevice.device_id,
            isOnline,
            connectionState,
            status: hardwareMetrics.status !== undefined
                       ? Number(hardwareMetrics.status)
                       : Number(dbDevice.status),
            voltage: hardwareMetrics.voltage !== undefined ? hardwareMetrics.voltage : dbDevice.voltage,
            updated_at: hardwareMetrics.timestamp || dbDevice.last_seen || Date.now(),
            latitude: hardwareMetrics.latitude || dbDevice.latitude,
            longitude: hardwareMetrics.longitude || dbDevice.longitude,
            history: powerMonitorNode[dbDevice.device_id]?.history || {}, 
          };
        });

        const sortedDevices = synchronizedDevices.sort(
          (a, b) => safeTimeMillis(b.updated_at) - safeTimeMillis(a.updated_at)
        );
        setDevices(sortedDevices);
      } else {
        setDevices(supabaseData.map((d: any) => ({ ...d, id: d.device_id, isOnline: false, connectionState: hasConnectivityIssue ? 'checking' : 'offline', updated_at: d.last_seen })));
      }
      setLoading(false);
    };

    const fetchAndSyncDevices = async () => {
      try {
        const { data: supabaseData, error: dbError } = await supabase
          .from("devices")
          .select("*");

        if (dbError) throw dbError;

        if (supabaseData) {
          supabaseDataRef.current = supabaseData;

          firebaseListener = onValue(rootFirebaseRef, (snapshot) => {
            const liveHardwareTree = snapshot.val();
            lastPowerMonitorNodeRef.current = extractPowerMonitorNode(liveHardwareTree); 
            hasConnectivityIssueRef.current = false;
            setError(null);
            buildAndSetDevices();
          }, (fbErr) => {
            hasConnectivityIssueRef.current = true;
            setError(fbErr.message);
            buildAndSetDevices();
            setLoading(false);
          });

          pollInterval = setInterval(buildAndSetDevices, 2000);
        }
      } catch (err: any) {
        setError(String(err?.message || err));
        setLoading(false);
      }
    };

    fetchAndSyncDevices();

    return () => {
      if (firebaseListener) {
        off(rootFirebaseRef, "value", firebaseListener);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [userId]);

  return { devices, loading, error };
};

export const useDeviceEvents = (deviceId: string, limit: number = 5) => {
  const [events, setEvents] = useState<PowerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return;
    }

    const fetchInitialEvents = async () => {
      try {
        const response = await DeviceService.getDeviceEvents(deviceId, limit);
        if (response.success && response.data) {
          setEvents(response.data);
        } else {
          setError(response.error || "Failed to fetch events");
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchInitialEvents();

    const channel = supabase
      .channel(`live-events-${deviceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "events",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          setEvents((prev) =>
            [payload.new as PowerEvent, ...prev].slice(0, limit),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceId, limit]);

  return { events, loading, error };
};

export const useDeviceOutages = (deviceId: string, limit: number = 10) => {
  const [outages, setOutages] = useState<Outage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return;
    }

    const fetchOutages = async () => {
      try {
        const response = await DeviceService.getDeviceOutages(deviceId, limit);
        if (response.success && response.data) {
          setOutages(response.data);
        } else {
          setError(response.error || "Failed to fetch outages");
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchOutages();

    const channel = supabase
      .channel(`live-outages-${deviceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "outages",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setOutages((prev) =>
              [payload.new as Outage, ...prev].slice(0, limit),
            );
          } else if (payload.eventType === "UPDATE") {
            setOutages((prev) =>
              prev.map((o) =>
                o.id === payload.new.id ? (payload.new as Outage) : o,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceId, limit]);

  return { outages, loading, error };
};

export const useCommunities = () => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const response = await CommunityService.getCommunities();
        if (response.success && response.data) {
          setCommunities(response.data);
        } else {
          setError(response.error || "Failed to fetch communities");
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetch();

    const channel = supabase
      .channel("live-communities")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "communities" },
        () => {
          fetch(); 
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { communities, loading, error };
};

export const useCommunityStats = (communityId: string) => {
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!communityId) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const response = await CommunityService.getCommunityStats(communityId);
        if (response.success && response.data) {
          setStats(response.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    const channel = supabase
      .channel(`live-community-stats-${communityId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "devices",
          filter: `community_id=eq.${communityId}`,
        },
        () => {
          fetchStats();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [communityId]);

  return { stats, loading, error };
};

export const useInsights = (deviceId: string) => {
  const [insights, setInsights] = useState<InsightsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      try {
        const response = await AnalyticsService.getInsightsSummary(deviceId);
        if (response.success && response.data) {
          setInsights(response.data);
        } else {
          setError(response.error || "Failed to fetch insights");
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetch();

    const channel = supabase
      .channel(`live-insights-${deviceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "outages",
          filter: `device_id=eq.${deviceId}`,
        },
        () => {
          fetch();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceId]);

  return { insights, loading, error };
};

export const useDeviceStatusPolling = (
  deviceId: string,
  intervalMs: number = 30000,
) => {
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      try {
        const response = await DeviceService.getDevice(deviceId);
        if (response.success && response.data) {
          setDevice(response.data);
        } else {
          setError(response.error || "Failed to fetch device");
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetch();
    const interval = setInterval(fetch, intervalMs);

    return () => clearInterval(interval);
  }, [deviceId, intervalMs]);

  return { device, loading, error };
};