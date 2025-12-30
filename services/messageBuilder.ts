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
  language?: string;
};

const buildLanguageInstruction = (language?: string) => {
  if (!language) return '';
  if (language === '简体中文') {
    return '请使用简体中文回复用户。';
  }
  if (language === 'English') {
    return 'Please respond in English.';
  }
  return `Please respond in ${language}.`;
};

export const buildSystemMessages = ({
  useSearch: _useSearch,
  language,
}: SystemMessageOptions): ChatMessage[] => {
  const messages: ChatMessage[] = [];
  void _useSearch;
  // Core identity prompts have been removed
  const languageInstruction = buildLanguageInstruction(language);
  if (languageInstruction) {
    messages.push({ role: 'system', content: languageInstruction });
  }

  return messages;
};

const appendPromptToText = (content: string, prompt: string) => {
  if (!prompt) return content;
  if (!content.trim()) return prompt;
  return `${content}\n\n${prompt}`;
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
  language?: string;
}): ChatMessage[] => [
  ...buildSystemMessages({
    useThinking: options.useThinking,
    useSearch: options.useSearch,
    language: options.language,
  }),
  ...mapHistoryToChatMessages(options.history, options.message),
];

export const buildFinalOpenAIMessages = (options: {
  history: HistoryMessage[];
  message?: string;
  useThinking: boolean;
  useSearch: boolean;
  language?: string;
}): OpenAIMessage[] => {
  const messages = [
    ...buildSystemMessages({
      useThinking: options.useThinking,
      useSearch: options.useSearch,
      language: options.language,
    }),
    ...mapHistoryToOpenAIMessages(options.history),
  ];
  void options.message;
  return messages;
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
