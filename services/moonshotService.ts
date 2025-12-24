import { ServiceParams, TokenUsage } from '../types';
import {
  buildFinalMessages,
  buildOpenAIToolPayload,
  buildThinkingBudgetToggle,
  resolveProviderState,
  streamOpenAIStyleChatWithLocalFiles,
  withRetry,
} from './serviceUtils';
import { MOONSHOT_MODELS } from '../constants';

// Token helpers
const estimateTokenCount = async (
  messages: any[],
  model: string
): Promise<number> => {
  void messages;
  void model;
  return 0;
};

const toTokenUsage = (usage?: any): TokenUsage | undefined =>
  usage
    ? {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        prompt_tokens_details: usage.prompt_tokens_details
          ? { cached_tokens: usage.prompt_tokens_details.cached_tokens || 0 }
          : undefined,
      }
    : undefined;

export const streamMoonshotResponse = async function* (params: ServiceParams) {
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

  // Choose model based on thinking status for Moonshot provider
  let modelToUse = configuredModel;
  if (provider === 'moonshot') {
    const thinkingEnabled = useThinking || useDeepThink;
    modelToUse = thinkingEnabled
      ? MOONSHOT_MODELS.thinking
      : MOONSHOT_MODELS.default;
  }

  const finalMessages = buildFinalMessages({
    history,
    message,
    useThinking,
    useSearch,
    showThinkingSummary: config.showThinkingSummary,
  });

  if (params.localAttachments?.length) {
    const attachments = params.localAttachments;
    const toolMessages = buildFinalMessages({
      history,
      message,
      useThinking,
      useSearch,
      showThinkingSummary: config.showThinkingSummary,
    });
    const lastUserIndex = [...toolMessages]
      .reverse()
      .findIndex(item => item.role === 'user');
    if (lastUserIndex !== -1) {
      const index = toolMessages.length - 1 - lastUserIndex;
      const fileList = attachments
        .map(file => `- ${file.file.name} (id: ${file.id})`)
        .join('\n');
      toolMessages[index] = {
        ...toolMessages[index],
        content: `${toolMessages[index].content}\n\nAttached files:\n${fileList}\n\nPlease call read_file for any file you need.`,
      };
    }

    yield* streamOpenAIStyleChatWithLocalFiles({
      endpoint: 'moonshot',
      payload: {
        model: modelToUse,
        messages: toolMessages,
        stream: streaming,
        stream_options: { include_usage: true },
        ...buildThinkingBudgetToggle(
          useThinking || useDeepThink,
          thinkingLevel,
          config.thinkingBudgetTokens
        ),
        temperature: config.temperature,
        top_p: config.showAdvancedParams ? config.topP : undefined,
        top_k: config.showAdvancedParams ? config.topK : undefined,
        ...buildOpenAIToolPayload(config.toolConfig, { managedOnly: true }),
      },
      localAttachments: attachments,
      toolConfig: config.toolConfig,
      useSearch,
      errorMessage,
    });
    return;
  }

  if (useSearch) {
    yield* streamOpenAIStyleChatWithLocalFiles({
      endpoint: 'moonshot',
      payload: {
        model: modelToUse,
        messages: finalMessages,
        stream: streaming,
        ...buildThinkingBudgetToggle(
          useThinking || useDeepThink,
          thinkingLevel,
          config.thinkingBudgetTokens
        ),
        temperature: config.temperature,
        top_p: config.showAdvancedParams ? config.topP : undefined,
        top_k: config.showAdvancedParams ? config.topK : undefined,
        ...buildOpenAIToolPayload(config.toolConfig, { managedOnly: true }),
      },
      localAttachments: params.localAttachments,
      toolConfig: config.toolConfig,
      useSearch,
      errorMessage,
    });
    return;
  }

  try {
    // Use proxy server for Moonshot AI API calls
    const proxyUrl = 'http://localhost:8787/api/moonshot';

    const payload = {
      model: modelToUse,
      messages: finalMessages,
      stream: streaming,
      ...buildThinkingBudgetToggle(
        useThinking || useDeepThink,
        thinkingLevel,
        config.thinkingBudgetTokens
      ),
      temperature: config.temperature,
      top_p: config.showAdvancedParams ? config.topP : undefined,
      top_k: config.showAdvancedParams ? config.topK : undefined,
      ...buildOpenAIToolPayload(config.toolConfig, { managedOnly: true }),
    };

    // Make request through proxy with retry mechanism
    const response = await withRetry(async () => {
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${res.statusText} - ${errorText}`);
      }

      return res;
    });

    if (!streaming) {
      const data = await response.json();
      const choice = data.choices?.[0];
      const content = choice?.message?.content || '';
      const reasoningContent =
        (choice?.message as any)?.reasoning_content || '';

      // Extract token usage
      const usage = toTokenUsage(data.usage);

      if (!usage) {
        const estimatedTokens = await estimateTokenCount(
          finalMessages,
          modelToUse
        );
        const responseTokens = await estimateTokenCount(
          [{ role: 'assistant', content }],
          modelToUse
        );

        const estimatedUsage: TokenUsage = {
          prompt_tokens: estimatedTokens,
          completion_tokens: responseTokens,
          total_tokens: estimatedTokens + responseTokens,
        };

        yield `__TOKEN_USAGE__${JSON.stringify(estimatedUsage)}`;
      } else {
        yield `__TOKEN_USAGE__${JSON.stringify(usage)}`;
      }

      // Handle reasoning content for non-streaming responses
      if (reasoningContent) {
        yield `__THINKING__${reasoningContent}`;
        yield `__END_THINKING__`;
      }

      if (content) {
        yield content;
      }
      return;
    }

    // Handle streaming response
    let tokenUsage: TokenUsage | undefined;
    let fullContent = '';
    let isInThinking = false;
    let hasYieldedThinkingStart = false;

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta as any;

              // Check for reasoning content (thinking)
              const reasoningContent = delta?.reasoning_content || '';
              const content = delta?.content || '';

              if (reasoningContent) {
                if (!isInThinking) {
                  isInThinking = true;
                  hasYieldedThinkingStart = true;
                  yield `__THINKING__${reasoningContent}`;
                } else {
                  yield `__THINKING__${reasoningContent}`;
                }
              } else if (content) {
                fullContent += content;

                // If we were in thinking mode and now getting regular content, end thinking
                if (isInThinking && hasYieldedThinkingStart) {
                  isInThinking = false;
                  hasYieldedThinkingStart = false;
                  yield `__END_THINKING__`;
                }

                yield content;
              }

              // Check for usage information in the final chunk
              tokenUsage = toTokenUsage(parsed.usage) || tokenUsage;
            } catch (e) {
              // Ignore JSON parse errors for malformed chunks
              console.warn('Failed to parse SSE chunk:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();

      // Ensure thinking phase is properly closed at the end
      if (isInThinking && hasYieldedThinkingStart) {
        yield `__END_THINKING__`;
        isInThinking = false;
        hasYieldedThinkingStart = false;
      }
    }

    // If no usage info from API, try to estimate it
    if (!tokenUsage) {
      const estimatedTokens = await estimateTokenCount(
        finalMessages,
        modelToUse
      );
      const responseTokens = await estimateTokenCount(
        [{ role: 'assistant', content: fullContent }],
        modelToUse
      );

      tokenUsage = {
        prompt_tokens: estimatedTokens,
        completion_tokens: responseTokens,
        total_tokens: estimatedTokens + responseTokens,
      };
    }

    // Yield token usage at the end of the stream
    if (tokenUsage) {
      yield `__TOKEN_USAGE__${JSON.stringify(tokenUsage)}`;
    }
  } catch (error) {
    console.error('Moonshot AI API Error:', error);
    const message =
      errorMessage || (error instanceof Error ? error.message : '');
    throw new Error(message);
  }
};
