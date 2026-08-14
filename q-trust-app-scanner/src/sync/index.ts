/**
 * App-wide background services, started once from the root layout.
 */

import { initFeedback } from '../utils/feedback';
import { startHeartbeat } from './heartbeat';
import { startPendingSync } from './pendingSync';

let started = false;

export function startBackgroundServices(): void {
  if (started) return;
  started = true;
  initFeedback();
  startPendingSync();
  startHeartbeat();
}

export { syncPendingScans } from './pendingSync';
export { sendHeartbeat } from './heartbeat';
