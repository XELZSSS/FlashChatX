import type OpenAI from 'openai';
import { ServiceParams, TokenUsage } from '../types';
import {
  buildFinalMessages,
  buildOpenAIToolPayload,
  resolveProviderState,
  resolveOpenAIReasoningEffort,
  withRetry,
  streamOpenAIStyleChatWithLocalFiles,
} from './serviceUtils';

export const streamDeepSeekResponse = async function* (params: ServiceParams) {
  const {
    history,
    message,
    useThinking,
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

  // Choose model based on thinking status for DeepSeek provider
  let modelToUse = configuredModel;
  if (provider === 'deepseek') {
    if (useThinking) {
      modelToUse = 'deepseek-reasoner';
    } else {
      modelToUse = 'deepseek-chat';
    }
  }

  const finalMessages: OpenAI.Chat.ChatCompletionMessageParam[] =
    buildFinalMessages({
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

    const toolModel = provider === 'deepseek' ? 'deepseek-chat' : modelToUse;

    yield* streamOpenAIStyleChatWithLocalFiles({
      endpoint: 'deepseek',
      payload: {
        model: toolModel,
        messages: toolMessages,
        stream: streaming,
        stream_options: { include_usage: true },
        reasoning_effort: useThinking
          ? resolveOpenAIReasoningEffort(
              thinkingLevel,
              config.thinkingBudgetTokens
            )
          : undefined,
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

  const proxyUrl = 'http://localhost:8787/api/deepseek';
  const payload = {
    model: modelToUse,
    messages: finalMessages,
    stream: streaming,
    reasoning_effort: useThinking
      ? resolveOpenAIReasoningEffort(thinkingLevel, config.thinkingBudgetTokens)
      : undefined,
    temperature: config.temperature,
    top_p: config.showAdvancedParams ? config.topP : undefined,
    top_k: config.showAdvancedParams ? config.topK : undefined,
    ...buildOpenAIToolPayload(config.toolConfig, { managedOnly: true }),
  };

  if (useSearch) {
    yield* streamOpenAIStyleChatWithLocalFiles({
      endpoint: 'deepseek',
      payload,
      localAttachments: params.localAttachments,
      toolConfig: config.toolConfig,
      useSearch,
      errorMessage,
    });
    return;
  }

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

  try {
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

    // Non-streaming path
    if (!streaming) {
      const data = await response.json();
      const messageData = data.choices?.[0]?.message as any;
      const content = messageData?.content || '';
      const reasoningContent = messageData?.reasoning_content || '';

      const usage = toTokenUsage(data.usage);

      if (usage) {
        yield `__TOKEN_USAGE__${JSON.stringify(usage)}`;
      }

      if (reasoningContent) {
        yield '<thinking>';
        yield reasoningContent;
        yield '</thinking>';
      }

      if (content) {
        yield content;
      }
      return;
    }

    // Streaming path
    let isInThinking = false;
    let hasYieldedThinkingStart = false;
    let tokenUsage: TokenUsage | undefined;

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body from proxy');
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
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (!data || data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta as any;

            tokenUsage = toTokenUsage(parsed.usage) || tokenUsage;

            if (delta?.reasoning_content) {
              if (!isInThinking) {
                isInThinking = true;
                hasYieldedThinkingStart = true;
                yield '<thinking>';
              }
              yield delta.reasoning_content;
            } else if (delta?.content) {
              if (isInThinking && hasYieldedThinkingStart) {
                yield '</thinking>';
                isInThinking = false;
                hasYieldedThinkingStart = false;
              }
              yield delta.content;
            }
          } catch (err) {
            console.warn('Failed to parse streaming chunk:', err);
          }
        }
      }
    } finally {
      if (isInThinking && hasYieldedThinkingStart) {
        yield '</thinking>';
        isInThinking = false;
        hasYieldedThinkingStart = false;
      }
    }

    if (tokenUsage) {
      yield `__TOKEN_USAGE__${JSON.stringify(tokenUsage)}`;
    }
  } catch (error) {
    console.error('DeepSeek API Error:', error);
    const message =
      errorMessage || (error instanceof Error ? error.message : '');
    throw new Error(message);
  }
};
