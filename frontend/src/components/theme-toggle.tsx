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
        "flex items-center justify-center w-9 h-9 rounded-full",
        "bg-muted text-foreground",
        "active:scale-95"
      )}
      data-testid="theme-toggle"
      title={`Switch to ${theme === "light" ? "Dark" : "Light"} mode`}
    >
      {theme === "dark" ? (
        <Sun className="w-[18px] h-[18px]" />
      ) : (
        <Moon className="w-[18px] h-[18px]" />
      )}
    </button>
  );
}
