import {
  buildFinalOpenAIMessages,
  injectAttachmentPrompt,
} from '../messageBuilder';
import { OpenAIStyleAdapterContext, OpenAIStyleAdapterResult } from './types';

export const buildXaiAdapter = (
  context: OpenAIStyleAdapterContext
): OpenAIStyleAdapterResult => {
  const { params, model } = context;
  const { history, message, useThinking, useSearch } = params;

  const baseMessages = buildFinalOpenAIMessages({
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

  return {
    endpoint: 'xai',
    model,
    messages,
  };
};
