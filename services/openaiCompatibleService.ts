import { ServiceParams } from '../types';
import { resolveProviderState } from './serviceUtils';
import { streamOpenAIStyleProvider } from './requestPipeline';
import { getOpenAIStyleAdapter } from './adapters/registry';

export const streamOpenAICompatibleResponse = async function* (
  params: ServiceParams
) {
  const { providerConfig } = params;

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

  yield* streamOpenAIStyleProvider({
    ...adapter,
    params,
    config: providerConfigResolved,
    streaming,
  });
};
