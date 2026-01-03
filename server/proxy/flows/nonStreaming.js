import { sendJson } from '../utils/response.js';
import { stripThinkingFromResponseData } from '../utils/thinkingFilter.js';
import { performUpstreamRequest } from '../utils/upstream.js';

export const handleNonStreamingRequest = async ({
  provider,
  payload,
  config,
  apiKey,
  apiUrl,
  ctx,
  model,
  thinkingEnabled,
  res,
}) => {
  const cacheKey = `${provider}:${model}:${JSON.stringify(payload)}`;
  const cachedResponse = ctx.requestCache.get(cacheKey);
  if (cachedResponse) {
    console.log(`[proxy] Cache hit for ${provider}`);
    const data = thinkingEnabled
      ? cachedResponse
      : stripThinkingFromResponseData(cachedResponse);
    return sendJson(res, 200, data);
  }

  try {
    const response = await performUpstreamRequest(
      provider,
      payload,
      config,
      apiKey,
      apiUrl,
      ctx
    );
    const data = await response.json();
    if (!thinkingEnabled) stripThinkingFromResponseData(data);

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
