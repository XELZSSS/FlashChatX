import { v4 as uuidv4 } from 'uuid';
import {
  LocalAttachment,
  Message,
  MessageRole,
  ProviderConfig,
  ThinkingLevel,
  UploadedFileReference,
} from '../types';

// Use UUID for generating unique IDs
export const generateId = () => uuidv4();

export const getJSON = <T>(key: string, fallback: T): T => {
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

export const setJSON = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const buildHistory = (messages: Message[]): HistoryEntry[] => {
  const filteredMessages = messages.filter(
    m => !(m.role === 'model' && !m.content.trim())
  );

  return filteredMessages.map(m => ({
    role: m.role,
    content: m.content,
    attachments: m.attachments,
  }));
};

// Build history for display (filters out search results)
export const buildDisplayHistory = (messages: Message[]) =>
  messages.filter(
    m =>
      !m.content.includes('根据搜索"') && !m.content.includes('未找到相关内容')
  );

export type StreamGenerator = AsyncGenerator<string>;
export type HistoryEntry = {
  role: MessageRole;
  content: string;
  attachments?: UploadedFileReference[];
};
export type StreamCommon = {
  history: HistoryEntry[];
  message: string;
  localAttachments?: LocalAttachment[];
  useThinking: boolean;
  useSearch: boolean;
  thinkingLevel: ThinkingLevel;
  language?: string;
  providerConfig: ProviderConfig;
  thinkingProcessLabel: string;
  finalAnswerLabel: string;
};
export type StreamFactory = (common: StreamCommon) => StreamGenerator;

const streamFactoryCache = new Map<string, StreamFactory>();

export const loadStreamFactory = (provider: string): Promise<StreamFactory> => {
  const cached = streamFactoryCache.get(provider);
  if (cached) return Promise.resolve(cached);

  switch (provider) {
    case 'z':
      return import('../services/zAIService').then(m => {
        streamFactoryCache.set(provider, m.streamZResponse);
        return m.streamZResponse;
      });
    case 'mimo':
      return import('../services/mimoService').then(m => {
        streamFactoryCache.set(provider, m.streamMimoResponse);
        return m.streamMimoResponse;
      });
    case 'z-intl':
      return import('../services/zIntlService').then(m => {
        streamFactoryCache.set(provider, m.streamZIntlResponse);
        return m.streamZIntlResponse;
      });
    case 'deepseek':
      return import('../services/deepseekService').then(m => {
        streamFactoryCache.set(provider, m.streamDeepSeekResponse);
        return m.streamDeepSeekResponse;
      });
    case 'openai-compatible':
      return import('../services/openaiCompatibleService').then(m => {
        streamFactoryCache.set(provider, m.streamOpenAICompatibleResponse);
        return m.streamOpenAICompatibleResponse;
      });
    case 'openrouter':
      return import('../services/openrouterService').then(m => {
        streamFactoryCache.set(provider, m.streamOpenRouterResponse);
        return m.streamOpenRouterResponse;
      });
    case 'xai':
      return import('../services/xaiService').then(m => {
        streamFactoryCache.set(provider, m.streamXaiResponse);
        return m.streamXaiResponse;
      });
    case 'bailing':
      return import('../services/bailingService').then(m => {
        streamFactoryCache.set(provider, m.streamBailingResponse);
        return m.streamBailingResponse;
      });
    case 'longcat':
      return import('../services/longcatService').then(m => {
        streamFactoryCache.set(provider, m.streamLongCatResponse);
        return m.streamLongCatResponse;
      });
    case 'modelscope':
      return import('../services/modelscopeService').then(m => {
        streamFactoryCache.set(provider, m.streamModelScopeResponse);
        return m.streamModelScopeResponse;
      });
    case 'moonshot':
      return import('../services/moonshotService').then(m => {
        streamFactoryCache.set(provider, m.streamMoonshotResponse);
        return m.streamMoonshotResponse;
      });
    case 'minimax':
      return import('../services/minimaxService').then(m => {
        streamFactoryCache.set(provider, m.streamMiniMaxResponse);
        return m.streamMiniMaxResponse;
      });
    case 'gemini':
      return import('../services/geminiService').then(m => {
        streamFactoryCache.set(provider, m.streamGeminiResponse);
        return m.streamGeminiResponse;
      });
    case 'anthropic':
      return import('../services/anthropicService').then(m => {
        streamFactoryCache.set(provider, m.streamAnthropicResponse);
        return m.streamAnthropicResponse;
      });
    default:
      return import('../services/openaiService').then(m => {
        streamFactoryCache.set(provider, m.streamOpenAIResponse);
        return m.streamOpenAIResponse;
      });
  }
};
