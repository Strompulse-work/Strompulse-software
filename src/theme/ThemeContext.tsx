// src/theme/ThemeContext.tsx
import React, { createContext, useState, useContext, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage"; // To save their choice!

// 1. Define the Light and Dark Palettes
export const lightTheme = {
  background: "#F4F6F8",
  cardBg: "#FFFFFF",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textTertiary: "#94A3B8",
  success: "#059669",
  successBg: "#D1FAE5",
  error: "#E11D48",
  errorBg: "#FFE4E6",
  warning: "#D97706",
  warningBg: "#FEF3C7",
  border: "#E2E8F0",
  primary: "#0EA5E9",
  primaryBg: "#E0F2FE",
};

export const darkTheme = {
  background: "#12141D", // Exact SRD Dark Theme
  cardBg: "#1E202B",
  textPrimary: "#FFFFFF",
  textSecondary: "#8E92A4",
  textTertiary: "#4b5563",
  success: "#00E676",
  successBg: "rgba(0, 230, 118, 0.15)",
  error: "#FF3B30",
  errorBg: "rgba(255, 59, 48, 0.15)",
  warning: "#FFCC00",
  warningBg: "rgba(255, 204, 0, 0.15)",
  border: "#2C2F3F",
  primary: "#00E676",
  primaryBg: "rgba(0, 230, 118, 0.15)",
};

type Theme = typeof lightTheme;

interface ThemeContextType {
  theme: Theme;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  isDarkMode: false,
  toggleDarkMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Load their saved preference when the app starts
  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem("isDarkMode");
      if (savedTheme !== null) {
        setIsDarkMode(JSON.parse(savedTheme));
      }
    };
    loadTheme();
  }, []);

  const toggleDarkMode = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    await AsyncStorage.setItem("isDarkMode", JSON.stringify(newMode)); // Save it!
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
