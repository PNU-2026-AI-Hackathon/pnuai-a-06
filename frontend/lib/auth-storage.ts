import { Platform } from 'react-native';

const memoryStorage = new Map<string, string>();

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
