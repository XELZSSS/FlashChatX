import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { ChatSession } from '../../types';

type UseChatActionsOptions = {
  setCurrentSessionId: Dispatch<SetStateAction<string | null>>;
  setInput: Dispatch<SetStateAction<string>>;
  setIsClearConfirmOpen: (open: boolean) => void;
  setIsRenameDialogOpen: (open: boolean) => void;
  setRenameSessionId: (id: string | null) => void;
  setNewTitle: (value: string) => void;
  renameSessionId: string | null;
  newTitle: string;
  setSessionsWithRef: (updater: (prev: ChatSession[]) => ChatSession[]) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  updateSessionPinStatus: (sessionId: string, isPinned: boolean) => void;
  currentSessionIdRef: MutableRefObject<string | null>;
  currentSessionRef: MutableRefObject<ChatSession | null>;
  sessionsRef: MutableRefObject<ChatSession[]>;
};

export const useChatActions = ({
  setCurrentSessionId,
  setInput,
  setIsClearConfirmOpen,
  setIsRenameDialogOpen,
  setRenameSessionId,
  setNewTitle,
  renameSessionId,
  newTitle,
  setSessionsWithRef,
  updateSessionTitle,
  updateSessionPinStatus,
  currentSessionIdRef,
  currentSessionRef,
  sessionsRef,
}: UseChatActionsOptions) => {
  const createNewChat = useCallback(() => {
    // Reset to welcome view without adding a sidebar card
    setCurrentSessionId(null);
    setInput('');
  }, [setCurrentSessionId, setInput]);

  const handleDeleteChat = useCallback(
    (id: string) => {
      setSessionsWithRef(prev => prev.filter(s => s.id !== id));
      setCurrentSessionId(prev => (prev === id ? null : prev));
    },
    [setCurrentSessionId, setSessionsWithRef]
  );

  const handleClearAllChats = useCallback(() => {
    setIsClearConfirmOpen(true);
  }, [setIsClearConfirmOpen]);

  const confirmClearAllChats = useCallback(() => {
    setSessionsWithRef(() => []);
    setCurrentSessionId(null);
    setInput('');
    setIsClearConfirmOpen(false);
  }, [
    setCurrentSessionId,
    setInput,
    setIsClearConfirmOpen,
    setSessionsWithRef,
  ]);

  const handlePinChat = useCallback(
    (sessionId: string) => {
      updateSessionPinStatus(sessionId, true);
    },
    [updateSessionPinStatus]
  );

  const handleUnpinChat = useCallback(
    (sessionId: string) => {
      updateSessionPinStatus(sessionId, false);
    },
    [updateSessionPinStatus]
  );

  const handleRenameChat = useCallback(
    (sessionId: string, nextTitle: string) => {
      updateSessionTitle(sessionId, nextTitle);
    },
    [updateSessionTitle]
  );

  const handleOpenRenameDialog = useCallback(
    (sessionId: string, currentTitle: string) => {
      setRenameSessionId(sessionId);
      setNewTitle(currentTitle);
      setIsRenameDialogOpen(true);
    },
    [setIsRenameDialogOpen, setNewTitle, setRenameSessionId]
  );

  const handleRenameConfirm = useCallback(() => {
    if (renameSessionId && newTitle.trim()) {
      handleRenameChat(renameSessionId, newTitle.trim());
      setIsRenameDialogOpen(false);
      setRenameSessionId(null);
      setNewTitle('');
    }
  }, [
    handleRenameChat,
    newTitle,
    renameSessionId,
    setIsRenameDialogOpen,
    setNewTitle,
    setRenameSessionId,
  ]);

  const handleRenameCancel = useCallback(() => {
    setIsRenameDialogOpen(false);
    setRenameSessionId(null);
    setNewTitle('');
  }, [setIsRenameDialogOpen, setNewTitle, setRenameSessionId]);

  const handleSelectChat = useCallback(
    (id: string) => {
      setCurrentSessionId(id);
      currentSessionIdRef.current = id;
      currentSessionRef.current =
        sessionsRef.current.find(session => session.id === id) || null;
    },
    [currentSessionIdRef, currentSessionRef, sessionsRef, setCurrentSessionId]
  );

  return {
    createNewChat,
    handleDeleteChat,
    handleClearAllChats,
    confirmClearAllChats,
    handlePinChat,
    handleUnpinChat,
    handleRenameChat,
    handleOpenRenameDialog,
    handleRenameConfirm,
    handleRenameCancel,
    handleSelectChat,
  };
};
