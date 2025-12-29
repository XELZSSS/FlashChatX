import { OpenRouter } from '@openrouter/sdk';
import type {
  ChatGenerationParams,
  ChatGenerationTokenUsage,
  ChatMessageToolCall,
  ChatResponse,
  ChatStreamingResponseChunkData,
  Message,
  Schema3,
  ToolDefinitionJson,
} from '@openrouter/sdk/models';
import { ServiceParams, TokenUsage, ToolPermissionConfig } from '../types';
import { buildFinalMessages, injectAttachmentPrompt } from './messageBuilder';
import {
  buildOpenAIToolPayload,
  buildSystemTimeToolResult,
  isTimeQuery,
  requireApiKey,
  resolveOpenAIReasoningEffort,
  resolveProviderState,
} from './serviceUtils';
import {
  getDefaultToolConfig,
  READ_FILE_TOOL_NAME,
  SYSTEM_TIME_TOOL_NAME,
  WEB_SEARCH_TOOL_NAME,
} from './toolRegistry';
import { searchAndFormat } from './searchService';

type OpenRouterMessageContent =
  | string
  | Array<{ type?: string; text?: string | null }>;

const createOpenRouterClient = (apiKey: string) => new OpenRouter({ apiKey });

const toTokenUsage = (
  usage?: ChatGenerationTokenUsage
): TokenUsage | undefined =>
  usage
    ? {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
        prompt_tokens_details: usage.promptTokensDetails
          ? { cached_tokens: usage.promptTokensDetails.cachedTokens || 0 }
          : undefined,
      }
    : undefined;

const getContentText = (content?: OpenRouterMessageContent | null) => {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return (
    content
      .filter(item => item.type === 'text' && typeof item.text === 'string')
      .map(item => item.text || '')
      .join('') || ''
  );
};

const extractReasoningText = (
  reasoning?: string | null,
  details?: Schema3[]
) => {
  if (reasoning) return reasoning;
  if (!Array.isArray(details)) return '';
  for (const item of details) {
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'reasoning.text' && typeof item.text === 'string') {
      return item.text;
    }
    if (item.type === 'reasoning.summary' && typeof item.summary === 'string') {
      return item.summary;
    }
  }
  return '';
};

const emitNonStreamingMessage = function* (
  completion: ChatResponse
): Generator<string> {
  const usage = toTokenUsage(completion.usage);
  if (usage) {
    yield `__TOKEN_USAGE__${JSON.stringify(usage)}`;
  }

  const choice = completion.choices?.[0];
  const message = choice?.message;
  const reasoningText = extractReasoningText(
    message?.reasoning || null,
    choice?.reasoningDetails
  );
  if (reasoningText) {
    yield `__THINKING__${reasoningText}`;
    yield '__END_THINKING__';
  }

  const content = getContentText(message?.content as OpenRouterMessageContent);
  if (content) {
    yield content;
  }
};

const streamOpenRouterMessage = async function* (
  stream: AsyncIterable<ChatStreamingResponseChunkData>
): AsyncGenerator<string> {
  let tokenUsage: TokenUsage | undefined;
  let hasThinking = false;
  let thinkingEnded = false;

  for await (const chunk of stream) {
    tokenUsage = toTokenUsage(chunk.usage) || tokenUsage;
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;

    const reasoningText = extractReasoningText(
      delta.reasoning || null,
      delta.reasoningDetails
    );
    if (reasoningText) {
      hasThinking = true;
      yield `__THINKING__${reasoningText}`;
      continue;
    }

    const content = delta.content;
    if (content) {
      if (hasThinking && !thinkingEnded) {
        thinkingEnded = true;
        yield '__END_THINKING__';
      }
      yield content;
    }
  }

  if (hasThinking && !thinkingEnded) {
    yield '__END_THINKING__';
  }

  if (tokenUsage) {
    yield `__TOKEN_USAGE__${JSON.stringify(tokenUsage)}`;
  }
};

