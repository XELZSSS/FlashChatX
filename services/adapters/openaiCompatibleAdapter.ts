import {
  buildFinalOpenAIMessages,
  injectAttachmentPrompt,
} from '../messageBuilder';
import { buildThinkingBudgetToggle } from '../serviceUtils';
import { OpenAIStyleAdapterContext, OpenAIStyleAdapterResult } from './types';

export const buildOpenAICompatibleAdapter = (
  context: OpenAIStyleAdapterContext
): OpenAIStyleAdapterResult => {
  const { params, config, model } = context;
  const { history, message, useThinking, useSearch, thinkingLevel } = params;

  const baseMessages = buildFinalOpenAIMessages({
    history,
    message,
    useThinking,
    useSearch,
  });

  const messages = injectAttachmentPrompt(
    baseMessages,
    params.localAttachments
  );
  const extraBody = buildThinkingBudgetToggle(
    useThinking,
    thinkingLevel,
    config.thinkingBudgetTokens
  );

  return {
    endpoint: 'openai-compatible',
    model,
    messages,
    extraBody: {
      ...extraBody,
      apiUrl: config.apiUrl,
    },
  };
};
