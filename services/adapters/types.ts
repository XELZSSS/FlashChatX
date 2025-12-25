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
  showThinkingSummary?: boolean;
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

export type GoogleContentPart =
  | { text: string }
  | {
      fileData: {
        fileUri: string;
        mimeType?: string;
        displayName?: string;
      };
    }
  | {
      functionCall: {
        name: string;
        args?: Record<string, unknown>;
      };
    }
  | {
      functionResponse: {
        name: string;
        response: { content: string };
      };
    };

export type GoogleContent = {
  role: 'user' | 'model';
  parts: GoogleContentPart[];
};

export type AnthropicAdapterConfig = {
  showThinkingSummary?: boolean;
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
  thinking?: Record<string, unknown>;
  temperature?: number;
  top_p?: number;
  top_k?: number;
};

export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'document';
      source: { type: 'file'; file_id: string };
      title?: string;
    }
  | {
      type: 'tool_use';
      id: string;
      name: string;
      input?: Record<string, unknown>;
    }
  | {
      type: 'tool_result';
      tool_use_id: string;
      content: string;
    };

export type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
};
