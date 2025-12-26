import { parseJsonBody } from './utils/bodyParser.js';
import { normalizePath } from './utils/url.js';
import { sendJson } from './utils/response.js';
import { handleApiRequest } from './handlers/apiHandlers.js';
import {
  handleOpenAIFileUpload,
  handleGoogleFileUpload,
  handleAnthropicFileUpload,
} from './handlers/uploadHandlers.js';
import { handleSaveEnv, handleSaveMemuEnv } from './handlers/envHandlers.js';
import { handleSearchProxy } from './handlers/searchHandlers.js';

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
