/**
 * Supabase Client Configuration
 * Production-ready setup for Supabase integration with Expo
 */

import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

// IMPORTANT: Replace these with your actual Supabase credentials
// Get them from: https://app.supabase.com/project/_/settings/api
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://evfstgmzwdhtwqogaknp.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2ZnN0Z216d2RodHdxb2dha25wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5Nzk5NDEsImV4cCI6MjA5MTU1NTk0MX0.caxip8jdoqzunbZcLx6Eb5KHIWETjITbsroYEpbP59I";

// Custom storage implementation for React Native
const storage = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error("Error retrieving item from secure store:", error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error("Error saving item to secure store:", error);
    }
  },
  removeItem: async (key: string) => {
    try {
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

export default supabase;
