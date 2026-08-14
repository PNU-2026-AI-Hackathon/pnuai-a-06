import { getPersistentAuthItem, setAuthItem, setPersistentAuthItem } from '@/lib/auth-storage';

export type AppLanguage = 'ko' | 'en';

export const DEFAULT_LANGUAGE: AppLanguage = 'ko';
const LANGUAGE_STORAGE_KEY = 'app_language';

let currentLanguage: AppLanguage = DEFAULT_LANGUAGE;

function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === 'ko' || value === 'en';
}

export function getCurrentLanguage(): AppLanguage {
  return currentLanguage;
}

export function setCurrentLanguage(language: AppLanguage) {
  currentLanguage = language;
  setAuthItem(LANGUAGE_STORAGE_KEY, language);
}

export async function loadSavedLanguage() {
  const savedLanguage = await getPersistentAuthItem(LANGUAGE_STORAGE_KEY);

  if (isAppLanguage(savedLanguage)) {
    currentLanguage = savedLanguage;
  }

  return currentLanguage;
}

export function getLanguageHeaders() {
  return { 'Accept-Language': getCurrentLanguage() };
}

export function persistLanguage(language: AppLanguage) {
  setCurrentLanguage(language);
  return setPersistentAuthItem(LANGUAGE_STORAGE_KEY, language);
}
