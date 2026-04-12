/**
 * Custom Hooks for Data Fetching and Realtime Subscriptions
 * Provides reusable logic for screens
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
import RealtimeService from "../services/realtimeService";

interface UseAsyncState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

/**
 * Generic async hook for data fetching
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
 * Hook to fetch and subscribe to user devices with real-time updates
 */
export const useUserDevices = (userId: string) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionIds = useRef<string[]>([]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchAndSubscribe = async () => {
      try {
        // Fetch initial data
        const response = await DeviceService.getUserDevices(userId);

        if (response.success && response.data) {
          setDevices(response.data);

          // Wrap subscriptions in a try/catch so channel collisions don't crash the UI
          try {
            response.data.forEach((device) => {
              const subId = RealtimeService.subscribeToDeviceStatus(
                device.id,
                (payload) => {
                  if (payload.new) {
                    setDevices((prev) =>
                      prev.map((d) =>
                        d.id === payload.new.id ? payload.new : d,
                      ),
                    );
                  }
                },
              );
              subscriptionIds.current.push(subId);
            });

            const userDevicesSub = RealtimeService.subscribeToUserDevices(
              userId,
              (payload) => {
                if (payload.eventType === "INSERT" && payload.new) {
                  setDevices((prev) => [...prev, payload.new]);
                } else if (payload.eventType === "DELETE" && payload.old?.id) {
                  setDevices((prev) =>
                    prev.filter((d) => d.id !== payload.old?.id),
                  );
                }
              },
            );
            subscriptionIds.current.push(userDevicesSub);
          } catch (subErr) {
            console.warn(
              "Realtime channel already active on another screen, skipping duplicate subscription.",
            );
          }
        } else {
          setError(response.error || "Failed to fetch devices");
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchAndSubscribe();

    return () => {
      subscriptionIds.current.forEach((id) => RealtimeService.unsubscribe(id));
    };
  }, [userId]);

  return { devices, loading, error };
};
/**
 * Hook to fetch and subscribe to device events with real-time updates
 */
export const useDeviceEvents = (deviceId: string, limit: number = 5) => {
  const [events, setEvents] = useState<PowerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionId = useRef<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return;
    }

    const fetchAndSubscribe = async () => {
      try {
        // Fetch initial events
        const response = await DeviceService.getDeviceEvents(deviceId, limit);
        if (response.success && response.data) {
          setEvents(response.data);

          // Subscribe to new events
          subscriptionId.current = RealtimeService.subscribeToDeviceEvents(
            deviceId,
            (payload) => {
              if (payload.eventType === "INSERT" && payload.new) {
                setEvents((prev) => [payload.new, ...prev].slice(0, limit));
              }
            },
          );
        } else {
          setError(response.error || "Failed to fetch events");
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchAndSubscribe();

    return () => {
      if (subscriptionId.current) {
        RealtimeService.unsubscribe(subscriptionId.current);
      }
    };
  }, [deviceId, limit]);

  return { events, loading, error };
};

/**
 * Hook to fetch outages for a device
 */
export const useDeviceOutages = (deviceId: string, limit: number = 10) => {
  const [outages, setOutages] = useState<Outage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionId = useRef<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return;
    }

    const fetchAndSubscribe = async () => {
      try {
        const response = await DeviceService.getDeviceOutages(deviceId, limit);
        if (response.success && response.data) {
          setOutages(response.data);

          subscriptionId.current = RealtimeService.subscribeToOutages(
            deviceId,
            (payload) => {
              if (payload.eventType === "INSERT" && payload.new) {
                setOutages((prev) => [payload.new, ...prev].slice(0, limit));
              } else if (payload.eventType === "UPDATE" && payload.new) {
                setOutages((prev) =>
                  prev.map((o) => (o.id === payload.new.id ? payload.new : o)),
                );
              }
            },
          );
        } else {
          setError(response.error || "Failed to fetch outages");
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchAndSubscribe();

    return () => {
      if (subscriptionId.current) {
        RealtimeService.unsubscribe(subscriptionId.current);
      }
    };
  }, [deviceId, limit]);

  return { outages, loading, error };
};

/**
 * Hook to fetch all communities
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
  }, []);

  return { communities, loading, error };
};

/**
 * Hook to fetch community statistics with real-time updates
 */
export const useCommunityStats = (communityId: string) => {
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionIds = useRef<string[]>([]);

  useEffect(() => {
    if (!communityId) {
      setLoading(false);
      return;
    }

    const fetchAndSubscribe = async () => {
      try {
        const response = await CommunityService.getCommunityStats(communityId);
        if (response.success && response.data) {
          setStats(response.data);

          // Subscribe to device changes in community
          const subId = RealtimeService.subscribeToCommunityDevices(
            communityId,
            (payload) => {
              // Refetch stats when devices change
              CommunityService.getCommunityStats(communityId).then((res) => {
                if (res.success) {
                  setStats(res.data || null);
                }
              });
            },
          );
          subscriptionIds.current.push(subId);
        } else {
          setError(response.error || "Failed to fetch stats");
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchAndSubscribe();

    return () => {
      subscriptionIds.current.forEach((id) => RealtimeService.unsubscribe(id));
    };
  }, [communityId]);

  return { stats, loading, error };
};

/**
 * Hook to fetch insights/analytics for a device
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

    // Refetch every 5 minutes
    const interval = setInterval(fetch, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [deviceId]);

  return { insights, loading, error };
};

/**
 * Hook for polling device status at intervals
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
