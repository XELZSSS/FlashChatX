import Anthropic from '@anthropic-ai/sdk';
import type {
  Messages as AnthropicMessages,
  RawMessageStreamEvent,
  Message,
  MessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming,
} from '@anthropic-ai/sdk/resources/messages';
import type {
  BetaRawMessageStreamEvent,
  Messages as AnthropicBetaMessages,
  BetaMessage,
  BetaMessageParam,
  MessageCreateParamsNonStreaming as BetaMessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming as BetaMessageCreateParamsStreaming,
  BetaToolChoice,
  BetaToolUnion,
} from '@anthropic-ai/sdk/resources/beta/messages';
import type { Stream } from '@anthropic-ai/sdk/streaming';
import { ServiceParams, TokenUsage } from '../types';
import {
  getToolDefinition,
  isToolEnabled,
  SYSTEM_TIME_TOOL_NAME,
} from './toolRegistry';
import {
  buildSystemTimeToolResult,
  isTimeQuery,
  requireApiKey,
  resolveProviderState,
} from './serviceUtils';
import { buildAnthropicAdapterContext } from './adapters/registry';
import type {
  AnthropicAdapterResult,
  AnthropicContentBlock,
  AnthropicMessage,
  AnthropicTool,
  AnthropicToolChoice,
} from './adapters/types';

type CompletionUsage = {
  input_tokens?: number;
  output_tokens?: number;
};

type AnthropicCompletion = {
  content?: AnthropicContentBlock[];
  usage?: CompletionUsage;
};

type StreamEvent = RawMessageStreamEvent | BetaRawMessageStreamEvent;

const MAX_TOKENS = 8192;

const toTokenUsage = (usage?: CompletionUsage): TokenUsage | undefined =>
  usage
    ? {
        prompt_tokens: usage.input_tokens,
        completion_tokens: usage.output_tokens,
        total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      }
    : undefined;

type RequestPayloadOptions = AnthropicAdapterResult & {
  model: string;
  tools?: AnthropicTool[];
  tool_choice?: AnthropicToolChoice;
};

type BaseRequestPayloadOptions = RequestPayloadOptions & {
  messages: AnthropicMessages.MessageParam[];
  tools?: AnthropicMessages.ToolUnion[];
  tool_choice?: AnthropicMessages.ToolChoice;
};

type BetaRequestPayloadOptions = RequestPayloadOptions & {
  messages: BetaMessageParam[];
  tools?: BetaToolUnion[];
  tool_choice?: BetaToolChoice;
};

function buildRequestPayload(
  options: BaseRequestPayloadOptions & { stream: true }
): MessageCreateParamsStreaming;
// eslint-disable-next-line no-redeclare
function buildRequestPayload(
  options: BaseRequestPayloadOptions & { stream: false }
): MessageCreateParamsNonStreaming;
// eslint-disable-next-line no-redeclare
function buildRequestPayload(
  options: BaseRequestPayloadOptions & { stream: boolean }
): MessageCreateParams {
  return {
    model: options.model,
    stream: options.stream,
    messages: options.messages,
    max_tokens: MAX_TOKENS,
    system: options.systemMessage,
    thinking: options.thinking,
    temperature: options.temperature,
    top_p: options.top_p,
    top_k: options.top_k,
    tools: options.tools,
    tool_choice: options.tool_choice,
  };
}

function buildBetaRequestPayload(
  options: BetaRequestPayloadOptions & { stream: true }
): BetaMessageCreateParamsStreaming;
// eslint-disable-next-line no-redeclare
function buildBetaRequestPayload(
  options: BetaRequestPayloadOptions & { stream: false }
): BetaMessageCreateParamsNonStreaming;
// eslint-disable-next-line no-redeclare
function buildBetaRequestPayload(
  options: BetaRequestPayloadOptions & { stream: boolean }
): BetaMessageCreateParams {
  return {
    model: options.model,
    stream: options.stream,
    messages: options.messages,
    max_tokens: MAX_TOKENS,
    system: options.systemMessage,
    thinking: options.thinking,
    temperature: options.temperature,
    top_p: options.top_p,
    top_k: options.top_k,
    tools: options.tools,
    tool_choice: options.tool_choice,
  };
}

const createAnthropicClient = (apiKey: string) =>
  new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

const getContentText = (blocks?: AnthropicContentBlock[] | string) => {
  if (!blocks) return '';
  if (typeof blocks === 'string') return blocks;
  return (
    blocks
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('') || ''
  );
};

const isThinkingBlock = (
  block: AnthropicContentBlock
): block is AnthropicContentBlock & { type: 'thinking'; thinking: string } =>
  block.type === 'thinking';

