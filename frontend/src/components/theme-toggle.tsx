"use client";

import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "@/store";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 rounded-full glass",
        "text-foreground text-xs font-medium",
        "transition-all hover:scale-105 active:scale-95"
      )}
      data-testid="theme-toggle"
      title={`Switch to ${theme === "light" ? "Dark" : "Light"} mode`}
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
