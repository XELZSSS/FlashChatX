import OpenAI, { toFile } from 'openai';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';

const readRequestBody = (req, maxBytes = 10 * 1024 * 1024) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > maxBytes) {
        const err = new Error('Request body too large');
        err.code = 'PAYLOAD_TOO_LARGE';
        req.destroy(err);
        return reject(err);
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

const parseJsonBody = async (req, maxBytes) => {
  const raw = await readRequestBody(req, maxBytes);
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (error) {
    const err = new Error('Invalid JSON');
    err.code = 'INVALID_JSON';
    err.cause = error;
    throw err;
  }
};

const normalizePath = (url = '') => {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return url;
  }
};

const getMessageText = message => {
  if (!message) return '';
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(part => part && part.type === 'text')
      .map(part => part.text || '')
      .join('');
  }
  return '';
};

const isSearchContextText = text => {
  if (!text) return false;
  return (
    text.includes('根据搜索"') ||
    text.includes('未找到相关内容') ||
    text.includes('Based on the search results for "') ||
    text.includes('No relevant information found about "') ||
    text.startsWith('根据搜索') ||
    text.startsWith('Based on the search results')
  );
};

const isMemoryContextText = text =>
  typeof text === 'string' && text.startsWith('相关记忆:');

const getLastUserMessageText = messages => {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') {
      return getMessageText(messages[i]);
    }
  }
  return '';
};

const getLastUserQueryText = messages => {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role !== 'user') continue;
    const text = getMessageText(msg);
    if (!text) continue;
    if (isSearchContextText(text) || isMemoryContextText(text)) {
      continue;
    }
    return text;
  }
  return getLastUserMessageText(messages);
};

const getToolChoiceMode = toolChoice => {
  if (!toolChoice) return null;
  if (typeof toolChoice === 'string') {
    if (toolChoice === 'none') return 'none';
    if (toolChoice === 'auto') return 'auto';
    if (toolChoice === 'required') return 'required';
    return 'unknown';
  }
  if (typeof toolChoice === 'object') {
    const type = toolChoice.type;
    if (type === 'none') return 'none';
    if (type === 'auto') return 'auto';
    if (type === 'any') return 'required';
    if (type === 'tool' || type === 'function') return 'specific';
  }
  return 'unknown';
};

const hasSystemTimeTool = tools => {
  if (!Array.isArray(tools) || tools.length === 0) return null;
  return tools.some(tool => tool?.function?.name === 'get_system_time');
};

const shouldTriggerSystemTimeTool = payload => {
  if (!payload) return false;
  const toolChoiceMode = getToolChoiceMode(payload.tool_choice);
  if (toolChoiceMode === 'none' || toolChoiceMode === 'specific') {
    return false;
  }
  if (
    toolChoiceMode &&
    toolChoiceMode !== 'auto' &&
    toolChoiceMode !== 'required'
  ) {
    return false;
  }
  if (Array.isArray(payload.allowed_tools) && payload.allowed_tools.length) {
    if (!payload.allowed_tools.includes('get_system_time')) return false;
  }
  const toolPresence = hasSystemTimeTool(payload.tools);
  if (toolPresence === false) return false;
  const text = getLastUserQueryText(payload.messages || []);
  if (!text) return false;
  const normalized = text.toLowerCase();
  const hasChinese = /[\u4e00-\u9fa5]/.test(text);
  const excludes = [
    '时间复杂度',
    '时间管理',
    '时间轴',
    'timeline',
    'complexity',
    'time complexity',
  ];
  if (excludes.some(term => normalized.includes(term))) return false;

  if (hasChinese) {
    const cnCore = [
      '时间',
      '日期',
      '星期',
      '几号',
      '几点',
      '多少点',
      '几点钟',
      '现在几点',
      '当前几点',
      '今天几号',
      '今天是几号',
      '今天几月几号',
      '现在几号',
      '现在几月几号',
      '几月几号',
      '今天日期',
      '现在日期',
      '星期几',
      '礼拜几',
      '周几',
      '周几号',
      '今天周几',
      '现在周几',
      '几时',
      '多晚了',
    ];
    const cnQuery = [
      '现在',
      '当前',
      '今天',
      '此刻',
      '几',
      '多少',
      '吗',
      '呢',
      '？',
      '?',
    ];
    const hasCore = cnCore.some(term => text.includes(term));
    const hasQuery = cnQuery.some(term => text.includes(term));
    return hasCore && hasQuery;
  }

  const enCore = [
    'time',
    'date',
    'day',
    'weekday',
    'what time',
    'current time',
    'time is it',
    'today',
    'what date',
    'what day',
    "what's the date",
    "what's the time",
    'what time now',
    'what day is it',
    "today's date",
    'current date',
  ];
  const enQuery = ['what', 'now', 'current', 'today', 'date', 'day', '?'];
  const hasCore = enCore.some(term => normalized.includes(term));
  const hasQuery = enQuery.some(term => normalized.includes(term));
  return hasCore && hasQuery;
};

