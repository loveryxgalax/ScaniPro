import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { createStore } from './store';

const SETTINGS_KEY = 'caseseal.lock.v1';

export type RelockAfter = 0 | 60 | 300;

type LockState = {
  ready: boolean;
  enabled: boolean;
  relockAfter: RelockAfter;
  locked: boolean;
  authenticating: boolean;
  biometryLabel: string;
  /** Device has no passcode, so the lock cannot protect anything. */
  deviceUnsecured: boolean;
  error: string | null;
};

export const lockStore = createStore<LockState>({
  ready: false,
  enabled: true,
  relockAfter: 0,
  locked: true,
  authenticating: false,
  biometryLabel: 'Face ID',
  deviceUnsecured: false,
  error: null,
});

async function persist() {
  const { enabled, relockAfter } = lockStore.get();
  try {
    await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify({ enabled, relockAfter }));
  } catch {
    // ignore
  }
}

export async function initLock() {
  let enabled = true;
  let relockAfter: RelockAfter = 0;
  try {
    const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as { enabled?: boolean; relockAfter?: RelockAfter };
      enabled = s.enabled ?? true;
      relockAfter = s.relockAfter ?? 0;
    }
  } catch {
    // defaults
  }
  let biometryLabel = 'Passcode';
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) biometryLabel = 'Face ID';
    else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) biometryLabel = 'Touch ID';
  } catch {
    // ignore
  }
  lockStore.set({ ready: true, enabled, relockAfter, locked: enabled, biometryLabel });
}

export async function unlock(): Promise<boolean> {
  if (lockStore.get().authenticating) return false;
  lockStore.set({ authenticating: true, error: null });
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) {
      lockStore.set({ locked: false, deviceUnsecured: true });
      return true;
    }
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock CaseSeal',
      fallbackLabel: 'Use Passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    if (r.success) {
      lockStore.set({ locked: false, deviceUnsecured: false });
      return true;
    }
    if (r.error === 'passcode_not_set' || r.error === 'not_enrolled') {
      lockStore.set({ locked: false, deviceUnsecured: true });
      return true;
    }
    if (r.error !== 'user_cancel' && r.error !== 'system_cancel' && r.error !== 'app_cancel') {
      lockStore.set({ error: 'Authentication failed. Try again.' });
    }
    return false;
  } catch {
    lockStore.set({ error: 'Authentication is unavailable right now.' });
    return false;
  } finally {
    lockStore.set({ authenticating: false });
  }
}

export function lockNow() {
  if (lockStore.get().enabled) lockStore.set({ locked: true });
}

/** Turning the lock off requires authenticating first. */
export async function setLockEnabled(enabled: boolean): Promise<boolean> {
  if (!enabled) {
    lockStore.set({ locked: true });
    const ok = await unlock();
    if (!ok) {
      lockStore.set({ locked: false });
      return false;
    }
  }
  lockStore.set({ enabled, locked: false });
  await persist();
  return true;
}

export async function setRelockAfter(relockAfter: RelockAfter) {
  lockStore.set({ relockAfter });
  await persist();
}
