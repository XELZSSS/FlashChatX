import { parseJsonBody } from '../utils/bodyParser.js';
import { sendJson } from '../utils/response.js';

export const handleSearchProxy = async (req, res, ctx) => {
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
