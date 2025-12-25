import { buildFinalMessages, injectAttachmentPrompt } from '../messageBuilder';
import { resolveOpenAIReasoningEffort } from '../serviceUtils';
import { OpenAIStyleAdapterContext, OpenAIStyleAdapterResult } from './types';

export const buildDeepseekAdapter = (
  context: OpenAIStyleAdapterContext
): OpenAIStyleAdapterResult => {
  const { params, config, model } = context;
  const { history, message, useThinking, useSearch, thinkingLevel } = params;

  const provider = config.provider;
  let modelToUse = model;
  if (provider === 'deepseek') {
    modelToUse = useThinking ? 'deepseek-reasoner' : 'deepseek-chat';
  }

  const baseMessages = buildFinalMessages({
    history,
    message,
    useThinking,
    useSearch,
    showThinkingSummary: config.showThinkingSummary,
  });

  const hasAttachments = Boolean(params.localAttachments?.length);
  if (hasAttachments && provider === 'deepseek') {
    modelToUse = 'deepseek-chat';
  }

  const messages = injectAttachmentPrompt(
    baseMessages,
    params.localAttachments
  );

  return {
    endpoint: 'deepseek',
    model: modelToUse,
    messages,
    extraBody: {
      reasoning_effort: useThinking
        ? resolveOpenAIReasoningEffort(
            thinkingLevel,
            config.thinkingBudgetTokens
          )
        : undefined,
    },
  };
};
