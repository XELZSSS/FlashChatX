import { useCallback, type MutableRefObject } from 'react';
import { generateId } from '../appUtils';
import type { ChatSession, ExtendedMessage, Message } from '../../types';

export type ExportFormat = 'json' | 'markdown' | 'text';

type UseChatFormattersOptions = {
  t: (key: string) => string;
  fileCounterRef: MutableRefObject<number>;
};

export const useChatFormatters = ({
  t,
  fileCounterRef,
}: UseChatFormattersOptions) => {
  const buildExportFilename = useCallback((format: string) => {
    const date = new Date();
    const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(date.getDate()).padStart(2, '0')}`;
    return `flashchatx-export-${stamp}.${format}`;
  }, []);

  const formatMarkdownSession = useCallback(
    (session: ChatSession) => {
      const createdAt =
        session.messages[0]?.timestamp || session.updatedAt || Date.now();
      const lines: string[] = [];
      lines.push(`# ${session.title || t('untitled')}`);
      lines.push(`- id: ${session.id}`);
      lines.push(`- createdAt: ${createdAt}`);
      lines.push(`- updatedAt: ${session.updatedAt}`);
      lines.push(`- pinned: ${session.isPinned ? 'true' : 'false'}`);
      lines.push('');
      session.messages.forEach(message => {
        const roleLabel = message.role === 'user' ? 'User' : 'Assistant';
        lines.push(`## ${roleLabel}`);
        if (message.attachments?.length) {
          lines.push('> attachments:');
          message.attachments.forEach(file => {
            lines.push(
              `> - ${file.name} (${file.provider}:${file.fileId}, ${file.size} bytes)`
            );
          });
        }
        lines.push(message.content || '');
        lines.push('');
      });
      return lines.join('\n');
    },
    [t]
  );

  const formatTextSession = useCallback((session: ChatSession) => {
    const lines: string[] = [];
    session.messages.forEach(message => {
      const roleLabel = message.role === 'user' ? 'User' : 'Assistant';
      lines.push(`${roleLabel}: ${message.content || ''}`);
      lines.push('');
    });
    return lines.join('\n');
  }, []);

  const buildExport = useCallback(
    (session: ChatSession, format: ExportFormat) => {
      if (format === 'json') {
        const payload = {
          version: 1,
          exportedAt: Date.now(),
          sessions: [session],
        };
        return {
          filename: buildExportFilename('json'),
          content: JSON.stringify(payload, null, 2),
        };
      }

      if (format === 'markdown') {
        return {
          filename: buildExportFilename('md'),
          content: formatMarkdownSession(session),
        };
      }

      return {
        filename: buildExportFilename('txt'),
        content: formatTextSession(session),
      };
    },
    [buildExportFilename, formatMarkdownSession, formatTextSession]
  );

  const createImportedMessage = useCallback(
    (
      role: 'user' | 'model',
      content: string,
      timestamp: number,
      extras?: Partial<ExtendedMessage>
    ): ExtendedMessage => {
      const baseMessage: ExtendedMessage = {
        id: `${generateId()}-${fileCounterRef.current++}`,
        role,
        content: content || '',
        timestamp,
      };

      if (!extras) {
        return baseMessage;
      }

      return {
        ...baseMessage,
        ...(extras.attachments?.length
          ? { attachments: extras.attachments }
          : {}),
        ...(extras.isThinking !== undefined
          ? { isThinking: extras.isThinking }
          : {}),
        ...(extras.thinkingContent
          ? { thinkingContent: extras.thinkingContent }
          : {}),
        ...(extras.responseContent
          ? { responseContent: extras.responseContent }
          : {}),
        ...(extras.isThinkingCollapsed !== undefined
          ? { isThinkingCollapsed: extras.isThinkingCollapsed }
          : {}),
        ...(extras.tokenUsage ? { tokenUsage: extras.tokenUsage } : {}),
      };
    },
    [fileCounterRef]
  );

  const parseJsonImport = useCallback(
    (raw: string): ChatSession[] => {
      const data = JSON.parse(raw);
      const sessionsList = Array.isArray(data) ? data : data.sessions;
      if (!Array.isArray(sessionsList)) {
        return [];
      }
      return sessionsList
        .filter(item => item && Array.isArray(item.messages))
        .map(item => {
          const messages: Message[] = item.messages.map(
            (msg: Message, index: number) => {
              const msgData = msg as Message & Partial<ExtendedMessage>;
              return createImportedMessage(
                msgData.role === 'model' ? 'model' : 'user',
                msgData.content || '',
                msgData.timestamp || Date.now() + index,
                {
                  attachments: msgData.attachments,
                  isThinking: msgData.isThinking,
                  thinkingContent: msgData.thinkingContent,
                  responseContent: msgData.responseContent,
                  isThinkingCollapsed: msgData.isThinkingCollapsed,
                  tokenUsage: msgData.tokenUsage,
                }
              );
            }
          );
          const updatedAt =
            item.updatedAt ||
            messages[messages.length - 1]?.timestamp ||
            Date.now();
          return {
            id: generateId(),
            title: item.title || t('untitled'),
            messages,
            updatedAt,
            isPinned: Boolean(item.isPinned),
          } as ChatSession;
        });
    },
    [createImportedMessage, t]
  );

  const parseMarkdownImport = useCallback(
    (raw: string): ChatSession[] => {
      const blocks = raw.split(/\n---\n/g);
      const sessionsList: ChatSession[] = [];

      blocks.forEach(block => {
        const lines = block.split('\n');
        let title = '';
        const messages: Message[] = [];
        let currentRole: 'user' | 'model' | null = null;
        let buffer: string[] = [];

        const flushBuffer = () => {
          if (!currentRole) return;
          const content = buffer.join('\n').trimEnd();
          const timestamp = Date.now() + messages.length;
          messages.push(createImportedMessage(currentRole, content, timestamp));
          buffer = [];
        };

        lines.forEach(line => {
          if (line.startsWith('# ')) {
            title = line.slice(2).trim();
            return;
          }
          if (line.startsWith('## ')) {
            flushBuffer();
            const roleLabel = line.slice(3).trim().toLowerCase();
            currentRole = roleLabel.startsWith('user') ? 'user' : 'model';
            return;
          }
          if (line.startsWith('> attachments:')) {
            return;
          }
          if (line.startsWith('> -')) {
            return;
          }
          if (line.startsWith('- ') && !currentRole) {
            return;
          }
          buffer.push(line);
        });

        flushBuffer();
        if (messages.length) {
          sessionsList.push({
            id: generateId(),
            title: title || t('untitled'),
            messages,
            updatedAt: messages[messages.length - 1]?.timestamp || Date.now(),
          });
        }
      });

      return sessionsList;
    },
    [createImportedMessage, t]
  );

  const parseTextImport = useCallback(
    (raw: string): ChatSession[] => {
      const lines = raw.split('\n');
      const messages: Message[] = [];
      let currentRole: 'user' | 'model' | null = null;
      let buffer: string[] = [];

      const flushBuffer = () => {
        if (!currentRole) return;
        const content = buffer.join('\n').trimEnd();
        const timestamp = Date.now() + messages.length;
        messages.push(createImportedMessage(currentRole, content, timestamp));
        buffer = [];
      };

      lines.forEach(line => {
        if (line.startsWith('User:')) {
          flushBuffer();
          currentRole = 'user';
          buffer.push(line.replace(/^User:\s?/, ''));
          return;
        }
        if (line.startsWith('Assistant:')) {
          flushBuffer();
          currentRole = 'model';
          buffer.push(line.replace(/^Assistant:\s?/, ''));
          return;
        }
        buffer.push(line);
      });

      flushBuffer();
      if (!messages.length) return [];

      return [
        {
          id: generateId(),
          title: t('untitled'),
          messages,
          updatedAt: messages[messages.length - 1]?.timestamp || Date.now(),
        },
      ];
    },
    [createImportedMessage, t]
  );

  const parseImport = useCallback(
    (raw: string, filename: string): ChatSession[] => {
      const name = filename.toLowerCase();
      if (name.endsWith('.json')) {
        return parseJsonImport(raw);
      }
      if (name.endsWith('.md') || name.endsWith('.markdown')) {
        return parseMarkdownImport(raw);
      }
      return parseTextImport(raw);
    },
    [parseJsonImport, parseMarkdownImport, parseTextImport]
  );

  return { buildExport, parseImport };
};
