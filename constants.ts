import { Theme, ProviderType, ThinkingLevel } from './types';

// Model constants for each provider
export const MODEL_CONFIG = {
  openai: 'gpt-5.2',
  openrouter: 'openai/gpt-5',
  xai: 'grok-4-1-fast',
  mimo: 'mimo-v2-flash',
  z: 'glm-4.7',
  'z-intl': 'glm-4.7',
  deepseek: 'deepseek-chat',
  'openai-compatible': 'gpt-5.2',
  bailing: 'Ling-1T',
  longcat: 'LongCat-Flash-Chat',
  modelscope: 'deepseek-ai/DeepSeek-V3',
  moonshot: 'kimi-k2-turbo-preview',
  minimax: 'MiniMax-M2.1',
  gemini: 'gemini-3-flash-preview',
  anthropic: 'Claude Opus 4.5',
} as const satisfies Record<ProviderType, string>;

// Bailing specific models
export const BAILING_MODELS = {
  default: 'Ling-1T',
  thinking: 'Ring-1T',
} as const;

// LongCat specific models
export const LONGCAT_MODELS = {
  default: 'LongCat-Flash-Chat',
  thinking: 'LongCat-Flash-Thinking',
} as const;

// Moonshot specific models
export const MOONSHOT_MODELS = {
  default: 'kimi-k2-turbo-preview',
  thinking: 'kimi-k2-thinking-turbo',
} as const;

export const GEMINI_MODELS = {
  default: 'gemini-3-flash-preview',
  thinking: 'gemini-3-pro-preview',
} as const;

// Individual model exports for backward compatibility
export const MODEL_GPT = MODEL_CONFIG.openai;
export const MODEL_Z = MODEL_CONFIG.z;

// Default settings with proper typing
export const DEFAULT_SETTINGS = {
  theme: 'system' as Theme,
  language: 'System',
} as const;

// Supported languages with type safety
export const SUPPORTED_LANGUAGES = ['简体中文', 'English', 'System'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// API endpoints
export const API_ENDPOINTS = {} as const;

// Storage keys
export const STORAGE_KEYS = {
  SESSIONS: 'ds_sessions',
  CURRENT_SESSION: 'ds_current_session',
  SETTINGS: 'ds_settings',
  CHAT_CONFIG: 'ds_chat_config',
  PROVIDER_CONFIG: 'ds_provider_config',
  MEMU_CONFIG: 'ds_memu_config',
} as const;

// UI constants
export const UI_CONSTANTS = {
  MAX_TITLE_LENGTH: 30,
  SIDEBAR_WIDTH: 'w-64',
  MOBILE_BREAKPOINT: 768,
} as const;

// MemU constants
export const MEMU_DEFAULTS = {
  BASE_URL: 'https://api.memu.so',
  MAX_MEMORIES: 10,
  TIMEOUT: 30000,
  MAX_RETRIES: 3,
} as const;

export const THINKING_LEVELS = ['low', 'medium', 'high'] as const;
export const THINKING_BUDGETS: Record<ThinkingLevel, number> = {
  low: 1024,
  medium: 2048,
  high: 4096,
};
