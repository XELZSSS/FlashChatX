import { ServiceParams } from '../types';
import { resolveProviderState } from '../pipeline/serviceUtils';
import { streamOpenAIStyleProvider } from '../pipeline/requestPipeline';
import { getOpenAIStyleAdapter } from '../adapters/registry';

export const streamZIntlResponse = async function* (params: ServiceParams) {
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
