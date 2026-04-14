/**
 * Authentication Service
 * Handles user authentication, session management, and secure token storage.
 * Updated to support Unified Auth (Email/Phone) and Google OAuth via WebBrowser.
 */

import supabase from "../config/supabase";
import { User, AuthSession, ApiResponse } from "../types"; // Keeps your custom type exactly as is
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Alert } from "react-native";
import * as ExpoAuthSession from "expo-auth-session"; // <-- Added 'Expo' to the name here!

// Tells the browser to close itself automatically once auth is done
WebBrowser.maybeCompleteAuthSession();

// Tells the browser to close itself automatically once auth is done
WebBrowser.maybeCompleteAuthSession();

const AUTH_TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "user_data";

export class AuthService {
  /**
   * Helper to determine if an identifier is a phone number or email
   */
  private static isPhoneNumber(identifier: string): boolean {
    return /^\d+$/.test(identifier.replace(/[\s\-\+]/g, ""));
  }

  /**
   * Automatically formats local Nigerian numbers into global E.164 format
   */
  private static formatPhoneNumber(phone: string): string {
    // Remove all spaces, dashes, or weird characters
    let cleaned = phone.replace(/[^\d+]/g, "");

    // If they already included the '+', trust them and send it as-is
    if (cleaned.startsWith("+")) return cleaned;

    // If they typed a standard local Nigerian number (e.g., 09059259175)
    // We remove the first '0' and add '+234'
    if (cleaned.startsWith("0") && cleaned.length === 11) {
      return "+234" + cleaned.substring(1);
    }

    // If they typed the country code but forgot the '+' (e.g., 2349059259175)
    if (cleaned.startsWith("234") && cleaned.length === 13) {
      return "+" + cleaned;
    }

    // Fallback: just add a plus and hope for the best
    return "+" + cleaned;
  }

