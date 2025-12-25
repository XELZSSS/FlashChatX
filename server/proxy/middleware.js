import { setTimeout as delay } from 'timers/promises';

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

// Simple SSE parser implementation for proxy server
export class ProxySSEParser {
  constructor() {
    this.buffer = '';
  }

  processChunk(chunk) {
    const text = Buffer.from(chunk).toString('utf8');
    this.buffer += text;

    // Split events
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    const events = [];
    let currentEvent = {};
    let dataLines = [];

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine === '') {
        if (dataLines.length > 0) {
          currentEvent.data = dataLines.join('\n');
          events.push(currentEvent);
        }
        currentEvent = {};
        dataLines = [];
        continue;
      }

      const colonIndex = trimmedLine.indexOf(':');
      if (colonIndex === -1) continue;

      const field = trimmedLine.substring(0, colonIndex);
      let value = trimmedLine.substring(colonIndex + 1);

      if (value.startsWith(' ')) {
        value = value.substring(1);
      }

      switch (field) {
        case 'data':
          dataLines.push(value);
          break;
        case 'event':
          currentEvent.event = value;
          break;
        case 'id':
          currentEvent.id = value;
          break;
        case 'retry': {
          const retryValue = parseInt(value, 10);
          if (!isNaN(retryValue)) {
            currentEvent.retry = retryValue;
          }
          break;
        }
      }
    }

    // Handle the last possible event
    if (dataLines.length > 0) {
      currentEvent.data = dataLines.join('\n');
      events.push(currentEvent);
    }

    return events;
  }

  reset() {
    this.buffer = '';
  }
}

export const handleStreamResponse = async (upstream, res, options = {}) => {
  if (!upstream.body) {
    res.writeHead(500);
    return res.end(JSON.stringify({ error: 'Upstream response missing body' }));
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const reader = upstream.body.getReader();
  const parser = new ProxySSEParser();
  let streamCompleted = false;

  const drainBufferedEvents = async () => {
    let remainingEvents = parser.processChunk('');
    let attempts = 0;
    const maxAttempts = 3;

    while (remainingEvents.length > 0 && attempts < maxAttempts) {
      for (const event of remainingEvents) {
        if (event.data) {
          const filtered = options.formatEventData
            ? options.formatEventData(event.data)
            : event.data;
          if (filtered) {
            res.write(`data: ${filtered}\n\n`);
          }
        }
      }
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 10));
      remainingEvents = parser.processChunk('');
    }

    const finalEvents = parser.processChunk('');
    for (const event of finalEvents) {
      if (event.data) {
        const filtered = options.formatEventData
          ? options.formatEventData(event.data)
          : event.data;
        if (filtered) {
          res.write(`data: ${filtered}\n\n`);
        }
      }
    }
  };

  const pump = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          streamCompleted = true;
          await drainBufferedEvents();
          break;
        }

        if (value) {
          const events = parser.processChunk(value);
          for (const event of events) {
            if (event.data) {
              const filtered = options.formatEventData
                ? options.formatEventData(event.data)
                : event.data;
              if (filtered) {
                res.write(`data: ${filtered}\n\n`);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[proxy] upstream stream error', err);
      // Try to process any remaining data before error handling
      if (!streamCompleted) {
        try {
          await drainBufferedEvents();
        } catch (parseError) {
          console.error('[proxy] Error parsing remaining events:', parseError);
        }
      }
    } finally {
      if (!res.writableEnded) res.end();
    }
  };

  pump();
};
