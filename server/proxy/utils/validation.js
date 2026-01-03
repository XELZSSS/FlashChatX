import { sendJson } from './response.js';

export const validateAndNormalizeRequest = ({
  provider,
  parsed,
  config,
  ctx,
  res,
}) => {
  const { messages = [], model, stream = false } = parsed;

  const requestApiKey = parsed?.apiKey;
  const requestApiUrl = parsed?.apiUrl;
  const apiKey = requestApiKey || ctx.apiKeys[provider];

  if (requestApiKey) {
    ctx.apiKeys[provider] = requestApiKey;
  }

  if (!apiKey) {
    sendJson(res, 401, {
      error: `${config.keyEnvVar} not set on proxy server.`,
    });
    return null;
  }

  // Basic input validation to avoid upstream 400s
  if (provider !== 'gemini' && provider !== 'anthropic') {
    if (!Array.isArray(messages)) {
      sendJson(res, 400, { error: 'messages must be an array' });
      return null;
    }
  }

  if (!model) {
    sendJson(res, 400, { error: `${config.modelEnvVar} is required` });
    return null;
  }

  const upstreamPayload = { ...(parsed || {}) };
  delete upstreamPayload.apiKey;
  delete upstreamPayload.apiUrl;
  upstreamPayload.model = model;
  upstreamPayload.stream = stream;

  return {
    apiKey,
    apiUrl: requestApiUrl,
    model,
    stream,
    normalizedPayload: upstreamPayload,
  };
};
