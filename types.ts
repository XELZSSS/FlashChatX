// Message role types for better type safety
export type MessageRole = 'user' | 'model';

// Provider types for AI services
export type ProviderType =
  | 'openai'
  | 'mimo'
  | 'z'
  | 'z-intl'
  | 'deepseek'
  | 'openai-compatible'
  | 'bailing'
  | 'longcat'
  | 'modelscope'
  | 'moonshot'
  | 'minimax'
  | 'google'
  | 'anthropic';

// Theme options with explicit string values
export const THEME_VALUES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEME_VALUES)[number];
export type ThinkingLevel = 'low' | 'medium' | 'high';

// Message interface with improved structure
export interface Message {
  readonly id: string;
  readonly role: MessageRole;
  content: string;
  readonly timestamp: number;
  readonly attachments?: UploadedFileReference[];
  readonly isThinking?: boolean;
  readonly thinkingContent?: string; // Deep thinking content
  readonly responseContent?: string; // Final response content
  readonly isThinkingCollapsed?: boolean; // Whether thinking content is collapsed
}

// Chat session with better immutability
export interface ChatSession {
  readonly id: string;
  title: string;
  readonly messages: Message[];
  updatedAt: number;
  isPinned?: boolean; // Add pin status
}

// Chat configuration with descriptive naming
export interface ChatConfig {
  readonly useThinking: boolean;
  readonly useSearch: boolean;
  readonly thinkingLevel: ThinkingLevel;
}

// User settings with proper typing
export interface UserSettings {
  readonly theme: Theme;
  readonly language: string;
}

// API response types for better error handling
export interface ApiResponse<T = unknown> {
  readonly data?: T;
  readonly error?: string;
  readonly status: number;
}

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
  readonly errorMessage?: string;
  readonly providerConfig?: ProviderConfig;
}

export type AttachmentStatus = 'ready' | 'uploading' | 'uploaded' | 'error';

export interface LocalAttachment {
  readonly id: string;
  readonly file: File;
  status: AttachmentStatus;
  error?: string;
}

export interface UploadedFileReference {
  readonly provider: ProviderType;
  readonly fileId: string;
  readonly fileUri?: string;
  readonly mimeType?: string;
  readonly name: string;
  readonly size: number;
}

// MemU configuration interface
export interface MemuSettings {
  readonly enabled: boolean;
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly autoSave: boolean;
  readonly maxMemories: number;
}

// Extended UserSettings to include MemU
export interface ExtendedUserSettings extends UserSettings {
  readonly memu: MemuSettings;
}

// Token usage statistics interface
export interface TokenUsage {
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
  readonly total_tokens: number;
  readonly prompt_tokens_details?: {
    readonly cached_tokens: number;
  };
}

// Extended Message interface to include token usage
export interface ExtendedMessage extends Message {
  readonly tokenUsage?: TokenUsage;
}

export type ToolChoiceMode = 'auto' | 'none' | 'required' | 'specific';

export interface ToolPermissionConfig {
  enabledToolNames: string[];
  toolChoice: ToolChoiceMode;
  toolChoiceName?: string;
}
