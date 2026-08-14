/**
 * Offline check-in sync engine.
 *
 * Scans captured while the network was down sit in the store's pendingScans
 * queue with their ORIGINAL scan timestamp (the backend accepts scannedAt,
 * so attendance stays truthful). This module drains the queue whenever
 * connectivity returns, on a slow interval, and on demand from settings.
 */

import * as Network from 'expo-network';
import { checkIn, isRetryableCheckInError } from '../api/attendance';
import { useDeviceStore } from '../store/deviceStore';
import { ARABIC_MESSAGES } from '../types';

export interface SyncResult {
  synced: number;
  rejected: number;
  remaining: number;
}

// A scan that keeps failing on transport errors is dropped after this many
// attempts so the queue can't grow stale forever (~gives days of retries).
const MAX_ATTEMPTS = 50;
const SYNC_INTERVAL_MS = 60 * 1000;

let isSyncing = false;
let started = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export async function syncPendingScans(): Promise<SyncResult> {
  const store = useDeviceStore.getState();
  const result: SyncResult = { synced: 0, rejected: 0, remaining: store.pendingScans.length };

  if (isSyncing || !store.config.isConfigured || store.pendingScans.length === 0) {
    return result;
  }

  isSyncing = true;
  try {
    // Snapshot; the store mutates as items complete
    const queue = [...useDeviceStore.getState().pendingScans];

    for (const pending of queue) {
      const response = await checkIn({
        qrUuid: pending.qrUuid,
        scannedAt: pending.scannedAt,
      });

      if (response.success) {
        store.removePendingScan(pending.id);
        store.addScanRecord({
          id: pending.id,
          qrUuid: pending.qrUuid,
          studentName: response.studentName || '',
          sessionName: response.sessionName,
          scannedAt: pending.scannedAt,
          success: true,
          status: response.status,
          alreadyCheckedIn: response.alreadyCheckedIn,
        });
        result.synced++;
        continue;
      }

      if (isRetryableCheckInError(response.errorCode)) {
        // Still unreachable — stop hammering; the rest of the queue would
        // fail the same way. Drop items that have exhausted their retries.
        store.markPendingAttempt(pending.id);
        const attempts = pending.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          store.removePendingScan(pending.id);
          store.addScanRecord({
            id: pending.id,
            qrUuid: pending.qrUuid,
            studentName: '',
            scannedAt: pending.scannedAt,
            success: false,
            errorMessage: ARABIC_MESSAGES.errorNetwork,
          });
          result.rejected++;
          continue;
        }
        break;
      }

      // Definitive server rejection (invalid QR, no session, unauthorized):
      // record the failure and stop retrying this scan.
      store.removePendingScan(pending.id);
      store.addScanRecord({
        id: pending.id,
        qrUuid: pending.qrUuid,
        studentName: '',
        scannedAt: pending.scannedAt,
        success: false,
        errorMessage: response.message,
      });
      result.rejected++;
    }
  } finally {
    isSyncing = false;
  }

  result.remaining = useDeviceStore.getState().pendingScans.length;
  return result;
}

/**
 * Register the connectivity listener + slow retry interval. Safe to call
 * more than once; only the first call takes effect.
 */
export function startPendingSync(): void {
  if (started) return;
  started = true;

  // Drain whenever connectivity comes back
  try {
    Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        syncPendingScans();
      }
    });
  } catch (e) {
    console.warn('[Sync] Network listener unavailable', e);
  }

  // Slow safety-net interval (only does work when the queue is non-empty)
  intervalHandle = setInterval(() => {
    if (useDeviceStore.getState().pendingScans.length > 0) {
      syncPendingScans();
    }
  }, SYNC_INTERVAL_MS);

  // Try once at startup in case the app closed with a non-empty queue
  syncPendingScans();
}
