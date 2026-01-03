import type { ChatSession } from '../../types';
import { generateId } from '../appUtils';

type SessionFactoryOptions = {
  sessionId: string | null;
  session: ChatSession | null;
  titleBase: string;
  setSessionsWithRef: (updater: (prev: ChatSession[]) => ChatSession[]) => void;
  setCurrentSessionId: (id: string | null) => void;
};

const buildSessionTitle = (titleBase: string) => {
  if (!titleBase) return '';
  return titleBase.slice(0, 30) + (titleBase.length > 30 ? '...' : '');
};

export const ensureSession = ({
  sessionId,
  session,
  titleBase,
  setSessionsWithRef,
  setCurrentSessionId,
}: SessionFactoryOptions) => {
  if (sessionId && session) {
    return { activeSessionId: sessionId, activeSession: session };
  }

  const newSession: ChatSession = {
    id: generateId(),
    title: buildSessionTitle(titleBase),
    messages: [],
    updatedAt: Date.now(),
  };

  setSessionsWithRef(prev => [newSession, ...prev]);
  setCurrentSessionId(newSession.id);

  return { activeSessionId: newSession.id, activeSession: newSession };
};

export const buildSessionTitleFromInput = buildSessionTitle;
