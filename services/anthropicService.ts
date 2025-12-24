import { ServiceParams, TokenUsage, UploadedFileReference } from '../types';
import {
  getToolDefinition,
  isToolEnabled,
  SYSTEM_TIME_TOOL_NAME,
} from './toolRegistry';
import {
  buildSystemTimeToolResult,
  buildSystemMessages,
  getThinkingSummaryPrompt,
  isTimeQuery,
  resolveProviderState,
  resolveThinkingBudget,
  withRetry,
} from './serviceUtils';

type CompletionUsage = {
  input_tokens?: number;
  output_tokens?: number;
};

const toTokenUsage = (usage?: CompletionUsage): TokenUsage | undefined =>
  usage
    ? {
        prompt_tokens: usage.input_tokens,
        completion_tokens: usage.output_tokens,
        total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      }
    : undefined;

export const streamAnthropicResponse = async function* (params: ServiceParams) {
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
    model: modelToUse,
    streaming,
  } = resolveProviderState(providerConfig);

  const systemMessages = buildSystemMessages({
    useThinking,
    useSearch,
    showThinkingSummary: config.showThinkingSummary,
  });

  const buildAnthropicContent = (
    text: string,
    attachments?: UploadedFileReference[]
  ) => {
    const blocks: Array<any> = [];
    if (text.trim()) {
      blocks.push({ type: 'text', text });
    }

    attachments
      ?.filter(item => item.provider === 'anthropic')
      .forEach(item => {
        blocks.push({
          type: 'document',
          source: { type: 'file', file_id: item.fileId },
          title: item.name,
        });
      });

    return blocks.length ? blocks : text;
  };

  const finalMessages = history.map(item => ({
    role: item.role === 'model' ? 'assistant' : 'user',
    content:
      item.role === 'user'
        ? buildAnthropicContent(item.content, item.attachments)
        : item.content,
  }));
  const thinkingSummaryPrompt = getThinkingSummaryPrompt(
    useThinking,
    config.showThinkingSummary
  );
  if (thinkingSummaryPrompt) {
    const targetText = params.message?.trim() || '';
    const getText = (content: any) =>
      Array.isArray(content)
        ? content
            .filter(block => block.type === 'text')
            .map(block => block.text || '')
            .join('')
            .trim()
        : String(content || '').trim();
    let targetIndex = -1;
    if (targetText) {
      for (let i = finalMessages.length - 1; i >= 0; i -= 1) {
        if (finalMessages[i].role !== 'user') continue;
        if (getText(finalMessages[i].content) === targetText) {
          targetIndex = i;
          break;
        }
      }
    }
    if (targetIndex === -1) {
      for (let i = finalMessages.length - 1; i >= 0; i -= 1) {
        if (finalMessages[i].role === 'user') {
          targetIndex = i;
          break;
        }
      }
    }
    if (targetIndex !== -1) {
      const content = finalMessages[targetIndex].content;
      finalMessages[targetIndex] = {
        ...finalMessages[targetIndex],
        content: Array.isArray(content)
          ? [...content, { type: 'text', text: `\n\n${thinkingSummaryPrompt}` }]
          : `${String(content || '')}\n\n${thinkingSummaryPrompt}`,
      };
    }
  }
  const hasFileAttachments = history.some(
    item =>
      item.role === 'user' &&
      item.attachments?.some(file => file.provider === 'anthropic')
  );
  const toolConfig = config.toolConfig;
  const toolChoice = toolConfig?.toolChoice || 'auto';
  const toolChoiceName = toolConfig?.toolChoiceName || '';
  const toolEnabled = isToolEnabled(toolConfig, SYSTEM_TIME_TOOL_NAME);
  const specificAllowed =
    toolChoice === 'specific' && toolChoiceName === SYSTEM_TIME_TOOL_NAME;
  const allowTool =
    toolEnabled &&
    toolChoice !== 'none' &&
    (toolChoice === 'required' || specificAllowed || isTimeQuery(message));
  const systemTimeTool = getToolDefinition(SYSTEM_TIME_TOOL_NAME);
  const tools =
    allowTool && systemTimeTool
      ? [
          {
            name: systemTimeTool.name,
            description: systemTimeTool.description,
            input_schema: systemTimeTool.parameters,
          },
        ]
      : undefined;
  const tool_choice =
    allowTool && tools
      ? toolChoice === 'required'
        ? { type: 'any' }
        : specificAllowed
          ? { type: 'tool', name: SYSTEM_TIME_TOOL_NAME }
          : { type: 'auto' }
      : undefined;

  try {
    if (allowTool && tools) {
      const res = await withRetry(async () => {
        const response = await fetch('http://localhost:8787/api/anthropic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelToUse,
            messages: finalMessages,
            max_tokens: 8192,
            stream: false,
            system:
              systemMessages.length > 0 ? systemMessages[0].content : undefined,
            anthropicBeta: hasFileAttachments
              ? 'files-api-2025-04-14'
              : undefined,
            thinking: useThinking
              ? {
                  type: 'enabled',
                  budget_tokens: resolveThinkingBudget(
                    thinkingLevel,
                    config.thinkingBudgetTokens
                  ),
                }
              : undefined,
            temperature: config.temperature,
            top_p: config.showAdvancedParams ? config.topP : undefined,
            top_k: config.showAdvancedParams ? config.topK : undefined,
            tools,
            tool_choice,
          }),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(
            `HTTP ${response.status}: ${response.statusText} - ${text}`
          );
        }
        return response;
      });

      const completion = await res.json();
      const toolUse = completion.content?.find(
        (block: any) =>
          block?.type === 'tool_use' && block?.name === SYSTEM_TIME_TOOL_NAME
      );

      if (toolUse?.id) {
        const toolResult = {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: buildSystemTimeToolResult(toolUse.input?.format),
        };
        const nextMessages = [
          ...finalMessages,
          { role: 'assistant', content: completion.content },
          { role: 'user', content: [toolResult] },
        ];

        if (!streaming) {
          const followRes = await withRetry(async () => {
            const response = await fetch(
              'http://localhost:8787/api/anthropic',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: modelToUse,
                  messages: nextMessages,
                  max_tokens: 8192,
                  stream: false,
                  system:
                    systemMessages.length > 0
                      ? systemMessages[0].content
                      : undefined,
                  anthropicBeta: hasFileAttachments
                    ? 'files-api-2025-04-14'
                    : undefined,
                  thinking: useThinking
                    ? {
                        type: 'enabled',
                        budget_tokens: resolveThinkingBudget(
                          thinkingLevel,
                          config.thinkingBudgetTokens
                        ),
                      }
                    : undefined,
                  temperature: config.temperature,
                  top_p: config.showAdvancedParams ? config.topP : undefined,
                  top_k: config.showAdvancedParams ? config.topK : undefined,
                  tools,
                  tool_choice,
                }),
              }
            );
            if (!response.ok) {
              const text = await response.text().catch(() => '');
              throw new Error(
                `HTTP ${response.status}: ${response.statusText} - ${text}`
              );
            }
            return response;
          });

          const followup = await followRes.json();
          const content =
            followup.content
              ?.filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('') || '';

          const usage = toTokenUsage(followup.usage);

          if (usage) {
            yield `__TOKEN_USAGE__${JSON.stringify(usage)}`;
          }

          if (content) {
            yield content;
          }
          return;
        }

        const response = await withRetry(async () => {
          const res = await fetch('http://localhost:8787/api/anthropic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: modelToUse,
              messages: nextMessages,
              max_tokens: 8192,
              stream: true,
              system:
                systemMessages.length > 0
                  ? systemMessages[0].content
                  : undefined,
              anthropicBeta: hasFileAttachments
                ? 'files-api-2025-04-14'
                : undefined,
              thinking: useThinking
                ? {
                    type: 'enabled',
                    budget_tokens: resolveThinkingBudget(
                      thinkingLevel,
                      config.thinkingBudgetTokens
                    ),
                  }
                : undefined,
              temperature: config.temperature,
              top_p: config.showAdvancedParams ? config.topP : undefined,
              top_k: config.showAdvancedParams ? config.topK : undefined,
              tools,
              tool_choice,
            }),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status}: ${res.statusText} - ${text}`);
          }
          return res;
        });

        let tokenUsage: TokenUsage | undefined;

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body from proxy');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;

            try {
              const chunk = JSON.parse(data);
              if (
                chunk.type === 'content_block_delta' &&
                chunk.delta?.type === 'text_delta'
              ) {
                const content = chunk.delta.text;
                if (content) yield content;
              } else if (chunk.type === 'message_delta') {
                if (chunk.usage) {
                  tokenUsage =
                    toTokenUsage({
                      input_tokens: chunk.usage.input_tokens,
                      output_tokens: chunk.usage.output_tokens,
                    }) || tokenUsage;
                }
              }
            } catch {
              // ignore
            }
          }
        }

        if (tokenUsage) {
          yield `__TOKEN_USAGE__${JSON.stringify(tokenUsage)}`;
        }
        return;
      }
    }

    if (!streaming) {
      const res = await withRetry(async () => {
        const response = await fetch('http://localhost:8787/api/anthropic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelToUse,
            messages: finalMessages,
            max_tokens: 8192,
            stream: false,
            system:
              systemMessages.length > 0 ? systemMessages[0].content : undefined,
            anthropicBeta: hasFileAttachments
              ? 'files-api-2025-04-14'
              : undefined,
            thinking: useThinking
              ? {
                  type: 'enabled',
                  budget_tokens: resolveThinkingBudget(
                    thinkingLevel,
                    config.thinkingBudgetTokens
                  ),
                }
              : undefined,
            temperature: config.temperature,
            top_p: config.showAdvancedParams ? config.topP : undefined,
            top_k: config.showAdvancedParams ? config.topK : undefined,
            tools,
            tool_choice,
          }),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(
            `HTTP ${response.status}: ${response.statusText} - ${text}`
          );
        }
        return response;
      });

      const completion = await res.json();
      const content =
        completion.content
          ?.filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('') || '';

      const usage = toTokenUsage(completion.usage);

      // Yield token usage as a special marker
      if (usage) {
        yield `__TOKEN_USAGE__${JSON.stringify(usage)}`;
      }

      if (content) {
        yield content;
      }
      return;
    }

    const response = await withRetry(async () => {
      const res = await fetch('http://localhost:8787/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToUse,
          messages: finalMessages,
          max_tokens: 8192,
          stream: true,
          system:
            systemMessages.length > 0 ? systemMessages[0].content : undefined,
          anthropicBeta: hasFileAttachments
            ? 'files-api-2025-04-14'
            : undefined,
          thinking: useThinking
            ? {
                type: 'enabled',
                budget_tokens: resolveThinkingBudget(
                  thinkingLevel,
                  config.thinkingBudgetTokens
                ),
              }
            : undefined,
          temperature: config.temperature,
          top_p: config.showAdvancedParams ? config.topP : undefined,
          top_k: config.showAdvancedParams ? config.topK : undefined,
          tools,
          tool_choice,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${res.statusText} - ${text}`);
      }
      return res;
    });

    let tokenUsage: TokenUsage | undefined;

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body from proxy');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;

        try {
          const chunk = JSON.parse(data);
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta?.type === 'text_delta'
          ) {
            const content = chunk.delta.text;
            if (content) yield content;
          } else if (chunk.type === 'message_delta') {
            if (chunk.usage) {
              tokenUsage =
                toTokenUsage({
                  input_tokens: chunk.usage.input_tokens,
                  output_tokens: chunk.usage.output_tokens,
                }) || tokenUsage;
            }
          }
        } catch {
          // ignore
        }
      }
    }

    // Yield token usage at the end of the stream
    if (tokenUsage) {
      yield `__TOKEN_USAGE__${JSON.stringify(tokenUsage)}`;
    }
  } catch (error) {
    console.error('Anthropic API Error:', error);
    const message =
      errorMessage || (error instanceof Error ? error.message : '');
    throw new Error(message);
  }
};
