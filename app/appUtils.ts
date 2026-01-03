import { v4 as uuidv4 } from 'uuid';
import { LocalAttachment, ProviderConfig, ThinkingLevel } from '../types';
import type { HistoryEntry } from '../utils/chatHistory';

export const generateId = () => uuidv4();

export type StreamGenerator = AsyncGenerator<string>;
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
      return import('../services/providers/zAIService').then(m => {
        streamFactoryCache.set(provider, m.streamZResponse);
        return m.streamZResponse;
      });
    case 'z-intl':
      return import('../services/providers/zIntlService').then(m => {
        streamFactoryCache.set(provider, m.streamZIntlResponse);
        return m.streamZIntlResponse;
      });
    case 'deepseek':
      return import('../services/providers/deepseekService').then(m => {
        streamFactoryCache.set(provider, m.streamDeepSeekResponse);
        return m.streamDeepSeekResponse;
      });
    case 'openai-compatible':
      return import('../services/providers/openaiCompatibleService').then(m => {
        streamFactoryCache.set(provider, m.streamOpenAICompatibleResponse);
        return m.streamOpenAICompatibleResponse;
      });
    case 'xai':
      return import('../services/providers/xaiService').then(m => {
        streamFactoryCache.set(provider, m.streamXaiResponse);
        return m.streamXaiResponse;
      });
    case 'bailing':
      return import('../services/providers/bailingService').then(m => {
        streamFactoryCache.set(provider, m.streamBailingResponse);
        return m.streamBailingResponse;
      });
    case 'longcat':
      return import('../services/providers/longcatService').then(m => {
        streamFactoryCache.set(provider, m.streamLongCatResponse);
        return m.streamLongCatResponse;
      });
    case 'moonshot':
      return import('../services/providers/moonshotService').then(m => {
        streamFactoryCache.set(provider, m.streamMoonshotResponse);
        return m.streamMoonshotResponse;
      });
    case 'minimax':
      return import('../services/providers/minimaxService').then(m => {
        streamFactoryCache.set(provider, m.streamMiniMaxResponse);
        return m.streamMiniMaxResponse;
      });
    case 'gemini':
      return import('../services/providers/geminiService').then(m => {
        streamFactoryCache.set(provider, m.streamGeminiResponse);
        return m.streamGeminiResponse;
      });
    case 'anthropic':
      return import('../services/providers/anthropicService').then(m => {
        streamFactoryCache.set(provider, m.streamAnthropicResponse);
        return m.streamAnthropicResponse;
      });
    default:
      return import('../services/providers/openaiService').then(m => {
        streamFactoryCache.set(provider, m.streamOpenAIResponse);
        return m.streamOpenAIResponse;
      });
  }
};
