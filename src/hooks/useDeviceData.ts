/**
 * Custom Hooks for Data Fetching and Realtime Subscriptions
 * Hybrid Backend Upgrade: Static relationships from Supabase + Zero-Latency hardware stream from Firebase.
 */

import { useEffect, useState, useCallback } from "react";
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
 * Hook to fetch and subscribe to user devices with HYBRID backend integration.
 * Pulls structure from Supabase and syncs hardware variables live from Firebase's PowerMonitor node.
 */
export const useUserDevices = (userId: string) => {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let firebaseListener: any;
    const rootFirebaseRef = ref(firebaseDb, "/");

    const fetchAndSyncDevices = async () => {
      try {
        // 1. Fetch static structural assets (Metadata, Names, Base coordinates) from Supabase
        const { data: supabaseData, error: dbError } = await supabase
          .from("devices")
          .select("*");

        if (dbError) throw dbError;

        if (supabaseData) {
          // 2. Open a real-time stream subscription on the hardware guy's Firebase root node
          firebaseListener = onValue(rootFirebaseRef, (snapshot) => {
            const liveHardwareTree = snapshot.val();

            // Check if the tree exists AND if the PowerMonitor node exists
            if (liveHardwareTree && liveHardwareTree.PowerMonitor) {
              const powerMonitorNode = liveHardwareTree.PowerMonitor;

              // 3. Perform a relational join between local Supabase assets and incoming physical IoT signals
              const synchronizedDevices = supabaseData.map((dbDevice: any) => {
                const hardwareMetrics = powerMonitorNode[dbDevice.device_id]?.realtime || {};

                return {
                  ...dbDevice,
                  id: dbDevice.device_id,
                  
                  // THE FIX: Wrap both in Number() so it is strictly 1 or 0
                  status: hardwareMetrics.status !== undefined 
                           ? Number(hardwareMetrics.status) 
                           : Number(dbDevice.status),
                           
                  voltage: hardwareMetrics.voltage !== undefined ? hardwareMetrics.voltage : dbDevice.voltage,
                  updated_at: hardwareMetrics.timestamp || dbDevice.last_seen || Date.now(),
                  latitude: hardwareMetrics.latitude || dbDevice.latitude,
                  longitude: hardwareMetrics.longitude || dbDevice.longitude,
                };
              });

              // Sort by operational timing so active alerts contextually float to the peak
              const sortedDevices = synchronizedDevices.sort(
                (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
              );
              setDevices(sortedDevices);
            } else {
              // Fallback to purely Supabase data if the Firebase node goes missing
              setDevices(supabaseData.map(d => ({ ...d, id: d.device_id, updated_at: d.last_seen })));
            }
            setLoading(false);
          }, (fbErr) => {
            console.error("Firebase continuous pipe error:", fbErr);
            setError(fbErr.message);
            setLoading(false);
          });
        }
      } catch (err) {
        console.error("Error setting up hybrid engine hooks:", err);
        setError(String(err));
        setLoading(false);
      }
    };

    fetchAndSyncDevices();

    // Clean up persistent hardware channel streams when component layout tears down
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