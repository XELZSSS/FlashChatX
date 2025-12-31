import { ProviderType, ServiceParams } from '../../types';
import { buildAnthropicAdapter } from './anthropicAdapter';
import { buildBailingAdapter } from './bailingAdapter';
import { buildDeepseekAdapter } from './deepseekAdapter';
import { buildGoogleAdapter } from './googleAdapter';
import { buildLongcatAdapter } from './longcatAdapter';
import { buildMinimaxAdapter } from './minimaxAdapter';
import { buildMoonshotAdapter } from './moonshotAdapter';
import { buildOpenAIAdapter } from './openaiAdapter';
import { buildOpenAICompatibleAdapter } from './openaiCompatibleAdapter';
import { buildXaiAdapter } from './xaiAdapter';
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
  xai: buildXaiAdapter,
  'openai-compatible': buildOpenAICompatibleAdapter,
  deepseek: buildDeepseekAdapter,
  bailing: buildBailingAdapter,
  longcat: buildLongcatAdapter,
  minimax: buildMinimaxAdapter,
  moonshot: buildMoonshotAdapter,
  z: buildZAdapter,
  'z-intl': buildZIntlAdapter,
  // Providers handled by non-OpenAI pipelines
  gemini: undefined,
  anthropic: undefined,
};

export const getOpenAIStyleAdapter = (provider: ProviderType) => {
  const adapter = openAIStyleAdapters[provider];
  if (!adapter) {
    throw new Error(`No OpenAI-style adapter registered for ${provider}`);
  }
  return adapter;
};

export const buildGeminiAdapterContext = (
  params: ServiceParams,
  config: GoogleAdapterConfig
): GoogleAdapterResult => buildGoogleAdapter(params, config, 'gemini');

export const buildAnthropicAdapterContext = (
  params: ServiceParams,
  config: AnthropicAdapterConfig
): AnthropicAdapterResult => buildAnthropicAdapter(params, config);
