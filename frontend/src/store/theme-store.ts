"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "auto";
type ResolvedTheme = "light" | "dark";

interface ThemeStore {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initTheme: () => void;
}

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "auto",
      resolvedTheme: "dark",

      setTheme: (theme) => {
        const resolvedTheme = theme === "auto" ? getSystemTheme() : theme;
        set({ theme, resolvedTheme });
        
        // Apply to document
        if (typeof document !== "undefined") {
          const root = document.documentElement;
          if (resolvedTheme === "light") {
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
        if (theme === "auto") setTheme("light");
        else if (theme === "light") setTheme("dark");
        else setTheme("auto");
      },

      initTheme: () => {
        const { theme, setTheme } = get();
        setTheme(theme); // Re-apply theme on init
        
        // Listen for system theme changes
        if (typeof window !== "undefined" && theme === "auto") {
          const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
          const handleChange = () => {
            const { theme } = get();
            if (theme === "auto") {
              set({ resolvedTheme: getSystemTheme() });
              // Re-apply classes
              const root = document.documentElement;
              if (getSystemTheme() === "light") {
                root.classList.add("light");
                root.classList.remove("dark");
              } else {
                root.classList.add("dark");
                root.classList.remove("light");
              }
            }
          };
          mediaQuery.addEventListener("change", handleChange);
        }
      },
    }),
    {
      name: "hypd-theme",
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
