import { ServiceParams } from '../types';
import { resolveProviderState } from './serviceUtils';
import { streamOpenAIStyleProvider } from './requestPipeline';
import { getOpenAIStyleAdapter } from './adapters/registry';

export const streamMoonshotResponse = async function* (params: ServiceParams) {
  const { providerConfig } = params;

  const {
    config,
    model: configuredModel,
    streaming,
  } = resolveProviderState(providerConfig);
  const adapter = getOpenAIStyleAdapter(config.provider)({
    params,
    config,
    model: configuredModel,
    streaming,
  });

  yield* streamOpenAIStyleProvider({
    ...adapter,
    params,
    config,
    streaming,
  });
};