  /**
   * Sign up with Email OR Phone Number + Password
   */
  static async signupWithEmail(
    identifier: string,
    password: string,
    fullName: string,
  ): Promise<ApiResponse<AuthSession>> {
    try {
      const isPhone = this.isPhoneNumber(identifier);

      // Dynamically set either the email or phone key
      const credentials = isPhone
        ? { phone: identifier, password }
        : { email: identifier, password };

      const { data, error } = await supabase.auth.signUp({
        ...credentials,
        options: {
          data: {
            full_name: fullName,
            role: "user",
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: "User creation failed" };
      }

      // Store session
      if (data.session) {
        await this.storeSession({
          user: this.mapAuthUser(data.user),
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token || "",
        });
      }

      return {
        success: true,
        data: data.session
          ? {
              user: this.mapAuthUser(data.user),
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token || "",
            }
          : undefined,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Login with Email OR Phone Number + Password
   */
  static async loginWithEmail(
    identifier: string,
    password: string,
  ): Promise<ApiResponse<AuthSession>> {
    try {
      const isPhone = this.isPhoneNumber(identifier);

      // Dynamically set either the email or phone key
      const credentials = isPhone
        ? { phone: identifier, password }
        : { email: identifier, password };

      const { data, error } =
        await supabase.auth.signInWithPassword(credentials);

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user || !data.session) {
        return { success: false, error: "Login failed" };
      }

      // Store session securely
      const sessionData: AuthSession = {
        user: this.mapAuthUser(data.user),
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token || "",
      };

      await this.storeSession(sessionData);

      return { success: true, data: sessionData };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Login/Sign up with Google OAuth via WebBrowser
   */
  static async loginWithGoogle(): Promise<ApiResponse<AuthSession>> {
    try {
      // 1. Get the custom teleport link for your Expo app
      const redirectUrl = ExpoAuthSession.makeRedirectUri();

      // 2. Ask Supabase to generate the specific Google login page URL
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true, // We are handling the browser manually below
        },
      });

      if (error) return { success: false, error: error.message };
      if (!data?.url) return { success: false, error: "No URL returned" };

      // 3. Open the secure in-app browser to the Google login page
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
      );

      // 4. When the user successfully logs in and comes back to the app...
      if (result.type === "success") {
        // Extract the secure tokens from the URL that Google sent back
        const params = result.url.split("#")[1];
        if (!params) return { success: false, error: "No tokens returned" };

        // Parse the URL parameters
        const urlParams = new URLSearchParams(params);
        const accessToken = urlParams.get("access_token");
        const refreshToken = urlParams.get("refresh_token");

        if (accessToken && refreshToken) {
          // Tell Supabase to officially log the user in with these tokens
          const { data: sessionData, error: sessionError } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

          if (sessionError) throw sessionError;

          if (sessionData.session) {
            const appSession: AuthSession = {
              user: this.mapAuthUser(sessionData.session.user),
              access_token: sessionData.session.access_token,
              refresh_token: sessionData.session.refresh_token || "",
            };

            await this.storeSession(appSession);
            return { success: true, data: appSession };
          }
        }
      }

      return { success: false, error: "Google sign-in was cancelled." };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Login with phone number OTP (future feature/fallback)
   */
  static async loginWithPhoneOTP(
    phone: string,
  ): Promise<ApiResponse<{ sessionId: string }>> {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: { sessionId: ((data as any)?.user?.id as string) || "" },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Verify OTP token
   */
  static async verifyOTP(
    phone: string,
    token: string,
  ): Promise<ApiResponse<AuthSession>> {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user || !data.session) {
        return { success: false, error: "OTP verification failed" };
      }

      const sessionData: AuthSession = {
        user: this.mapAuthUser(data.user),
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token || "",
      };

      await this.storeSession(sessionData);

      return { success: true, data: sessionData };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get current session from storage
   */
  static async getCurrentSession(): Promise<AuthSession | null> {
    try {
      const jsonStr = await SecureStore.getItemAsync(USER_KEY);
      if (jsonStr) {
        return JSON.parse(jsonStr);
      }
      return null;
    } catch (error) {
      console.error("Error retrieving session:", error);
      return null;
    }
  }

  /**
   * Store session securely
   */
  static async storeSession(session: AuthSession): Promise<void> {
    try {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(session));
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, session.access_token);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refresh_token);
    } catch (error) {
      console.error("Error storing session:", error);
    }
  }

  /**
   * Refresh authentication token
   */
  static async refreshToken(): Promise<ApiResponse<string>> {
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        return { success: false, error: "No refresh token available" };
      }

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.session) {
        await SecureStore.setItemAsync(
          AUTH_TOKEN_KEY,
          data.session.access_token,
        );
        return { success: true, data: data.session.access_token };
      }

      return { success: false, error: "Token refresh failed" };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Logout and clear session
   */
  static async logout(): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.warn("Supabase logout error:", error);
      }

      // Clear secure storage
      await SecureStore.deleteItemAsync(USER_KEY);
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(
    fullName: string,
    avatarUrl?: string,
  ): Promise<ApiResponse<User>> {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          avatar_url: avatarUrl,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: "Profile update failed" };
      }

      const user = this.mapAuthUser(data.user);

      // Update stored session
      const session = await this.getCurrentSession();
      if (session) {
        session.user = user;
        await this.storeSession(session);
      }

      return { success: true, data: user };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Change password
   */
  static async changePassword(newPassword: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Request password reset
   */
  static async requestPasswordReset(email: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "ibadanpower://auth/reset-password",
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Map Supabase auth user to app User type
   */
  private static mapAuthUser(authUser: any): User {
    return {
      id: authUser.id,
      email: authUser.email,
      phone: authUser.phone,
      full_name: authUser.user_metadata?.full_name || "Unknown User",
      role: authUser.user_metadata?.role || "user",
      avatar_url: authUser.user_metadata?.avatar_url,
      created_at: authUser.created_at,
      updated_at: authUser.updated_at,
    };
  }

  /**
   * Check if user session is valid
   */
  static async isAuthenticated(): Promise<boolean> {
    const session = await this.getCurrentSession();
    return !!session?.access_token;
  }
}

export default AuthService;
