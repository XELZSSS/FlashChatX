import { ServiceParams } from '../types';
import {
  buildFinalMessages,
  buildOpenAIToolPayload,
  resolveThinkingBudget,
  resolveProviderState,
  streamOpenAIStyleChatFromProxy,
  streamOpenAIStyleChatWithLocalFiles,
} from './serviceUtils';

export const streamMiniMaxResponse = async function* (params: ServiceParams) {
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
    model: modelToUse,
    streaming,
  } = resolveProviderState(providerConfig);
  const providerConfigResolved = config;

  const thinkingEnabled = useThinking || useDeepThink;
  const finalMessages = buildFinalMessages({
    history,
    message,
    useThinking,
    useSearch,
    showThinkingSummary: providerConfigResolved.showThinkingSummary,
  });
  const extraBody: any = {};
  if (thinkingEnabled) {
    extraBody.extra_body = {
      reasoning_split: true,
      thinking_budget: resolveThinkingBudget(
        thinkingLevel,
        providerConfigResolved.thinkingBudgetTokens
      ),
    };
  }

  const stripThinkingFromStream = async function* (
    stream: AsyncGenerator<string>
  ) {
    let inThinkBlock = false;
    let tagBuffer = '';
    const thinkTags = new Set(['think', '/think', 'thinking', '/thinking']);

    const filterChunk = (chunk: string) => {
      let text = tagBuffer + chunk;
      tagBuffer = '';
      let output = '';

      for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === '<') {
          const closeIdx = text.indexOf('>', i + 1);
          if (closeIdx === -1) {
            tagBuffer = text.slice(i);
            break;
          }
          const tag = text
            .slice(i + 1, closeIdx)
            .trim()
            .toLowerCase();
          if (thinkTags.has(tag)) {
            inThinkBlock = !tag.startsWith('/');
            i = closeIdx;
            continue;
          }
          if (!inThinkBlock) {
            output += text.slice(i, closeIdx + 1);
          }
          i = closeIdx;
          continue;
        }
        if (!inThinkBlock) output += ch;
      }

      return output;
    };

    for await (const chunk of stream) {
      if (!chunk) continue;
      if (chunk.startsWith('__THINKING__') || chunk === '__END_THINKING__') {
        continue;
      }
      const filtered = filterChunk(chunk);
      if (filtered) yield filtered;
    }
  };

  if (params.localAttachments?.length) {
    const attachments = params.localAttachments;
    const lastUserIndex = [...finalMessages]
      .reverse()
      .findIndex(item => item.role === 'user');
    if (lastUserIndex !== -1) {
      const index = finalMessages.length - 1 - lastUserIndex;
      const fileList = attachments
        .map(file => `- ${file.file.name} (id: ${file.id})`)
        .join('\n');
      finalMessages[index] = {
        ...finalMessages[index],
        content: `${finalMessages[index].content}\n\nAttached files:\n${fileList}\n\nPlease call read_file for any file you need.`,
      };
    }

    const rawStream = streamOpenAIStyleChatWithLocalFiles({
      endpoint: 'minimax',
      payload: {
        model: modelToUse,
        messages: finalMessages,
        stream: streaming,
        stream_options: { include_usage: true },
        ...extraBody,
        temperature: providerConfigResolved.temperature,
        top_p: providerConfigResolved.showAdvancedParams
          ? providerConfigResolved.topP
          : undefined,
        top_k: providerConfigResolved.showAdvancedParams
          ? providerConfigResolved.topK
          : undefined,
        ...buildOpenAIToolPayload(providerConfigResolved.toolConfig, {
          managedOnly: true,
        }),
      },
      localAttachments: attachments,
      toolConfig: providerConfigResolved.toolConfig,
      errorMessage,
    });
    if (thinkingEnabled) {
      yield* rawStream;
    } else {
      yield* stripThinkingFromStream(rawStream);
    }
    return;
  }

  const rawStream = streamOpenAIStyleChatFromProxy({
    endpoint: 'minimax',
    payload: {
      model: modelToUse,
      messages: finalMessages,
      stream: streaming,
      stream_options: { include_usage: true },
      ...extraBody,
      temperature: providerConfigResolved.temperature,
      top_p: providerConfigResolved.showAdvancedParams
        ? providerConfigResolved.topP
        : undefined,
      top_k: providerConfigResolved.showAdvancedParams
        ? providerConfigResolved.topK
        : undefined,
      ...buildOpenAIToolPayload(providerConfigResolved.toolConfig, {
        managedOnly: true,
      }),
    },
    errorMessage,
  });
  if (thinkingEnabled) {
    yield* rawStream;
    return;
  }
  yield* stripThinkingFromStream(rawStream);
};
