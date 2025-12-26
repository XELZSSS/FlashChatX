import { useCallback, useMemo, useRef, useState } from 'react';
import { ChatSession, Message } from '../../types';

type UseSessionsOptions = {
  chatSearchQuery: string;
  currentSessionId: string | null;
};

export const useSessions = ({
  chatSearchQuery,
  currentSessionId,
}: UseSessionsOptions) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const sessionsRef = useRef<ChatSession[]>([]);

  const setSessionsWithRef = useCallback(
    (updater: (prev: ChatSession[]) => ChatSession[]) => {
      setSessions(prev => {
        const next = updater(prev);
        sessionsRef.current = next;
        return next;
      });
    },
    []
  );

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const query = chatSearchQuery.trim().toLowerCase();
    if (!query) {
      return sortedSessions;
    }

    return sortedSessions.filter(session => {
      if (session.title?.toLowerCase().includes(query)) {
        return true;
      }

      return session.messages.some(message => {
        const content = message.content?.toLowerCase() || '';
        if (content.includes(query)) {
          return true;
        }
        if (message.responseContent?.toLowerCase().includes(query)) {
          return true;
        }
        if (message.thinkingSummary?.toLowerCase().includes(query)) {
          return true;
        }
        if (message.thinkingContent?.toLowerCase().includes(query)) {
          return true;
        }
        if (message.attachments?.length) {
          return message.attachments.some(file =>
            file.name?.toLowerCase().includes(query)
          );
        }
        return false;
      });
    });
  }, [chatSearchQuery, sortedSessions]);

  const currentSession = useMemo(
    () => sessions.find(s => s.id === currentSessionId) || null,
    [sessions, currentSessionId]
  );

  const currentMessages = useMemo(() => {
    return currentSession ? currentSession.messages : [];
  }, [currentSession]);

  const updateSessionMessages = useCallback(
    (sessionId: string, messages: Message[]) => {
      setSessionsWithRef(prev =>
        prev.map(s =>
          s.id === sessionId ? { ...s, messages, updatedAt: Date.now() } : s
        )
      );
    },
    [setSessionsWithRef]
  );

  const updateSessionTitle = useCallback(
    (sessionId: string, title: string) => {
      setSessionsWithRef(prev =>
        prev.map(s => (s.id === sessionId ? { ...s, title } : s))
      );
    },
    [setSessionsWithRef]
  );

  const updateSessionPinStatus = useCallback(
    (sessionId: string, isPinned: boolean) => {
      setSessionsWithRef(prev =>
        prev.map(s => (s.id === sessionId ? { ...s, isPinned } : s))
      );
    },
    [setSessionsWithRef]
  );

  return {
    sessions,
    sessionsRef,
    setSessionsWithRef,
    sortedSessions,
    filteredSessions,
    currentSession,
    currentMessages,
    updateSessionMessages,
    updateSessionTitle,
    updateSessionPinStatus,
  };
};
