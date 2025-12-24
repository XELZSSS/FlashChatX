/* global self, MessageEvent */
type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens: number;
  };
};

type InitMessage = {
  type: 'init';
  thinkingProcessLabel: string;
  finalAnswerLabel: string;
};

type ChunkMessage = {
  type: 'chunk';
  value: string;
};

type FinalizeMessage = {
  type: 'finalize';
  provider: string;
  useThinking: boolean;
  useDeepThink: boolean;
};

type WorkerMessage = InitMessage | ChunkMessage | FinalizeMessage;

type ResultMessage = {
  type: 'result';
  responseContent: string;
  thinkingContent: string;
  thinkingSummary: string;
  tokenUsage?: TokenUsage;
};

type ErrorMessage = {
  type: 'error';
  message: string;
};

let thinkingContent = '';
let thinkingSummary = '';
let responseContent = '';
let tokenUsage: TokenUsage | undefined;
let isThinkingPhase = false;
let isSummaryPhase = false;
let summaryBuffer = '';
let thinkingProcessLabel = 'Thinking';
let finalAnswerLabel = 'Final Answer';

const resetState = () => {
  thinkingContent = '';
  thinkingSummary = '';
  responseContent = '';
  tokenUsage = undefined;
  isThinkingPhase = false;
  isSummaryPhase = false;
  summaryBuffer = '';
};

const sanitizeAIText = (text: string) => {
  if (!text) return text;

  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    if (code === 0xfffd || code === 0xfeff) {
      continue;
    }

    if (
      code === 0x00ef &&
      text.charCodeAt(i + 1) === 0x00bb &&
      text.charCodeAt(i + 2) === 0x00bf
    ) {
      i += 2;
      continue;
    }

    if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = text.charCodeAt(i + 1);
      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        result += text[i] + text[i + 1];
        i++;
      }
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      continue;
    }

    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      continue;
    }
    if (code >= 0x7f && code <= 0x9f) continue;
    if (
      (code >= 0x200b && code <= 0x200f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2060 && code <= 0x206f)
    ) {
      continue;
    }

    result += text[i];
  }

  return result;
};

const summaryOpenTag = '<thinking_summary>';
const summaryCloseTag = '</thinking_summary>';
const summaryMaxLength = 1200;

const appendSummary = (value: string) => {
  if (!value || thinkingSummary.length >= summaryMaxLength) return;
  const remaining = summaryMaxLength - thinkingSummary.length;
  thinkingSummary += value.slice(0, remaining);
};

const processSummaryTags = (text: string) => {
  if (!text) return '';
  summaryBuffer += text;
  let output = '';
  const findTagPrefix = (buffer: string, tag: string) => {
    let idx = buffer.lastIndexOf('<');
    while (idx !== -1) {
      const tail = buffer.slice(idx);
      if (tag.startsWith(tail)) {
        return idx;
      }
      idx = buffer.lastIndexOf('<', idx - 1);
    }
    return -1;
  };

  while (summaryBuffer) {
    if (isSummaryPhase) {
      const closeIndex = summaryBuffer.indexOf(summaryCloseTag);
      if (closeIndex === -1) {
        const partialIndex = findTagPrefix(summaryBuffer, summaryCloseTag);
        if (partialIndex >= 0) {
          if (partialIndex > 0) {
            appendSummary(summaryBuffer.slice(0, partialIndex));
          }
          summaryBuffer = summaryBuffer.slice(partialIndex);
          return output;
        }
        appendSummary(summaryBuffer);
        summaryBuffer = '';
        return output;
      }
      appendSummary(summaryBuffer.slice(0, closeIndex));
      summaryBuffer = summaryBuffer.slice(closeIndex + summaryCloseTag.length);
      isSummaryPhase = false;
      continue;
    }

    const openIndex = summaryBuffer.indexOf(summaryOpenTag);
    if (openIndex === -1) {
      const partialIndex = findTagPrefix(summaryBuffer, summaryOpenTag);
      if (partialIndex >= 0) {
        if (partialIndex > 0) {
          output += summaryBuffer.slice(0, partialIndex);
        }
        summaryBuffer = summaryBuffer.slice(partialIndex);
        break;
      }
      output += summaryBuffer;
      summaryBuffer = '';
      break;
    }

    if (openIndex > 0) {
      output += summaryBuffer.slice(0, openIndex);
    }
    summaryBuffer = summaryBuffer.slice(openIndex + summaryOpenTag.length);
    isSummaryPhase = true;
  }

  return output;
};

const finalize = (
  provider: string,
  useThinking: boolean,
  useDeepThink: boolean
) => {
  if (summaryBuffer) {
    if (isSummaryPhase) {
      appendSummary(summaryBuffer);
    } else if (isThinkingPhase) {
      thinkingContent += summaryBuffer;
    } else {
      responseContent += summaryBuffer;
    }
    summaryBuffer = '';
  }

  void provider;
  void useThinking;
  void useDeepThink;
  void thinkingProcessLabel;
  void finalAnswerLabel;
};

const handleChunk = (value: string) => {
  const cleanChunk = sanitizeAIText(value);
  if (!cleanChunk) return;

  if (cleanChunk.startsWith('__THINKING__')) {
    isThinkingPhase = true;
    const thinkingChunk = cleanChunk.replace('__THINKING__', '');
    if (thinkingChunk) {
      const output = processSummaryTags(thinkingChunk);
      if (output) {
        thinkingContent += output;
      }
    }
    return;
  }

  if (cleanChunk === '__END_THINKING__') {
    isThinkingPhase = false;
    return;
  }

  if (cleanChunk === '<thinking>') {
    isThinkingPhase = true;
    return;
  }

  if (cleanChunk === '</thinking>') {
    isThinkingPhase = false;
    return;
  }

  if (cleanChunk.startsWith('__TOKEN_USAGE__')) {
    try {
      const usageData = JSON.parse(cleanChunk.replace('__TOKEN_USAGE__', ''));
      tokenUsage = usageData;
    } catch (error) {
      console.error('[worker] Failed to parse token usage:', error);
    }
    return;
  }

  const output = processSummaryTags(cleanChunk);
  if (!output) return;
  if (isThinkingPhase) {
    thinkingContent += output;
  } else {
    responseContent += output;
  }
};

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  try {
    const message = event.data;
    if (!message) return;

    if (message.type === 'init') {
      resetState();
      thinkingProcessLabel =
        message.thinkingProcessLabel || thinkingProcessLabel;
      finalAnswerLabel = message.finalAnswerLabel || finalAnswerLabel;
      return;
    }

    if (message.type === 'chunk') {
      handleChunk(message.value || '');
      return;
    }

    if (message.type === 'finalize') {
      finalize(message.provider, message.useThinking, message.useDeepThink);
      const result: ResultMessage = {
        type: 'result',
        responseContent,
        thinkingContent,
        thinkingSummary,
        tokenUsage,
      };
      self.postMessage(result);
      resetState();
      return;
    }
  } catch (error) {
    const err: ErrorMessage = {
      type: 'error',
      message: error instanceof Error ? error.message : 'Worker error',
    };
    self.postMessage(err);
  }
};
