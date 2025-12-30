import { buildFinalOpenAIMessages } from '../messageBuilder';
import { resolveOpenAIReasoningEffort } from '../serviceUtils';
import { OpenAIStyleAdapterContext, OpenAIStyleAdapterResult } from './types';

export const buildOpenAIAdapter = (
  context: OpenAIStyleAdapterContext
): OpenAIStyleAdapterResult => {
  const { params, config, model } = context;
  const { history, message, useThinking, useSearch, thinkingLevel } = params;

  const messages = buildFinalOpenAIMessages({
    history,
    message,
    useThinking,
    useSearch,
    language: params.language,
  });

  const reasoningEffort = resolveOpenAIReasoningEffort(
    thinkingLevel,
    config.thinkingBudgetTokens
  );

  return {
    endpoint: 'openai',
    model,
    messages,
    extraBody: {
      reasoning_effort: useThinking ? reasoningEffort : undefined,
    },
  };
};
