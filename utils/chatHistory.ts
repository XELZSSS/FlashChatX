import { Message, MessageRole, UploadedFileReference } from '../types';

export type HistoryEntry = {
  role: MessageRole;
  content: string;
  attachments?: UploadedFileReference[];
};

export const buildHistory = (messages: Message[]): HistoryEntry[] => {
  const filteredMessages = messages.filter(
    m => !(m.role === 'model' && !m.content.trim())
  );

  return filteredMessages.map(m => ({
    role: m.role,
    content: m.content,
    attachments: m.attachments,
  }));
};

// Build history for display (filters out search results).
export const buildDisplayHistory = (messages: Message[]) =>
  messages.filter(
    m =>
      !m.content.includes('根据搜索"') && !m.content.includes('未找到相关内容')
  );
