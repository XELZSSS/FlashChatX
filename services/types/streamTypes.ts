/**
 * OpenAI-style response types
 * OpenAI 风格的响应类型
 */

export type OpenAIResponseReasoningDetail = { text?: string };

export type OpenAIResponseMessage = {
    content?: string;
    reasoning_content?: string;
    reasoning_details?: OpenAIResponseReasoningDetail[];
    tool_calls?: OpenAIToolCall[];
};

export type OpenAIResponseChoice = {
    message?: OpenAIResponseMessage;
    delta?: OpenAIResponseMessage;
};

export type OpenAIResponse = {
    choices?: OpenAIResponseChoice[];
    usage?: OpenAIStreamUsage;
};

export type OpenAIProxyPayload = {
    stream?: boolean;
    messages?: Array<{ role?: string; content?: string | unknown[] }>;
    stream_options?: unknown;
};

export type OpenAIToolCall = {
    id: string;
    function?: { name?: string; arguments?: string };
};

export type OpenAIStreamUsage = {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
};

/**
 * Anthropic-style response types
 * Anthropic 风格的响应类型
 */

export type AnthropicResponse = {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
};
