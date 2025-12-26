import { useEffect, type MutableRefObject } from 'react';
import { setJSON } from '../appUtils';
import { STORAGE_KEYS } from '../../constants';
import type { ChatConfig, ChatSession } from '../../types';
import type { MemuConfig } from '../../services/memuService';

type UseSessionPersistenceOptions = {
  hasHydrated: MutableRefObject<boolean>;
  sessions: ChatSession[];
  currentSessionId: string | null;
  chatConfig: ChatConfig;
  memuConfig: MemuConfig;
  isSidebarOpen: boolean;
};

export const useSessionPersistence = ({
  hasHydrated,
  sessions,
  currentSessionId,
  chatConfig,
  memuConfig,
  isSidebarOpen,
}: UseSessionPersistenceOptions) => {
  useEffect(() => {
    if (!hasHydrated.current) return;
    setJSON('ds_sessions', sessions);
    setJSON('ds_current_session', currentSessionId);
    setJSON('ds_chat_config', chatConfig);
    setJSON(STORAGE_KEYS.MEMU_CONFIG, memuConfig);
    setJSON('ds_sidebar_open', isSidebarOpen);
  }, [
    chatConfig,
    currentSessionId,
    hasHydrated,
    isSidebarOpen,
    memuConfig,
    sessions,
  ]);
};
