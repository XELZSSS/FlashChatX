/**
 * Robust SSE (Server-Sent Events) parser
 * Ensures no instantaneous packet loss or delay
 */

export interface SSEParserOptions {
  /** Buffer size limit in bytes */
  maxBufferSize?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Error callback function */
  onError?: (error: Error) => void;
}

export interface SSEEvent {
  /** Event type */
  event?: string;
  /** Data content */
  data: string;
  /** Event ID */
  id?: string;
  /** Reconnection time in milliseconds */
  retry?: number;
}

export class SSEParser {
  private buffer: string = '';
  private lastEventId: string | undefined;
  private retryCount: number = 0;
  private options: SSEParserOptions;
  private decoder: TextDecoder;

  constructor(options: SSEParserOptions = {}) {
    this.options = {
      maxBufferSize: options.maxBufferSize ?? 1024 * 1024, // 1MB
      maxRetries: options.maxRetries ?? 3,
      onError: options.onError ?? console.error,
    };
    this.decoder = new TextDecoder();
  }

  /**
   * Process new data chunk
   * @param chunk Newly received data chunk
   * @returns Array of parsed events
   */
  public processChunk(chunk: Uint8Array): SSEEvent[] {
    // Decode binary data to text
    const text = this.decoder.decode(chunk, { stream: true });
    this.buffer += text;

    // Check buffer size
    if (this.buffer.length > this.options.maxBufferSize) {
      const error = new Error(
        `Buffer overflow: ${this.buffer.length} bytes exceeds limit of ${this.options.maxBufferSize}`
      );
      this.options.onError(error);
      this.reset();
      return [];
    }

    // Try to parse complete events
    const events = this.parseEvents(false);
    this.retryCount = 0;

    return events;
  }

  /**
   * Parse complete events from buffer
   * @returns Array of parsed events
   */
  public parseEvents(flush: boolean = false): SSEEvent[] {
    const events: SSEEvent[] = [];
    if (flush && !this.buffer) {
      return events;
    }
    const source =
      flush && !this.buffer.endsWith('\n') ? `${this.buffer}\n` : this.buffer;
    const lines = source.split('\n');

    // Keep the last incomplete line
    const lastLine = lines.pop() || '';
    this.buffer = flush ? '' : lastLine;

    let currentEvent: Partial<SSEEvent> = {};
    let dataLines: string[] = [];

    for (const line of lines) {
      const normalizedLine = line.endsWith('\r') ? line.slice(0, -1) : line;

      // Empty line indicates end of event
      if (normalizedLine === '') {
        if (dataLines.length > 0) {
          currentEvent.data = dataLines.join('\n');
          events.push(this.createEvent(currentEvent));
          currentEvent = {};
          dataLines.length = 0;
        }
        continue;
      }

      // Parse field
      const colonIndex = normalizedLine.indexOf(':');
      if (colonIndex === -1) {
        // Ignore invalid lines
        continue;
      }

      const field = normalizedLine.substring(0, colonIndex);
      let value = normalizedLine.substring(colonIndex + 1);

      // Remove single space at the beginning of value
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
          this.lastEventId = value;
          break;
        case 'retry': {
          const retryValue = parseInt(value, 10);
          if (!isNaN(retryValue)) {
            currentEvent.retry = retryValue;
          }
          break;
        }
        // Ignore other fields
      }
    }

    // Handle the last possible event at the end of buffer
    if (dataLines.length > 0) {
      currentEvent.data = dataLines.join('\n');
      events.push(this.createEvent(currentEvent));
    }

    return events;
  }

  /**
   * Create standardized event object
   * @param event Raw event data
   * @returns Standardized event object
   */
  private createEvent(event: Partial<SSEEvent>): SSEEvent {
    if (event.id) {
      this.lastEventId = event.id;
    }
    return {
      event: event.event,
      data: event.data || '',
      id: event.id || this.lastEventId,
      retry: event.retry,
    };
  }

  /**
   * Reset parser state
   */
  public reset(): void {
    this.buffer = '';
    this.retryCount = 0;
  }

  /**
   * Get the last event ID
   */
  public getLastEventId(): string | undefined {
    return this.lastEventId;
  }

  /**
   * Handle error and try to recover
   * @param error Error object
   * @returns Whether to continue processing
   */
  public async handleError(error: Error): Promise<boolean> {
    this.options.onError(error);

    if (this.retryCount >= this.options.maxRetries) {
      return false;
    }

    this.retryCount++;

    // Exponential backoff strategy
    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));

    return true;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.reset();
  }
}

/**
 * Convenience function to create SSE parser
 * @param options Configuration options
 * @returns SSE parser instance
 */
export function createSSEParser(options?: SSEParserOptions): SSEParser {
  return new SSEParser(options);
}

/**
 * Helper function to process streaming response
 * @param reader Readable stream reader
 * @param parser SSE parser
 * @param onEvent Event callback function
 * @param onComplete Completion callback function
 * @param onError Error callback function
 */
export async function processSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  parser: SSEParser,
  onEvent: (event: SSEEvent) => void,
  onComplete?: () => void,
  onError?: (error: Error) => void
): Promise<void> {
  let streamCompleted = false;

  while (true) {
    try {
      const { done, value } = await reader.read();

      if (done) {
        streamCompleted = true;
        parser.parseEvents(true).forEach(onEvent);
        onComplete?.();
        return;
      }

      if (value) {
        const events = parser.processChunk(value);
        events.forEach(onEvent);
      }
    } catch (error) {
      if (!streamCompleted) {
        try {
          parser.parseEvents(false).forEach(onEvent);
        } catch (parseError) {
          console.error('Error parsing remaining events:', parseError);
        }
      }

      const shouldContinue = await parser.handleError(error as Error);
      if (!shouldContinue) {
        onError?.(error as Error);
        return;
      }
    }
  }
}
