// Enhanced proxy server entrypoint (modularized)
// Run with: npm run proxy

import http from 'http';
import {
  API_PROVIDERS,
  PATH_TO_PROVIDER,
  SYSTEM_TIME_TOOL,
  TIME_TOOL_PROVIDERS,
} from './proxy/providers.js';
import {
  RequestCache,
  ConnectionPool,
  retryRequest,
  handleStreamResponse,
} from './proxy/middleware.js';
import { ENV_PATH, getEnvValue, persistEnvUpdates } from './proxy/env.js';
import { createRouter } from './proxy/router.js';

const PORT = process.env.PROXY_PORT || 8787;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Initialize API keys from environment
const apiKeys = {};
for (const [provider, config] of Object.entries(API_PROVIDERS)) {
  apiKeys[provider] = getEnvValue(config.keyEnvVar);
}

// Log initial configuration to help with debugging
console.log('[proxy] Initial configuration:', {
  hasOpenAIKey: !!apiKeys.openai,
  hasXAIKey: !!apiKeys.xai,
  hasMiMoKey: !!apiKeys.mimo,
  hasZKey: !!apiKeys.z,
  hasZIntlKey: !!apiKeys['z-intl'],
  hasDeepSeekKey: !!apiKeys.deepseek,
  hasOpenAICompatibleKey: !!apiKeys['openai-compatible'],
  hasBailingKey: !!apiKeys.bailing,
  hasLongCatKey: !!apiKeys.longcat,
  hasModelScopeKey: !!apiKeys.modelscope,
  hasMoonshotKey: !!apiKeys.moonshot,
  hasMiniMaxKey: !!apiKeys.minimax,
  hasGeminiKey: !!apiKeys.gemini,
  hasAnthropicKey: !!apiKeys.anthropic,
});

// Initialize cache and connection pool
const requestCache = new RequestCache();
const connectionPool = new ConnectionPool();

const ctx = {
  API_PROVIDERS,
  PATH_TO_PROVIDER,
  TIME_TOOL_PROVIDERS,
  SYSTEM_TIME_TOOL,
  MAX_UPLOAD_BYTES,
  ENV_PATH,
  apiKeys,
  requestCache,
  connectionPool,
  retryRequest,
  handleStreamResponse,
  getEnvValue,
  persistEnvUpdates,
};

const server = http.createServer(createRouter(ctx));

server.on('error', err => {
  // In dev, an external proxy may already be running; don't crash the app.
  if (err && err.code === 'EADDRINUSE') {
    console.warn(
      `[proxy] Port ${PORT} already in use; using existing proxy instance.`
    );
    return;
  }
  console.error('[proxy] Server error:', err);
});

server.listen(PORT, () => {
  console.log(
    `[proxy] Enhanced proxy server running at http://localhost:${PORT}`
  );
  console.log(`[proxy] Features: Request retry, caching, connection pooling`);
  for (const config of Object.values(API_PROVIDERS)) {
    console.log(
      `[proxy] API endpoint: http://localhost:${PORT}${config.endpoint}`
    );
  }
  console.log(
    `[proxy] Cache size: ${requestCache.maxSize}, TTL: ${requestCache.ttlMs}ms`
  );
  console.log(
    `[proxy] Connection pool max size: ${connectionPool.maxConnections}`
  );
});