const buildSystemTimeResult = args => {
  const now = new Date();
  const format = args?.format;
  const timeZone =
    Intl.DateTimeFormat?.().resolvedOptions?.().timeZone || 'local';
  const payload = {
    local: now.toLocaleString(),
    weekday: now.toLocaleDateString(undefined, { weekday: 'long' }),
    date: now.toLocaleDateString(),
    timeZone,
    timestamp: now.getTime(),
  };
  return JSON.stringify(format === 'iso' ? payload : payload);
};

const isThinkingEnabled = payload => {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.reasoning_effort) return true;
  if (payload.extra_body?.reasoning_split) return true;
  if (payload.thinking && typeof payload.thinking === 'object') {
    return payload.thinking.type === 'enabled';
  }
  return false;
};

const createThinkTagStripper = () => {
  let inThinkBlock = false;
  let tagBuffer = '';
  const thinkTags = new Set(['think', '/think', 'thinking', '/thinking']);

  return text => {
    if (!text) return '';
    let source = tagBuffer + text;
    tagBuffer = '';
    let output = '';

    for (let i = 0; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '<') {
        const closeIdx = source.indexOf('>', i + 1);
        if (closeIdx === -1) {
          tagBuffer = source.slice(i);
          break;
        }
        const tag = source
          .slice(i + 1, closeIdx)
          .trim()
          .toLowerCase();
        if (thinkTags.has(tag)) {
          inThinkBlock = !tag.startsWith('/');
          i = closeIdx;
          continue;
        }
        if (!inThinkBlock) {
          output += source.slice(i, closeIdx + 1);
        }
        i = closeIdx;
        continue;
      }
      if (!inThinkBlock) output += ch;
    }

    return output;
  };
};

const stripThinkingFromText = text => {
  const strip = createThinkTagStripper();
  return strip(text || '');
};

const stripThinkingFromMessage = message => {
  if (!message || typeof message !== 'object') return;
  if (typeof message.content === 'string') {
    message.content = stripThinkingFromText(message.content);
  }
  if ('reasoning_content' in message) delete message.reasoning_content;
  if ('reasoning_details' in message) delete message.reasoning_details;
};

const stripThinkingFromResponseData = data => {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data.choices)) {
    data.choices.forEach(choice => {
      if (choice?.message) {
        stripThinkingFromMessage(choice.message);
      }
      if (choice?.delta) {
        stripThinkingFromMessage(choice.delta);
      }
    });
  }
  return data;
};

const createStreamThinkingFilter = () => {
  const strip = createThinkTagStripper();
  return data => {
    if (!data || data === '[DONE]') return data;
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      return strip(data);
    }
    if (Array.isArray(parsed.choices)) {
      parsed.choices.forEach(choice => {
        if (choice?.delta) {
          if ('reasoning_content' in choice.delta) {
            delete choice.delta.reasoning_content;
          }
          if ('reasoning_details' in choice.delta) {
            delete choice.delta.reasoning_details;
          }
          if (typeof choice.delta.content === 'string') {
            choice.delta.content = strip(choice.delta.content);
          }
        }
        if (choice?.message) {
          if ('reasoning_content' in choice.message) {
            delete choice.message.reasoning_content;
          }
          if ('reasoning_details' in choice.message) {
            delete choice.message.reasoning_details;
          }
          if (typeof choice.message.content === 'string') {
            choice.message.content = strip(choice.message.content);
          }
        }
      });
    }
    return JSON.stringify(parsed);
  };
};

const mergeTools = (tools, toolToAdd) => {
  const list = Array.isArray(tools) ? [...tools] : [];
  const exists = list.some(
    tool => tool?.function?.name === toolToAdd.function.name
  );
  if (!exists) {
    list.push(toolToAdd);
  }
  return list;
};

const decodeBase64Payload = dataBase64 => {
  if (!dataBase64 || typeof dataBase64 !== 'string') {
    const error = new Error('Missing base64 payload');
    error.code = 'INVALID_UPLOAD';
    throw error;
  }
  return Buffer.from(dataBase64, 'base64');
};

const sendJson = (res, status, payload) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(payload));
};

