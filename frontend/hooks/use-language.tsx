import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  getCurrentLanguage,
  loadSavedLanguage,
  persistLanguage,
  type AppLanguage,
} from '@/lib/language';

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(getCurrentLanguage);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isActive = true;

    void loadSavedLanguage()
      .catch(() => getCurrentLanguage())
      .then((savedLanguage) => {
        if (isActive) {
          setLanguageState(savedLanguage);
          setIsReady(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    await persistLanguage(nextLanguage);
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  if (!isReady) {
    return null;
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage는 LanguageProvider 안에서 사용해야 합니다.');
  }

  return context;
}
