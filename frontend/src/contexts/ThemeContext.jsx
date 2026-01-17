import { createContext, useContext, useEffect, useState } from "react";

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

export function ThemeProvider({ children }) {
  // Theme can be "light", "dark", or "auto"
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("hypd-theme");
    if (saved && ["light", "dark", "auto"].includes(saved)) return saved;
    return "auto"; // Default to auto (system preference)
  });

  // Actual resolved theme (light or dark)
  const [resolvedTheme, setResolvedTheme] = useState(() => {
    const saved = localStorage.getItem("hypd-theme");
    if (saved === "light" || saved === "dark") return saved;
    return getSystemTheme();
  });

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (theme !== "auto") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = (e) => {
      setResolvedTheme(e.matches ? "light" : "dark");
    };

    // Set initial value
    setResolvedTheme(mediaQuery.matches ? "light" : "dark");

    // Listen for changes
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Update resolved theme when theme changes
  useEffect(() => {
    if (theme === "auto") {
      setResolvedTheme(getSystemTheme());
    } else {
      setResolvedTheme(theme);
    }
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

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
