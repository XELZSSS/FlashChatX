import { ServiceParams } from '../types';
import {
  buildFinalMessages,
  buildOpenAIToolPayload,
  buildThinkingBudgetToggle,
  resolveProviderState,
  streamOpenAIStyleChatFromProxy,
  streamOpenAIStyleChatWithLocalFiles,
} from './serviceUtils';
import { BAILING_MODELS } from '../constants';

export const streamBailingResponse = async function* (params: ServiceParams) {
  const {
    history,
    message,
    useThinking,
    useDeepThink,
    useSearch,
    thinkingLevel,
    errorMessage,
    providerConfig,
  } = params;

  const {
    config,
    model: configuredModel,
    streaming,
  } = resolveProviderState(providerConfig);
  const provider = config.provider;
  const providerConfigResolved = config;

  // Choose model based on thinking status for Bailing provider
  let modelToUse = configuredModel;
  if (provider === 'bailing') {
    if (useThinking || useDeepThink) {
      modelToUse = BAILING_MODELS.thinking; // Ring-1T for thinking
    } else {
      modelToUse = BAILING_MODELS.default; // Ling-1T for normal chat
    }
  }

  const finalMessages = buildFinalMessages({
    history,
    message,
    useThinking,
    useSearch,
    showThinkingSummary: providerConfigResolved.showThinkingSummary,
  });
  const extraBody = buildThinkingBudgetToggle(
    useThinking || useDeepThink,
    thinkingLevel,
    providerConfigResolved.thinkingBudgetTokens
  );

  if (params.localAttachments?.length) {
    const toolModel = BAILING_MODELS.default;
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
      endpoint: 'bailing',
      payload: {
        model: toolModel,
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
      },
      localAttachments: attachments,
      toolConfig: providerConfigResolved.toolConfig,
      errorMessage,
    });
    return;
  }

  yield* streamOpenAIStyleChatFromProxy({
    endpoint: 'bailing',
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
    },
    errorMessage,
  });
};
