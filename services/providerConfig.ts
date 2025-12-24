import { MODEL_CONFIG, STORAGE_KEYS } from '../constants';
import {
  ProviderType,
  ProviderConfig as IProviderConfig,
  ToolPermissionConfig,
} from '../types';
import { getDefaultToolConfig } from './toolRegistry';

// Re-export for backward compatibility
export type ProviderConfig = IProviderConfig;

// Environment variable helper with better error handling
const getEnvVar = (key: string): string | undefined => {
  try {
    return import.meta.env?.[key] || process.env?.[key];
  } catch (error) {
    console.warn(`Failed to read environment variable ${key}:`, error);
    return undefined;
  }
};

// Default configuration using constants
const defaultConfig: ProviderConfig = {
  provider: 'openai',
  apiKey: '',
  model: MODEL_CONFIG.openai,
  stream: true,
  temperature: 0.0,
  showAdvancedParams: false,
  showThinkingSummary: false,
  toolConfig: getDefaultToolConfig(),
};

type ProviderConfigStoreV2 = {
  version: 2;
  currentProvider: ProviderType;
  configs: Partial<Record<ProviderType, ProviderConfig>>;
};

const STORE_VERSION = 2 as const;

// Provider-specific environment variable mappings
const PROVIDER_ENV_VARS = {
  openai: { apiKey: 'OPENAI_API_KEY', model: 'OPENAI_MODEL' },
  mimo: { apiKey: 'MIMO_API_KEY', model: 'MIMO_MODEL' },
  z: { apiKey: 'Z_API_KEY', model: 'Z_MODEL' },
  'z-intl': { apiKey: 'Z_INTL_API_KEY', model: 'Z_INTL_MODEL' },
  deepseek: { apiKey: 'DEEPSEEK_API_KEY', model: 'DEEPSEEK_MODEL' },
  'openai-compatible': {
    apiKey: 'OPENAI_COMPATIBLE_API_KEY',
    model: 'OPENAI_COMPATIBLE_MODEL',
    apiUrl: 'OPENAI_COMPATIBLE_API_URL',
  },
  bailing: {
    apiKey: 'BAILING_API_KEY',
    model: 'BAILING_MODEL',
    thinkingModel: 'BAILING_THINKING_MODEL',
  },
  longcat: {
    apiKey: 'LONGCAT_API_KEY',
    model: 'LONGCAT_MODEL',
    thinkingModel: 'LONGCAT_THINKING_MODEL',
  },
  modelscope: { apiKey: 'MODELSCOPE_API_KEY', model: 'MODELSCOPE_MODEL' },
  moonshot: { apiKey: 'MOONSHOT_API_KEY', model: 'MOONSHOT_MODEL' },
  minimax: { apiKey: 'MINIMAX_API_KEY', model: 'MINIMAX_MODEL' },
  google: { apiKey: 'GOOGLE_API_KEY', model: 'GOOGLE_MODEL' },
  anthropic: { apiKey: 'ANTHROPIC_API_KEY', model: 'ANTHROPIC_MODEL' },
} as const satisfies Record<
  ProviderType,
  { apiKey: string; model: string; apiUrl?: string; thinkingModel?: string }
>;

// Get default model for provider with better type safety
export const getDefaultModelForProvider = (provider: ProviderType): string => {
  const envKey = PROVIDER_ENV_VARS[provider].model;
  return getEnvVar(envKey) || MODEL_CONFIG[provider];
};

// Get default API key for provider
export const getDefaultApiKeyForProvider = (provider: ProviderType): string => {
  const envKey = PROVIDER_ENV_VARS[provider].apiKey;
  return getEnvVar(envKey) || '';
};

const getBaseConfigForProvider = (provider: ProviderType): ProviderConfig => {
  const envConfig = getEnvProviderConfig(provider);
  return {
    ...defaultConfig,
    provider,
    model: envConfig.model ?? getDefaultModelForProvider(provider),
    apiKey: envConfig.apiKey ?? getDefaultApiKeyForProvider(provider),
    stream: envConfig.stream ?? true,
    apiUrl: envConfig.apiUrl,
  };
};

