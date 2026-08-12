/**
 * Theme Context Provider for Q-Trust App Scanner
 * 
 * Provides theme-aware colors and utilities throughout the app
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { Colors, getThemeColors, ColorScheme } from './colors';
import { useDeviceStore } from '../store/deviceStore';

interface ThemeContextValue {
  colorScheme: ColorScheme;
  colors: ReturnType<typeof getThemeColors>;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useSystemColorScheme();
  const { themeMode } = useDeviceStore();
  
  // Determine actual color scheme based on user preference
  const colorScheme: ColorScheme = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, systemColorScheme]);
  
  const value = useMemo(() => ({
    colorScheme,
    colors: getThemeColors(colorScheme),
    isDark: colorScheme === 'dark',
  }), [colorScheme]);
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function useThemeColors() {
  const { colors } = useTheme();
  return colors;
}

