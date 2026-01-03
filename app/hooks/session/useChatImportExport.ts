import { useCallback, type MutableRefObject } from 'react';
import type { ChatSession, LocalAttachment } from '../../../types';
import {
  useChatFormatters,
  type ExportFormat,
} from '../chat/useChatFormatters';

type UseChatImportExportOptions = {
  t: (key: string) => string;
  sessions: ChatSession[];
  setSessionsWithRef: (updater: (prev: ChatSession[]) => ChatSession[]) => void;
  setCurrentSessionId: (id: string | null) => void;
  currentSessionIdRef: MutableRefObject<string | null>;
  currentSessionRef: MutableRefObject<ChatSession | null>;
  fileCounterRef: MutableRefObject<number>;
  inFlightSessionRef: MutableRefObject<string | null>;
  currentActionRef: MutableRefObject<'send' | 'regenerate' | null>;
  isSendingRef: MutableRefObject<boolean>;
  isLoadingRef: MutableRefObject<boolean>;
  inputRef: MutableRefObject<string>;
  attachmentsRef: MutableRefObject<LocalAttachment[]>;
  setIsLoading: (value: boolean) => void;
  setInput: (value: string) => void;
  setAttachments: (value: LocalAttachment[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
};

export const useChatImportExport = ({
  t,
  sessions,
  setSessionsWithRef,
  setCurrentSessionId,
  currentSessionIdRef,
  currentSessionRef,
  fileCounterRef,
  inFlightSessionRef,
  currentActionRef,
  isSendingRef,
  isLoadingRef,
  inputRef,
  attachmentsRef,
  setIsLoading,
  setInput,
  setAttachments,
  showToast,
}: UseChatImportExportOptions) => {
  const { buildExport, parseImport } = useChatFormatters({
    t,
    fileCounterRef,
  });

  const downloadTextFile = useCallback((filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportChatById = useCallback(
    (id: string, format: ExportFormat) => {
      const target = sessions.find(session => session.id === id);
      if (!target) return;
      if (!target.messages.length) return;
      const payload = buildExport(target, format);
      downloadTextFile(payload.filename, payload.content);
    },
    [buildExport, downloadTextFile, sessions]
  );

  const importChats = useCallback(
    async (file: File) => {
      const text = await file.text();
      let imported: ChatSession[] = [];

      try {
        imported = parseImport(text, file.name);
      } catch (error) {
        console.error('Import failed:', error);
        showToast(t('importFailed'), 'error');
        return;
      }

      if (!imported.length) {
        showToast(t('importFailed'), 'error');
        return;
      }

      setSessionsWithRef(prev => {
        const next = [...prev, ...imported];
        return next;
      });
      const latestImported = imported[imported.length - 1];
      if (latestImported) {
        setCurrentSessionId(latestImported.id);
        currentSessionIdRef.current = latestImported.id;
        currentSessionRef.current = latestImported;
      }
      inFlightSessionRef.current = null;
      currentActionRef.current = null;
      isSendingRef.current = false;
      isLoadingRef.current = false;
      inputRef.current = '';
      attachmentsRef.current = [];
      setIsLoading(false);
      setInput('');
      setAttachments([]);
      showToast(t('importSuccess'), 'success');
    },
    [
      attachmentsRef,
      currentActionRef,
      currentSessionIdRef,
      currentSessionRef,
      inFlightSessionRef,
      inputRef,
      isLoadingRef,
      isSendingRef,
      parseImport,
      setAttachments,
      setCurrentSessionId,
      setInput,
      setIsLoading,
      setSessionsWithRef,
      showToast,
      t,
    ]
  );

  const triggerImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.md,.markdown,.txt';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        importChats(file);
      }
    };
    input.click();
  }, [importChats]);

  return { exportChatById, triggerImport };
};
