"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[App] Service Worker registered:", registration.scope);
        })
        .catch((error) => {
          console.error("[App] Service Worker registration failed:", error);
        });
    }
  }, []);

  return null;
}

// Helper function to pre-cache a game
export function precacheGame(gameId: string) {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({
        type: "PRECACHE_GAME",
        gameId,
      });
    });
  }
}
