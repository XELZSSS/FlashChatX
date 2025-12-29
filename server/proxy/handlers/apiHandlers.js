import {
  buildSystemTimeResult,
  getToolChoiceMode,
  mergeTools,
  shouldTriggerSystemTimeTool,
} from '../utils/tools.js';
import {
  createStreamThinkingFilter,
  isThinkingEnabled,
  stripThinkingFromResponseData,
} from '../utils/thinkingFilter.js';
import { sendJson } from '../utils/response.js';

const performUpstreamRequest = async (
  provider,
  payload,
  config,
  apiKey,
  apiUrl,
  ctx
) => {
  return ctx.connectionPool.execute(async () =>
    ctx.retryRequest(async () => {
      let headers = { 'Content-Type': 'application/json', ...config.headers };
      let targetUrl = config.targetUrl;

      if (provider === 'gemini') {
        const model = payload?.model;
        if (!model) {
          const error = new Error('model is required for gemini provider');
          error.status = 400;
          throw error;
        }

        const endpoint = payload?.stream
          ? `${model}:streamGenerateContent?alt=sse`
          : `${model}:generateContent`;
        targetUrl = `${config.targetUrl}/${endpoint}?key=${encodeURIComponent(apiKey)}`;
      } else if (provider === 'anthropic') {
        headers = {
          ...headers,
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        };
        if (payload?.anthropicBeta) {
          headers['anthropic-beta'] = payload.anthropicBeta;
          delete payload.anthropicBeta;
        }
      } else {
        headers = { ...headers, Authorization: `Bearer ${apiKey}` };
      }

      // For openai-compatible provider, use custom API URL if provided
      if (provider === 'openai-compatible') {
        const overrideUrl = apiUrl || ctx.getEnvValue(config.urlEnvVar);
        if (overrideUrl) {
          targetUrl = `${overrideUrl.replace(/\/$/, '')}/chat/completions`;
        }
      }

      const upstream = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!upstream.ok) {
        const error = new Error(
          `HTTP ${upstream.status}: ${upstream.statusText}`
        );
        error.status = upstream.status;
        error.text = await upstream.text();
        throw error;
      }

      return upstream;
    })
  );
};

const handleStreamingRequest = async (
  req,
  res,
  provider,
  payload,
  config,
  apiKey,
  apiUrl,
  ctx
) => {
  try {
    const response = await performUpstreamRequest(
      provider,
      payload,
      config,
      apiKey || ctx.apiKeys[provider],
      apiUrl,
      ctx
    );
    const thinkingEnabled = isThinkingEnabled(payload);
    const streamEventFilter = thinkingEnabled
      ? null
      : createStreamThinkingFilter();
    return ctx.handleStreamResponse(
      response,
      res,
      streamEventFilter ? { formatEventData: streamEventFilter } : {}
    );
  } catch (error) {
    console.error(`[proxy] Streaming request failed for ${provider}:`, error);
    const errorMessage = error.text || error.message || 'Unknown error';
    sendJson(res, error.status || 500, { error: errorMessage });
  }
};

