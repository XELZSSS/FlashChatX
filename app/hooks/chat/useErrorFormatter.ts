import { useCallback } from 'react';

type TranslationFn = (key: string) => string;

/**
 * Hook for formatting error messages with helpful hints
 * 用于格式化错误消息并提供有用提示的 Hook
 */
export const useErrorFormatter = (t: TranslationFn) => {
  const formatErrorMessage = useCallback(
    (error: unknown) => {
      const raw =
        error instanceof Error ? error.message?.trim() : String(error || '');
      const normalized = raw.toLowerCase();
      const hints: string[] = [];

      // API key related errors
      if (normalized.includes('api key') || normalized.includes('apikey')) {
        hints.push(t('errorMissingApiKey'));
      }

      // Authentication errors
      if (normalized.includes('401') || normalized.includes('unauthorized')) {
        hints.push(t('errorUnauthorized'));
      }
      if (normalized.includes('403') || normalized.includes('forbidden')) {
        hints.push(t('errorForbidden'));
      }

      // Rate limiting
      if (normalized.includes('429') || normalized.includes('rate limit')) {
        hints.push(t('errorRateLimit'));
      }

      // Network errors
      if (normalized.includes('timeout') || normalized.includes('timed out')) {
        hints.push(t('errorTimeout'));
      }
      if (
        normalized.includes('network') ||
        normalized.includes('econn') ||
        normalized.includes('fetch')
      ) {
        hints.push(t('errorNetwork'));
      }

      // Model errors
      if (normalized.includes('model') && normalized.includes('not')) {
        hints.push(t('errorModelNotFound'));
      }

      // API URL errors
      if (normalized.includes('api url') || normalized.includes('apiurl')) {
        hints.push(t('errorInvalidApiUrl'));
      }

      // Server errors
      if (
        normalized.includes('500') ||
        normalized.includes('502') ||
        normalized.includes('503') ||
        normalized.includes('504')
      ) {
        hints.push(t('errorServer'));
      }

      const details = raw ? `${t('errorDetails')}\n${raw}` : t('errorUnknown');
      const hintText = hints.length
        ? `\n\n${t('errorHints')}\n- ${hints.join('\n- ')}`
        : '';

      return `${t('errorTitle')}\n${details}${hintText}`;
    },
    [t]
  );

  return { formatErrorMessage };
};
