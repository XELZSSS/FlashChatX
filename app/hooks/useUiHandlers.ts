import { useCallback } from 'react';
import type React from 'react';

type UseUiHandlersOptions = {
  setNewTitle: (value: string) => void;
  handleRenameConfirm: () => void;
  handleRenameCancel: () => void;
  closeSettings: () => void;
  closeClearConfirm: () => void;
};

export const useUiHandlers = ({
  setNewTitle,
  handleRenameConfirm,
  handleRenameCancel,
  closeSettings,
  closeClearConfirm,
}: UseUiHandlersOptions) => {
  const onRenameInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setNewTitle(event.target.value);
    },
    [setNewTitle]
  );

  const onRenameKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        handleRenameConfirm();
      } else if (event.key === 'Escape') {
        handleRenameCancel();
      }
    },
    [handleRenameConfirm, handleRenameCancel]
  );

  return {
    onRenameInputChange,
    onRenameKeyDown,
    onRenameConfirm: handleRenameConfirm,
    onRenameCancel: handleRenameCancel,
    onCloseSettings: closeSettings,
    onCloseClearConfirm: closeClearConfirm,
  };
};
