export const performUpstreamRequest = async (
  provider,
  payload,
  config,
  apiKey,
  apiUrl,
  ctx
) =>
  ctx.connectionPool.execute(async () =>
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
