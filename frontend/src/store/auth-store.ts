"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, AppSettings, LoginCredentials, RegisterCredentials, AuthResponse } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface AuthStore {
  user: User | null;
  token: string | null;
  loading: boolean;
  settings: AppSettings;
  
  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setSettings: (settings: AppSettings) => void;
  
  // Auth methods
  login: (credentials: LoginCredentials) => Promise<User>;
  register: (credentials: RegisterCredentials) => Promise<User>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  fetchSettings: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: true,
      settings: {},

      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setLoading: (loading) => set({ loading }),
      setSettings: (settings) => set({ settings }),

      login: async (credentials) => {
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.detail || "Login failed");
        }
        
        const authData = data as AuthResponse;
        set({ token: authData.access_token, user: authData.user });
        return authData.user;
      },

      register: async (credentials) => {
        const res = await fetch(`${API_URL}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.detail || "Registration failed");
        }
        
        const authData = data as AuthResponse;
        set({ token: authData.access_token, user: authData.user });
        return authData.user;
      },

      logout: () => {
        set({ token: null, user: null });
      },

      fetchUser: async () => {
        const { token } = get();
        if (!token) {
          set({ loading: false });
          return;
        }

        try {
          const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          
          if (res.ok) {
            const userData = await res.json();
            set({ user: userData, loading: false });
          } else {
            set({ token: null, user: null, loading: false });
          }
        } catch (e) {
          console.error("Auth error:", e);
          set({ loading: false });
        }
      },

      fetchSettings: async () => {
        try {
          const res = await fetch(`${API_URL}/api/settings`);
          if (res.ok) {
            const data = await res.json();
            set({ settings: data });
          }
        } catch (e) {
          console.error("Settings error:", e);
        }
      },
    }),
    {
      name: "hypd-auth",
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
