import type { Message } from '../../types';
import { generateId } from '../appUtils';
import { buildHistory, type HistoryEntry } from '../../utils/chatHistory';

type BuildContextOptions = {
  userMessage: Message;
  updatedMessages: Message[];
  memoryContents: string[];
  searchMessage: Message | null;
  memuEnabled: boolean;
};

export const buildContextForRequest = ({
  userMessage,
  updatedMessages,
  memoryContents,
  searchMessage,
  memuEnabled,
}: BuildContextOptions): {
  contextMessages: Message[];
  historyForAPI: HistoryEntry[];
} => {
  const contextMessages: Message[] = [];
  let historyForAPI: HistoryEntry[] = [];

  if (memuEnabled) {
    if (memoryContents.length) {
      const memoryContext = memoryContents.join('\n\n');
      contextMessages.push({
        id: generateId(),
        role: 'user',
        content: `相关记忆:\n${memoryContext}`,
        timestamp: Date.now(),
      });
    }

    if (searchMessage) {
      contextMessages.push(searchMessage);
    }

    historyForAPI = buildHistory([userMessage, ...contextMessages]);
  } else {
    const searchContext = searchMessage ? [searchMessage] : [];
    historyForAPI = buildHistory([...updatedMessages, ...searchContext]);
  }

  return { contextMessages, historyForAPI };
};
