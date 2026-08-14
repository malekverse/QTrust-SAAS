/**
 * Kiosk health heartbeat.
 *
 * Every few minutes the device reports itself to the backend (id, app
 * version, battery, offline backlog) so admins can see which kiosks are
 * online, out of battery, or sitting on unsynced scans. Failures are
 * silent — health reporting must never affect scanning.
 */

import * as Battery from 'expo-battery';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import apiClient from '../api/client';
import { ENV } from '../config/env';
import { useDeviceStore } from '../store/deviceStore';

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

let started = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export async function sendHeartbeat(): Promise<void> {
  const { config, pendingScans } = useDeviceStore.getState();
  if (!config.isConfigured || !config.deviceToken || !config.deviceId) return;

  try {
    const [batteryLevel, batteryState] = await Promise.all([
      Battery.getBatteryLevelAsync().catch(() => -1),
      Battery.getBatteryStateAsync().catch(() => Battery.BatteryState.UNKNOWN),
    ]);

    await apiClient.post(
      ENV.ENDPOINTS.HEARTBEAT,
      {
        deviceId: config.deviceId,
        appVersion: Constants.expoConfig?.version ?? 'unknown',
        platform: Platform.OS,
        batteryLevel: batteryLevel >= 0 ? batteryLevel : undefined,
        batteryCharging:
          batteryState === Battery.BatteryState.CHARGING ||
          batteryState === Battery.BatteryState.FULL,
        pendingScans: pendingScans.length,
      },
      // Health telemetry is best-effort — don't log failures (offline kiosk,
      // endpoint not yet deployed) as errors.
      { silentErrors: true }
    );
  } catch {
    // silent — a missed heartbeat just shows the kiosk as offline
  }
}

/** Start the heartbeat loop. Safe to call more than once. */
export function startHeartbeat(): void {
  if (started) return;
  started = true;
  sendHeartbeat();
  intervalHandle = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
}
