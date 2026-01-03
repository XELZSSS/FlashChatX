import {
  buildFinalMessages,
  injectAttachmentPrompt,
} from '../pipeline/messageBuilder';
import { buildThinkingBudgetToggle } from '../pipeline/serviceUtils';
import { OpenAIStyleAdapterContext, OpenAIStyleAdapterResult } from './types';

export const buildZIntlAdapter = (
  context: OpenAIStyleAdapterContext
): OpenAIStyleAdapterResult => {
  const { params, config, model } = context;
  const { history, message, useThinking, useSearch, thinkingLevel } = params;

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
    endpoint: 'z-intl',
    model,
    messages,
    extraBody,
  };
};
