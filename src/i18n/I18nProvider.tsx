import {
  useCallback,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  getInitialLanguage,
  I18nContext,
  interpolate,
  languageStorageKey,
  translations,
  type Language,
  type TranslationKey,
  type TranslationParams,
} from './context';

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(languageStorageKey, nextLanguage);
    }
  }, []);

  const t = useCallback((key: TranslationKey, params?: TranslationParams) => {
    const template = translations[language][key] || translations.en[key] || key;
    return interpolate(template, params);
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
  }), [language, setLanguage, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
