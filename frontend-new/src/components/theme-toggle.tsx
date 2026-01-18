"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useThemeStore } from "@/store";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  const getIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="w-4 h-4" />;
      case "dark":
        return <Moon className="w-4 h-4" />;
      case "auto":
        return <Monitor className="w-4 h-4" />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case "light":
        return "Light";
      case "dark":
        return "Dark";
      case "auto":
        return "Auto";
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 rounded-full glass",
        "text-foreground text-xs font-medium",
        "transition-all hover:scale-105 active:scale-95"
      )}
      data-testid="theme-toggle"
      title={`Theme: ${getLabel()}`}
    >
      {getIcon()}
      <span className="hidden sm:inline">{getLabel()}</span>
    </button>
  );
}
