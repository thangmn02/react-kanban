import { createContext } from 'react';

import en from './translations/en';
import vi from './translations/vi';

export type Language = 'en' | 'vi';
export type TranslationKey = keyof typeof en;
export type TranslationParams = Record<string, string | number | boolean | null | undefined>;

export const languageStorageKey = 'app.language';
export const translations: Record<Language, Record<TranslationKey, string>> = { en, vi };

export interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function getInitialLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'en';
  }

  const savedLanguage = window.localStorage.getItem(languageStorageKey);

  if (savedLanguage === 'en' || savedLanguage === 'vi') {
    return savedLanguage;
  }

  return window.navigator.language.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

export function interpolate(template: string, params?: TranslationParams) {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === null || value === undefined ? '' : String(value);
  });
}
