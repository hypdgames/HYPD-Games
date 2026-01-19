"use client";

import { useEffect, useState } from "react";
import { useAuthStore, useThemeStore } from "@/store";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Initialize theme
    useThemeStore.getState().initTheme();
    
    // Fetch user and settings
    useAuthStore.getState().fetchUser();
    useAuthStore.getState().fetchSettings();
  }, []);

  // Prevent hydration mismatch by not rendering theme-dependent content until mounted
  if (!mounted) {
    return null;
  }

  return <>{children}</>;
}
