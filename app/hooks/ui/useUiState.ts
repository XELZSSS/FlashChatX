import { useCallback, useState } from 'react';

type UseUiStateOptions = {
  initialSidebarOpen: () => boolean;
};

export const useUiState = ({ initialSidebarOpen }: UseUiStateOptions) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(initialSidebarOpen);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const closeClearConfirm = useCallback(() => {
    setIsClearConfirmOpen(false);
  }, []);

  return {
    isSidebarOpen,
    setIsSidebarOpen,
    toggleSidebar,
    isSettingsOpen,
    openSettings,
    closeSettings,
    isClearConfirmOpen,
    setIsClearConfirmOpen,
    closeClearConfirm,
    isRenameDialogOpen,
    setIsRenameDialogOpen,
    renameSessionId,
    setRenameSessionId,
    newTitle,
    setNewTitle,
  };
};
