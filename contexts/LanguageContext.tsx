import React, { createContext, useMemo } from 'react';
import {
  translations,
  TranslationKey,
  getTranslation,
  LANGUAGES,
} from '../translations';

// Enhanced language context type with better typing
interface LanguageContextType {
  readonly language: string;
  readonly t: (key: TranslationKey) => string;
}

// Default context value
const defaultContext: LanguageContextType = {
  language: 'English',
  t: key => translations['English'][key] || key,
};

const LanguageContext = createContext<LanguageContextType>(defaultContext);

// Export the context for use in separate hook file
export { LanguageContext };

// Language resolution utilities
const resolveSystemLanguage = (): string => {
  if (typeof navigator === 'undefined') return 'English';

  const browserLang = navigator.language;
  return browserLang.startsWith('zh') ? '简体中文' : 'English';
};

const validateLanguage = (language: string): string => {
  return LANGUAGES.includes(language as (typeof LANGUAGES)[number])
    ? language
    : 'English';
};

// Optimized language provider component
export const LanguageProvider: React.FC<{
  readonly language: string;
  readonly children: React.ReactNode;
}> = ({ language, children }) => {
  // Memoize language resolution to avoid unnecessary recalculations
  const activeLanguage = useMemo(() => {
    if (language === 'System') {
      return resolveSystemLanguage();
    }
    return validateLanguage(language);
  }, [language]);

  // Memoize translation function
  const t = useMemo(() => {
    return (key: TranslationKey): string => getTranslation(activeLanguage, key);
  }, [activeLanguage]);

  // Memoize context value
  const contextValue = useMemo(
    (): LanguageContextType => ({
      language: activeLanguage,
      t,
    }),
    [activeLanguage, t]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};
