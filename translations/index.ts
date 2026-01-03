/**
 * Translation modules index
 * 翻译模块索引 - 合并所有模块并提供统一导出
 */
import { common } from './common';
import { errors } from './errors';
import { settings } from './settings';
import { providers } from './providers';
import { tools } from './tools';
import { data } from './data';
import { emoji } from './emoji';

// Type for language keys
type LanguageKey = 'English' | '简体中文';

// Merged translations maintaining backward compatibility
export const translations = {
  English: {
    ...common.English,
    ...errors.English,
    ...settings.English,
    ...providers.English,
    ...tools.English,
    ...data.English,
    ...emoji.English,
  },
  简体中文: {
    ...common['简体中文'],
    ...errors['简体中文'],
    ...settings['简体中文'],
    ...providers['简体中文'],
    ...tools['简体中文'],
    ...data['简体中文'],
    ...emoji['简体中文'],
  },
};

// Type exports
export type TranslationKey = keyof (typeof translations)['English'];
export const LANGUAGES = Object.keys(translations) as LanguageKey[];

// Translation getter function
export const getTranslation = (lang: string, key: TranslationKey): string => {
  const dict =
    translations[lang as keyof typeof translations] || translations['English'];
  return dict[key] || translations['English'][key] || key;
};

// Re-export individual modules for direct access
export { common, errors, settings, providers, tools, data, emoji };
