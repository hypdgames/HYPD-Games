"use client";

import { useEffect, useRef, useState } from "react";
import { AppSettings } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Convert hex to HSL string for CSS variables
function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Parse hex
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  // Return HSL values without hsl() wrapper for CSS variable
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const faviconLinkRef = useRef<HTMLLinkElement | null>(null);
  const appleLinkRef = useRef<HTMLLinkElement | null>(null);

  // Apply CSS custom properties (safe during render)
  const applyColorSettings = (settings: AppSettings) => {
    if (typeof document === "undefined") return;
    
    // Apply primary color (lime) - converts hex to HSL for CSS variables
    if (settings.primary_color && settings.primary_color.startsWith('#')) {
      const hsl = hexToHSL(settings.primary_color);
      document.documentElement.style.setProperty('--primary', hsl);
      document.documentElement.style.setProperty('--accent', hsl);
      document.documentElement.style.setProperty('--ring', hsl);
    }

    // Update page title
    if (settings.site_name) {
      document.title = `${settings.site_name} - Play Instant Games`;
    }
  };

  // Safely update favicon using refs instead of DOM manipulation
  const updateFavicon = (url: string) => {
    if (typeof document === "undefined") return;
    
    // Update or create favicon link
    if (!faviconLinkRef.current) {
      // Try to find existing favicon first
      const existing = document.querySelector("link[rel='icon']") as HTMLLinkElement;
      if (existing) {
        faviconLinkRef.current = existing;
      } else {
        faviconLinkRef.current = document.createElement('link');
        faviconLinkRef.current.rel = 'icon';
        document.head.appendChild(faviconLinkRef.current);
      }
    }
    faviconLinkRef.current.href = url;

    // Update or create apple-touch-icon
    if (!appleLinkRef.current) {
      const existing = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
      if (existing) {
        appleLinkRef.current = existing;
      } else {
        appleLinkRef.current = document.createElement('link');
        appleLinkRef.current.rel = 'apple-touch-icon';
        document.head.appendChild(appleLinkRef.current);
      }
    }
    appleLinkRef.current.href = url;
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/api/settings`);
        if (res.ok) {
          const data = await res.json();
          applyColorSettings(data);
          if (data.favicon_url) {
            updateFavicon(data.favicon_url);
          }
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };

    fetchSettings();
    
    // Re-fetch settings every 60 seconds to pick up changes
    const interval = setInterval(fetchSettings, 60000);
    return () => clearInterval(interval);
  }, [mounted]);

  return <>{children}</>;
}
