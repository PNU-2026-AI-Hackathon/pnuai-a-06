import { Platform } from 'react-native';

const memoryStorage = new Map<string, string>();
type SecureStoreModule = typeof import('expo-secure-store');

let secureStore: SecureStoreModule | null | undefined;

function getSecureStore() {
  if (secureStore !== undefined) {
    return secureStore;
  }

  try {
    secureStore = require('expo-secure-store') as SecureStoreModule;
  } catch {
    secureStore = null;
  }

  return secureStore;
}

export const MISSION_COMPLETION_PENDING_KEY = 'mission_completion_alert_pending';

export function setAuthItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }

  memoryStorage.set(key, value);
}

export function getAuthItem(key: string) {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }

  return memoryStorage.get(key) ?? null;
}

export async function setPersistentAuthItem(key: string, value: string) {
  setAuthItem(key, value);

  if (Platform.OS === 'web') {
    return;
  }

  const store = getSecureStore();

  if (!store) {
    return;
  }

  try {
    await store.setItemAsync(key, value);
  } catch {
    // Expo Go/dev clients without the native module still use memory storage.
  }
}

export async function getPersistentAuthItem(key: string) {
  if (Platform.OS === 'web') {
    return getAuthItem(key);
  }

  const store = getSecureStore();

  if (!store) {
    return getAuthItem(key);
  }

  let value: string | null;

  try {
    value = await store.getItemAsync(key);
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
    localStorage.removeItem(key);
    return;
  }

  const store = getSecureStore();

  if (!store) {
    return;
  }

  try {
    await store.deleteItemAsync(key);
  } catch {
    // Ignore cleanup failures when the native module is unavailable.
  }
}