const getThinkingText = (blocks?: AnthropicContentBlock[] | string) => {
  if (!blocks || typeof blocks === 'string') return '';
  return (
    blocks
      .filter(isThinkingBlock)
      .map(block => block.thinking)
      .join('') || ''
  );
};

const emitNonStreamingMessage = function* (
  completion: AnthropicCompletion
): Generator<string> {
  const usage = toTokenUsage(completion.usage);
  if (usage) {
    yield `__TOKEN_USAGE__${JSON.stringify(usage)}`;
  }

  const thinkingText = getThinkingText(completion.content);
  if (thinkingText) {
    yield `__THINKING__${thinkingText}`;
    yield '__END_THINKING__';
  }

  const content = getContentText(completion.content);
  if (content) {
    yield content;
  }
};

const streamAnthropicMessage = async function* (
  stream: AsyncIterable<StreamEvent>
): AsyncGenerator<string> {
  let tokenUsage: TokenUsage | undefined;
  let hasThinking = false;
  let thinkingEnded = false;

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta) {
      if (chunk.delta.type === 'thinking_delta') {
        const thinking =
          'thinking' in chunk.delta && typeof chunk.delta.thinking === 'string'
            ? chunk.delta.thinking
            : '';
        if (!hasThinking) {
          hasThinking = true;
        }
        if (thinking) {
          yield `__THINKING__${thinking}`;
        }
        continue;
      }

      if (chunk.delta.type === 'text_delta') {
        if (hasThinking && !thinkingEnded) {
          thinkingEnded = true;
          yield '__END_THINKING__';
        }
        const text =
          'text' in chunk.delta && typeof chunk.delta.text === 'string'
            ? chunk.delta.text
            : '';
        if (text) {
          yield text;
        }
        continue;
      }
    }

    if (chunk.type === 'message_delta' && chunk.usage) {
      tokenUsage =
        toTokenUsage({
          input_tokens:
            typeof chunk.usage.input_tokens === 'number'
              ? chunk.usage.input_tokens
              : undefined,
          output_tokens:
            typeof chunk.usage.output_tokens === 'number'
              ? chunk.usage.output_tokens
              : undefined,
        }) || tokenUsage;
    }
  }

  if (hasThinking && !thinkingEnded) {
    yield '__END_THINKING__';
  }

  if (tokenUsage) {
    yield `__TOKEN_USAGE__${JSON.stringify(tokenUsage)}`;
  }
};

type MessageCreateParams = AnthropicMessages.MessageCreateParams;
type BetaMessageCreateParams = AnthropicBetaMessages.MessageCreateParams;

function createMessage(
  client: Anthropic,
  payload: MessageCreateParamsNonStreaming,
  betas?: string[]
): Promise<Message>;
// eslint-disable-next-line no-redeclare
function createMessage(
  client: Anthropic,
  payload: MessageCreateParamsStreaming,
  betas?: string[]
): Promise<Stream<RawMessageStreamEvent>>;
// eslint-disable-next-line no-redeclare
function createMessage(
  client: Anthropic,
  payload: BetaMessageCreateParamsNonStreaming,
  betas?: string[]
): Promise<BetaMessage>;
// eslint-disable-next-line no-redeclare
function createMessage(
  client: Anthropic,
  payload: BetaMessageCreateParamsStreaming,
  betas?: string[]
): Promise<Stream<BetaRawMessageStreamEvent>>;
// eslint-disable-next-line no-redeclare
function createMessage(
  client: Anthropic,
  payload: MessageCreateParams | BetaMessageCreateParams,
  betas?: string[]
): Promise<
  | Message
  | Stream<RawMessageStreamEvent>
  | BetaMessage
  | Stream<BetaRawMessageStreamEvent>
> {
  if (betas?.length) {
    return client.beta.messages.create({
      ...(payload as BetaMessageCreateParams),
      betas,
    });
  }
  return client.messages.create(payload as MessageCreateParams);
}

