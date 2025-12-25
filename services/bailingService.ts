import { ServiceParams } from '../types';
import { resolveProviderState } from './serviceUtils';
import { streamOpenAIStyleProvider } from './requestPipeline';
import { getOpenAIStyleAdapter } from './adapters/registry';

export const streamBailingResponse = async function* (params: ServiceParams) {
  const { providerConfig } = params;

  const {
    config,
    model: configuredModel,
    streaming,
  } = resolveProviderState(providerConfig);
  const providerConfigResolved = config;
  const adapter = getOpenAIStyleAdapter(providerConfigResolved.provider)({
    params,
    config: providerConfigResolved,
    model: configuredModel,
    streaming,
  });

  yield* streamOpenAIStyleProvider({
    ...adapter,
    params,
    config: providerConfigResolved,
    streaming,
  });
};
