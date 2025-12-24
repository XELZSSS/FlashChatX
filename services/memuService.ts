import { MemuClient } from 'memu-js';
import { MEMU_DEFAULTS, STORAGE_KEYS } from '../constants';

// MemU client instance
let memuClient: MemuClient | null = null;
let isInitialized = false;
let cachedBaseUrl: string | null = null;
let cachedApiKey: string | null = null;

// MemU configuration interface
export interface MemuConfig {
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  autoSave: boolean;
  maxMemories: number;
}

// Memory item interface
export interface MemoryItem {
  id: string;
  content: string;
  similarityScore?: number;
  category?: string;
  timestamp?: string;
}

// Memory response interface
export interface MemoryResponse {
  taskId: string;
  status: 'pending' | 'success' | 'failure';
}

// Related memories response interface
export interface RelatedMemoriesResponse {
  relatedMemories: MemoryItem[];
}

// Default configuration
const DEFAULT_CONFIG: MemuConfig = {
  baseUrl: MEMU_DEFAULTS.BASE_URL,
  apiKey: '',
  enabled: false,
  autoSave: true,
  maxMemories: MEMU_DEFAULTS.MAX_MEMORIES,
};

const getJSON = <T>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(
      `Failed to parse localStorage key "${key}", using fallback.`,
      error
    );
    return fallback;
  }
};

// Get MemU client instance
const getMemuClient = (config?: MemuConfig): MemuClient => {
  const memuConfig = config || loadMemuConfig();

  if (!memuConfig.apiKey) {
    throw new Error('MemU API key is required');
  }

  const needsRefresh =
    !memuClient ||
    !isInitialized ||
    cachedBaseUrl !== memuConfig.baseUrl ||
    cachedApiKey !== memuConfig.apiKey;

  if (!memuClient || !isInitialized) {
    memuClient = new MemuClient({
      baseUrl: memuConfig.baseUrl,
      apiKey: memuConfig.apiKey,
      timeout: 30000,
      maxRetries: 3,
    });

    isInitialized = true;
    cachedBaseUrl = memuConfig.baseUrl;
    cachedApiKey = memuConfig.apiKey;
  } else if (needsRefresh) {
    memuClient = new MemuClient({
      baseUrl: memuConfig.baseUrl,
      apiKey: memuConfig.apiKey,
      timeout: 30000,
      maxRetries: 3,
    });
    cachedBaseUrl = memuConfig.baseUrl;
    cachedApiKey = memuConfig.apiKey;
  }

  return memuClient;
};

// Load configuration from environment variables
export const loadMemuConfig = (): MemuConfig => {
  const stored = getJSON<MemuConfig | null>(STORAGE_KEYS.MEMU_CONFIG, null);
  if (stored && typeof stored === 'object') {
    return {
      ...DEFAULT_CONFIG,
      ...stored,
    };
  }

  const max = parseInt(import.meta.env?.MEMU_MAX_MEMORIES || '10', 10);
  const envConfig: MemuConfig = {
    baseUrl: import.meta.env?.MEMU_BASE_URL || DEFAULT_CONFIG.baseUrl,
    apiKey: import.meta.env?.MEMU_API_KEY || '',
    enabled: import.meta.env?.MEMU_ENABLED === 'true',
    autoSave: import.meta.env?.MEMU_AUTO_SAVE !== 'false',
    maxMemories:
      Number.isFinite(max) && max > 0 ? max : DEFAULT_CONFIG.maxMemories,
  };

  localStorage.setItem(STORAGE_KEYS.MEMU_CONFIG, JSON.stringify(envConfig));
  return envConfig;
};

// Save configuration to local storage (preferred for packaged app)
export const saveMemuConfig = async (config: MemuConfig): Promise<boolean> => {
  try {
    localStorage.setItem(STORAGE_KEYS.MEMU_CONFIG, JSON.stringify(config));

    // Best-effort dev-only persistence into project .env.local via proxy
    if (import.meta.env.DEV) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);

        await fetch('http://localhost:8787/api/save-memu-env', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            enabled: config.enabled,
            autoSave: config.autoSave,
            maxMemories: config.maxMemories,
          }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));
      } catch (error) {
        console.warn(
          'Skipping MemU .env.local persistence (proxy unavailable).',
          error
        );
      }
    }

    // Reset client instance to use new configuration
    memuClient = null;
    isInitialized = false;
    cachedApiKey = null;
    cachedBaseUrl = null;

    return true;
  } catch (error) {
    console.error('Failed to save MemU config:', error);
    return false;
  }
};

// Save conversation to memory
export const saveConversationToMemory = async (
  conversation: string,
  userId: string,
  userName: string,
  agentId: string,
  agentName: string,
  config?: MemuConfig
): Promise<MemoryResponse | null> => {
  try {
    const memuConfig = config || loadMemuConfig();

    if (!memuConfig.enabled) return null;
    if (!memuConfig.apiKey) return null;

    const client = getMemuClient(memuConfig);
    const response = await client.memorizeConversation(
      conversation,
      userId,
      userName,
      agentId,
      agentName
    );

    return {
      taskId: response.taskId,
      status: 'pending',
    };
  } catch (error) {
    console.error('Failed to save conversation to memory:', error);
    return null;
  }
};

// Check task status
export const getMemoryTaskStatus = async (
  taskId: string,
  config?: MemuConfig
): Promise<'pending' | 'success' | 'failure'> => {
  try {
    const memuConfig = config || loadMemuConfig();

    if (!memuConfig.enabled || !memuConfig.apiKey) {
      return 'failure';
    }

    const client = getMemuClient(memuConfig);
    const status = await client.getTaskStatus(taskId);

    return status.status as 'pending' | 'success' | 'failure';
  } catch (error) {
    console.error('Failed to get memory task status:', error);
    return 'failure';
  }
};

// Retrieve relevant memories
export const retrieveRelevantMemories = async (
  userId: string,
  query: string,
  agentId?: string,
  config?: MemuConfig
): Promise<MemoryItem[]> => {
  try {
    const memuConfig = config || loadMemuConfig();

    if (!memuConfig.enabled || !memuConfig.apiKey) {
      return [];
    }

    const client = getMemuClient(memuConfig);
    const memories = await client.retrieveRelatedMemoryItems({
      userId,
      query,
      agentId,
      topK: memuConfig.maxMemories,
      minSimilarity: 0.5,
    });

    return memories.relatedMemories.map((memory: any) => ({
      id: memory.memory?.id || Math.random().toString(36).substr(2, 9),
      content: memory.memory?.content || '',
      similarityScore: memory.similarityScore,
      category: memory.memory?.category,
      timestamp: memory.memory?.timestamp,
    }));
  } catch (error) {
    console.error('Failed to retrieve memories:', error);
    return [];
  }
};

// Format conversation to string
export const formatConversationToString = (
  messages: Array<{ role: string; content: string }>
): string => {
  return messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
};

// Reset MemU client
export const resetMemuClient = (): void => {
  memuClient = null;
  isInitialized = false;
  cachedApiKey = null;
  cachedBaseUrl = null;
};

// Check if MemU is available
export const isMemuAvailable = (config?: MemuConfig): boolean => {
  const memuConfig = config || loadMemuConfig();
  return memuConfig.enabled && !!memuConfig.apiKey;
};
