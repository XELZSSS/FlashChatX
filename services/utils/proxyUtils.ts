/**
 * Proxy request utilities
 * 代理请求工具函数
 */

const PROXY_BASE_URL = 'http://localhost:8787/api';

/**
 * Retry mechanism for API calls with exponential backoff
 * API 调用的指数退避重试机制
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const message =
        error instanceof Error ? error.message : String(error || '');
      const status = (() => {
        if (!error || typeof error !== 'object') return undefined;
        const candidate = error as {
          status?: unknown;
          response?: { status?: unknown };
        };
        if (typeof candidate.status === 'number') return candidate.status;
        if (typeof candidate.response?.status === 'number') {
          return candidate.response.status;
        }
        return undefined;
      })();

      const retryable =
        status === 429 ||
        (status && status >= 500) ||
        message.includes('rate limit') ||
        message.includes('ECONN') ||
        message.includes('ETIMEDOUT') ||
        message.includes('network');

      if (!retryable) {
        throw error;
      }

      if (attempt === maxRetries) {
        throw new Error(
          `Request failed after ${maxRetries + 1} attempts: ${message || 'retry limit reached'}`
        );
      }

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Request failed without error details');
};

/**
 * Fetch from proxy with retry
 * 带重试的代理请求
 */
export const fetchProxy = async (
  endpoint: string,
  payload: unknown
): Promise<Response> =>
  withRetry(async () => {
    const res = await fetch(`${PROXY_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${res.statusText} - ${errorText}`);
    }

    return res;
  });

/**
 * Post JSON to proxy and parse response
 * 发送 JSON 到代理并解析响应
 */
export const postProxyJson = async (endpoint: string, payload: unknown) => {
  const response = await fetchProxy(endpoint, payload);
  return response.json();
};

/**
 * Require API key or throw error
 * 要求 API 密钥，否则抛出错误
 */
export const requireApiKey = (key: string | undefined, label: string) => {
  if (!key) {
    throw new Error(`${label} is missing. Please configure the API key.`);
  }
  return key;
};
