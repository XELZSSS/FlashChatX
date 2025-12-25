import { buildFinalMessages, injectAttachmentPrompt } from '../messageBuilder';
import { buildThinkingBudgetToggle } from '../serviceUtils';
import { MOONSHOT_MODELS } from '../../constants';
import { OpenAIStyleAdapterContext, OpenAIStyleAdapterResult } from './types';

export const buildMoonshotAdapter = (
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

  const provider = config.provider;
  let modelToUse = model;
  if (provider === 'moonshot') {
    modelToUse =
      useThinking || useDeepThink
        ? MOONSHOT_MODELS.thinking
        : MOONSHOT_MODELS.default;
  }

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
  const extraBody = buildThinkingBudgetToggle(
    useThinking || useDeepThink,
    thinkingLevel,
    config.thinkingBudgetTokens
  );

  return {
    endpoint: 'moonshot',
    model: modelToUse,
    messages,
    extraBody,
  };
};
