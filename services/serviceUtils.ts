import {
  ProviderConfig,
  getDefaultModelForProvider,
  loadProviderConfig,
} from './providerConfig';
import { TokenUsage, ThinkingLevel, LocalAttachment } from '../types';
import type { OpenAIContentPart } from './adapters/types';
import { THINKING_BUDGETS } from '../constants';
import { parseFileToText } from '../utils/fileParser';
import type { ToolPermissionConfig } from '../types';
import {
  getDefaultToolConfig,
  getToolDefinitionsByNames,
  READ_FILE_TOOL_NAME,
  SYSTEM_TIME_TOOL_NAME,
  WEB_SEARCH_TOOL_NAME,
} from './toolRegistry';
import { searchAndFormat } from './searchService';

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

export const buildThinkingToggle = (useThinking: boolean) => {
  const type: 'enabled' | 'disabled' = useThinking ? 'enabled' : 'disabled';
  return { thinking: { type } };
};

export const resolveThinkingLevel = (
  thinkingLevel?: ThinkingLevel
): ThinkingLevel => thinkingLevel || 'medium';

const OPENAI_BUDGET_TO_EFFORT = [
  { max: 1024, effort: 'low' as ThinkingLevel },
  { max: 4096, effort: 'medium' as ThinkingLevel },
];

export const resolveThinkingBudget = (
  thinkingLevel?: ThinkingLevel,
  customBudget?: number
): number => {
  if (typeof customBudget === 'number' && Number.isFinite(customBudget)) {
    return customBudget;
  }
  return THINKING_BUDGETS[resolveThinkingLevel(thinkingLevel)];
};

export const getThinkingBudget = (thinkingLevel?: ThinkingLevel): number =>
  THINKING_BUDGETS[resolveThinkingLevel(thinkingLevel)];

export const resolveOpenAIReasoningEffort = (
  thinkingLevel?: ThinkingLevel,
  customBudget?: number
): ThinkingLevel => {
  if (typeof customBudget === 'number' && Number.isFinite(customBudget)) {
    for (const rule of OPENAI_BUDGET_TO_EFFORT) {
      if (customBudget <= rule.max) {
        return rule.effort;
      }
    }
    return 'high';
  }
  return resolveThinkingLevel(thinkingLevel);
};

export const buildThinkingBudgetToggle = (
  useThinking: boolean,
  thinkingLevel?: ThinkingLevel,
  customBudget?: number
) => {
  const type: 'enabled' | 'disabled' = useThinking ? 'enabled' : 'disabled';
  if (!useThinking) {
    return { thinking: { type } };
  }
  return {
    thinking: {
      type,
      budget_tokens: resolveThinkingBudget(thinkingLevel, customBudget),
    },
  };
};

export const requireApiKey = (key: string | undefined, label: string) => {
  if (!key) {
    throw new Error(`${label} is missing. Please configure the API key.`);
  }
  return key;
};

// Retry mechanism for API calls with exponential backoff
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const message = String((error as any)?.message || '');
      const status: number | undefined =
        (error as any)?.status || (error as any)?.response?.status || undefined;

      const retryable =
        status === 429 ||
        (status && status >= 500) ||
        message.includes('rate limit') ||
        message.includes('ECONN') ||
        message.includes('ETIMEDOUT') ||
        message.includes('network');

      if (!retryable) {
        throw error;
      }

      if (attempt === maxRetries) {
        throw new Error(
          `Request failed after ${maxRetries + 1} attempts: ${message || 'retry limit reached'}`
        );
      }

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Request failed without error details');
};

const PROXY_BASE_URL = 'http://localhost:8787/api';

const fetchProxy = async (
  endpoint: string,
  payload: unknown
): Promise<Response> =>
  withRetry(async () => {
    const res = await fetch(`${PROXY_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${res.statusText} - ${errorText}`);
    }

    return res;
  });

