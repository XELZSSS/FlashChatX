import { ProviderType, ServiceParams } from '../../types';
import { buildAnthropicAdapter } from './anthropicAdapter';
import { buildBailingAdapter } from './bailingAdapter';
import { buildDeepseekAdapter } from './deepseekAdapter';
import { buildGoogleAdapter } from './googleAdapter';
import { buildLongcatAdapter } from './longcatAdapter';
import { buildMinimaxAdapter } from './minimaxAdapter';
import { buildMimoAdapter } from './mimoAdapter';
import { buildModelscopeAdapter } from './modelscopeAdapter';
import { buildMoonshotAdapter } from './moonshotAdapter';
import { buildOpenAIAdapter } from './openaiAdapter';
import { buildOpenAICompatibleAdapter } from './openaiCompatibleAdapter';
import { buildZAdapter } from './zAdapter';
import { buildZIntlAdapter } from './zIntlAdapter';
import {
  AnthropicAdapterConfig,
  AnthropicAdapterResult,
  GoogleAdapterConfig,
  GoogleAdapterResult,
  OpenAIStyleAdapterContext,
  OpenAIStyleAdapterResult,
} from './types';

type OpenAIStyleAdapterBuilder = (
  context: OpenAIStyleAdapterContext
) => OpenAIStyleAdapterResult;

const openAIStyleAdapters: Record<
  ProviderType,
  OpenAIStyleAdapterBuilder | undefined
> = {
  openai: buildOpenAIAdapter,
  'openai-compatible': buildOpenAICompatibleAdapter,
  deepseek: buildDeepseekAdapter,
  bailing: buildBailingAdapter,
  longcat: buildLongcatAdapter,
  mimo: buildMimoAdapter,
  minimax: buildMinimaxAdapter,
  modelscope: buildModelscopeAdapter,
  moonshot: buildMoonshotAdapter,
  z: buildZAdapter,
  'z-intl': buildZIntlAdapter,
  // Providers handled by non-OpenAI pipelines
  google: undefined,
  anthropic: undefined,
};

export const getOpenAIStyleAdapter = (provider: ProviderType) => {
  const adapter = openAIStyleAdapters[provider];
  if (!adapter) {
    throw new Error(`No OpenAI-style adapter registered for ${provider}`);
  }
  return adapter;
};

export const buildGoogleAdapterContext = (
  params: ServiceParams,
  config: GoogleAdapterConfig
): GoogleAdapterResult => buildGoogleAdapter(params, config);

export const buildAnthropicAdapterContext = (
  params: ServiceParams,
  config: AnthropicAdapterConfig
): AnthropicAdapterResult => buildAnthropicAdapter(params, config);
