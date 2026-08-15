/**
 * Zustand store for device configuration and app state
 *
 * Persistence layout:
 * - Non-sensitive state (config minus token, theme, camera, scan history,
 *   pending offline scans) → AsyncStorage via zustand persist.
 * - The scanner token and settings-PIN hash → expo-secure-store only
 *   (see src/utils/secureStorage.ts). The token is hydrated into memory
 *   at startup by initializeDevice().
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraFacing, DeviceConfig, PendingScan, ScanRecord, ThemeMode } from '../types';
import * as Crypto from 'expo-crypto';
import {
  clearStoredDeviceToken,
  clearStoredPinHash,
  getStoredDeviceToken,
  getStoredPinHash,
  setStoredDeviceToken,
} from '../utils/secureStorage';

interface DeviceState {
  // Configuration (deviceToken is memory-only; persisted copy is blanked)
  config: DeviceConfig;
  themeMode: ThemeMode;
  cameraFacing: CameraFacing;

  // Whether a settings PIN is configured (hash itself lives in SecureStore)
  hasPin: boolean;

  // Demo/recording mode: branded background + scripted scan for capturing
  // marketing screenshots/video. Session-only (never persisted) so a kiosk
  // can't boot into it.
  demoMode: boolean;

  // Recent scans for debugging
  recentScans: ScanRecord[];

  // Offline check-ins waiting to sync
  pendingScans: PendingScan[];

  // Cooldown tracking to prevent duplicate scans
  lastScannedQr: string | null;
  lastScannedAt: number | null;

  // Actions
  setConfig: (config: Partial<DeviceConfig>) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setCameraFacing: (facing: CameraFacing) => void;
  setHasPin: (hasPin: boolean) => void;
  setDemoMode: (on: boolean) => void;
  clearConfig: () => void;

  // Scan tracking
  addScanRecord: (record: ScanRecord) => void;
  clearRecentScans: () => void;
  setLastScanned: (qrUuid: string) => void;
  canScanQr: (qrUuid: string, cooldownMs?: number) => boolean;

  // Offline queue
  enqueuePendingScan: (scan: { qrUuid: string; scannedAt: string }) => void;
  removePendingScan: (id: string) => void;
  markPendingAttempt: (id: string) => void;

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

// Cap the offline queue so a misbehaving QR in front of the camera for hours
// can't grow storage without bound.
const MAX_PENDING_SCANS = 200;

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,
      themeMode: 'light',
      cameraFacing: 'front',
      hasPin: false,
      demoMode: false,
      recentScans: [],
      pendingScans: [],
      lastScannedQr: null,
      lastScannedAt: null,

      setConfig: (newConfig) => {
        // The token never touches AsyncStorage — mirror it to SecureStore.
        if (typeof newConfig.deviceToken === 'string' && newConfig.deviceToken.length > 0) {
          setStoredDeviceToken(newConfig.deviceToken);
        }
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

      setCameraFacing: (facing) => {
        set({ cameraFacing: facing });
      },

      setHasPin: (hasPin) => {
        set({ hasPin });
      },

      setDemoMode: (on) => {
        set({ demoMode: on });
      },

      clearConfig: () => {
        clearStoredDeviceToken();
        clearStoredPinHash();
        set({
          config: DEFAULT_CONFIG,
          hasPin: false,
          pendingScans: [],
          recentScans: [],
        });
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

      enqueuePendingScan: ({ qrUuid, scannedAt }) => {
        set((state) => {
          if (state.pendingScans.length >= MAX_PENDING_SCANS) return state;
          const pending: PendingScan = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            qrUuid,
            scannedAt,
            attempts: 0,
          };
          return { pendingScans: [...state.pendingScans, pending] };
        });
      },

      removePendingScan: (id) => {
        set((state) => ({
          pendingScans: state.pendingScans.filter(p => p.id !== id),
        }));
      },

      markPendingAttempt: (id) => {
        set((state) => ({
          pendingScans: state.pendingScans.map(p =>
            p.id === id ? { ...p, attempts: p.attempts + 1 } : p
          ),
        }));
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
      version: 3,
      partialize: (state) => ({
        // deviceToken deliberately blanked — SecureStore is its only home
        config: { ...state.config, deviceToken: '' },
        themeMode: state.themeMode,
        cameraFacing: state.cameraFacing,
        recentScans: state.recentScans,
        pendingScans: state.pendingScans,
      }),
      migrate: async (persisted: any, version) => {
        // v1 → v2: token used to live in the AsyncStorage payload; move it
        // to SecureStore once, then keep it out of the plain-text blob.
        if (version < 2 && persisted?.config?.deviceToken) {
          await setStoredDeviceToken(persisted.config.deviceToken);
          persisted.config.deviceToken = '';
        }
        // v2 → v3: production backend moved to q-trust-saas.vercel.app.
        // Repoint devices still saved with the old domain so they don't keep
        // hitting the dead deployment.
        if (version < 3 && persisted?.config?.apiBaseUrl === 'https://q-trust.vercel.app') {
          persisted.config.apiBaseUrl = 'https://q-trust-saas.vercel.app';
        }
        return persisted;
      },
    }
  )
);

/** Resolve once zustand-persist has rehydrated from AsyncStorage. */
async function waitForHydration(): Promise<void> {
  const persistApi = useDeviceStore.persist;
  if (persistApi.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const unsub = persistApi.onFinishHydration(() => {
      unsub();
      resolve();
    });
    // Safety net: never block startup on a storage failure
    setTimeout(resolve, 1500);
  });
}

/**
 * One-time startup hydration: device ID + secrets from SecureStore.
 * Called from the root layout before any API call needs the token.
 */
export async function initializeDevice() {
  await waitForHydration();
  const { config, setHasPin } = useDeviceStore.getState();

  if (!config.deviceId) {
    const deviceId = await generateDeviceId();
    useDeviceStore.setState((state) => ({
      config: { ...state.config, deviceId },
    }));
  }

  const [token, pinHash] = await Promise.all([
    getStoredDeviceToken(),
    getStoredPinHash(),
  ]);

  if (token) {
    useDeviceStore.setState((state) => ({
      config: { ...state.config, deviceToken: token },
    }));
  }
  setHasPin(!!pinHash);
}

export default useDeviceStore;
