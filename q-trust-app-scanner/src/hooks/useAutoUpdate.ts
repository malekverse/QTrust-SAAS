/**
 * Self-updating kiosk: periodically checks EAS Updates for a new bundle,
 * downloads it in the background, and reloads only while the scanner is
 * idle so a student mid-scan is never interrupted.
 *
 * No-ops in Expo Go and dev builds (Updates.isEnabled is false there).
 */

import { useEffect, useState } from 'react';
import * as Updates from 'expo-updates';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
// Idle grace period before reloading, so we don't reload the instant
// between two students in a queue.
const RELOAD_DELAY_MS = 8 * 1000;

export function useAutoUpdate(isIdle: boolean): void {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    let cancelled = false;
    const check = async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          if (!cancelled) setUpdateReady(true);
        }
      } catch {
        // network hiccups are fine; we'll check again next interval
      }
    };

    check();
    const handle = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, []);

  useEffect(() => {
    if (!updateReady || !isIdle) return;
    const timer = setTimeout(() => {
      Updates.reloadAsync().catch(() => {});
    }, RELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [updateReady, isIdle]);
}

export default useAutoUpdate;
