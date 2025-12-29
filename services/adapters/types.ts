import type { Content, Part } from '@google/genai';
import type {
  ContentBlock,
  ContentBlockParam,
  MessageParam,
  ThinkingConfigParam,
  ToolChoice,
  ToolUnion,
} from '@anthropic-ai/sdk/resources/messages';
import type {
  BetaContentBlock,
  BetaContentBlockParam,
  MessageParam as BetaMessageParam,
  ToolChoice as BetaToolChoice,
  ToolUnion as BetaToolUnion,
} from '@anthropic-ai/sdk/resources/beta/messages';
import { ProviderConfig, ServiceParams } from '../../types';

export type OpenAIStyleAdapterContext = {
  params: ServiceParams;
  config: ProviderConfig;
  model: string;
  streaming: boolean;
};

export type OpenAIStyleAdapterResult = {
  endpoint: string;
  model: string;
  messages: OpenAIMessage[];
  extraBody?: Record<string, unknown>;
  streamOptions?: Record<string, unknown>;
};

export type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'file'; file: { file_id: string } };

export type OpenAIMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string | OpenAIContentPart[];
};

export type GoogleAdapterConfig = {
  temperature?: number;
  showAdvancedParams?: boolean;
  topP?: number;
  topK?: number;
  thinkingBudgetTokens?: number;
};

export type GoogleAdapterResult = {
  contents: GoogleContent[];
  generationConfig: Record<string, unknown>;
  systemInstruction?: string;
};

export type GoogleContentPart = Part;

export type GoogleContent = Content;

export type AnthropicAdapterConfig = {
  temperature?: number;
  showAdvancedParams?: boolean;
  topP?: number;
  topK?: number;
  thinkingBudgetTokens?: number;
};

export type AnthropicAdapterResult = {
  messages: AnthropicMessage[];
  systemMessage?: string;
  anthropicBeta?: string;
  thinking?: ThinkingConfigParam;
  temperature?: number;
  top_p?: number;
  top_k?: number;
};

export type AnthropicContentBlock =
  | ContentBlock
  | ContentBlockParam
  | BetaContentBlock
  | BetaContentBlockParam;

export type AnthropicMessage = MessageParam | BetaMessageParam;

export type AnthropicTool = ToolUnion | BetaToolUnion;

export type AnthropicToolChoice = ToolChoice | BetaToolChoice;
