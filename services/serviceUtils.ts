import {
  ProviderConfig,
  getDefaultModelForProvider,
  loadProviderConfig,
} from './providerConfig';
import { TokenUsage, ThinkingLevel, LocalAttachment } from '../types';
import type { OpenAIContentPart } from './adapters/types';
import type { ToolPermissionConfig } from '../types';
import {
  getDefaultToolConfig,
  getToolDefinitionsByNames,
  READ_FILE_TOOL_NAME,
  SYSTEM_TIME_TOOL_NAME,
  WEB_SEARCH_TOOL_NAME,
} from './toolRegistry';
import { searchAndFormat } from './searchService';

// Re-export from modularized utils
export {
  buildThinkingToggle,
  buildThinkingBudgetToggle,
  resolveThinkingLevel,
  resolveThinkingBudget,
  getThinkingBudget,
  resolveOpenAIReasoningEffort,
} from './utils/thinkingUtils';

export {
  withRetry,
  fetchProxy,
  postProxyJson,
  requireApiKey,
} from './utils/proxyUtils';

// Import for internal use (with aliases to avoid conflict with re-exports)
import {
  fetchProxy as _fetchProxy,
  postProxyJson as _postProxyJson,
} from './utils/proxyUtils';

// Types used internally
type OpenAIResponseReasoningDetail = { text?: string };
type OpenAIResponseMessage = {
  content?: string;
  reasoning_content?: string;
  reasoning_details?: OpenAIResponseReasoningDetail[];
  tool_calls?: OpenAIToolCall[];
};
type OpenAIResponseChoice = {
  message?: OpenAIResponseMessage;
  delta?: OpenAIResponseMessage;
};
type OpenAIResponse = {
  choices?: OpenAIResponseChoice[];
  usage?: OpenAIStreamUsage;
};
type OpenAIProxyPayload = {
  stream?: boolean;
  messages?: Array<{ role?: string; content?: string | OpenAIContentPart[] }>;
  stream_options?: unknown;
};
type OpenAIToolCall = {
  id: string;
  function?: { name?: string; arguments?: string };
};
type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export const isTimeQuery = (text: string) => {
  if (!text) return false;
  const normalized = text.toLowerCase();
  const hasChinese = /[\u4e00-\u9fa5]/.test(text);
  const excludes = [
    '时间复杂度',
    '时间管理',
    '时间轴',
    'timeline',
    'complexity',
    'time complexity',
  ];
  if (excludes.some(term => normalized.includes(term))) return false;

  if (hasChinese) {
    const cnCore = [
      '时间',
      '日期',
      '星期',
      '几号',
      '几点',
      '多少点',
      '几点钟',
      '现在几点',
      '当前几点',
      '今天几号',
      '今天是几号',
      '今天几月几号',
      '现在几号',
      '现在几月几号',
      '几月几号',
      '今天日期',
      '现在日期',
      '星期几',
      '礼拜几',
      '周几',
      '周几号',
      '今天周几',
      '现在周几',
      '几时',
      '多晚了',
    ];
    const cnQuery = [
      '现在',
      '当前',
      '今天',
      '此刻',
      '几',
      '多少',
      '吗',
      '呢',
      '？',
      '?',
    ];
    const hasCore = cnCore.some(term => text.includes(term));
    const hasQuery = cnQuery.some(term => text.includes(term));
    return hasCore && hasQuery;
  }

  const enCore = [
    'time',
    'date',
    'day',
    'weekday',
    'what time',
    'current time',
    'time is it',
    'today',
    'what date',
    'what day',
    "what's the date",
    "what's the time",
    'what time now',
    'what day is it',
    "today's date",
    'current date',
  ];
  const enQuery = ['what', 'now', 'current', 'today', 'date', 'day', '?'];
  const hasCore = enCore.some(term => normalized.includes(term));
  const hasQuery = enQuery.some(term => normalized.includes(term));
  return hasCore && hasQuery;
};

export const buildSystemTimeToolResult = (format?: string) => {
  const now = new Date();
  const timeZone =
    Intl.DateTimeFormat?.().resolvedOptions?.().timeZone || 'local';
  const payload = {
    local: now.toLocaleString(),
    weekday: now.toLocaleDateString(undefined, { weekday: 'long' }),
    date: now.toLocaleDateString(),
    timeZone,
    timestamp: now.getTime(),
  };
  void format;
  return JSON.stringify(payload);
};

export const resolveProviderState = (providerConfig?: ProviderConfig) => {
  const resolvedConfig = providerConfig || loadProviderConfig();
  const model =
    resolvedConfig.model || getDefaultModelForProvider(resolvedConfig.provider);
  const streaming = resolvedConfig.stream !== false;

  return { config: resolvedConfig, model, streaming };
};



type OpenAIStreamUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
};

const toTokenUsage = (usage?: OpenAIStreamUsage): TokenUsage | undefined =>
  usage
    ? {
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
      prompt_tokens_details: usage.prompt_tokens_details
        ? { cached_tokens: usage.prompt_tokens_details.cached_tokens || 0 }
        : undefined,
    }
    : undefined;

