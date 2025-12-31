import { ProviderConfig } from '../services/providerConfig';
import { getDefaultToolConfig } from '../services/toolRegistry';

/**
 * Normalizes tool configuration to ensure consistent comparison
 */
export const normalizeToolConfig = (
  config?: ProviderConfig['toolConfig']
): NonNullable<ProviderConfig['toolConfig']> => {
  const fallback = getDefaultToolConfig();
  return {
    enabledToolNames: config?.enabledToolNames || fallback.enabledToolNames,
    toolChoice: config?.toolChoice || fallback.toolChoice,
    toolChoiceName: config?.toolChoiceName || '',
  };
};

/**
 * Compares two tool configurations for equality
 */
export const isToolConfigEqual = (
  a?: ProviderConfig['toolConfig'],
  b?: ProviderConfig['toolConfig']
): boolean => {
  const left = normalizeToolConfig(a);
  const right = normalizeToolConfig(b);

  if (left.toolChoice !== right.toolChoice) return false;
  if (left.toolChoiceName !== right.toolChoiceName) return false;
  if (left.enabledToolNames.length !== right.enabledToolNames.length) {
    return false;
  }

  const leftSorted = [...left.enabledToolNames].sort();
  const rightSorted = [...right.enabledToolNames].sort();
  return leftSorted.every((name, idx) => name === rightSorted[idx]);
};

/**
 * Compares two provider configurations for equality
 */
export const isProviderConfigEqual = (
  current: ProviderConfig,
  initial: ProviderConfig
): boolean => {
  return (
    current.provider === initial.provider &&
    current.apiKey === initial.apiKey &&
    current.model === initial.model &&
    current.stream === initial.stream &&
    current.apiUrl === initial.apiUrl &&
    current.temperature === initial.temperature &&
    current.topP === initial.topP &&
    current.topK === initial.topK &&
    current.showAdvancedParams === initial.showAdvancedParams &&
    current.thinkingBudgetTokens === initial.thinkingBudgetTokens &&
    isToolConfigEqual(current.toolConfig, initial.toolConfig)
  );
};

/**
 * Sanitizes a number string by removing non-numeric characters except decimal point
 */
export const sanitizeNumber = (value: string): string =>
  value.replace(/[^0-9.]/g, '');

/**
 * Normalizes decimal input to ensure only one decimal point
 */
export const normalizeDecimalInput = (value: string): string => {
  const sanitized = sanitizeNumber(value);
  const parts = sanitized.split('.');
  if (parts.length <= 1) return sanitized;
  return `${parts[0]}.${parts.slice(1).join('')}`;
};

/**
 * Parses a decimal input value, handling edge cases
 */
export const parseDecimalInput = (value: string): number | undefined => {
  if (!value) return undefined;
  if (value === '.' || value.endsWith('.')) return undefined;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Parses an integer input value
 */
export const parseIntegerInput = (value: string): number | undefined => {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};
