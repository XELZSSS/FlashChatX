import {
  buildFinalMessages,
  injectAttachmentPrompt,
} from '../pipeline/messageBuilder';
import { buildThinkingBudgetToggle } from '../pipeline/serviceUtils';
import { MOONSHOT_MODELS } from '../../constants';
import { OpenAIStyleAdapterContext, OpenAIStyleAdapterResult } from './types';

export const buildMoonshotAdapter = (
  context: OpenAIStyleAdapterContext
): OpenAIStyleAdapterResult => {
  const { params, config, model } = context;
  const { history, message, useThinking, useSearch, thinkingLevel } = params;

  const provider = config.provider;
  let modelToUse = model;
  if (provider === 'moonshot') {
    modelToUse = useThinking
      ? MOONSHOT_MODELS.thinking
      : MOONSHOT_MODELS.default;
  }

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
  const extraBody = buildThinkingBudgetToggle(
    useThinking,
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
