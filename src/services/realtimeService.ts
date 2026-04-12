/**
 * Real-Time Subscription Service
 * Manages Supabase Realtime subscriptions for real-time device and event updates
 */

import supabase from "../config/supabase";
import {
  RealtimePayload,
  PowerEvent,
  Outage,
  Device,
  DeviceStatusUpdate,
} from "../types";

export type RealtimeCallback<T> = (payload: RealtimePayload<T>) => void;

/**
 * Manages all real-time subscriptions for the app
 */
export class RealtimeService {
  private static eventSubscriptions: Map<string, any> = new Map();
  private static errorCallbacks: Map<string, Function> = new Map();

  /**
   * Subscribe to power events for a specific device
   * Fires whenever the events table is modified
   */
  static subscribeToDeviceEvents(
    deviceId: string,
    onUpdate: RealtimeCallback<PowerEvent>,
  ): string {
    const subscriptionId = `events-${deviceId}-${Date.now()}`;

    // Unsubscribe if already exists
    this.unsubscribe(subscriptionId);

    const channel = supabase
      .channel(`events:device_id=eq.${deviceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload: any) => {
          onUpdate(payload);
        },
      )
      .subscribe();

    this.eventSubscriptions.set(subscriptionId, channel);
    return subscriptionId;
  }

  /**
   * Subscribe to all events for current user's devices
   */
  static subscribeToUserEvents(
    userId: string,
    onUpdate: RealtimeCallback<PowerEvent>,
  ): string {
    const subscriptionId = `user-events-${userId}-${Date.now()}`;

    // Unsubscribe if already exists
    this.unsubscribe(subscriptionId);

    const channel = supabase
      .channel(`user-events:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
        },
        (payload: any) => {
          onUpdate(payload);
        },
      )
      .subscribe();

    this.eventSubscriptions.set(subscriptionId, channel);
    return subscriptionId;
  }

  /**
   * Subscribe to device status changes
   */
  static subscribeToDeviceStatus(
    deviceId: string,
    onUpdate: RealtimeCallback<Device>,
  ): string {
    const subscriptionId = `device-status-${deviceId}-${Date.now()}`;

    // Unsubscribe if already exists
    this.unsubscribe(subscriptionId);

    const channel = supabase
      .channel(`devices:id=eq.${deviceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "devices",
          filter: `id=eq.${deviceId}`,
        },
        (payload: any) => {
          onUpdate(payload);
        },
      )
      .subscribe();

    this.eventSubscriptions.set(subscriptionId, channel);
    return subscriptionId;
  }

  /**
   * Subscribe to all devices for a user
   */
  static subscribeToUserDevices(
    userId: string,
    onUpdate: RealtimeCallback<Device>,
  ): string {
    const subscriptionId = `user-devices-${userId}-${Date.now()}`;

    // Unsubscribe if already exists
    this.unsubscribe(subscriptionId);

    const channel = supabase
      .channel(`user-devices:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "devices",
        },
        (payload: any) => {
          onUpdate(payload);
        },
      )
      .subscribe();

    this.eventSubscriptions.set(subscriptionId, channel);
    return subscriptionId;
  }

  /**
   * Subscribe to outage records
   */
  static subscribeToOutages(
    deviceId: string,
    onUpdate: RealtimeCallback<Outage>,
  ): string {
    const subscriptionId = `outages-${deviceId}-${Date.now()}`;

    // Unsubscribe if already exists
    this.unsubscribe(subscriptionId);

    const channel = supabase
      .channel(`outages:device_id=eq.${deviceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "outages",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload: any) => {
          onUpdate(payload);
        },
      )
      .subscribe();

    this.eventSubscriptions.set(subscriptionId, channel);
    return subscriptionId;
  }

  /**
   * Subscribe to community updates
   */
  static subscribeToCommunityDevices(
    communityId: string,
    onUpdate: RealtimeCallback<Device>,
  ): string {
    const subscriptionId = `community-devices-${communityId}-${Date.now()}`;

    // Unsubscribe if already exists
    this.unsubscribe(subscriptionId);

    const channel = supabase
      .channel(`community-devices:${communityId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "devices",
          filter: `community_id=eq.${communityId}`,
        },
        (payload: any) => {
          onUpdate(payload);
        },
      )
      .subscribe();

    this.eventSubscriptions.set(subscriptionId, channel);
    return subscriptionId;
  }

  /**
   * Unsubscribe from a specific subscription
   */
  static unsubscribe(subscriptionId: string): void {
    const subscription = this.eventSubscriptions.get(subscriptionId);
    if (subscription) {
      supabase.removeChannel(subscription);
      this.eventSubscriptions.delete(subscriptionId);
      this.errorCallbacks.delete(subscriptionId);
    }
  }

  /**
   * Unsubscribe from all subscriptions
   */
  static unsubscribeAll(): void {
    this.eventSubscriptions.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.eventSubscriptions.clear();
    this.errorCallbacks.clear();
  }

  /**
   * Register error callback for a subscription
   */
  static onError(
    subscriptionId: string,
    callback: (error: Error) => void,
  ): void {
    this.errorCallbacks.set(subscriptionId, callback);
  }

  /**
   * Get subscription status
   */
  static isSubscribed(subscriptionId: string): boolean {
    return this.eventSubscriptions.has(subscriptionId);
  }

  /**
   * Get total active subscriptions
   */
  static getActiveSubscriptionCount(): number {
    return this.eventSubscriptions.size;
  }
}

export default RealtimeService;
