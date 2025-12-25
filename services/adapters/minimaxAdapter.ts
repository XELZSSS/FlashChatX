import { buildFinalMessages, injectAttachmentPrompt } from '../messageBuilder';
import { resolveThinkingBudget } from '../serviceUtils';
import { OpenAIStyleAdapterContext, OpenAIStyleAdapterResult } from './types';

export const buildMinimaxAdapter = (
  context: OpenAIStyleAdapterContext
): OpenAIStyleAdapterResult => {
  const { params, config, model } = context;
  const {
    history,
    message,
    useThinking,
    useDeepThink,
    useSearch,
    thinkingLevel,
  } = params;

  const thinkingEnabled = useThinking || useDeepThink;
  const baseMessages = buildFinalMessages({
    history,
    message,
    useThinking,
    useSearch,
    showThinkingSummary: config.showThinkingSummary,
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
