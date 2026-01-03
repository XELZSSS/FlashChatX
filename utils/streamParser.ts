import type { TokenUsage } from '../types';

export type ParsedStreamChunk =
  | { kind: 'ignore' }
  | { kind: 'startThinking' }
  | { kind: 'endThinking' }
  | { kind: 'thinking'; value: string }
  | { kind: 'content'; value: string }
  | { kind: 'tokenUsage'; usage: TokenUsage };

export const parseStreamChunk = (chunk: string): ParsedStreamChunk => {
  if (!chunk) return { kind: 'ignore' };

  if (chunk.startsWith('__THINKING__')) {
    return { kind: 'thinking', value: chunk.replace('__THINKING__', '') };
  }
  if (chunk === '__END_THINKING__') {
    return { kind: 'endThinking' };
  }
  if (chunk === '<thinking>') {
    return { kind: 'startThinking' };
  }
  if (chunk === '</thinking>') {
    return { kind: 'endThinking' };
  }
  if (chunk.startsWith('__TOKEN_USAGE__')) {
    try {
      const parsed = JSON.parse(chunk.replace('__TOKEN_USAGE__', ''));
      return { kind: 'tokenUsage', usage: parsed as TokenUsage };
    } catch {
      return { kind: 'ignore' };
    }
  }

  return { kind: 'content', value: chunk };
};