const readOpenAISSE = async function* (
  response: Response
): AsyncGenerator<OpenAIResponse> {
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
        yield JSON.parse(data);
      } catch {
        // Ignore malformed chunks
      }
    }
  }
};

const streamTextChunks = async function* (
  text: string,
  options?: { chunkSize?: number }
): AsyncGenerator<string> {
  const chunkSize = options?.chunkSize ?? 12;
  for (let i = 0; i < text.length; i += chunkSize) {
    yield text.slice(i, i + chunkSize);
    await new Promise(resolve => setTimeout(resolve, 0));
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

export const buildOpenAIToolPayload = (
  toolConfig?: ToolPermissionConfig,
  options?: {
    managedOnly?: boolean;
    forceToolName?: string;
    toolNames?: string[];
  }
) => {
  const normalized = normalizeToolConfig(toolConfig);
  const forceToolName = options?.forceToolName;
  const enabledToolNames = options?.toolNames || normalized.enabledToolNames;

  const toolNames = forceToolName
    ? enabledToolNames.includes(forceToolName)
      ? [forceToolName]
      : []
    : enabledToolNames;

  const definitions = getToolDefinitionsByNames(toolNames, {
    managedOnly: options?.managedOnly,
  });

  if (!definitions.length) {
    if (normalized.toolChoice === 'none') {
      return { tool_choice: 'none' };
    }
    if (options?.managedOnly) {
      return { tool_choice: 'none' };
    }
    return {};
  }

  const tools = definitions.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

  if (forceToolName) {
    return {
      tools,
      tool_choice: { type: 'function', function: { name: forceToolName } },
    };
  }

  if (normalized.toolChoice === 'none') {
    return { tool_choice: 'none' };
  }

  if (normalized.toolChoice === 'required') {
    return { tools, tool_choice: 'required' };
  }

  if (normalized.toolChoice === 'specific' && normalized.toolChoiceName) {
    const match = definitions.find(
      tool => tool.name === normalized.toolChoiceName
    );
    if (match) {
      return {
        tools,
        tool_choice: {
          type: 'function',
          function: { name: normalized.toolChoiceName },
        },
      };
    }
  }

  return { tools, tool_choice: 'auto' };
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

const getMessageText = (content: string | OpenAIContentPart[]) =>
  Array.isArray(content)
    ? content
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('')
    : content;

const getLastUserMessageText = (
  messages:
    | Array<{ role?: string; content?: string | OpenAIContentPart[] }>
    | undefined
): string => {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role !== 'user') continue;
    const text = getMessageText(messages[i].content || '');
    if (text) return text;
  }
  return '';
};

const resolveToolNames = (
  toolConfig: ToolPermissionConfig | undefined,
  options: {
    useSearch?: boolean;
    localAttachments?: LocalAttachment[];
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
  if (!options.localAttachments?.length) {
    toolNames = toolNames.filter(name => name !== READ_FILE_TOOL_NAME);
  }
  return toolNames;
};

export const streamOpenAIStyleChatFromProxy = async function* (options: {
  endpoint: string;
  payload: OpenAIProxyPayload;
  errorMessage?: string;
}): AsyncGenerator<string> {
  const { endpoint, payload, errorMessage } = options;

  try {
    const response = await _fetchProxy(endpoint, payload);

    if (!payload?.stream) {
      const data = (await response.json()) as OpenAIResponse;
      const messageData = data.choices?.[0]?.message;
      const content = messageData?.content || '';
      const reasoningContent =
        messageData?.reasoning_content ||
        (Array.isArray(messageData?.reasoning_details)
          ? messageData.reasoning_details[0]?.text || ''
          : '');

      const usage = toTokenUsage(data.usage);
      if (usage) {
        yield `__TOKEN_USAGE__${JSON.stringify(usage)}`;
      }

      if (reasoningContent) {
        yield `__THINKING__${reasoningContent}`;
        yield `__END_THINKING__`;
      }

      if (content) {
        yield content;
      }
      return;
    }

    let tokenUsage: TokenUsage | undefined;
    let hasThinking = false;
    let thinkingEnded = false;

    for await (const parsed of readOpenAISSE(response)) {
      tokenUsage = toTokenUsage(parsed.usage) || tokenUsage;
      const delta = parsed.choices?.[0]?.delta;
      if (!delta) continue;

      const reasoningContent = delta.reasoning_content;
      const reasoningDetails = delta.reasoning_details;
      const content = delta.content;

      if (reasoningContent) {
        hasThinking = true;
        yield `__THINKING__${reasoningContent}`;
        continue;
      }

      if (reasoningDetails && Array.isArray(reasoningDetails)) {
        const text = reasoningDetails[0]?.text;
        if (text) {
          hasThinking = true;
          yield `__THINKING__${text}`;
          continue;
        }
      }

      if (content) {
        if (hasThinking && !thinkingEnded) {
          thinkingEnded = true;
          yield `__END_THINKING__`;
        }
        yield content;
      }
    }

    if (tokenUsage) {
      yield `__TOKEN_USAGE__${JSON.stringify(tokenUsage)}`;
    }
  } catch (error) {
    const message =
      errorMessage || (error instanceof Error ? error.message : '');
    throw new Error(message);
  }
};

export const streamAnthropicStyleChatFromProxy = async function* (options: {
  endpoint: string;
  payload: { stream?: boolean } & Record<string, unknown>;
  errorMessage?: string;
}): AsyncGenerator<string> {
  const { endpoint, payload, errorMessage } = options;

  try {
    const response = await _fetchProxy(endpoint, payload);

    if (!payload?.stream) {
      const data = (await response.json()) as AnthropicResponse;
      const content =
        data.content
          ?.filter(block => block.type === 'text')
          .map(block => block.text || '')
          .join('') || '';
      const usage = data.usage;
      if (usage) {
        const tokenUsage = {
          prompt_tokens: usage.input_tokens,
          completion_tokens: usage.output_tokens,
          total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
        };
        yield `__TOKEN_USAGE__${JSON.stringify(tokenUsage)}`;
      }
      if (content) {
        yield content;
      }
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body from proxy');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let tokenUsage:
      | {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      }
      | undefined;

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
              tokenUsage = {
                prompt_tokens: chunk.usage.input_tokens || 0,
                completion_tokens: chunk.usage.output_tokens || 0,
                total_tokens:
                  (chunk.usage.input_tokens || 0) +
                  (chunk.usage.output_tokens || 0),
              };
            }
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }

    if (tokenUsage) {
      yield `__TOKEN_USAGE__${JSON.stringify(tokenUsage)}`;
    }
  } catch (error) {
    const message =
      errorMessage || (error instanceof Error ? error.message : '');
    throw new Error(message);
  }
};

const findAttachment = (
  attachments: LocalAttachment[],
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

export const streamOpenAIStyleChatWithLocalFiles = async function* (options: {
  endpoint: string;
  payload: OpenAIProxyPayload;
  localAttachments?: LocalAttachment[];
  errorMessage?: string;
  toolConfig?: ToolPermissionConfig;
  useSearch?: boolean;
}): AsyncGenerator<string> {
  const {
    endpoint,
    payload,
    localAttachments,
    errorMessage,
    toolConfig,
    useSearch,
  } = options;
  const attachments = localAttachments || [];
  const lastUserMessageText = getLastUserMessageText(payload.messages);
  const enabledToolNames = resolveToolNames(toolConfig, {
    useSearch,
    localAttachments: attachments,
    lastUserMessageText,
  });
  const toolPayload = buildOpenAIToolPayload(toolConfig, {
    toolNames: enabledToolNames,
  });
  const toolDisabled =
    toolPayload.tool_choice === 'none' ||
    !Array.isArray(toolPayload.tools) ||
    toolPayload.tools.length === 0;

  if (toolDisabled) {
    yield* streamOpenAIStyleChatFromProxy({ endpoint, payload, errorMessage });
    return;
  }
  const basePayload = { ...(payload || {}) };
  delete basePayload.stream_options;

  const firstResponse = (await _postProxyJson(endpoint, {
    ...basePayload,
    stream: false,
    tools: toolPayload.tools,
    tool_choice: toolPayload.tool_choice,
  })) as OpenAIResponse;

  const initialUsage = toTokenUsage(firstResponse.usage);
  const assistantMessage = firstResponse.choices?.[0]?.message;
  const toolCalls = assistantMessage?.tool_calls || [];

  if (!toolCalls.length) {
    const content = assistantMessage?.content || '';
    if (initialUsage) {
      yield `__TOKEN_USAGE__${JSON.stringify(initialUsage)}`;
    }
    if (content) {
      if (payload?.stream) {
        yield* streamTextChunks(content);
      } else {
        yield content;
      }
      return;
    }
    yield* streamOpenAIStyleChatFromProxy({ endpoint, payload, errorMessage });
    return;
  }

  const toolResults: Array<{
    role: 'tool';
    tool_call_id: string;
    content: string;
  }> = [];
  let searchExecuted = false;
  let cachedSearchResult = '';

  for (const toolCall of toolCalls) {
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
        } else if (!searchExecuted) {
          searchExecuted = true;
          const searchResult = await searchAndFormat({
            query,
            site: typeof args.site === 'string' ? args.site : undefined,
            filetype:
              typeof args.filetype === 'string' ? args.filetype : undefined,
            fetch_full: normalizeOptionalBoolean(args.fetch_full),
            timeout_ms: normalizeOptionalNumber(args.timeout_ms),
            limit: 3,
            page: normalizeOptionalNumber(args.page),
          });
          cachedSearchResult = searchResult || 'Search failed.';
          content = cachedSearchResult;
        } else {
          content = cachedSearchResult || 'Search already performed.';
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

    toolResults.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content,
    });
  }

  if (initialUsage) {
    yield `__TOKEN_USAGE__${JSON.stringify(initialUsage)}`;
  }

  const baseMessages = payload.messages || [];
  const messages = [...baseMessages, assistantMessage, ...toolResults];

  yield* streamOpenAIStyleChatFromProxy({
    endpoint,
    payload: {
      ...payload,
      messages,
    },
    errorMessage,
  });
};
