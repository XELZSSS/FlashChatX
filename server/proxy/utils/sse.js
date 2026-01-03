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
