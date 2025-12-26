import OpenAI, { toFile } from 'openai';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { parseJsonBody } from '../utils/bodyParser.js';
import { sendJson } from '../utils/response.js';

const decodeBase64Payload = dataBase64 => {
  if (!dataBase64 || typeof dataBase64 !== 'string') {
    const error = new Error('Missing base64 payload');
    error.code = 'INVALID_UPLOAD';
    throw error;
  }
  return Buffer.from(dataBase64, 'base64');
};

export const handleOpenAIFileUpload = async (req, res, ctx) => {
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

export const handleGoogleFileUpload = async (req, res, ctx) => {
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

export const handleAnthropicFileUpload = async (req, res, ctx) => {
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