export const streamAnthropicResponse = async function* (params: ServiceParams) {
  const { message, errorMessage, providerConfig } = params;

  const {
    config,
    model: modelToUse,
    streaming,
  } = resolveProviderState(providerConfig);

  const adapter: AnthropicAdapterResult = buildAnthropicAdapterContext(
    params,
    config
  );
  const { messages: finalMessages, anthropicBeta } = adapter;
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
    const apiKey = requireApiKey(config.apiKey, 'Anthropic API key');
    const client = createAnthropicClient(apiKey);
    const betas = anthropicBeta ? [anthropicBeta] : undefined;
    const useBeta = !!betas?.length;
    const baseMessages = adapter.messages as AnthropicMessages.MessageParam[];
    const betaMessages = adapter.messages as BetaMessageParam[];
    const baseTools = tools as AnthropicMessages.ToolUnion[] | undefined;
    const betaTools = tools as BetaToolUnion[] | undefined;
    const baseToolChoice = tool_choice as
      | AnthropicMessages.ToolChoice
      | undefined;
    const betaToolChoice = tool_choice as BetaToolChoice | undefined;

    const buildBasePayloadNonStreaming = (
      messages: AnthropicMessages.MessageParam[] = baseMessages
    ) =>
      buildRequestPayload({
        ...adapter,
        model: modelToUse,
        stream: false,
        messages,
        tools: baseTools,
        tool_choice: baseToolChoice,
      });

    const buildBasePayloadStreaming = (
      messages: AnthropicMessages.MessageParam[] = baseMessages
    ) =>
      buildRequestPayload({
        ...adapter,
        model: modelToUse,
        stream: true,
        messages,
        tools: baseTools,
        tool_choice: baseToolChoice,
      });

    const buildBetaPayloadNonStreaming = (
      messages: BetaMessageParam[] = betaMessages
    ) =>
      buildBetaRequestPayload({
        ...adapter,
        model: modelToUse,
        stream: false,
        messages,
        tools: betaTools,
        tool_choice: betaToolChoice,
      });

    const buildBetaPayloadStreaming = (
      messages: BetaMessageParam[] = betaMessages
    ) =>
      buildBetaRequestPayload({
        ...adapter,
        model: modelToUse,
        stream: true,
        messages,
        tools: betaTools,
        tool_choice: betaToolChoice,
      });

    if (allowTool && tools) {
      const completion = useBeta
        ? ((await createMessage(
            client,
            buildBetaPayloadNonStreaming(),
            betas
          )) as AnthropicCompletion)
        : ((await createMessage(
            client,
            buildBasePayloadNonStreaming(),
            betas
          )) as AnthropicCompletion);
      const toolUse = completion.content?.find(
        (block): block is AnthropicContentBlock & { type: 'tool_use' } =>
          block.type === 'tool_use' && block.name === SYSTEM_TIME_TOOL_NAME
      );

      if (toolUse?.id) {
        const toolInput =
          toolUse.input &&
          typeof toolUse.input === 'object' &&
          'format' in toolUse.input
            ? (toolUse.input as { format?: string }).format
            : undefined;
        const toolResult: AnthropicContentBlock = {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: buildSystemTimeToolResult(toolInput),
        };
        const assistantContent = completion.content as
          | AnthropicContentBlock[]
          | string;
        const nextMessages: AnthropicMessage[] = [
          ...finalMessages,
          { role: 'assistant', content: assistantContent },
          { role: 'user', content: [toolResult] },
        ];

        if (!streaming) {
          const followup = useBeta
            ? ((await createMessage(
                client,
                buildBetaPayloadNonStreaming(
                  nextMessages as BetaMessageParam[]
                ),
                betas
              )) as AnthropicCompletion)
            : ((await createMessage(
                client,
                buildBasePayloadNonStreaming(
                  nextMessages as AnthropicMessages.MessageParam[]
                ),
                betas
              )) as AnthropicCompletion);
          yield* emitNonStreamingMessage(followup);
          return;
        }

        const stream = useBeta
          ? ((await createMessage(
              client,
              buildBetaPayloadStreaming(nextMessages as BetaMessageParam[]),
              betas
            )) as AsyncIterable<StreamEvent>)
          : ((await createMessage(
              client,
              buildBasePayloadStreaming(
                nextMessages as AnthropicMessages.MessageParam[]
              ),
              betas
            )) as AsyncIterable<StreamEvent>);
        yield* streamAnthropicMessage(stream);
        return;
      }
    }

    if (!streaming) {
      const completion = useBeta
        ? ((await createMessage(
            client,
            buildBetaPayloadNonStreaming(),
            betas
          )) as AnthropicCompletion)
        : ((await createMessage(
            client,
            buildBasePayloadNonStreaming(),
            betas
          )) as AnthropicCompletion);
      yield* emitNonStreamingMessage(completion);
      return;
    }

    const stream = useBeta
      ? ((await createMessage(
          client,
          buildBetaPayloadStreaming(),
          betas
        )) as AsyncIterable<StreamEvent>)
      : ((await createMessage(
          client,
          buildBasePayloadStreaming(),
          betas
        )) as AsyncIterable<StreamEvent>);
    yield* streamAnthropicMessage(stream);
  } catch (error) {
    console.error('Anthropic API Error:', error);
    const message =
      errorMessage || (error instanceof Error ? error.message : '');
    throw new Error(message);
  }
};
