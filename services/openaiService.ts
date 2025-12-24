import { ServiceParams } from '../types';
import {
  buildFinalOpenAIMessages,
  buildOpenAIToolPayload,
  resolveProviderState,
  resolveOpenAIReasoningEffort,
  streamOpenAIStyleChatWithLocalFiles,
} from './serviceUtils';

export const streamOpenAIResponse = async function* (params: ServiceParams) {
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

  const reasoningEffort = resolveOpenAIReasoningEffort(
    thinkingLevel,
    providerConfigResolved.thinkingBudgetTokens
  );

  yield* streamOpenAIStyleChatWithLocalFiles({
    endpoint: 'openai',
    payload: {
      model: modelToUse,
      messages: finalMessages,
      stream: streaming,
      stream_options: { include_usage: true },
      reasoning_effort: useThinking ? reasoningEffort : undefined,
      temperature: providerConfigResolved.temperature,
      top_p: providerConfigResolved.showAdvancedParams
        ? providerConfigResolved.topP
        : undefined,
      ...buildOpenAIToolPayload(providerConfigResolved.toolConfig, {
        managedOnly: true,
      }),
    },
    localAttachments: params.localAttachments,
    toolConfig: providerConfigResolved.toolConfig,
    useSearch,
    errorMessage,
  });
};
