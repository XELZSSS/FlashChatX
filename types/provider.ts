import type {
  LocalAttachment,
  MessageRole,
  ThinkingLevel,
  UploadedFileReference,
} from './chat';
import type { ToolPermissionConfig } from './tools';

// Provider types for AI services
export type ProviderType =
  | 'openai'
  | 'xai'
  | 'z'
  | 'z-intl'
  | 'deepseek'
  | 'openai-compatible'
  | 'bailing'
  | 'longcat'
  | 'moonshot'
  | 'minimax'
  | 'gemini'
  | 'anthropic';

// Provider configuration interface
export interface ProviderConfig {
  readonly provider: ProviderType;
  apiKey: string;
  model: string;
  stream: boolean;
  apiUrl?: string; // For OpenAI Compatible providers
  temperature?: number; // Response diversity control
  topP?: number;
  topK?: number;
  showAdvancedParams?: boolean;
  thinkingBudgetTokens?: number;
  toolConfig?: ToolPermissionConfig;
}

// Service parameters interface
export interface ServiceParams {
  readonly history: Array<{
    role: MessageRole;
    content: string;
    attachments?: UploadedFileReference[];
  }>;
  readonly message: string;
  readonly localAttachments?: LocalAttachment[];
  readonly useThinking: boolean;
  readonly useSearch: boolean;
  readonly thinkingLevel: ThinkingLevel;
  readonly language?: string;
  readonly errorMessage?: string;
  readonly providerConfig?: ProviderConfig;
}
