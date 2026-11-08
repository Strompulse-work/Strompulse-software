/**
 * Supabase Client Configuration
 * Production-ready setup for Supabase integration with Expo
 */

import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";

// IMPORTANT: Replace these with your actual Supabase credentials
// Get them from: https://app.supabase.com/project/_/settings/api
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://evfstgmzwdhtwqogaknp.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2ZnN0Z216d2RodHdxb2dha25wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5Nzk5NDEsImV4cCI6MjA5MTU1NTk0MX0.caxip8jdoqzunbZcLx6Eb5KHIWETjITbsroYEpbP59I";

/**
 * SecureStore can only hold ~2048 bytes per value. A Supabase session is often larger,
 * which can silently fail to save and log users out. Here, large values are split into chunks.
 */
const CHUNK_SIZE = 1800;
const chunkCountKey = (key: string) => `${key}__chunks`;
const chunkKey = (key: string, i: number) => `${key}__${i}`;

const storage = {
  getItem: async (key: string) => {
    try {
      const count = await SecureStore.getItemAsync(chunkCountKey(key));
      if (!count) return await SecureStore.getItemAsync(key); // older, un-chunked value
      const parts: string[] = [];
      for (let i = 0; i < parseInt(count, 10); i++) {
        const part = await SecureStore.getItemAsync(chunkKey(key, i));
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join("");
    } catch (error) {
      console.error("Error retrieving item from secure store:", error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await storage.removeItem(key);
      const count = Math.ceil(value.length / CHUNK_SIZE);
      for (let i = 0; i < count; i++) {
        await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
      }
      await SecureStore.setItemAsync(chunkCountKey(key), String(count));
    } catch (error) {
      console.error("Error saving item to secure store:", error);
    }
  },
  removeItem: async (key: string) => {
    try {
      const count = await SecureStore.getItemAsync(chunkCountKey(key));
      if (count) {
        for (let i = 0; i < parseInt(count, 10); i++) await SecureStore.deleteItemAsync(chunkKey(key, i));
        await SecureStore.deleteItemAsync(chunkCountKey(key));
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error("Error removing item from secure store:", error);
    }
  },
};

/**
 * Initialize Supabase client with custom storage
 * This ensures auth tokens are stored securely on the device
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: storage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Keep the login token fresh only while the app is open (Supabase's recommended setup for React Native).
// Without this, a phone that wakes up after a long sleep can send SOS/journey alerts with an expired token.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export default supabase;