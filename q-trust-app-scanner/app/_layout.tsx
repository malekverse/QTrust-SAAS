/**
 * Root Layout for Q-Trust App Scanner
 */

import { useEffect } from 'react';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { useDeviceStore, initializeDevice } from '../src/store/deviceStore';
import { startBackgroundServices } from '../src/sync';
import { Colors } from '../src/theme/colors';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

// Custom navigation themes with Islamic colors
const IslamicLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    background: Colors.light.background,
    card: Colors.light.surface,
    text: Colors.light.text,
    border: Colors.light.border,
  },
};

const IslamicDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#1A9E6A', // Adjusted for dark mode
    background: Colors.dark.background,
    card: Colors.dark.surface,
    text: Colors.dark.text,
    border: Colors.dark.border,
  },
};

function RootLayoutNav() {
  const { isDark } = useTheme();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Waits for storage hydration, generates the device ID if missing,
      // and loads the scanner token + PIN flag from SecureStore.
      await initializeDevice();
      startBackgroundServices();
      SplashScreen.hideAsync();

      if (cancelled) return;
      const { isSetupComplete } = useDeviceStore.getState();
      router.replace(isSetupComplete() ? '/scanner' : '/setup');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <NavigationThemeProvider value={isDark ? IslamicDarkTheme : IslamicLightTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen 
          name="index" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="setup" 
          options={{ 
            headerShown: false,
            animation: 'fade',
          }} 
        />
        <Stack.Screen 
          name="scanner" 
          options={{ 
            headerShown: false,
            animation: 'fade',
          }} 
        />
        <Stack.Screen 
          name="settings" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_left',
            presentation: 'card',
          }} 
        />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RootLayoutNav />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
