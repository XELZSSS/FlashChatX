import { buildFinalMessages, injectAttachmentPrompt } from '../messageBuilder';
import { buildThinkingBudgetToggle } from '../serviceUtils';
import { LONGCAT_MODELS } from '../../constants';
import { OpenAIStyleAdapterContext, OpenAIStyleAdapterResult } from './types';

export const buildLongcatAdapter = (
  context: OpenAIStyleAdapterContext
): OpenAIStyleAdapterResult => {
  const { params, config, model } = context;
  const { history, message, useThinking, useSearch, thinkingLevel } = params;

  const provider = config.provider;
  let modelToUse = model;
  if (provider === 'longcat') {
    modelToUse = useThinking ? LONGCAT_MODELS.thinking : LONGCAT_MODELS.default;
  }

  const baseMessages = buildFinalMessages({
    history,
    message,
    useThinking,
    useSearch,
  });

  const hasAttachments = Boolean(params.localAttachments?.length);
  if (hasAttachments) {
    modelToUse = LONGCAT_MODELS.default;
  }

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
    endpoint: 'longcat',
    model: modelToUse,
    messages,
    extraBody,
  };
};
