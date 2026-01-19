"use client";

import { useEffect } from "react";
import { useAuthStore, useThemeStore } from "@/store";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize theme - using getState() to avoid re-render loops
    useThemeStore.getState().initTheme();
    
    // Fetch user and settings
    useAuthStore.getState().fetchUser();
    useAuthStore.getState().fetchSettings();
  }, []);

  return <>{children}</>;
}
