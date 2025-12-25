import { ServiceParams } from '../types';
import { resolveProviderState } from './serviceUtils';
import { streamOpenAIStyleProvider } from './requestPipeline';
import { getOpenAIStyleAdapter } from './adapters/registry';

export const streamMiniMaxResponse = async function* (params: ServiceParams) {
  const { providerConfig, useThinking, useDeepThink } = params;

  const {
    config,
    model: modelToUse,
    streaming,
  } = resolveProviderState(providerConfig);
  const providerConfigResolved = config;
  const adapter = getOpenAIStyleAdapter(providerConfigResolved.provider)({
    params,
    config: providerConfigResolved,
    model: modelToUse,
    streaming,
  });
  const thinkingEnabled = useThinking || useDeepThink;

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
    const rawStream = streamOpenAIStyleProvider({
      ...adapter,
      params,
      config: providerConfigResolved,
      streaming,
    });
    if (thinkingEnabled) {
      yield* rawStream;
    } else {
      yield* stripThinkingFromStream(rawStream);
    }
    return;
  }

  const rawStream = streamOpenAIStyleProvider({
    ...adapter,
    params,
    config: providerConfigResolved,
    streaming,
  });
  if (thinkingEnabled) {
    yield* rawStream;
    return;
  }
  yield* stripThinkingFromStream(rawStream);
};
