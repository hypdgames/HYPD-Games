"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark";

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initTheme: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "dark",

      setTheme: (theme) => {
        // Ensure theme is valid (migrate old "auto" to "dark")
        const validTheme = theme === "light" ? "light" : "dark";
        set({ theme: validTheme });
        
        // Apply to document
        if (typeof document !== "undefined") {
          const root = document.documentElement;
          if (validTheme === "light") {
            root.classList.add("light");
            root.classList.remove("dark");
          } else {
            root.classList.add("dark");
            root.classList.remove("light");
          }
        }
      },

      toggleTheme: () => {
        const { theme, setTheme } = get();
        setTheme(theme === "light" ? "dark" : "light");
      },

      initTheme: () => {
        const { theme, setTheme } = get();
        // Migrate old "auto" value to "dark"
        const validTheme = theme === "light" ? "light" : "dark";
        setTheme(validTheme);
      },
    }),
    {
      name: "hypd-theme",
      partialize: (state) => ({ theme: state.theme }),
      // Handle migration from old store structure
      onRehydrateStorage: () => (state) => {
        if (state) {
          // If theme is not valid, default to dark
          if (state.theme !== "light" && state.theme !== "dark") {
            state.theme = "dark";
          }
        }
      },
    }
  )
);