export const handleApiRequest = async (req, res, provider, parsed, ctx) => {
  const config = ctx.API_PROVIDERS[provider];
  const { messages = [], model, stream = false } = parsed;

  const requestApiKey = parsed?.apiKey;
  const requestApiUrl = parsed?.apiUrl;
  const apiKey = requestApiKey || ctx.apiKeys[provider];

  if (requestApiKey) {
    ctx.apiKeys[provider] = requestApiKey;
  }

  if (!apiKey) {
    return sendJson(res, 401, {
      error: `${config.keyEnvVar} not set on proxy server.`,
    });
  }

  // Basic input validation to avoid upstream 400s
  if (provider !== 'gemini' && provider !== 'anthropic') {
    if (!Array.isArray(messages)) {
      return sendJson(res, 400, { error: 'messages must be an array' });
    }
  }

  if (!model) {
    return sendJson(res, 400, { error: `${config.modelEnvVar} is required` });
  }

  const upstreamPayload = { ...(parsed || {}) };
  delete upstreamPayload.apiKey;
  delete upstreamPayload.apiUrl;
  upstreamPayload.model = model;
  upstreamPayload.stream = stream;
  const normalizedPayload = upstreamPayload;
  const thinkingEnabled = isThinkingEnabled(normalizedPayload);
  const streamEventFilter = thinkingEnabled
    ? null
    : createStreamThinkingFilter();

  const canUseSystemTimeTool =
    ctx.TIME_TOOL_PROVIDERS.has(provider) &&
    provider !== 'gemini' &&
    provider !== 'anthropic';
  const shouldUseSystemTimeTool =
    canUseSystemTimeTool && shouldTriggerSystemTimeTool(normalizedPayload);

  if (shouldUseSystemTimeTool) {
    try {
      const toolMessages = [...(normalizedPayload.messages || [])];
      const mergedTools = mergeTools(
        normalizedPayload.tools,
        ctx.SYSTEM_TIME_TOOL
      );
      const buildToolPayload = tool_choice => ({
        ...normalizedPayload,
        stream: false,
        messages: toolMessages,
        tools: mergedTools,
        tool_choice,
      });
      const requestToolCalls = async tool_choice => {
        const response = await performUpstreamRequest(
          provider,
          buildToolPayload(tool_choice),
          config,
          apiKey,
          requestApiUrl,
          ctx
        );
        const data = await response.json();
        const message = data?.choices?.[0]?.message;
        return { data, message, toolCalls: message?.tool_calls || [] };
      };

      const requestedMode = getToolChoiceMode(normalizedPayload.tool_choice);
      const initialChoice = requestedMode === 'required' ? 'required' : 'auto';
      let {
        data: toolData,
        message: assistantMessage,
        toolCalls,
      } = await requestToolCalls(initialChoice);

      if (!toolCalls.length && initialChoice !== 'required') {
        ({
          data: toolData,
          message: assistantMessage,
          toolCalls,
        } = await requestToolCalls('required'));
      }

      if (toolCalls.length) {
        const toolResults = toolCalls.map(toolCall => {
          let args = {};
          try {
            args = toolCall?.function?.arguments
              ? JSON.parse(toolCall.function.arguments)
              : {};
          } catch {
            args = {};
          }
          return {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: buildSystemTimeResult(args),
          };
        });

        const followupPayload = {
          ...normalizedPayload,
          messages: [...toolMessages, assistantMessage, ...toolResults],
          tools: mergedTools,
        };

        if (stream) {
          const response = await performUpstreamRequest(
            provider,
            { ...followupPayload, stream: true },
            config,
            apiKey,
            requestApiUrl,
            ctx
          );
          return ctx.handleStreamResponse(
            response,
            res,
            streamEventFilter ? { formatEventData: streamEventFilter } : {}
          );
        }

        const response = await performUpstreamRequest(
          provider,
          { ...followupPayload, stream: false },
          config,
          apiKey,
          requestApiUrl,
          ctx
        );
        const data = await response.json();
        if (!thinkingEnabled) stripThinkingFromResponseData(data);
        return sendJson(res, 200, data);
      }

      if (!stream) {
        const data = thinkingEnabled
          ? toolData
          : stripThinkingFromResponseData(toolData);
        return sendJson(res, 200, data);
      }
      // Fall through to normal streaming if no tool calls were returned.
    } catch (error) {
      console.error('[proxy] System time tool flow failed:', error);
      const status =
        (typeof error.status === 'number' && error.status) ||
        (error.response && error.response.status) ||
        500;
      const errorMessage = error.text || error.message || 'Unknown error';
      return sendJson(res, status, { error: errorMessage });
    }
  }

  // For streaming requests, don't use cache
  if (stream) {
    // apiKey/apiUrl can be provided per-request (preferred for packaged app)
    return handleStreamingRequest(
      req,
      res,
      provider,
      normalizedPayload,
      config,
      apiKey,
      requestApiUrl,
      ctx
    );
  }

  // Create cache key for non-streaming requests
  const cacheKey = `${provider}:${model}:${JSON.stringify(normalizedPayload)}`;

  // Try to get from cache first
  const cachedResponse = ctx.requestCache.get(cacheKey);
  if (cachedResponse) {
    console.log(`[proxy] Cache hit for ${provider}`);
    const data = thinkingEnabled
      ? cachedResponse
      : stripThinkingFromResponseData(cachedResponse);
    return sendJson(res, 200, data);
  }

  // Execute request with connection pooling and retry
  try {
    const response = await performUpstreamRequest(
      provider,
      normalizedPayload,
      config,
      apiKey,
      requestApiUrl,
      ctx
    );
    const data = await response.json();
    if (!thinkingEnabled) stripThinkingFromResponseData(data);

    // Cache the response
    ctx.requestCache.set(cacheKey, data);

    sendJson(res, 200, data);
  } catch (error) {
    console.error(`[proxy] Request failed for ${provider}:`, error);
    const status =
      (typeof error.status === 'number' && error.status) ||
      (error.response && error.response.status) ||
      500;
    const errorMessage = error.text || error.message || 'Unknown error';
    sendJson(res, status, { error: errorMessage });
  }
};
