import { buildFinalMessages, injectAttachmentPrompt } from '../messageBuilder';
import { buildThinkingBudgetToggle } from '../serviceUtils';
import { BAILING_MODELS } from '../../constants';
import { OpenAIStyleAdapterContext, OpenAIStyleAdapterResult } from './types';

export const buildBailingAdapter = (
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
  if (provider === 'bailing') {
    modelToUse =
      useThinking || useDeepThink
        ? BAILING_MODELS.thinking
        : BAILING_MODELS.default;
  }

  const baseMessages = buildFinalMessages({
    history,
    message,
    useThinking,
    useSearch,
    showThinkingSummary: config.showThinkingSummary,
  });

  const hasAttachments = Boolean(params.localAttachments?.length);
  if (hasAttachments) {
    modelToUse = BAILING_MODELS.default;
  }

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
    endpoint: 'bailing',
    model: modelToUse,
    messages,
    extraBody,
  };
};
