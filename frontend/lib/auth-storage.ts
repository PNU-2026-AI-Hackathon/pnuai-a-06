import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const memoryStorage = new Map<string, string>();

function getWebSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getWebPersistentStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const MISSION_COMPLETION_PENDING_KEY = 'mission_completion_alert_pending';
export const DELETED_ACCOUNT_EMAIL_KEY = 'deleted_account_email';

export function markDeletedAccountEmail(email: string) {
  setAuthItem(DELETED_ACCOUNT_EMAIL_KEY, email.trim().toLowerCase());
}

export function clearDeletedAccountEmail() {
  return deletePersistentAuthItem(DELETED_ACCOUNT_EMAIL_KEY);
}

export function setAuthItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    getWebSessionStorage()?.setItem(key, value);
    return;
  }

  memoryStorage.set(key, value);
}

export function getAuthItem(key: string) {
  if (Platform.OS === 'web') {
    return getWebSessionStorage()?.getItem(key) ?? null;
  }

  return memoryStorage.get(key) ?? null;
}

export async function setPersistentAuthItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    getWebPersistentStorage()?.setItem(key, value);
    setAuthItem(key, value);
    return;
  }

  setAuthItem(key, value);

  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Expo Go/dev clients without the native module still use memory storage.
  }
}

export async function getPersistentAuthItem(key: string) {
  if (Platform.OS === 'web') {
    return getWebPersistentStorage()?.getItem(key) ?? null;
  }

  let value: string | null;

  try {
    value = await SecureStore.getItemAsync(key);
  } catch {
    return getAuthItem(key);
  }

  if (value !== null) {
    memoryStorage.set(key, value);
  }

  return value;
}

export async function deletePersistentAuthItem(key: string) {
  memoryStorage.delete(key);

  if (Platform.OS === 'web') {
    getWebSessionStorage()?.removeItem(key);
    getWebPersistentStorage()?.removeItem(key);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore cleanup failures when the native module is unavailable.
  }
}

/** Remove only the persisted copy while keeping the current in-memory session. */
export async function clearPersistedAuthItem(key: string) {
  if (Platform.OS === 'web') {
    getWebPersistentStorage()?.removeItem(key);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore cleanup failures when the native module is unavailable.
  }
}
