import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggle({ className = "" }) {
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  
  // Get icon and label based on current theme setting
  const getThemeInfo = () => {
    if (theme === "auto") {
      return {
        icon: <Monitor className="w-5 h-5 text-blue-400" />,
        label: "Auto (system)"
      };
    }
    if (resolvedTheme === "dark") {
      return {
        icon: <Sun className="w-5 h-5 text-yellow-400" />,
        label: "Switch to light"
      };
    }
    return {
      icon: <Moon className="w-5 h-5 text-slate-600" />,
      label: "Switch to dark"
    };
  };
  
  const { icon, label } = getThemeInfo();
  
  return (
    <button
      onClick={toggleTheme}
      className={`w-10 h-10 rounded-full glass flex items-center justify-center touch-target transition-all hover:scale-105 active:scale-95 ${className}`}
      data-testid="theme-toggle"
      aria-label={label}
      title={`Current: ${theme === "auto" ? "Auto (System)" : theme}. Click to change.`}
    >
      {icon}
    </button>
  );
}
