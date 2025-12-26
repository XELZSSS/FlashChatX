import { ServiceParams, TokenUsage } from '../types';
import {
  getToolDefinition,
  isToolEnabled,
  SYSTEM_TIME_TOOL_NAME,
} from './toolRegistry';
import {
  buildSystemTimeToolResult,
  isTimeQuery,
  postProxyJson,
  resolveProviderState,
} from './serviceUtils';
import {
  buildAnthropicPayload,
  streamAnthropicProvider,
} from './requestPipeline';
import { buildAnthropicAdapterContext } from './adapters/registry';
import type {
  AnthropicAdapterResult,
  AnthropicContentBlock,
  AnthropicMessage,
} from './adapters/types';

type CompletionUsage = {
  input_tokens?: number;
  output_tokens?: number;
};

type AnthropicCompletion = {
  content?: AnthropicContentBlock[];
  usage?: CompletionUsage;
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
  const {
    messages: finalMessages,
    systemMessage,
    anthropicBeta,
    thinking,
    temperature,
    top_p,
    top_k,
  } = adapter;
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
      const completion = (await postProxyJson(
        'anthropic',
        buildAnthropicPayload({
          model: modelToUse,
          messages: finalMessages,
          stream: false,
          systemMessage,
          anthropicBeta,
          thinking,
          temperature,
          top_p,
          top_k,
          tools,
          tool_choice,
        })
      )) as AnthropicCompletion;
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
          const followup = (await postProxyJson(
            'anthropic',
            buildAnthropicPayload({
              model: modelToUse,
              messages: nextMessages,
              stream: false,
              systemMessage,
              anthropicBeta,
              thinking,
              temperature,
              top_p,
              top_k,
              tools,
              tool_choice,
            })
          )) as AnthropicCompletion;
          const content =
            followup.content
              ?.filter(block => block.type === 'text')
              .map(block => block.text)
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

        yield* streamAnthropicProvider({
          params,
          payload: buildAnthropicPayload({
            model: modelToUse,
            messages: nextMessages,
            stream: true,
            systemMessage,
            anthropicBeta,
            thinking,
            temperature,
            top_p,
            top_k,
            tools,
            tool_choice,
          }),
        });
        return;
      }
    }

    if (!streaming) {
      const completion = (await postProxyJson(
        'anthropic',
        buildAnthropicPayload({
          model: modelToUse,
          messages: finalMessages,
          stream: false,
          systemMessage,
          anthropicBeta,
          thinking,
          temperature,
          top_p,
          top_k,
          tools,
          tool_choice,
        })
      )) as AnthropicCompletion;
      const content =
        completion.content
          ?.filter(block => block.type === 'text')
          .map(block => block.text)
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

    yield* streamAnthropicProvider({
      params,
      payload: buildAnthropicPayload({
        model: modelToUse,
        messages: finalMessages,
        stream: true,
        systemMessage,
        anthropicBeta,
        thinking,
        temperature,
        top_p,
        top_k,
        tools,
        tool_choice,
      }),
    });
  } catch (error) {
    console.error('Anthropic API Error:', error);
    const message =
      errorMessage || (error instanceof Error ? error.message : '');
    throw new Error(message);
  }
};
