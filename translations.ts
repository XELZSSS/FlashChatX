/**
 * Translation barrel export
 * 翻译统一导出 - 保持向后兼容性
 *
 * This file re-exports from the modularized translations directory.
 * All translations are now organized by functional area:
 * - common: UI/navigation/file handling
 * - errors: Error messages
 * - settings: Settings panel
 * - providers: Provider names and platforms
 * - tools: Tool/memory related
 * - data: Calculator and import/export
 * - emoji: Emoji picker
 */
export {
  translations,
  type TranslationKey,
  LANGUAGES,
  getTranslation,
  // Individual modules for direct access
  common,
  errors,
  settings,
  providers,
  tools,
  data,
  emoji,
} from './translations/index';
