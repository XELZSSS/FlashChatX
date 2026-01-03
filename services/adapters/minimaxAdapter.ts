import {
  buildFinalMessages,
  injectAttachmentPrompt,
} from '../pipeline/messageBuilder';
import { resolveThinkingBudget } from '../pipeline/serviceUtils';
import { OpenAIStyleAdapterContext, OpenAIStyleAdapterResult } from './types';

export const buildMinimaxAdapter = (
  context: OpenAIStyleAdapterContext
): OpenAIStyleAdapterResult => {
  const { params, config, model } = context;
  const { history, message, useThinking, useSearch, thinkingLevel } = params;

  const thinkingEnabled = useThinking;
  const baseMessages = buildFinalMessages({
    history,
    message,
    useThinking,
    useSearch,
    language: params.language,
  });

  const messages = injectAttachmentPrompt(
    baseMessages,
    params.localAttachments
  );
  const extraBody: Record<string, unknown> = {};
  if (thinkingEnabled) {
    extraBody.extra_body = {
      reasoning_split: true,
      thinking_budget: resolveThinkingBudget(
        thinkingLevel,
        config.thinkingBudgetTokens
      ),
    };
  }

  return {
    endpoint: 'minimax',
    model,
    messages,
    extraBody,
  };
};
