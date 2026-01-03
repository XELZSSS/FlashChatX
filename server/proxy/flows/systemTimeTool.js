import {
  buildSystemTimeResult,
  getToolChoiceMode,
  mergeTools,
  shouldTriggerSystemTimeTool,
} from '../utils/tools.js';
import { stripThinkingFromResponseData } from '../utils/thinkingFilter.js';
import { sendJson } from '../utils/response.js';
import { performUpstreamRequest } from '../utils/upstream.js';

export const handleSystemTimeToolFlow = async ({
  provider,
  normalizedPayload,
  config,
  apiKey,
  apiUrl,
  ctx,
  res,
  stream,
  thinkingEnabled,
  streamEventFilter,
}) => {
  const canUseSystemTimeTool =
    ctx.TIME_TOOL_PROVIDERS.has(provider) &&
    provider !== 'gemini' &&
    provider !== 'anthropic';
  const shouldUseSystemTimeTool =
    canUseSystemTimeTool && shouldTriggerSystemTimeTool(normalizedPayload);

  if (!shouldUseSystemTimeTool) {
    return { handled: false };
  }

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
        apiUrl,
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
          apiUrl,
          ctx
        );
        ctx.handleStreamResponse(
          response,
          res,
          streamEventFilter ? { formatEventData: streamEventFilter } : {}
        );
        return { handled: true };
      }

      const response = await performUpstreamRequest(
        provider,
        { ...followupPayload, stream: false },
        config,
        apiKey,
        apiUrl,
        ctx
      );
      const data = await response.json();
      if (!thinkingEnabled) stripThinkingFromResponseData(data);
      sendJson(res, 200, data);
      return { handled: true };
    }

    if (!stream) {
      const data = thinkingEnabled
        ? toolData
        : stripThinkingFromResponseData(toolData);
      sendJson(res, 200, data);
      return { handled: true };
    }
  } catch (error) {
    console.error('[proxy] System time tool flow failed:', error);
    const status =
      (typeof error.status === 'number' && error.status) ||
      (error.response && error.response.status) ||
      500;
    const errorMessage = error.text || error.message || 'Unknown error';
    sendJson(res, status, { error: errorMessage });
    return { handled: true };
  }

  return { handled: false };
};
