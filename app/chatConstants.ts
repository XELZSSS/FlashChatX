import { ChatConfig, ProviderType } from '../types';

export const MIN_SEND_INTERVAL_MS = 500;

export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  useThinking: false,
  useSearch: false,
  thinkingLevel: 'medium',
};

export const TOOL_SEARCH_PROVIDERS = new Set<ProviderType>([
  'openai',
  'openrouter',
  'xai',
  'openai-compatible',
  'bailing',
  'longcat',
  'modelscope',
  'mimo',
  'minimax',
  'z',
  'z-intl',
]);
