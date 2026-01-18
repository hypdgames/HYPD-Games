"use client";

import { useEffect } from "react";
import { useAuthStore, useThemeStore } from "@/store";

export function Providers({ children }: { children: React.ReactNode }) {
  const { fetchUser, fetchSettings } = useAuthStore();
  const { initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();
    fetchUser();
    fetchSettings();
  }, [initTheme, fetchUser, fetchSettings]);

  return <>{children}</>;
}
