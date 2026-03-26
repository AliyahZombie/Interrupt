import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Language, TranslationKey } from './translations';
import { detectDeviceLanguage, translate } from './translate';

const STORAGE_KEY = 'language';

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'zh';
}

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLanguage(stored)) return stored;
  return detectDeviceLanguage();
}

export function I18nProvider(props: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => getInitialLanguage());

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    return {
      language,
      setLanguage,
      t: (key, vars) => translate(language, key, vars),
    };
  }, [language]);

  return (
    <I18nContext.Provider value={value}>
      {props.children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
