import { useCallback, type MutableRefObject } from 'react';
import type { ChatSession, ExtendedMessage } from '../../../types';

type UseMessageMutationsOptions = {
  currentSessionIdRef: MutableRefObject<string | null>;
  setSessionsWithRef: (updater: (prev: ChatSession[]) => ChatSession[]) => void;
};

export const useMessageMutations = ({
  currentSessionIdRef,
  setSessionsWithRef,
}: UseMessageMutationsOptions) => {
  const updateMessage = useCallback(
    (messageId: string, updates: Partial<ExtendedMessage>) => {
      const sessionId = currentSessionIdRef.current;
      if (!sessionId) return;

      setSessionsWithRef(prev =>
        prev.map(session => {
          if (session.id !== sessionId) return session;

          return {
            ...session,
            messages: session.messages.map(msg =>
              msg.id === messageId ? { ...msg, ...updates } : msg
            ),
          };
        })
      );
    },
    [currentSessionIdRef, setSessionsWithRef]
  );

  return { updateMessage };
};
