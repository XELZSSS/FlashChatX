import { ProviderConfig, ServiceParams } from '../types';
import {
  buildOpenAIToolPayload,
  streamAnthropicStyleChatFromProxy,
  streamOpenAIStyleChatWithLocalFiles,
} from './serviceUtils';
import {
  AnthropicAdapterResult,
  OpenAIStyleAdapterResult,
} from './adapters/types';

type OpenAIStylePipelineOptions = OpenAIStyleAdapterResult & {
  params: ServiceParams;
  config: ProviderConfig;
  streaming: boolean;
};

type OpenAIStylePayload = {
  model: string;
  messages: OpenAIStyleAdapterResult['messages'];
  stream: boolean;
  stream_options?: Record<string, unknown>;
} & Record<string, unknown>;

const buildAdvancedParams = (config: ProviderConfig) => ({
  temperature: config.temperature,
  top_p: config.showAdvancedParams ? config.topP : undefined,
  top_k: config.showAdvancedParams ? config.topK : undefined,
});

export const streamOpenAIStyleProvider = async function* (
  options: OpenAIStylePipelineOptions
): AsyncGenerator<string> {
  const {
    endpoint,
    params,
    config,
    model,
    messages,
    streaming,
    extraBody,
    streamOptions,
  } = options;

  const payload: OpenAIStylePayload = {
    model,
    messages,
    stream: streaming,
    stream_options: streamOptions ?? { include_usage: true },
    ...extraBody,
    ...buildAdvancedParams(config),
    ...buildOpenAIToolPayload(config.toolConfig, { managedOnly: true }),
  };

  yield* streamOpenAIStyleChatWithLocalFiles({
    endpoint,
    payload,
    localAttachments: params.localAttachments,
    toolConfig: config.toolConfig,
    useSearch: params.useSearch,
    errorMessage: params.errorMessage,
  });
};

type WithModelStream<T> = T & { model: string; stream: boolean };

const buildModelStreamPayload = <T extends { model: string; stream: boolean }>(
  options: T
) => {
  const { model, stream, ...rest } = options;
  return { model, stream, ...rest };
};

type AnthropicPayloadOptions = WithModelStream<AnthropicAdapterResult> & {
  tools?: Array<Record<string, unknown>>;
  tool_choice?: Record<string, unknown>;
  max_tokens?: number;
};

export const buildAnthropicPayload = (options: AnthropicPayloadOptions) => ({
  ...buildModelStreamPayload({
    model: options.model,
    stream: options.stream,
    messages: options.messages,
    max_tokens: options.max_tokens ?? 8192,
    system: options.systemMessage,
    anthropicBeta: options.anthropicBeta,
    thinking: options.thinking,
    temperature: options.temperature,
    top_p: options.top_p,
    top_k: options.top_k,
  }),
  tools: options.tools,
  tool_choice: options.tool_choice,
});

export const streamAnthropicProvider = async function* (options: {
  payload: ReturnType<typeof buildAnthropicPayload>;
  params: ServiceParams;
}): AsyncGenerator<string> {
  yield* streamAnthropicStyleChatFromProxy({
    endpoint: 'anthropic',
    payload: options.payload,
    errorMessage: options.params.errorMessage,
  });
};
