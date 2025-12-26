import { useEffect, useRef } from 'react';
import { ChatConfig, ChatSession } from '../../types';
import { DEFAULT_CHAT_CONFIG } from '../chatConstants';
import { STORAGE_KEYS } from '../../constants';
import { getJSON } from '../appUtils';
import { MemuConfig, loadMemuConfig } from '../../services/memuService';

type UseHydrationOptions = {
  setSessionsWithRef: (updater: (prev: ChatSession[]) => ChatSession[]) => void;
  setCurrentSessionId: (id: string | null) => void;
  setChatConfig: (config: ChatConfig) => void;
  setMemuConfig: (config: MemuConfig) => void;
  setIsSidebarOpen: (open: boolean) => void;
  setIsRestoring: (restoring: boolean) => void;
};

export const useHydration = ({
  setSessionsWithRef,
  setCurrentSessionId,
  setChatConfig,
  setMemuConfig,
  setIsSidebarOpen,
  setIsRestoring,
}: UseHydrationOptions) => {
  const hasHydrated = useRef(false);

  useEffect(() => {
    const savedSessions = getJSON<ChatSession[]>('ds_sessions', []);
    if (savedSessions.length > 0) {
      setSessionsWithRef(() => savedSessions);
    }

    const savedSessionId = getJSON<string | null>('ds_current_session', null);
    setCurrentSessionId(savedSessionId);

    const savedChatConfig = getJSON<Partial<ChatConfig>>(
      'ds_chat_config',
      DEFAULT_CHAT_CONFIG
    );
    setChatConfig({ ...DEFAULT_CHAT_CONFIG, ...savedChatConfig });

    const savedMemuConfig = getJSON<MemuConfig>(
      STORAGE_KEYS.MEMU_CONFIG,
      loadMemuConfig()
    );
    setMemuConfig(savedMemuConfig);

    const savedSidebarState = getJSON<boolean>('ds_sidebar_open', true);
    setIsSidebarOpen(savedSidebarState);

    setTimeout(() => {
      hasHydrated.current = true;
      setIsRestoring(false);
    }, 0);
  }, [
    setSessionsWithRef,
    setCurrentSessionId,
    setChatConfig,
    setMemuConfig,
    setIsSidebarOpen,
    setIsRestoring,
  ]);

  return { hasHydrated };
};
