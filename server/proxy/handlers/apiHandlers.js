import { handleSystemTimeToolFlow } from '../flows/systemTimeTool.js';
import {
  createStreamThinkingFilter,
  isThinkingEnabled,
} from '../utils/thinkingFilter.js';
import { handleStreamingRequest } from '../flows/streaming.js';
import { handleNonStreamingRequest } from '../flows/nonStreaming.js';
import { validateAndNormalizeRequest } from '../utils/validation.js';

export const handleApiRequest = async (req, res, provider, parsed, ctx) => {
  const config = ctx.API_PROVIDERS[provider];
  const validated = validateAndNormalizeRequest({
    provider,
    parsed,
    config,
    ctx,
    res,
  });
  if (!validated) return;

  const { apiKey, apiUrl, model, stream, normalizedPayload } = validated;
  const thinkingEnabled = isThinkingEnabled(normalizedPayload);
  const streamEventFilter = thinkingEnabled
    ? null
    : createStreamThinkingFilter();

  const systemTimeResult = await handleSystemTimeToolFlow({
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
  });
  if (systemTimeResult.handled) return;

  // For streaming requests, don't use cache
  if (stream) {
    // apiKey/apiUrl can be provided per-request (preferred for packaged app)
    return handleStreamingRequest({
      res,
      provider,
      payload: normalizedPayload,
      config,
      apiKey,
      apiUrl,
      ctx,
      streamEventFilter,
    });
  }
  return handleNonStreamingRequest({
    provider,
    payload: normalizedPayload,
    config,
    apiKey,
    apiUrl,
    ctx,
    model,
    thinkingEnabled,
    res,
  });
};