export const postProxyJson = async (endpoint: string, payload: unknown) => {
  const response = await fetchProxy(endpoint, payload);
  return response.json();
};

const extractGoogleResponseText = (data: any): string =>
  data?.candidates?.[0]?.content?.parts
    ?.map((part: any) => part.text || '')
    .join('') || '';

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
): AsyncGenerator<any> {
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

const getLastUserMessageText = (messages: any[] | undefined): string => {
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
  payload: any;
  errorMessage?: string;
}): AsyncGenerator<string> {
  const { endpoint, payload, errorMessage } = options;

  try {
    const response = await fetchProxy(endpoint, payload);

    if (!payload?.stream) {
      const data = await response.json();
      const messageData = data.choices?.[0]?.message as any;
      const content = messageData?.content || '';
      const reasoningContent =
        messageData?.reasoning_content ||
        (Array.isArray(messageData?.reasoning_details)
          ? (messageData.reasoning_details[0]?.text as string | undefined) || ''
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
      const delta = parsed.choices?.[0]?.delta as any;
      if (!delta) continue;

      const reasoningContent = delta.reasoning_content as string | undefined;
      const reasoningDetails = delta.reasoning_details as any[] | undefined;
      const content = delta.content as string | undefined;

      if (reasoningContent) {
        hasThinking = true;
        yield `__THINKING__${reasoningContent}`;
        continue;
      }

      if (reasoningDetails && Array.isArray(reasoningDetails)) {
        const text = reasoningDetails[0]?.text as string | undefined;
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

export const streamGoogleStyleChatFromProxy = async function* (options: {
  endpoint: string;
  payload: any;
  errorMessage?: string;
}): AsyncGenerator<string> {
  const { endpoint, payload, errorMessage } = options;

  try {
    const response = await fetchProxy(endpoint, payload);

    if (!payload?.stream) {
      const data = await response.json();
      const content = extractGoogleResponseText(data);
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
    let lastText = '';

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
          const parsed = JSON.parse(data);
          const text = extractGoogleResponseText(parsed);
          if (!text) continue;

          if (text.startsWith(lastText)) {
            const delta = text.slice(lastText.length);
            if (delta) yield delta;
          } else {
            yield text;
          }
          lastText = text;
        } catch {
          // ignore malformed chunks
        }
      }
    }
  } catch (error) {
    const message =
      errorMessage || (error instanceof Error ? error.message : '');
    throw new Error(message);
  }
};

export const streamAnthropicStyleChatFromProxy = async function* (options: {
  endpoint: string;
  payload: any;
  errorMessage?: string;
}): AsyncGenerator<string> {
  const { endpoint, payload, errorMessage } = options;

  try {
    const response = await fetchProxy(endpoint, payload);

    if (!payload?.stream) {
      const data = await response.json();
      const content =
        data?.content
          ?.filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('') || '';
      const usage = data?.usage;
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
  payload: any;
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
  const lastUserMessageText = getLastUserMessageText(payload?.messages);
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

  const firstResponse = await postProxyJson(endpoint, {
    ...basePayload,
    stream: false,
    tools: toolPayload.tools,
    tool_choice: toolPayload.tool_choice,
  });

  const assistantMessage = firstResponse?.choices?.[0]?.message;
  const toolCalls = assistantMessage?.tool_calls || [];

  if (!toolCalls.length) {
    const content = assistantMessage?.content || '';
    if (content) {
      yield content;
      return;
    }
    yield* streamOpenAIStyleChatFromProxy({ endpoint, payload, errorMessage });
    return;
  }

  const toolResults = await Promise.all(
    toolCalls.map(async (toolCall: any) => {
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
        tool_call_id: toolCall.id,
        content,
      };
    })
  );

  const messages = [...payload.messages, assistantMessage, ...toolResults];

  yield* streamOpenAIStyleChatFromProxy({
    endpoint,
    payload: {
      ...payload,
      messages,
    },
    errorMessage,
  });
};
