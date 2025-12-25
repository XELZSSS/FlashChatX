import { buildFinalMessages, injectAttachmentPrompt } from '../messageBuilder';
import { buildThinkingBudgetToggle } from '../serviceUtils';
import { OpenAIStyleAdapterContext, OpenAIStyleAdapterResult } from './types';

export const buildMimoAdapter = (
  context: OpenAIStyleAdapterContext
): OpenAIStyleAdapterResult => {
  const { params, config, model } = context;
  const { history, message, useThinking, useSearch, thinkingLevel } = params;

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
  const thinkingToggle = buildThinkingBudgetToggle(
    useThinking,
    thinkingLevel,
    config.thinkingBudgetTokens
  );

  return {
    endpoint: 'mimo',
    model,
    messages,
    extraBody: {
      thinking: thinkingToggle.thinking,
    },
  };
};
