import {
  ProviderType,
  ServiceParams,
  UploadedFileReference,
} from '../../types';
import { buildInstructionText } from '../pipeline/messageBuilder';
import { resolveThinkingBudget } from '../pipeline/serviceUtils';
import {
  GoogleAdapterConfig,
  GoogleAdapterResult,
  GoogleContentPart,
} from './types';

const buildGoogleParts = (
  text: string,
  provider: ProviderType,
  attachments?: UploadedFileReference[]
): GoogleContentPart[] => {
  const parts: GoogleContentPart[] = [];
  if (text.trim()) {
    parts.push({ text });
  }

  attachments
    ?.filter(item => item.provider === provider && item.fileUri)
    .forEach(item => {
      if (item.fileUri) {
        parts.push({
          fileData: {
            fileUri: item.fileUri,
            mimeType: item.mimeType,
            displayName: item.name,
          },
        });
      }
    });

  return parts.length ? parts : [{ text: '' }];
};

export const buildGoogleAdapter = (
  params: ServiceParams,
  config: GoogleAdapterConfig,
  provider: ProviderType = 'gemini'
): GoogleAdapterResult => {
  const { history, message, useThinking, useSearch, thinkingLevel } = params;

  const contents: GoogleAdapterResult['contents'] = history.map(item => ({
    role: item.role === 'model' ? 'model' : 'user',
    parts: buildGoogleParts(
      item.content || '',
      provider,
      item.role === 'user' ? item.attachments : undefined
    ),
  }));

  const lastHistory = history[history.length - 1];
  const shouldAppendMessage =
    !lastHistory ||
    lastHistory.role !== 'user' ||
    lastHistory.content !== message;

  if (shouldAppendMessage) {
    contents.push({
      role: 'user',
      parts: buildGoogleParts(message, provider, undefined),
    });
  }

  const systemInstruction = buildInstructionText({
    useThinking,
    useSearch,
    language: params.language,
  });

  const generationConfig = {
    temperature: config.temperature ?? 0,
    ...(config.showAdvancedParams && config.topP !== undefined
      ? { topP: config.topP }
      : {}),
    ...(config.showAdvancedParams && config.topK !== undefined
      ? { topK: config.topK }
      : {}),
    ...(useThinking
      ? {
          thinkingConfig: {
            includeThoughts: true,
            thinkingBudget: resolveThinkingBudget(
              thinkingLevel,
              config.thinkingBudgetTokens
            ),
          },
        }
      : {}),
  };

  return { contents, generationConfig, systemInstruction };
};
