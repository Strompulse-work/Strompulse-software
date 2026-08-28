/**
 * Custom Hooks for Data Fetching and Realtime Subscriptions
 * Hybrid Backend Upgrade: Static relationships from Supabase + Zero-Latency hardware stream from Firebase.
 * Includes Real-Time Heartbeat Logic for Online/Offline Status.
 *
 * FIXES APPLIED (see inline comments marked FIX:):
 * 1. Firebase root path corrected — devices (STROM006, STROM007, ...) live directly
 *    at the database root, NOT under a "PowerMonitor" node. The old code checked
 *    liveHardwareTree.PowerMonitor, which is always undefined, so every device
 *    silently fell back to stale Supabase-only data with isOnline forced to false.
 * 2. Heartbeat threshold changed from 60s to 180s to match the actual spec
 *    (device pings ~every 30s, treat as offline after 180s of silence).
 * 3. Sorting now parses the STROM timestamp format instead of calling
 *    `new Date(rawString)` directly, which returned Invalid Date (NaN) and
 *    produced an unreliable sort order.
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
// STROM DEVICE HEARTBEAT UTILITIES
// ============================================================================

const STROM_OFFLINE_THRESHOLD_SECONDS = 180; // FIX: was scattered as 60 at call sites

// FIX: the hardware writes its timestamp in WAT (Nigeria time, UTC+1, no DST)
// regardless of what timezone the phone/server running this code is set to.
// Confirmed from a live device: Firebase timestamp read 21:19:43 WAT while
// the reading machine's clock showed 20:18 — a ~61 minute gap, i.e. exactly
// the WAT offset. That gap alone was enough to push every device past the
// 180s offline threshold, so a perfectly live device reported "Power Outage".
const STROM_DEVICE_UTC_OFFSET_MINUTES = 60; // WAT = UTC+1

/**
 * Parses STROM DDMMYYYYHHMMSS timestamp string into a JavaScript Date object.
 *
 * IMPORTANT: uses Date.UTC() and then subtracts the WAT offset, so the
 * result is a correct absolute instant NO MATTER what timezone the runtime
 * (phone, dev machine, server) itself is set to. The previous version used
 * `new Date(y, m, d, h, mi, s)`, which silently interprets those numbers as
 * local time of whatever machine runs the code — correct only by accident
 * when that machine happens to be set to WAT, and wrong (by the exact
 * zone gap) everywhere else. That was the root cause of the false
 * "Power Outage" reading on a live device.
 */
