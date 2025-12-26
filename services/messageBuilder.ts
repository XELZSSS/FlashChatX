import { LocalAttachment, UploadedFileReference } from '../types';

type HistoryMessage = {
  role: 'user' | 'model';
  content: string;
  attachments?: UploadedFileReference[];
};
type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'file'; file: { file_id: string } };
type OpenAIMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string | OpenAIContentPart[];
};

type SystemMessageOptions = {
  useThinking: boolean;
  useSearch: boolean;
  searchPrompt?: string;
  showThinkingSummary?: boolean;
};

export const buildSystemMessages = ({
  useSearch: _useSearch,
  showThinkingSummary: _showThinkingSummary,
}: SystemMessageOptions): ChatMessage[] => {
  const messages: ChatMessage[] = [];
  void _useSearch;
  void _showThinkingSummary;
  // Core identity prompts have been removed

  return messages;
};

export const getThinkingSummaryPrompt = (
  useThinking: boolean,
  showThinkingSummary?: boolean
) => {
  if (!useThinking || !showThinkingSummary) {
    return '';
  }
  return 'After answering, add a short 1-2 sentence summary in <thinking_summary>...</thinking_summary>.';
};

const appendPromptToText = (content: string, prompt: string) => {
  if (!prompt) return content;
  if (!content.trim()) return prompt;
  return `${content}\n\n${prompt}`;
};

const findMatchingUserMessageIndex = (
  messages: ChatMessage[],
  message?: string
) => {
  if (!message) return -1;
  const target = message.trim();
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role !== 'user') continue;
    if (messages[i].content.trim() === target) {
      return i;
    }
  }
  return -1;
};

const appendThinkingSummaryPromptToMessages = (
  messages: ChatMessage[],
  useThinking: boolean,
  showThinkingSummary?: boolean,
  message?: string
): ChatMessage[] => {
  const prompt = getThinkingSummaryPrompt(useThinking, showThinkingSummary);
  if (!prompt) return messages;

  const next = [...messages];
  const matchedIndex = findMatchingUserMessageIndex(next, message);
  const targetIndex =
    matchedIndex !== -1
      ? matchedIndex
      : next.map(item => item.role).lastIndexOf('user');
  if (targetIndex !== -1) {
    next[targetIndex] = {
      ...next[targetIndex],
      content: appendPromptToText(next[targetIndex].content, prompt),
    };
    return next;
  }

  next.push({ role: 'user', content: prompt });
  return next;
};

export const mapHistoryToChatMessages = (
  history: HistoryMessage[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _message: string
): ChatMessage[] => [
  ...history.map<ChatMessage>(item => ({
    role: item.role === 'model' ? 'assistant' : 'user',
    content: item.content || '',
  })),
];

const buildOpenAIParts = (
  content: string,
  attachments?: UploadedFileReference[]
): OpenAIContentPart[] => {
  const parts: OpenAIContentPart[] = [];
  if (content.trim()) {
    parts.push({ type: 'text', text: content });
  }

  attachments
    ?.filter(item => item.provider === 'openai' && item.fileId)
    .forEach(item => {
      parts.push({ type: 'file', file: { file_id: item.fileId } });
    });

  return parts;
};

export const mapHistoryToOpenAIMessages = (
  history: HistoryMessage[]
): OpenAIMessage[] =>
  history.map(item => {
    const parts = buildOpenAIParts(item.content || '', item.attachments);
    const content = parts.length ? parts : item.content ? item.content : '';
    return {
      role: item.role === 'model' ? 'assistant' : 'user',
      content,
    };
  });

export const buildFinalMessages = (options: {
  history: HistoryMessage[];
  message: string;
  useThinking: boolean;
  useSearch: boolean;
  showThinkingSummary?: boolean;
}): ChatMessage[] =>
  appendThinkingSummaryPromptToMessages(
    [
      ...buildSystemMessages({
        useThinking: options.useThinking,
        useSearch: options.useSearch,
        showThinkingSummary: options.showThinkingSummary,
      }),
      ...mapHistoryToChatMessages(options.history, options.message),
    ],
    options.useThinking,
    options.showThinkingSummary,
    options.message
  );

export const buildFinalOpenAIMessages = (options: {
  history: HistoryMessage[];
  message?: string;
  useThinking: boolean;
  useSearch: boolean;
  showThinkingSummary?: boolean;
}): OpenAIMessage[] => {
  const prompt = getThinkingSummaryPrompt(
    options.useThinking,
    options.showThinkingSummary
  );
  const messages = [
    ...buildSystemMessages({
      useThinking: options.useThinking,
      useSearch: options.useSearch,
      showThinkingSummary: options.showThinkingSummary,
    }),
    ...mapHistoryToOpenAIMessages(options.history),
  ];

  if (!prompt) return messages;

  const next = [...messages];
  const getMessageText = (content: string | OpenAIContentPart[]) =>
    Array.isArray(content)
      ? content
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join('')
      : content;
  let targetIndex = -1;
  if (options.message) {
    const target = options.message.trim();
    for (let i = next.length - 1; i >= 0; i -= 1) {
      if (next[i].role !== 'user') continue;
      const text = getMessageText(next[i].content).trim();
      if (text === target) {
        targetIndex = i;
        break;
      }
    }
  }
  if (targetIndex === -1) {
    targetIndex = next.map(item => item.role).lastIndexOf('user');
  }
  if (targetIndex !== -1) {
    const content = next[targetIndex].content;
    next[targetIndex] = {
      ...next[targetIndex],
      content: Array.isArray(content)
        ? [...content, { type: 'text', text: `\n\n${prompt}` }]
        : appendPromptToText(content, prompt),
    };
    return next;
  }

  next.push({ role: 'user', content: prompt });
  return next;
};

type TextMessage = { role: string; content: string | OpenAIContentPart[] };

const buildAttachmentPrompt = (attachments: LocalAttachment[]) => {
  const fileList = attachments
    .map(file => `- ${file.file.name} (id: ${file.id})`)
    .join('\n');
  return `Attached files:\n${fileList}\n\nPlease call read_file for any file you need.`;
};

export const injectAttachmentPrompt = <T extends TextMessage>(
  messages: T[],
  attachments?: LocalAttachment[]
): T[] => {
  if (!attachments || attachments.length === 0) return messages;
  const prompt = buildAttachmentPrompt(attachments);
  const next = [...messages];
  const targetIndex = next.map(item => item.role).lastIndexOf('user');
  if (targetIndex === -1) {
    return [...next, { role: 'user', content: prompt } as T];
  }
  const target = next[targetIndex];
  const appendPrompt = (content: string | OpenAIContentPart[]) =>
    Array.isArray(content)
      ? [...content, { type: 'text', text: `\n\n${prompt}` }]
      : appendPromptToText(content || '', prompt);
  next[targetIndex] = {
    ...target,
    content: appendPrompt(target.content),
  };
  return next;
};

export const buildInstructionText = (options: SystemMessageOptions): string =>
  buildSystemMessages(options)
    .map(message => message.content)
    .join(' ');