const normalizeToolConfig = (config?: ToolPermissionConfig) => {
  const fallback = getDefaultToolConfig();
  return {
    enabledToolNames: config?.enabledToolNames || fallback.enabledToolNames,
    toolChoice: config?.toolChoice || fallback.toolChoice,
    toolChoiceName: config?.toolChoiceName || '',
  };
};

const resolveToolNames = (
  toolConfig: ToolPermissionConfig | undefined,
  options: {
    useSearch?: boolean;
    hasAttachments?: boolean;
    lastUserMessageText?: string;
  }
) => {
  const normalized = normalizeToolConfig(toolConfig);
  let toolNames = normalized.enabledToolNames || [];
  if (options.useSearch && !toolNames.includes(WEB_SEARCH_TOOL_NAME)) {
    toolNames = [...toolNames, WEB_SEARCH_TOOL_NAME];
  }
  if (!options.useSearch) {
    toolNames = toolNames.filter(name => name !== WEB_SEARCH_TOOL_NAME);
  }
  if (!isTimeQuery(options.lastUserMessageText || '')) {
    toolNames = toolNames.filter(name => name !== SYSTEM_TIME_TOOL_NAME);
  }
  if (!options.hasAttachments) {
    toolNames = toolNames.filter(name => name !== READ_FILE_TOOL_NAME);
  }
  return toolNames;
};

const normalizeOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizeOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const findAttachment = (
  attachments: NonNullable<ServiceParams['localAttachments']>,
  args: { file_name?: string; file_id?: string }
) => {
  if (args.file_id) {
    const byId = attachments.find(item => item.id === args.file_id);
    if (byId) return byId;
  }
  if (args.file_name) {
    const target = args.file_name.toLowerCase();
    const byName = attachments.find(
      item => item.file.name.toLowerCase() === target
    );
    if (byName) return byName;
  }
  return null;
};

const executeToolCalls = async (
  toolCalls: ChatMessageToolCall[],
  localAttachments?: NonNullable<ServiceParams['localAttachments']>
) => {
  const attachments = localAttachments || [];

  return Promise.all(
    toolCalls.map(async toolCall => {
      let content = '';
      try {
        const args = toolCall?.function?.arguments
          ? JSON.parse(toolCall.function.arguments)
          : {};
        const toolName = toolCall?.function?.name;
        if (toolName === READ_FILE_TOOL_NAME) {
          const attachment = findAttachment(attachments, args);
          if (!attachment) {
            content = `File not found: ${args.file_name || args.file_id || 'unknown'}`;
          } else {
            const { parseFileToText } = await import('../utils/fileParser');
            content = await parseFileToText(attachment.file);
          }
        } else if (toolName === WEB_SEARCH_TOOL_NAME) {
          const query = typeof args.query === 'string' ? args.query.trim() : '';
          if (!query) {
            content = 'Search query is required.';
          } else {
            const searchResult = await searchAndFormat({
              query,
              site: typeof args.site === 'string' ? args.site : undefined,
              filetype:
                typeof args.filetype === 'string' ? args.filetype : undefined,
              fetch_full: normalizeOptionalBoolean(args.fetch_full),
              timeout_ms: normalizeOptionalNumber(args.timeout_ms),
              limit: normalizeOptionalNumber(args.limit),
              page: normalizeOptionalNumber(args.page),
            });
            content = searchResult || 'Search failed.';
          }
        } else if (toolName === SYSTEM_TIME_TOOL_NAME) {
          content = buildSystemTimeToolResult(args?.format);
        } else {
          content = `Unsupported tool: ${toolName || 'unknown'}`;
        }
      } catch (error) {
        content =
          error instanceof Error ? error.message : 'Tool execution failed.';
      }

      return {
        role: 'tool',
        toolCallId: toolCall.id,
        content,
      } satisfies Message;
    })
  );
};

const buildOpenRouterToolPayload = (options: {
  toolConfig?: ToolPermissionConfig;
  toolNames?: string[];
}) => {
  const toolPayload = buildOpenAIToolPayload(options.toolConfig, {
    toolNames: options.toolNames,
  });
  const tools = toolPayload.tools as ToolDefinitionJson[] | undefined;
  const toolChoice = toolPayload.tool_choice;
  return {
    tools,
    toolChoice,
  };
};

