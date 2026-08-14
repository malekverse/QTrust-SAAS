/**
 * Audible + haptic feedback for scan results.
 * A kiosk operator/student shouldn't need to look at the screen to know
 * whether a scan worked — success chime, error buzz, neutral blip for
 * offline-queued scans. Haptics are a no-op on tablets without a vibrator.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

let successPlayer: AudioPlayer | null = null;
let errorPlayer: AudioPlayer | null = null;
let queuedPlayer: AudioPlayer | null = null;
let initialized = false;

export async function initFeedback(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    // Kiosk feedback must be audible even with the iOS silent switch on.
    await setAudioModeAsync({ playsInSilentMode: true });
    successPlayer = createAudioPlayer(require('../../assets/sounds/success.wav'));
    errorPlayer = createAudioPlayer(require('../../assets/sounds/error.wav'));
    queuedPlayer = createAudioPlayer(require('../../assets/sounds/queued.wav'));
  } catch (e) {
    console.warn('[Feedback] Audio init failed', e);
  }
}

function play(player: AudioPlayer | null) {
  try {
    if (!player) return;
    player.seekTo(0);
    player.play();
  } catch {
    // audio failure must never break the scan flow
  }
}

export function feedbackSuccess(): void {
  play(successPlayer);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function feedbackError(): void {
  play(errorPlayer);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

export function feedbackQueued(): void {
  play(queuedPlayer);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
