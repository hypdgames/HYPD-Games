import { createContext, useContext, useEffect, useState, useMemo } from "react";

const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

// Get system theme preference
const getSystemTheme = () => {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
};

// Get initial theme from localStorage or system
const getInitialTheme = () => {
  const saved = localStorage.getItem("hypd-theme");
  if (saved && ["light", "dark", "auto"].includes(saved)) return saved;
  return "auto";
};

// Get initial resolved theme
const getInitialResolvedTheme = () => {
  const saved = localStorage.getItem("hypd-theme");
  if (saved === "light" || saved === "dark") return saved;
  return getSystemTheme();
};

export function ThemeProvider({ children }) {
  // Theme can be "light", "dark", or "auto"
  const [theme, setTheme] = useState(getInitialTheme);

  // Actual resolved theme (light or dark)
  const [resolvedTheme, setResolvedTheme] = useState(getInitialResolvedTheme);

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (theme !== "auto") {
      setResolvedTheme(theme);
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    
    // Set initial value for auto mode
    const systemTheme = mediaQuery.matches ? "light" : "dark";
    setResolvedTheme(systemTheme);
    
    const handleChange = (e) => {
      setResolvedTheme(e.matches ? "light" : "dark");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    if (resolvedTheme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }
    
    localStorage.setItem("hypd-theme", theme);
  }, [theme, resolvedTheme]);

  // Cycle through themes: auto -> light -> dark -> auto
  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === "auto") return "light";
      if (prev === "light") return "dark";
      return "auto";
    });
  };

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme, toggleTheme }), [theme, resolvedTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
