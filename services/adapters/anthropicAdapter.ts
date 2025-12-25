import { ServiceParams, UploadedFileReference } from '../../types';
import {
  buildSystemMessages,
  getThinkingSummaryPrompt,
} from '../messageBuilder';
import { resolveThinkingBudget } from '../serviceUtils';
import {
  AnthropicAdapterConfig,
  AnthropicAdapterResult,
  AnthropicContentBlock,
} from './types';

const buildAnthropicContent = (
  text: string,
  attachments?: UploadedFileReference[]
): AnthropicContentBlock[] | string => {
  const blocks: AnthropicContentBlock[] = [];
  if (text.trim()) {
    blocks.push({ type: 'text', text });
  }

  attachments
    ?.filter(item => item.provider === 'anthropic')
    .forEach(item => {
      blocks.push({
        type: 'document',
        source: { type: 'file', file_id: item.fileId },
        title: item.name,
      });
    });

  return blocks.length ? blocks : text;
};

export const buildAnthropicAdapter = (
  params: ServiceParams,
  config: AnthropicAdapterConfig
): AnthropicAdapterResult => {
  const { history, useThinking, useSearch, thinkingLevel } = params;

  const systemMessages = buildSystemMessages({
    useThinking,
    useSearch,
    showThinkingSummary: config.showThinkingSummary,
  });
  const systemMessage =
    systemMessages.length > 0 ? systemMessages[0].content : undefined;

  const finalMessages: AnthropicAdapterResult['messages'] = history.map(
    item => ({
      role: item.role === 'model' ? 'assistant' : 'user',
      content:
        item.role === 'user'
          ? buildAnthropicContent(item.content, item.attachments)
          : item.content,
    })
  );

  const thinkingSummaryPrompt = getThinkingSummaryPrompt(
    useThinking,
    config.showThinkingSummary
  );
  if (thinkingSummaryPrompt) {
    const targetText = params.message?.trim() || '';
    const getText = (content: AnthropicContentBlock[] | string) =>
      Array.isArray(content)
        ? content
            .filter(block => block.type === 'text')
            .map(block => ('text' in block ? block.text || '' : ''))
            .join('')
            .trim()
        : String(content || '').trim();
    let targetIndex = -1;
    if (targetText) {
      for (let i = finalMessages.length - 1; i >= 0; i -= 1) {
        if (finalMessages[i].role !== 'user') continue;
        if (getText(finalMessages[i].content) === targetText) {
          targetIndex = i;
          break;
        }
      }
    }
    if (targetIndex === -1) {
      for (let i = finalMessages.length - 1; i >= 0; i -= 1) {
        if (finalMessages[i].role === 'user') {
          targetIndex = i;
          break;
        }
      }
    }
    if (targetIndex !== -1) {
      const content = finalMessages[targetIndex].content;
      finalMessages[targetIndex] = {
        ...finalMessages[targetIndex],
        content: Array.isArray(content)
          ? [...content, { type: 'text', text: `\n\n${thinkingSummaryPrompt}` }]
          : `${String(content || '')}\n\n${thinkingSummaryPrompt}`,
      };
    }
  }

  const hasFileAttachments = history.some(
    item =>
      item.role === 'user' &&
      item.attachments?.some(file => file.provider === 'anthropic')
  );

  const anthropicBeta = hasFileAttachments ? 'files-api-2025-04-14' : undefined;
  const thinking = useThinking
    ? {
        type: 'enabled',
        budget_tokens: resolveThinkingBudget(
          thinkingLevel,
          config.thinkingBudgetTokens
        ),
      }
    : undefined;

  return {
    messages: finalMessages,
    systemMessage,
    anthropicBeta,
    thinking,
    temperature: config.temperature,
    top_p: config.showAdvancedParams ? config.topP : undefined,
    top_k: config.showAdvancedParams ? config.topK : undefined,
  };
};
