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
        set({ theme });
        
        // Apply to document
        if (typeof document !== "undefined") {
          const root = document.documentElement;
          if (theme === "light") {
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
        setTheme(theme); // Re-apply theme on init
      },
    }),
    {
      name: "hypd-theme",
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