const isProviderType = (value: unknown): value is ProviderType => {
  return (
    typeof value === 'string' && (value as ProviderType) in PROVIDER_ENV_VARS
  );
};

const coerceStore = (parsed: unknown): ProviderConfigStoreV2 | null => {
  if (!parsed || typeof parsed !== 'object') return null;

  const candidate = parsed as any;

  if (
    candidate.version === STORE_VERSION &&
    isProviderType(candidate.currentProvider) &&
    candidate.configs &&
    typeof candidate.configs === 'object'
  ) {
    return candidate as ProviderConfigStoreV2;
  }

  // Backward compatibility: older schema stored a single ProviderConfig
  if (isProviderType(candidate.provider)) {
    const provider = candidate.provider as ProviderType;
    const migrated: ProviderConfigStoreV2 = {
      version: STORE_VERSION,
      currentProvider: provider,
      configs: {
        [provider]: {
          ...getBaseConfigForProvider(provider),
          ...candidate,
          provider,
        },
      },
    };
    return migrated;
  }

  return null;
};

const loadProviderConfigStore = (): ProviderConfigStoreV2 => {
  const raw = localStorage.getItem(STORAGE_KEYS.PROVIDER_CONFIG);
  if (!raw) {
    return {
      version: STORE_VERSION,
      currentProvider: defaultConfig.provider,
      configs: {},
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const store = coerceStore(parsed);
    if (store) return store;
  } catch (error) {
    console.warn(
      'Failed to parse provider config store from storage, resetting to defaults.',
      error
    );
  }

  localStorage.removeItem(STORAGE_KEYS.PROVIDER_CONFIG);
  return {
    version: STORE_VERSION,
    currentProvider: defaultConfig.provider,
    configs: {},
  };
};

const mergeProviderConfig = (
  provider: ProviderType,
  stored: ProviderConfig | undefined
): ProviderConfig => {
  const base = getBaseConfigForProvider(provider);
  const merged: ProviderConfig = {
    ...base,
    ...stored,
    provider,
  };

  if (!merged.model) merged.model = base.model;
  if (merged.apiKey === undefined) merged.apiKey = base.apiKey;
  if (merged.stream === undefined) merged.stream = base.stream;
  if (merged.temperature === undefined) merged.temperature = base.temperature;
  if (merged.showAdvancedParams === undefined) {
    merged.showAdvancedParams = base.showAdvancedParams;
  }
  if (merged.showThinkingSummary === undefined) {
    merged.showThinkingSummary = base.showThinkingSummary;
  }
  if (!merged.toolConfig) {
    merged.toolConfig = getDefaultToolConfig();
  } else {
    merged.toolConfig = {
      ...getDefaultToolConfig(),
      ...merged.toolConfig,
      enabledToolNames:
        merged.toolConfig.enabledToolNames ||
        getDefaultToolConfig().enabledToolNames,
    } as ToolPermissionConfig;
  }

  if (provider === 'openai-compatible') {
    merged.apiUrl = stored?.apiUrl ?? base.apiUrl;
  } else {
    delete (merged as any).apiUrl;
  }

  return merged;
};

export const getProviderConfigForProvider = (provider: ProviderType) => {
  const store = loadProviderConfigStore();
  return mergeProviderConfig(provider, store.configs[provider]);
};

// Get complete provider configuration from environment variables
export const getEnvProviderConfig = (
  provider: ProviderType
): Partial<ProviderConfig> => {
  const config: Partial<ProviderConfig> = {
    provider,
    model: getDefaultModelForProvider(provider),
    apiKey: getDefaultApiKeyForProvider(provider),
    stream: true,
  };

  // Add apiUrl for openai-compatible provider
  if (provider === 'openai-compatible') {
    const envVars = PROVIDER_ENV_VARS[provider];
    if (envVars.apiUrl) {
      config.apiUrl = getEnvVar(envVars.apiUrl);
    }
  }

  return config;
};

// Cache loaded config to avoid repeated checks
let cachedConfig: ProviderConfig | null = null;
let hasInitialized = false;

export const loadProviderConfig = (): ProviderConfig => {
  // Return cached config if already initialized and cache exists
  if (hasInitialized && cachedConfig) {
    return cachedConfig;
  }

  const store = loadProviderConfigStore();
  const provider = store.currentProvider;
  const config = mergeProviderConfig(provider, store.configs[provider]);

  cachedConfig = config;
  hasInitialized = true;
  return config;
};

// Save state management
let lastSavedConfig: ProviderConfig | null = null;
let isInitializing = false;

const normalizeToolConfig = (config?: ToolPermissionConfig) => {
  const fallback = getDefaultToolConfig();
  return {
    enabledToolNames: config?.enabledToolNames || fallback.enabledToolNames,
    toolChoice: config?.toolChoice || fallback.toolChoice,
    toolChoiceName: config?.toolChoiceName || '',
  };
};

const areToolConfigsEqual = (
  a?: ToolPermissionConfig,
  b?: ToolPermissionConfig
) => {
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

export const saveProviderConfig = async (
  config: ProviderConfig,
  options?: { force?: boolean }
): Promise<boolean> => {
  const store = loadProviderConfigStore();
  const prev = store.configs[config.provider];

  const hasChanged =
    !prev ||
    prev.apiKey !== config.apiKey ||
    prev.model !== config.model ||
    prev.stream !== config.stream ||
    prev.apiUrl !== config.apiUrl ||
    prev.temperature !== config.temperature ||
    prev.topP !== config.topP ||
    prev.topK !== config.topK ||
    prev.showAdvancedParams !== config.showAdvancedParams ||
    prev.thinkingBudgetTokens !== config.thinkingBudgetTokens ||
    prev.showThinkingSummary !== config.showThinkingSummary ||
    !areToolConfigsEqual(prev.toolConfig, config.toolConfig) ||
    store.currentProvider !== config.provider;

  if (!hasChanged) return true;

  const nextStore: ProviderConfigStoreV2 = {
    ...store,
    currentProvider: config.provider,
    configs: {
      ...store.configs,
      [config.provider]: { ...config },
    },
  };

  // Save to localStorage immediately (Electron will persist this under userData)
  localStorage.setItem(STORAGE_KEYS.PROVIDER_CONFIG, JSON.stringify(nextStore));
  cachedConfig = { ...config };
  hasInitialized = true;

  const isSameAsLastSaved =
    lastSavedConfig &&
    lastSavedConfig.provider === config.provider &&
    lastSavedConfig.apiKey === config.apiKey &&
    lastSavedConfig.model === config.model &&
    lastSavedConfig.apiUrl === config.apiUrl &&
    lastSavedConfig.temperature === config.temperature &&
    lastSavedConfig.topP === config.topP &&
    lastSavedConfig.topK === config.topK &&
    lastSavedConfig.showAdvancedParams === config.showAdvancedParams &&
    lastSavedConfig.thinkingBudgetTokens === config.thinkingBudgetTokens &&
    lastSavedConfig.showThinkingSummary === config.showThinkingSummary &&
    areToolConfigsEqual(lastSavedConfig.toolConfig, config.toolConfig);

  const forceSave = options?.force === true;

  if (!isSameAsLastSaved && (!isInitializing || forceSave)) {
    const persistToProxy = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);

      try {
        const response = await fetch('http://localhost:8787/api/save-env', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: config.provider,
            apiKey: config.apiKey,
            model: config.model,
            apiUrl: config.apiUrl,
          }),
          signal: controller.signal,
        });

        if (response.ok) {
          const result = await response.json().catch(() => ({}));
          console.log('Server response:', result);
          return true;
        }

        const errorData = await response.json().catch(() => ({}));
        console.error(
          'Failed to save config to server:',
          errorData.error || 'Unknown error'
        );
        return false;
      } catch (error) {
        console.warn(
          'Skipping environment persistence (proxy unavailable).',
          error
        );
        return false;
      } finally {
        clearTimeout(timeout);
      }
    };

    let persisted = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      persisted = await persistToProxy();
      if (persisted) break;
      await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
    }

    if (persisted) {
      lastSavedConfig = { ...config };
    }
  }

  return true;
};

// Cache management utilities
export const resetProviderConfigCache = (): void => {
  cachedConfig = null;
  hasInitialized = false;
  lastSavedConfig = null;
};
