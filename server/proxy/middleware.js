import { setTimeout as delay } from 'timers/promises';
import { ProxySSEParser, handleStreamResponse } from './utils/sse.js';

// Request cache implementation
export class RequestCache {
  constructor(maxSize = 100, ttlMs = 5 * 60 * 1000) {
    // Default 5 minutes TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  _isExpired(entry) {
    return Date.now() - entry.timestamp > this.ttlMs;
  }

  _cleanupExpired() {
    for (const [key, entry] of this.cache.entries()) {
      if (this._isExpired(entry)) {
        this.cache.delete(key);
      }
    }
  }

  _evictOldest() {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry || this._isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key, data) {
    this._cleanupExpired();
    this._evictOldest();
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clear() {
    this.cache.clear();
  }
}

// Connection pool for HTTP requests
export class ConnectionPool {
  constructor(maxConnections = 10) {
    this.maxConnections = maxConnections;
    this.activeConnections = 0;
    this.requestQueue = [];
  }

  async execute(requestFn) {
    return new Promise((resolve, reject) => {
      if (this.activeConnections < this.maxConnections) {
        this._executeRequest(requestFn, resolve, reject);
      } else {
        this.requestQueue.push({ requestFn, resolve, reject });
      }
    });
  }

  async _executeRequest(requestFn, resolve, reject) {
    this.activeConnections++;
    try {
      const result = await requestFn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.activeConnections--;
      this._processQueue();
    }
  }

  _processQueue() {
    if (
      this.requestQueue.length > 0 &&
      this.activeConnections < this.maxConnections
    ) {
      const { requestFn, resolve, reject } = this.requestQueue.shift();
      this._executeRequest(requestFn, resolve, reject);
    }
  }
}

// Retry mechanism with exponential backoff
export async function retryRequest(
  requestFn,
  maxRetries = 3,
  baseDelay = 1000
) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;

      // Don't retry on client errors (4xx)
      const status = Number(error?.status);
      if (Number.isFinite(status) && status >= 400 && status < 500) {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delayMs = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(
        `[proxy] Request failed, retrying in ${Math.round(delayMs)}ms (attempt ${attempt + 1}/${maxRetries})`
      );
      await delay(delayMs);
    }
  }

  throw lastError;
}

export { ProxySSEParser, handleStreamResponse };