const handleOpenAIFileUpload = async (req, res, ctx) => {
  try {
    const parsed = await parseJsonBody(req, ctx.MAX_UPLOAD_BYTES);
    const apiKey = parsed?.apiKey || ctx.apiKeys.openai;
    if (!apiKey) {
      return sendJson(res, 401, {
        error: 'OPENAI_API_KEY not set on proxy server.',
      });
    }

    if (parsed?.apiKey) {
      ctx.apiKeys.openai = parsed.apiKey;
    }

    const buffer = decodeBase64Payload(parsed.dataBase64);
    const fileName = parsed.fileName || 'upload';
    const mimeType = parsed.mimeType || 'application/octet-stream';
    const purpose = parsed.purpose || 'user_data';

    const client = new OpenAI({ apiKey });
    const file = await toFile(buffer, fileName, { type: mimeType });
    const uploaded = await client.files.create({ file, purpose });

    return sendJson(res, 200, {
      id: uploaded.id,
      filename: uploaded.filename,
      bytes: uploaded.bytes,
    });
  } catch (error) {
    console.error('[proxy] OpenAI file upload failed:', error);
    const status = error.code === 'PAYLOAD_TOO_LARGE' ? 413 : 500;
    return sendJson(res, status, {
      error: error.message || 'Upload failed',
    });
  }
};

const handleGoogleFileUpload = async (req, res, ctx) => {
  try {
    const parsed = await parseJsonBody(req, ctx.MAX_UPLOAD_BYTES);
    const apiKey = parsed?.apiKey || ctx.apiKeys.google;
    if (!apiKey) {
      return sendJson(res, 401, {
        error: 'GOOGLE_API_KEY not set on proxy server.',
      });
    }

    if (parsed?.apiKey) {
      ctx.apiKeys.google = parsed.apiKey;
    }

    const buffer = decodeBase64Payload(parsed.dataBase64);
    const fileName = parsed.fileName || 'upload';
    const mimeType = parsed.mimeType || 'application/octet-stream';
    const blob = new Blob([buffer], { type: mimeType });

    const client = new GoogleGenAI({ apiKey });
    const uploaded = await client.files.upload({
      file: blob,
      config: { mimeType, displayName: fileName },
    });

    return sendJson(res, 200, {
      name: uploaded.name,
      uri: uploaded.uri,
      displayName: uploaded.displayName,
      mimeType: uploaded.mimeType,
    });
  } catch (error) {
    console.error('[proxy] Google file upload failed:', error);
    const status = error.code === 'PAYLOAD_TOO_LARGE' ? 413 : 500;
    return sendJson(res, status, {
      error: error.message || 'Upload failed',
    });
  }
};

