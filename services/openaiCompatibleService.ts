import { ServiceParams } from '../types';
import {
  buildFinalOpenAIMessages,
  buildOpenAIToolPayload,
  buildThinkingBudgetToggle,
  resolveProviderState,
  streamOpenAIStyleChatFromProxy,
  streamOpenAIStyleChatWithLocalFiles,
} from './serviceUtils';

export const streamOpenAICompatibleResponse = async function* (
  params: ServiceParams
) {
  const {
    history,
    useThinking,
    useSearch,
    thinkingLevel,
    errorMessage,
    providerConfig,
  } = params;

  const {
    config,
    model: modelToUse,
    streaming,
  } = resolveProviderState(providerConfig);
  const providerConfigResolved = config;
  const finalMessages = buildFinalOpenAIMessages({
    history,
    message: params.message,
    useThinking,
    useSearch,
    showThinkingSummary: providerConfigResolved.showThinkingSummary,
  });

  const extraBody = buildThinkingBudgetToggle(
    useThinking,
    thinkingLevel,
    providerConfigResolved.thinkingBudgetTokens
  );

  if (params.localAttachments?.length) {
    const attachments = params.localAttachments;
    const lastUserIndex = [...finalMessages]
      .reverse()
      .findIndex(item => item.role === 'user');
    if (lastUserIndex !== -1) {
      const index = finalMessages.length - 1 - lastUserIndex;
      const fileList = attachments
        .map(file => `- ${file.file.name} (id: ${file.id})`)
        .join('\n');
      finalMessages[index] = {
        ...finalMessages[index],
        content: `${finalMessages[index].content}\n\nAttached files:\n${fileList}\n\nPlease call read_file for any file you need.`,
      };
    }

    yield* streamOpenAIStyleChatWithLocalFiles({
      endpoint: 'openai-compatible',
      payload: {
        model: modelToUse,
        messages: finalMessages,
        stream: streaming,
        stream_options: { include_usage: true },
        ...extraBody,
        temperature: providerConfigResolved.temperature,
        top_p: providerConfigResolved.showAdvancedParams
          ? providerConfigResolved.topP
          : undefined,
        top_k: providerConfigResolved.showAdvancedParams
          ? providerConfigResolved.topK
          : undefined,
        ...buildOpenAIToolPayload(providerConfigResolved.toolConfig, {
          managedOnly: true,
        }),
        apiUrl: providerConfigResolved.apiUrl,
      },
      localAttachments: attachments,
      toolConfig: providerConfigResolved.toolConfig,
      errorMessage,
    });
    return;
  }

  yield* streamOpenAIStyleChatFromProxy({
    endpoint: 'openai-compatible',
    payload: {
      model: modelToUse,
      messages: finalMessages,
      stream: streaming,
      stream_options: { include_usage: true },
      ...extraBody,
      temperature: providerConfigResolved.temperature,
      top_p: providerConfigResolved.showAdvancedParams
        ? providerConfigResolved.topP
        : undefined,
      top_k: providerConfigResolved.showAdvancedParams
        ? providerConfigResolved.topK
        : undefined,
      ...buildOpenAIToolPayload(providerConfigResolved.toolConfig, {
        managedOnly: true,
      }),
      apiUrl: providerConfigResolved.apiUrl,
    },
    errorMessage,
  });
};
