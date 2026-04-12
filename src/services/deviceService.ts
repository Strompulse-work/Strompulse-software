/**
 * Device and Data Service
 * Handles all device queries, event history, and analytics from Supabase
 */

import supabase from "../config/supabase";
import {
  Device,
  Outage,
  PowerEvent,
  Community,
  CommunityStats,
  DailyStats,
  ApiResponse,
} from "../types";

export class DeviceService {
  /**
   * Get all devices for current user
   */
  static async getUserDevices(userId: string): Promise<ApiResponse<Device[]>> {
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("owner_user_id", userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get single device details
   */
  static async getDevice(deviceId: string): Promise<ApiResponse<Device>> {
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("id", deviceId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get devices for a community
   */
  static async getCommunityDevices(
    communityId: string,
  ): Promise<ApiResponse<Device[]>> {
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("community_id", communityId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get event history for a device (last N events)
   */
  static async getDeviceEvents(
    deviceId: string,
    limit: number = 100,
  ): Promise<ApiResponse<PowerEvent[]>> {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("device_id", deviceId)
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get recent outages for a device
   */
  static async getDeviceOutages(
    deviceId: string,
    limit: number = 10,
  ): Promise<ApiResponse<Outage[]>> {
    try {
      const { data, error } = await supabase
        .from("outages")
        .select("*")
        .eq("device_id", deviceId)
        .order("started_at", { ascending: false })
        .limit(limit);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get active (ongoing) outages for a device
   */
  static async getActiveOutages(
    deviceId: string,
  ): Promise<ApiResponse<Outage[]>> {
    try {
      const { data, error } = await supabase
        .from("outages")
        .select("*")
        .eq("device_id", deviceId)
        .eq("is_active", true);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Create a new outage record (called by backend, but available here for admin)
   */
  static async createOutage(
    deviceId: string,
    startedAt: string,
  ): Promise<ApiResponse<Outage>> {
    try {
      const { data, error } = await supabase.from("outages").insert({
        device_id: deviceId,
        started_at: startedAt,
        duration_minutes: 0,
        is_active: true,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data?.[0] };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Update device status
   */
  static async updateDeviceStatus(
    deviceId: string,
    status: "ON" | "OFF" | "OFFLINE",
  ): Promise<ApiResponse<Device>> {
    try {
      const { data, error } = await supabase
        .from("devices")
        .update({
          status,
          last_seen: new Date().toISOString(),
        })
        .eq("id", deviceId)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Search devices by address or device ID
   */
  static async searchDevices(query: string): Promise<ApiResponse<Device[]>> {
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .or(`address.ilike.%${query}%,device_id.ilike.%${query}%`);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

export class CommunityService {
  /**
   * Get all communities
   */
  static async getCommunities(): Promise<ApiResponse<Community[]>> {
    try {
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .order("name");

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get single community details
   */
  static async getCommunity(
    communityId: string,
  ): Promise<ApiResponse<Community>> {
    try {
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .eq("id", communityId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get community statistics
   * Should ideally be a Supabase function for performance
   */
  static async getCommunityStats(
    communityId: string,
  ): Promise<ApiResponse<CommunityStats>> {
    try {
      // Get all devices for community
      const { data: devices, error: devicesError } = await supabase
        .from("devices")
        .select("*")
        .eq("community_id", communityId);

      if (devicesError) {
        return { success: false, error: devicesError.message };
      }

      const totalDevices = devices?.length || 0;
      const devicesOnline =
        devices?.filter((d) => d.status === "ON").length || 0;
      const devicesOffline =
        devices?.filter((d) => d.status === "OFFLINE").length || 0;

      // Get active outages
      const { data: outages, error: outagesError } = await supabase
        .from("outages")
        .select("*")
        .in("device_id", devices?.map((d) => d.id) || []);

      if (outagesError) {
        throw outagesError;
      }

      const currentOutageCount =
        outages?.filter((o) => o.is_active).length || 0;
      const totalOutageMinutes =
        outages?.reduce((sum, o) => sum + (o.duration_minutes || 0), 0) || 0;

      const uptime =
        totalDevices > 0
          ? ((totalDevices - devicesOffline) / totalDevices) * 100
          : 100;

      const avgOutageDuration =
        (outages?.length || 0) > 0 ? totalOutageMinutes / outages!.length : 0;

      return {
        success: true,
        data: {
          community_id: communityId,
          total_devices: totalDevices,
          devices_online: devicesOnline,
          devices_offline: devicesOffline,
          current_outage_count: currentOutageCount,
          uptime_percentage: Math.round(uptime * 10) / 10,
          avg_outage_duration_minutes: Math.round(avgOutageDuration * 10) / 10,
          status_indicator:
            uptime >= 95 ? "healthy" : uptime >= 85 ? "warning" : "critical",
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get communities for community admin user
   */
  static async getAdminCommunities(
    userId: string,
  ): Promise<ApiResponse<Community[]>> {
    try {
      // This assumes a many-to-many relationship between admins and communities
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .eq("admin_id", userId); // Adjust based on your schema

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

export class AnalyticsService {
  /**
   * Get daily statistics for a device
   */
  static async getDailyStats(
    deviceId: string,
    startDate: string,
    endDate: string,
  ): Promise<ApiResponse<DailyStats[]>> {
    try {
      const { data, error } = await supabase
        .from("daily_stats")
        .select("*")
        .eq("device_id", deviceId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get week statistics (aggregated)
   */
  static async getWeeklyStats(deviceId: string): Promise<ApiResponse<any>> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const { data: events, error } = await supabase
        .from("events")
        .select("*")
        .eq("device_id", deviceId)
        .gte("timestamp", startDate.toISOString())
        .lte("timestamp", endDate.toISOString());

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: events };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get month statistics
   */
  static async getMonthlyStats(deviceId: string): Promise<ApiResponse<any>> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const { data: events, error } = await supabase
        .from("events")
        .select("*")
        .eq("device_id", deviceId)
        .gte("timestamp", startDate.toISOString())
        .lte("timestamp", endDate.toISOString());

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: events };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Calculate insights summary for a device
   */
  static async getInsightsSummary(deviceId: string): Promise<ApiResponse<any>> {
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const { data: outages, error: outagesError } = await supabase
        .from("outages")
        .select("*")
        .eq("device_id", deviceId)
        .gte("started_at", weekAgo.toISOString());

      if (outagesError) throw outagesError;

      const weekOutageHours =
        (outages || []).reduce((sum, o) => sum + (o.duration_minutes || 0), 0) /
        60;

      const longestOutage = Math.max(
        ...(outages || []).map((o) => o.duration_minutes || 0),
        0,
      );

      const avgUptime = 100 - ((weekOutageHours * 60) / (7 * 24 * 60)) * 100;
      const stabilityScore = Math.max(0, Math.min(100, Math.round(avgUptime)));

      return {
        success: true,
        data: {
          week_total_outage_hours: Math.round(weekOutageHours * 10) / 10,
          longest_outage_minutes: longestOutage,
          avg_daily_uptime_percentage: Math.round(avgUptime * 10) / 10,
          stability_score: stabilityScore,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

export default {
  DeviceService,
  CommunityService,
  AnalyticsService,
};
