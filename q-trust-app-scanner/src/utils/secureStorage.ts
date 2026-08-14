/**
 * Encrypted storage for device secrets (scanner token, settings PIN hash).
 * Values live in the platform keystore via expo-secure-store — never in
 * AsyncStorage, which is plain text on disk.
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const TOKEN_KEY = 'qtrust.deviceToken';
const PIN_HASH_KEY = 'qtrust.settingsPinHash';

export async function getStoredDeviceToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredDeviceToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (e) {
    console.warn('[SecureStorage] Failed to store device token', e);
  }
}

export async function clearStoredDeviceToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `qtrust-pin:${pin.trim()}`
  );
}

export async function getStoredPinHash(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PIN_HASH_KEY);
  } catch {
    return null;
  }
}

export async function setStoredPinHash(hash: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
  } catch (e) {
    console.warn('[SecureStorage] Failed to store PIN', e);
  }
}

export async function clearStoredPinHash(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  } catch {
    // ignore
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await getStoredPinHash();
  if (!stored) return true; // no PIN configured — nothing to verify
  const candidate = await hashPin(pin);
  return candidate === stored;
}
