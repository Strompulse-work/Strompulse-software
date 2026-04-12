/**
 * Authentication Service
 * Handles user authentication, session management, and secure token storage
 */

import supabase from "../config/supabase";
import { User, AuthSession, ApiResponse } from "../types";
import * as SecureStore from "expo-secure-store";

const AUTH_TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "user_data";

export class AuthService {
  /**
   * Sign up with email and password
   */
  static async signupWithEmail(
    email: string,
    password: string,
    fullName: string,
  ): Promise<ApiResponse<AuthSession>> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
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
   * Login with email and password
   */
  static async loginWithEmail(
    email: string,
    password: string,
  ): Promise<ApiResponse<AuthSession>> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

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
   * Login with phone number OTP (future feature)
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