export const streamOpenRouterResponse = async function* (
  params: ServiceParams
) {
  const { providerConfig, errorMessage, useThinking, thinkingLevel } = params;

  const {
    config,
    model: modelToUse,
    streaming,
  } = resolveProviderState(providerConfig);

  try {
    const apiKey = requireApiKey(config.apiKey, 'OpenRouter API key');
    const client = createOpenRouterClient(apiKey);

    const baseMessages = buildFinalMessages({
      history: params.history,
      message: params.message,
      useThinking,
      useSearch: params.useSearch,
    });
    const messages = injectAttachmentPrompt(
      baseMessages,
      params.localAttachments
    ) as Message[];

    const reasoning = useThinking
      ? {
          effort: resolveOpenAIReasoningEffort(
            thinkingLevel,
            config.thinkingBudgetTokens
          ),
        }
      : { effort: 'none' as const };

    const advancedParams: Pick<ChatGenerationParams, 'temperature' | 'topP'> = {
      temperature: config.temperature ?? 0,
      topP: config.showAdvancedParams ? config.topP : undefined,
    };

    const toolNames = resolveToolNames(config.toolConfig, {
      useSearch: params.useSearch,
      hasAttachments: !!params.localAttachments?.length,
      lastUserMessageText: params.message,
    });
    const toolPayload = buildOpenRouterToolPayload({
      toolConfig: config.toolConfig,
      toolNames,
    });

    const basePayload: ChatGenerationParams = {
      model: modelToUse,
      messages,
      stream: streaming,
      streamOptions: streaming ? { includeUsage: true } : undefined,
      reasoning,
      ...advancedParams,
      ...(toolPayload.tools ? { tools: toolPayload.tools } : {}),
      ...(toolPayload.toolChoice ? { toolChoice: toolPayload.toolChoice } : {}),
    };

    const toolsEnabled =
      Array.isArray(toolPayload.tools) &&
      toolPayload.tools.length > 0 &&
      toolPayload.toolChoice !== 'none';

    if (!toolsEnabled) {
      if (streaming) {
        const stream = await client.chat.send({
          ...basePayload,
          stream: true,
        });
        yield* streamOpenRouterMessage(
          stream as AsyncIterable<ChatStreamingResponseChunkData>
        );
        return;
      }

      const response = await client.chat.send({
        ...basePayload,
        stream: false,
        streamOptions: undefined,
      });
      yield* emitNonStreamingMessage(response as ChatResponse);
      return;
    }

    const firstResponse = await client.chat.send({
      ...basePayload,
      stream: false,
      streamOptions: undefined,
    });

    const firstCompletion = firstResponse as ChatResponse;
    const toolCalls = firstCompletion.choices?.[0]?.message?.toolCalls || [];

    if (!toolCalls.length) {
      yield* emitNonStreamingMessage(firstCompletion);
      return;
    }

    const toolResults = await executeToolCalls(
      toolCalls,
      params.localAttachments
    );
    const assistantMessage = firstCompletion.choices?.[0]?.message;
    const nextMessages = assistantMessage
      ? [...messages, assistantMessage, ...toolResults]
      : [...messages, ...toolResults];

    if (streaming) {
      const stream = await client.chat.send({
        ...basePayload,
        messages: nextMessages,
        stream: true,
        streamOptions: { includeUsage: true },
      });
      yield* streamOpenRouterMessage(
        stream as AsyncIterable<ChatStreamingResponseChunkData>
      );
      return;
    }

    const followup = await client.chat.send({
      ...basePayload,
      messages: nextMessages,
      stream: false,
      streamOptions: undefined,
    });
    yield* emitNonStreamingMessage(followup as ChatResponse);
  } catch (error) {
    console.error('OpenRouter SDK Error:', error);
    const message =
      errorMessage || (error instanceof Error ? error.message : '');
    throw new Error(message);
  }
};