const handleAnthropicFileUpload = async (req, res, ctx) => {
  try {
    const parsed = await parseJsonBody(req, ctx.MAX_UPLOAD_BYTES);
    const apiKey = parsed?.apiKey || ctx.apiKeys.anthropic;
    if (!apiKey) {
      return sendJson(res, 401, {
        error: 'ANTHROPIC_API_KEY not set on proxy server.',
      });
    }

    if (parsed?.apiKey) {
      ctx.apiKeys.anthropic = parsed.apiKey;
    }

    const buffer = decodeBase64Payload(parsed.dataBase64);
    const fileName = parsed.fileName || 'upload';
    const mimeType = parsed.mimeType || 'application/octet-stream';

    const client = new Anthropic({ apiKey });
    const file = await Anthropic.toFile(buffer, fileName, { type: mimeType });
    const uploaded = await client.beta.files.upload({
      file,
      betas: ['files-api-2025-04-14'],
    });

    return sendJson(res, 200, {
      id: uploaded.id,
      filename: uploaded.filename,
      mimeType: uploaded.mime_type,
      size: uploaded.size_bytes,
    });
  } catch (error) {
    console.error('[proxy] Anthropic file upload failed:', error);
    const status = error.code === 'PAYLOAD_TOO_LARGE' ? 413 : 500;
    return sendJson(res, status, {
      error: error.message || 'Upload failed',
    });
  }
};

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

      if (provider === 'google') {
        const model = payload?.model;
        if (!model) {
          const error = new Error('model is required for google provider');
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

const handleApiRequest = async (req, res, provider, parsed, ctx) => {
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
  if (provider !== 'google' && provider !== 'anthropic') {
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
    provider !== 'google' &&
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

const handleSaveEnv = async (req, res, ctx) => {
  try {
    const payload = await parseJsonBody(req);
    const { provider, apiKey, model, apiUrl } = payload;

    if (!provider) {
      return sendJson(res, 400, {
        error: 'provider required',
        details: 'Provider is a required field',
      });
    }

    const validProviders = Object.keys(ctx.API_PROVIDERS);
    if (!validProviders.includes(provider)) {
      return sendJson(res, 400, {
        error: 'invalid provider',
        details: `Provider must be one of: ${validProviders.join(', ')}`,
      });
    }

    try {
      const providerConfig = ctx.API_PROVIDERS[provider];
      const updates = [{ key: providerConfig.keyEnvVar, value: apiKey || '' }];
      ctx.apiKeys[provider] = apiKey;

      if (model) {
        updates.push({ key: providerConfig.modelEnvVar, value: model });
      }

      if (apiUrl && providerConfig.urlEnvVar) {
        updates.push({ key: providerConfig.urlEnvVar, value: apiUrl });
      }

      const updatedKeys = ctx.persistEnvUpdates(updates);

      console.log(
        `[proxy] Successfully updated environment variables: ${updatedKeys.join(', ')}`
      );

      return sendJson(res, 200, {
        ok: true,
        message: 'Configuration saved successfully',
        updatedKeys,
      });
    } catch (writeError) {
      console.error('[proxy] Failed to write to .env.local:', writeError);
      return sendJson(res, 500, {
        error: 'write failed',
        details: 'Failed to write configuration to file',
      });
    }
  } catch (parseError) {
    console.error('[proxy] Failed to parse request body:', parseError);
    return sendJson(res, 400, {
      error: 'invalid json',
      details: 'Request body contains invalid JSON',
    });
  }
};

const handleSaveMemuEnv = async (req, res, ctx) => {
  try {
    const payload = await parseJsonBody(req);
    const { baseUrl, apiKey, enabled, autoSave, maxMemories } = payload;

    try {
      const updates = [
        { key: 'MEMU_BASE_URL', value: baseUrl || '' },
        { key: 'MEMU_API_KEY', value: apiKey || '' },
        { key: 'MEMU_ENABLED', value: enabled ? 'true' : 'false' },
        { key: 'MEMU_AUTO_SAVE', value: autoSave ? 'true' : 'false' },
        { key: 'MEMU_MAX_MEMORIES', value: String(maxMemories || 10) },
      ];

      const updatedKeys = ctx.persistEnvUpdates(updates);

      console.log(
        `[proxy] Successfully updated MemU environment variables: ${updatedKeys.join(', ')}`
      );

      return sendJson(res, 200, {
        ok: true,
        message: 'MemU configuration saved successfully',
        updatedKeys,
      });
    } catch (writeError) {
      console.error(
        '[proxy] Failed to write MemU config to .env.local:',
        writeError
      );
      return sendJson(res, 500, {
        error: 'write failed',
        details: 'Failed to write MemU configuration to file',
      });
    }
  } catch (parseError) {
    console.error(
      '[proxy] Failed to parse MemU config request body:',
      parseError
    );
    return sendJson(res, 400, {
      error: 'invalid json',
      details: 'Request body contains invalid JSON',
    });
  }
};

const handleSearchProxy = async (req, res, ctx) => {
  try {
    const payload = await parseJsonBody(req);
    const baseUrl = payload?.baseUrl || 'https://uapis.cn';
    const apiKey = payload?.apiKey || ctx.getEnvValue('SEARCH_API_KEY') || '';
    const upstreamUrl = `${String(baseUrl).replace(/\/$/, '')}/api/v1/search/aggregate`;
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const body = { ...payload };
    delete body.apiKey;
    delete body.baseUrl;

    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    res.writeHead(upstream.status || 500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    return res.end(text);
  } catch (error) {
    console.error('[proxy] Search proxy failed:', error);
    return sendJson(res, 500, {
      error: error?.message || 'Search proxy failed',
    });
  }
};

export const createRouter = ctx => async (req, res) => {
  const pathName = normalizePath(req.url);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (req.method === 'POST' && pathName === '/api/save-env') {
    return handleSaveEnv(req, res, ctx);
  }

  if (req.method === 'POST' && pathName === '/api/save-memu-env') {
    return handleSaveMemuEnv(req, res, ctx);
  }

  if (req.method === 'POST' && pathName === '/api/openai/files') {
    return handleOpenAIFileUpload(req, res, ctx);
  }

  if (req.method === 'POST' && pathName === '/api/google/files') {
    return handleGoogleFileUpload(req, res, ctx);
  }

  if (req.method === 'POST' && pathName === '/api/anthropic/files') {
    return handleAnthropicFileUpload(req, res, ctx);
  }

  if (req.method === 'POST' && pathName === '/api/search/aggregate') {
    return handleSearchProxy(req, res, ctx);
  }

  if (req.method !== 'POST') {
    res.writeHead(404);
    return res.end();
  }

  let parsedBody;
  try {
    parsedBody = await parseJsonBody(req);
  } catch (error) {
    if (error.code === 'INVALID_JSON') {
      return sendJson(res, 400, {
        error: 'invalid json',
        details: 'Request body contains invalid JSON',
      });
    }
    if (error.code === 'PAYLOAD_TOO_LARGE') {
      return sendJson(res, 413, {
        error: 'payload too large',
        details: 'Request body exceeds size limit',
      });
    }
    console.error('[proxy] Failed to parse request body', error);
    return sendJson(res, 500, { error: 'Proxy error' });
  }

  const provider = ctx.PATH_TO_PROVIDER[pathName];
  if (provider) {
    return handleApiRequest(req, res, provider, parsedBody, ctx);
  }

  res.writeHead(404);
  res.end();
};