export const parseStromTimestamp = (tsStr: string | number | undefined): Date | null => {
  if (!tsStr) return null;
  const str = String(tsStr);

  // Handle STROM DDMMYYYYHHMMSS format (14 digits)
  if (str.length === 14 && /^\d+$/.test(str)) {
    const day = parseInt(str.substring(0, 2), 10);
    const month = parseInt(str.substring(2, 4), 10) - 1; // JS Months are 0-indexed
    const year = parseInt(str.substring(4, 8), 10);
    const hours = parseInt(str.substring(8, 10), 10);
    const minutes = parseInt(str.substring(10, 12), 10);
    const seconds = parseInt(str.substring(12, 14), 10);

    // Treat (year, month, day, hours, minutes, seconds) as WAT wall-clock
    // time, then convert to the true UTC instant it represents.
    const utcMillis =
      Date.UTC(year, month, day, hours, minutes, seconds) -
      STROM_DEVICE_UTC_OFFSET_MINUTES * 60 * 1000;

    const parsed = new Date(utcMillis);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Fallback for standard ISO or standard date formats
  const fallbackDate = new Date(str);
  return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
};

/**
 * Calculates a STROM device's connection state: 'online' | 'offline' | 'checking'.
 *
 * 'checking' covers the ~60s warm-up window on the fallback path (no
 * serverReceivedAt yet) where we've seen at most one change and can't yet
 * tell a genuine live device from a one-off touch. Use this three-state
 * result to show a neutral "Checking…" UI during warm-up instead of a
 * false "Power Outage", while still resolving to a definite online/offline
 * once confirmed (or once the grace window expires with no confirmation).
 *
 * FIX (v6): see prior notes — prefers the Cloud-Function-stamped
 * `serverReceivedAt` (instant, no warm-up needed) and only falls back to
 * change-counting when that field isn't present yet.
 */
export type ConnectionState = 'online' | 'offline' | 'checking';

export type HeartbeatTracker = Record<
  string,
  { rawTimestamp: string; lastChangeAt: number; consecutiveGenuineChanges: number; firstSeenAt: number }
>;

const MIN_PLAUSIBLE_GAP_SECONDS = 10; // fallback path only
const REQUIRED_CONSECUTIVE_CHANGES = 2; // fallback path only
const CHECKING_GRACE_SECONDS = 90; // fallback path only — how long to show "checking" before giving up and calling it offline

export const getDeviceConnectionState = (
  hardwareMetrics: any,
  deviceId: string,
  tracker: HeartbeatTracker,
  thresholdSeconds: number = STROM_OFFLINE_THRESHOLD_SECONDS
): ConnectionState => {
  if (!hardwareMetrics) return 'offline';

  // 1. Device must report status as "1" (Active)
  const rawStatus = String(hardwareMetrics.status).trim();
  const reportedActive =
    rawStatus === "1" ||
    rawStatus.toLowerCase() === "true" ||
    rawStatus.toLowerCase() === "on";

  if (!reportedActive) return 'offline';

  // 2a. PREFERRED PATH: authoritative server timestamp, stamped by the
  // Cloud Function. Correct and instant on a single read — no warm-up.
  if (typeof hardwareMetrics.serverReceivedAt === "number") {
    const secondsSinceServerWrite = (Date.now() - hardwareMetrics.serverReceivedAt) / 1000;
    return secondsSinceServerWrite <= thresholdSeconds ? 'online' : 'offline';
  }

  // 2b. FALLBACK PATH: no serverReceivedAt yet — change-counting with a
  // 'checking' state during the confirmation window instead of a false
  // 'offline'.
  const rawTimestamp = hardwareMetrics.timestamp;
  if (!rawTimestamp) return 'offline';
  const tsString = String(rawTimestamp);

  const now = Date.now();
  const prev = tracker[deviceId];

  if (!prev) {
    tracker[deviceId] = { rawTimestamp: tsString, lastChangeAt: now, consecutiveGenuineChanges: 0, firstSeenAt: now };
    return 'checking';
  }

  let streak = prev.consecutiveGenuineChanges;
  let lastChangeAt = prev.lastChangeAt;

  if (prev.rawTimestamp !== tsString) {
    const gap = (now - prev.lastChangeAt) / 1000;
    const plausible = gap >= MIN_PLAUSIBLE_GAP_SECONDS && gap <= thresholdSeconds;
    streak = plausible ? prev.consecutiveGenuineChanges + 1 : 0;
    lastChangeAt = now;
  }

  tracker[deviceId] = { rawTimestamp: tsString, lastChangeAt, consecutiveGenuineChanges: streak, firstSeenAt: prev.firstSeenAt };

  if (streak >= REQUIRED_CONSECUTIVE_CHANGES) {
    const secondsSinceChange = (now - lastChangeAt) / 1000;
    return secondsSinceChange <= thresholdSeconds ? 'online' : 'offline';
  }

  // Not yet confirmed — show 'checking' until the grace window runs out,
  // then give up and call it offline rather than checking forever.
  const secondsSinceFirstSeen = (now - prev.firstSeenAt) / 1000;
  return secondsSinceFirstSeen <= CHECKING_GRACE_SECONDS ? 'checking' : 'offline';
};

/**
 * Back-compat boolean wrapper — 'checking' counts as not-yet-online here,
 * for any call site that hasn't been updated to use the 3-state version.
 */
export const checkIsDeviceOnline = (
  hardwareMetrics: any,
  deviceId: string,
  tracker: HeartbeatTracker,
  thresholdSeconds: number = STROM_OFFLINE_THRESHOLD_SECONDS
): boolean => {
  return getDeviceConnectionState(hardwareMetrics, deviceId, tracker, thresholdSeconds) === 'online';
};

/**
 * FIX: SHARED across every screen — module-level, not per-hook-instance.
 * Before this, ElectricityScreen and CommunityZonesScreen each called
 * useAllGridDevices() independently, and each got its OWN private
 * tracker via useRef. That meant a device already confirmed online on
 * the Communities list would reset back to "checking"/"offline" the
 * moment you navigated into its detail screen, which mounts a fresh
 * hook instance with empty tracker state. Declaring this once at module
 * scope means every screen reads and writes the SAME record for a given
 * device, so a confirmation made on one screen is immediately visible
 * on every other screen — no re-confirmation, no inconsistency.
 */
const sharedHeartbeatTracker: HeartbeatTracker = {};

/**
 * FIX: safe millis extraction for sorting — handles both the raw STROM
 * timestamp string and any ISO/epoch fallback value without ever returning NaN.
 */
const safeTimeMillis = (value: any): number => {
  const parsed = parseStromTimestamp(value);
  return parsed ? parsed.getTime() : 0;
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Generic async hook for one-off data fetching
 */
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

/**
 * FIX: Extracts the map of { deviceId: { realtime, history, ... } } from the
 * raw Firebase root snapshot. Devices live directly at the root (STROM006,
 * STROM007, STROM008, ...) — there is no "PowerMonitor" wrapper node. We
 * still check for a PowerMonitor node first for backward compatibility in
 * case that structure is reintroduced later, but default to treating the
 * root itself as the device map, filtered to keys that look like device IDs.
 */
const extractPowerMonitorNode = (liveHardwareTree: any): Record<string, any> | null => {
  if (!liveHardwareTree) return null;

  if (liveHardwareTree.PowerMonitor) {
    return liveHardwareTree.PowerMonitor;
  }

  // Root-level device map (matches actual current DB structure: STROM006, STROM007, ...)
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

/**
 * Hook to fetch all grid devices globally.
 * Bypasses user-specific restrictions and pulls everything directly from the Firebase stream.
 */
export const useAllGridDevices = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // FIX: uses the module-level sharedHeartbeatTracker, not a private
  // per-instance ref — see note above sharedHeartbeatTracker's declaration.

  useEffect(() => {
    let firebaseListener: any;
    const rootFirebaseRef = ref(firebaseDb, "/");

    const fetchAndSyncDevices = async () => {
      try {
        // 1. Fetch static structural assets from Supabase (optional metadata layer)
        const { data: supabaseData, error: dbError } = await supabase
          .from("devices")
          .select("*");

        if (dbError) console.warn("Supabase metadata fetch issue, relying on Firebase stream:", dbError);

        // 2. Open a real-time stream subscription on the hardware Firebase root node
        firebaseListener = onValue(rootFirebaseRef, (snapshot) => {
          const liveHardwareTree = snapshot.val();
          const powerMonitorNode = extractPowerMonitorNode(liveHardwareTree); // FIX

          if (powerMonitorNode) {
            // 3. Dynamically map ALL hardware IDs currently transmitting in Firebase
            const deviceIds = Object.keys(powerMonitorNode);

            const synchronizedDevices = deviceIds.map((deviceId) => {
              const hardwareMetrics = powerMonitorNode[deviceId]?.realtime || {};
              const dbDevice = (supabaseData || []).find((d: any) => d.device_id === deviceId) || {};

              // 4. Compute connection state using OUR clock, not the device's.
              // Exposes both the new 3-state field (for screens that want a
              // "Checking…" UI) and the old boolean (for anything that isn't
              // updated yet) — isOnline stays false during 'checking', so
              // nothing breaks for screens not yet using connectionState.
              const connectionState = getDeviceConnectionState(hardwareMetrics, deviceId, sharedHeartbeatTracker); // FIX
              const isOnline = connectionState === 'online';

              return {
                ...dbDevice,
                id: deviceId,
                isOnline, // Computed property injected directly into device object
                connectionState, // 'online' | 'offline' | 'checking'
                status: hardwareMetrics.status !== undefined
                           ? Number(hardwareMetrics.status)
                           : Number(dbDevice.status || 0),
                voltage: hardwareMetrics.voltage !== undefined ? hardwareMetrics.voltage : (dbDevice.voltage || 0),
                updated_at: hardwareMetrics.timestamp || dbDevice.last_seen || Date.now(),
                latitude: hardwareMetrics.latitude || dbDevice.latitude,
                longitude: hardwareMetrics.longitude || dbDevice.longitude,
              };
            });

            // FIX: sort using safeTimeMillis instead of new Date(rawString).getTime()
            const sortedDevices = synchronizedDevices.sort(
              (a, b) => safeTimeMillis(b.updated_at) - safeTimeMillis(a.updated_at)
            );

            setDevices(sortedDevices);
          } else {
            setDevices((supabaseData || []).map((d: any) => ({ ...d, id: d.device_id, isOnline: false, updated_at: d.last_seen })));
          }
          setLoading(false);
        }, (fbErr) => {
          console.error("Firebase continuous pipe error:", fbErr);
          setError(fbErr.message);
          setLoading(false);
        });
      } catch (err: any) {
        console.error("❌ Error setting up global hybrid engine hooks!");
        setError(String(err?.message || err));
        setLoading(false);
      }
    };

    fetchAndSyncDevices();

    return () => {
      if (firebaseListener) {
        off(rootFirebaseRef, "value", firebaseListener);
      }
    };
  }, []);

  return { devices, loading, error };
};

/**
 * Hook to fetch and subscribe to user devices with HYBRID backend integration.
 */
export const useUserDevices = (userId: string) => {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // FIX: shares sharedHeartbeatTracker with useAllGridDevices — same device
  // seen from either hook is judged by the same confirmation history.

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let firebaseListener: any;
    const rootFirebaseRef = ref(firebaseDb, "/");

    const fetchAndSyncDevices = async () => {
      try {
        const { data: supabaseData, error: dbError } = await supabase
          .from("devices")
          .select("*");

        if (dbError) throw dbError;

        if (supabaseData) {
          firebaseListener = onValue(rootFirebaseRef, (snapshot) => {
            const liveHardwareTree = snapshot.val();
            const powerMonitorNode = extractPowerMonitorNode(liveHardwareTree); // FIX

            if (powerMonitorNode) {
              const synchronizedDevices = supabaseData.map((dbDevice: any) => {
                const hardwareMetrics = powerMonitorNode[dbDevice.device_id]?.realtime || {};

                // Compute connection state using OUR clock, not the device's.
                const connectionState = getDeviceConnectionState(hardwareMetrics, dbDevice.device_id, sharedHeartbeatTracker); // FIX
                const isOnline = connectionState === 'online';

                return {
                  ...dbDevice,
                  id: dbDevice.device_id,
                  isOnline, // Computed property
                  connectionState, // 'online' | 'offline' | 'checking'
                  status: hardwareMetrics.status !== undefined
                             ? Number(hardwareMetrics.status)
                             : Number(dbDevice.status),
                  voltage: hardwareMetrics.voltage !== undefined ? hardwareMetrics.voltage : dbDevice.voltage,
                  updated_at: hardwareMetrics.timestamp || dbDevice.last_seen || Date.now(),
                  latitude: hardwareMetrics.latitude || dbDevice.latitude,
                  longitude: hardwareMetrics.longitude || dbDevice.longitude,
                };
              });

              // FIX: sort using safeTimeMillis instead of new Date(rawString).getTime()
              const sortedDevices = synchronizedDevices.sort(
                (a, b) => safeTimeMillis(b.updated_at) - safeTimeMillis(a.updated_at)
              );
              setDevices(sortedDevices);
            } else {
              setDevices(supabaseData.map(d => ({ ...d, id: d.device_id, isOnline: false, updated_at: d.last_seen })));
            }
            setLoading(false);
          }, (fbErr) => {
            console.error("Firebase continuous pipe error:", fbErr);
            setError(fbErr.message);
            setLoading(false);
          });
        }
      } catch (err: any) {
        console.error("❌ Error setting up hybrid engine hooks!");
        setError(String(err?.message || err));
        setLoading(false);
      }
    };

    fetchAndSyncDevices();

    return () => {
      if (firebaseListener) {
        off(rootFirebaseRef, "value", firebaseListener);
      }
    };
  }, [userId]);

  return { devices, loading, error };
};

/**
 * Hook to fetch and subscribe to device events (Raw ON/OFF logs)
 */
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

/**
 * Hook to fetch outages and update in real-time
 */
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

/**
 * Hook to fetch all communities (Auto-updates when new communities are added)
 */
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
          fetch(); // Refetch the list when a new community is created/updated
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { communities, loading, error };
};

/**
 * Hook to fetch community statistics (Auto-recalculates when a device in the community changes)
 */
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

    // Trigger a backend stats recalculation whenever a device inside THIS community changes status
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

/**
 * Hook to fetch insights/analytics for a device.
 * Refetches if an outage record updates (e.g., duration changes).
 */
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

    // Update insights if any outages for this device change
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

/**
 * Hook for polling device status at intervals (Fallback mechanism)
 */
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