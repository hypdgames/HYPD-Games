"use client";

import { useEffect, useCallback } from "react";
import { AppSettings } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const applySettings = useCallback((settings: AppSettings) => {
    // Apply colors to CSS variables
    if (settings.primary_color) {
      document.documentElement.style.setProperty('--lime', settings.primary_color);
    }
    if (settings.accent_color) {
      document.documentElement.style.setProperty('--accent', settings.accent_color);
    }
    if (settings.background_color) {
      document.documentElement.style.setProperty('--background', settings.background_color);
    }

    // Update favicon dynamically
    if (settings.favicon_url) {
      updateFavicon(settings.favicon_url);
    }

    // Update page title
    if (settings.site_name) {
      document.title = `${settings.site_name} - Play Instant Games`;
    }
  }, []);

  const updateFavicon = (url: string) => {
    // Remove existing favicon links
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach(link => link.remove());

    // Add new favicon
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = url;
    document.head.appendChild(link);

    // Also add apple-touch-icon
    const appleLink = document.createElement('link');
    appleLink.rel = 'apple-touch-icon';
    appleLink.href = url;
    document.head.appendChild(appleLink);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/api/settings`);
        if (res.ok) {
          const data = await res.json();
          applySettings(data);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };

    fetchSettings();
    
    // Re-fetch settings every 30 seconds to pick up changes
    const interval = setInterval(fetchSettings, 30000);
    return () => clearInterval(interval);
  }, [applySettings]);

  return <>{children}</>;
}
