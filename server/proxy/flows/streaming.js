import { sendJson } from '../utils/response.js';
import { performUpstreamRequest } from '../utils/upstream.js';

export const handleStreamingRequest = async ({
  res,
  provider,
  payload,
  config,
  apiKey,
  apiUrl,
  ctx,
  streamEventFilter,
}) => {
  try {
    const response = await performUpstreamRequest(
      provider,
      payload,
      config,
      apiKey,
      apiUrl,
      ctx
    );
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
