/**
 * Zustand store for device configuration and app state
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceConfig, ThemeMode, ScanRecord } from '../types';
import * as Crypto from 'expo-crypto';

interface DeviceState {
  // Configuration
  config: DeviceConfig;
  themeMode: ThemeMode;
  
  // Recent scans for debugging
  recentScans: ScanRecord[];
  
  // Cooldown tracking to prevent duplicate scans
  lastScannedQr: string | null;
  lastScannedAt: number | null;
  
  // Actions
  setConfig: (config: Partial<DeviceConfig>) => void;
  setThemeMode: (mode: ThemeMode) => void;
  clearConfig: () => void;
  
  // Scan tracking
  addScanRecord: (record: ScanRecord) => void;
  clearRecentScans: () => void;
  setLastScanned: (qrUuid: string) => void;
  canScanQr: (qrUuid: string, cooldownMs?: number) => boolean;
  
  // Setup check
  isSetupComplete: () => boolean;
}

// Generate a unique device ID
async function generateDeviceId(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const DEFAULT_CONFIG: DeviceConfig = {
  apiBaseUrl: '',
  deviceToken: '',
  deviceId: '',
  isConfigured: false,
};

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,
      themeMode: 'light',
      recentScans: [],
      lastScannedQr: null,
      lastScannedAt: null,
      
      setConfig: (newConfig) => {
        set((state) => ({
          config: {
            ...state.config,
            ...newConfig,
            isConfigured: true,
          },
        }));
      },
      
      setThemeMode: (mode) => {
        set({ themeMode: mode });
      },
      
      clearConfig: () => {
        set({ config: DEFAULT_CONFIG });
      },
      
      addScanRecord: (record) => {
        set((state) => ({
          recentScans: [record, ...state.recentScans].slice(0, 50), // Keep last 50
        }));
      },
      
      clearRecentScans: () => {
        set({ recentScans: [] });
      },
      
      setLastScanned: (qrUuid) => {
        set({
          lastScannedQr: qrUuid,
          lastScannedAt: Date.now(),
        });
      },
      
      canScanQr: (qrUuid, cooldownMs = 5000) => {
        const { lastScannedQr, lastScannedAt } = get();
        
        // Different QR code - always allow
        if (lastScannedQr !== qrUuid) return true;
        
        // Same QR code - check cooldown
        if (!lastScannedAt) return true;
        
        const elapsed = Date.now() - lastScannedAt;
        return elapsed >= cooldownMs;
      },
      
      isSetupComplete: () => {
        const { config } = get();
        return config.isConfigured && 
               config.apiBaseUrl.length > 0 && 
               config.deviceToken.length > 0;
      },
    }),
    {
      name: 'q-trust-device-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        config: state.config,
        themeMode: state.themeMode,
        recentScans: state.recentScans,
      }),
    }
  )
);

// Initialize device ID if not set
export async function initializeDeviceId() {
  const { config, setConfig } = useDeviceStore.getState();
  
  if (!config.deviceId) {
    const deviceId = await generateDeviceId();
    setConfig({ deviceId });
  }
}

export default useDeviceStore;

