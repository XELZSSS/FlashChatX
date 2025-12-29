import React, { useState, useRef, useEffect } from 'react';
// Components
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import ConfirmDialog from './components/ConfirmDialog';
import InputArea from './components/InputArea';
import SettingsModal from './components/SettingsModal';
import TitleBar from './components/TitleBar';
// Services
import { DEFAULT_SETTINGS } from './constants';
import { getJSON } from './app/appUtils';
import { DEFAULT_CHAT_CONFIG } from './app/chatConstants';
import { loadMemuConfig, type MemuConfig } from './services/memuService';
import { ChatSession, ChatConfig, ExtendedUserSettings } from './types';
// Hooks
import { useAppDerivedState } from './app/hooks/useAppDerivedState';
import { useAppSettings } from './app/hooks/useAppSettings';
import { useHydration } from './app/hooks/useHydration';
import { useChatActions } from './app/hooks/useChatActions';
import { useChatImportExport } from './app/hooks/useChatImportExport';
import { useChatStream } from './app/hooks/useChatStream';
import { useSendMessage } from './app/hooks/useSendMessage';
import { useSessionPersistence } from './app/hooks/useSessionPersistence';
import { useSessions } from './app/hooks/useSessions';
import { useSyncRefs } from './app/hooks/useSyncRefs';
import { useToasts } from './app/hooks/useToasts';
import { useMessageMutations } from './app/hooks/useMessageMutations';
import { useUiState } from './app/hooks/useUiState';
import { useUiHandlers } from './app/hooks/useUiHandlers';
import { useAttachments } from './app/hooks/useAttachments';
// Contexts
import { LanguageProvider } from './contexts/LanguageContext';
import { useTranslation } from './contexts/useTranslation';

const AppContent: React.FC<{
  settings: ExtendedUserSettings;
  setSettings: (s: ExtendedUserSettings) => void;
}> = ({ settings, setSettings }) => {
  const { t } = useTranslation();
  // Core UI state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatConfig, setChatConfig] = useState<ChatConfig>(DEFAULT_CHAT_CONFIG);
  const [isRestoring, setIsRestoring] = useState(true);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [memuConfig, setMemuConfig] = useState<MemuConfig>(() =>
    loadMemuConfig()
  );
  const fileCounterRef = useRef(1);
  // Refs for async-safe access
  const isSendingRef = useRef(false);
  const inFlightSessionRef = useRef<string | null>(null);
  const lastSendAtRef = useRef(0);
  const currentActionRef = useRef<'send' | 'regenerate' | null>(null);
  const inputRef = useRef(input);
  const currentSessionIdRef = useRef<string | null>(currentSessionId);
  const currentSessionRef = useRef<ChatSession | null>(null);
  const isLoadingRef = useRef(isLoading);
  const chatConfigRef = useRef(chatConfig);
  const memuConfigRef = useRef<MemuConfig>(loadMemuConfig());

  // Base hooks (UI/session/attachments/toast)
  const { toast, showToast } = useToasts();
  const {
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
  } = useUiState({
    initialSidebarOpen: () => getJSON<boolean>('ds_sidebar_open', true),
  });
  const {
    sessions,
    sessionsRef,
    setSessionsWithRef,
    filteredSessions,
    currentSession,
    currentMessages,
    updateSessionMessages,
    updateSessionTitle,
    updateSessionPinStatus,
  } = useSessions({ chatSearchQuery, currentSessionId });
  const {
    attachments,
    setAttachments,
    attachmentsRef,
    buildAttachmentRefs,
    handleAddAttachments,
    handleRemoveAttachment,
    updateAttachment,
  } = useAttachments();

  // Hydration and streaming/send flows
  const { hasHydrated } = useHydration({
    setSessionsWithRef,
    setCurrentSessionId,
    setChatConfig,
    setMemuConfig,
    setIsSidebarOpen,
    setIsRestoring,
  });

  const { createProviderStream, processStreamAndUpdateMessages } =
    useChatStream({
      t,
      chatConfigRef,
      sessionsRef,
      updateSessionMessages,
    });
  const { handleSendMessage } = useSendMessage({
    t,
    inputRef,
    isLoadingRef,
    currentSessionIdRef,
    currentSessionRef,
    memuConfigRef,
    attachmentsRef,
    isSendingRef,
    inFlightSessionRef,
    lastSendAtRef,
    currentActionRef,
    chatConfigRef,
    setIsLoading,
    setInput,
    setAttachments,
    setCurrentSessionId,
    setSessionsWithRef,
    updateSessionMessages,
    updateSessionTitle,
    buildAttachmentRefs,
    updateAttachment,
    createProviderStream,
    processStreamAndUpdateMessages,
  });
  const { exportChatById, triggerImport } = useChatImportExport({
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
  });
  // Session actions and UI handlers
  const {
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
  } = useChatActions({
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
  });
  const {
    onRenameInputChange,
    onRenameKeyDown,
    onRenameConfirm,
    onRenameCancel,
    onCloseSettings,
    onCloseClearConfirm,
  } = useUiHandlers({
    setNewTitle,
    handleRenameConfirm,
    handleRenameCancel,
    closeSettings,
    closeClearConfirm,
  });

  // Derived UI state
  const { cumulativeTokenUsage, displayMessages, isUploading, showWelcome } =
    useAppDerivedState({
      currentMessages,
      attachments,
      hasHydrated,
      isRestoring,
      currentSessionId,
    });

  // Ref sync and persistence
  useSyncRefs({
    input,
    currentSessionId,
    currentSession,
    isLoading,
    chatConfig,
    memuConfig,
    inputRef,
    currentSessionIdRef,
    currentSessionRef,
    isLoadingRef,
    chatConfigRef,
    memuConfigRef,
  });

  useSessionPersistence({
    hasHydrated,
    sessions,
    currentSessionId,
    chatConfig,
    memuConfig,
    isSidebarOpen,
  });

  // Message-level mutations
  const { updateMessage } = useMessageMutations({
    currentSessionIdRef,
    setSessionsWithRef,
  });

  const [renameVisible, setRenameVisible] = useState(isRenameDialogOpen);
  const [renameClosing, setRenameClosing] = useState(false);
  const renameOpenTimerRef = useRef<number | null>(null);
  const renameCloseTimerRef = useRef<number | null>(null);
  const renameHideTimerRef = useRef<number | null>(null);
  const renameTransitionMs = 160;

  useEffect(() => {
    if (isRenameDialogOpen) {
      if (renameOpenTimerRef.current) {
        window.clearTimeout(renameOpenTimerRef.current);
        renameOpenTimerRef.current = null;
      }
      if (renameCloseTimerRef.current) {
        window.clearTimeout(renameCloseTimerRef.current);
        renameCloseTimerRef.current = null;
      }
      if (renameHideTimerRef.current) {
        window.clearTimeout(renameHideTimerRef.current);
        renameHideTimerRef.current = null;
      }
      renameOpenTimerRef.current = window.setTimeout(() => {
        setRenameVisible(true);
        setRenameClosing(false);
      }, 0);
      return () => {
        if (renameOpenTimerRef.current) {
          window.clearTimeout(renameOpenTimerRef.current);
          renameOpenTimerRef.current = null;
        }
      };
    }

    if (!renameVisible) return;
    renameCloseTimerRef.current = window.setTimeout(() => {
      setRenameClosing(true);
    }, 0);
    renameHideTimerRef.current = window.setTimeout(() => {
      setRenameVisible(false);
      setRenameClosing(false);
    }, renameTransitionMs);

    return () => {
      if (renameOpenTimerRef.current) {
        window.clearTimeout(renameOpenTimerRef.current);
        renameOpenTimerRef.current = null;
      }
      if (renameCloseTimerRef.current) {
        window.clearTimeout(renameCloseTimerRef.current);
        renameCloseTimerRef.current = null;
      }
      if (renameHideTimerRef.current) {
        window.clearTimeout(renameHideTimerRef.current);
        renameHideTimerRef.current = null;
      }
    };
  }, [isRenameDialogOpen, renameVisible]);

  return (
    <div className="app-shell flex h-screen">
      <Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        sessions={filteredSessions}
        currentSessionId={currentSessionId}
        searchQuery={chatSearchQuery}
        onSearchQueryChange={setChatSearchQuery}
        onNewChat={createNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onClearAllChats={handleClearAllChats}
        onOpenSettings={openSettings}
        onRenameChat={handleRenameChat}
        onOpenRenameDialog={handleOpenRenameDialog}
        onPinChat={handlePinChat}
        onUnpinChat={handleUnpinChat}
        onExportChat={exportChatById}
        onImportChats={triggerImport}
      />

      <div className="flex-1 flex flex-col min-h-0">
        <TitleBar />
        <div className="flex-1 flex flex-col relative h-full overflow-hidden">
          {/* Content Area */}
          <div
            className="chat-transition flex-1 flex flex-col"
            data-state={showWelcome ? 'welcome' : 'chat'}
          >
            {isRestoring ? (
              // Loading State: Show loading indicator while restoring state
              <div className="flex-1 flex flex-col items-center justify-center p-4 w-full">
                <div className="flex flex-col items-center justify-center w-full max-w-3xl">
                  <div className="mb-8 text-center">
                    <div className="typing-indicator">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : showWelcome ? (
              // Welcome State: Centered Input
              <div className="flex-1 flex flex-col items-center justify-center p-4 w-full">
                <div className="flex flex-col items-center justify-center w-full max-w-3xl">
                  <div className="mb-8 text-center">
                    <h1 className="text-2xl font-semibold text-muted mb-2">
                      {t('welcomeTitle')}
                    </h1>
                  </div>
                  <InputArea
                    input={input}
                    setInput={setInput}
                    onSend={handleSendMessage}
                    isLoading={isLoading}
                    isUploading={isUploading}
                    showEmojiButton={false}
                    config={chatConfig}
                    setConfig={setChatConfig}
                    attachments={attachments}
                    onAddAttachments={handleAddAttachments}
                    onRemoveAttachment={handleRemoveAttachment}
                  />
                </div>
              </div>
            ) : (
              // Chat State: Input at Bottom
              <>
                <ChatInterface
                  messages={displayMessages}
                  isLoading={isLoading}
                  onUpdateMessage={updateMessage}
                  cumulativeTokenUsage={cumulativeTokenUsage}
                />
                <div className="w-full z-10 flex-shrink-0 absolute bottom-0 left-0 right-0">
                  <InputArea
                    input={input}
                    setInput={setInput}
                    onSend={handleSendMessage}
                    isLoading={isLoading}
                    isUploading={isUploading}
                    showEmojiButton
                    config={chatConfig}
                    setConfig={setChatConfig}
                    attachments={attachments}
                    onAddAttachments={handleAddAttachments}
                    onRemoveAttachment={handleRemoveAttachment}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={onCloseSettings}
        settings={settings}
        onUpdateSettings={setSettings}
      />

      <ConfirmDialog
        isOpen={isClearConfirmOpen}
        title={t('clearAllChatsTitle')}
        message={t('confirmClearAll')}
        confirmText={t('confirm')}
        cancelText={t('cancel')}
        onConfirm={confirmClearAllChats}
        onCancel={onCloseClearConfirm}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[70]">
          <div
            className={`surface rounded-xl px-4 py-3 text-sm shadow-soft border transition-all ${
              toast.tone === 'error'
                ? 'border-red-500/30 text-red-400'
                : 'border-[var(--border)] text-[var(--text)]'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      {renameVisible && (
        <div
          className="rename-backdrop fixed inset-0 z-50 flex items-center justify-center"
          data-state={renameClosing ? 'closing' : 'open'}
        >
          <div
            className="RenameDialog rename-panel surface rounded-lg p-4 w-full max-w-md mx-4"
            data-state={renameClosing ? 'closing' : 'open'}
          >
            <h3 className="text-lg font-medium mb-3">{t('renameChatTitle')}</h3>
            <input
              type="text"
              value={newTitle}
              onChange={onRenameInputChange}
              onKeyDown={onRenameKeyDown}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--panel)] text-[var(--text)] focus:outline-none"
              placeholder={t('newChatName')}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={onRenameCancel}
                className="px-3 py-1.5 text-sm bg-[var(--panel)] border border-[var(--border)] rounded-md text-[var(--text)] transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={onRenameConfirm}
                className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-md transition-colors"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const { settings, setSettings } = useAppSettings({
    defaultSettings: DEFAULT_SETTINGS,
    defaultMemuSettings: {
      enabled: false,
      apiKey: '',
      baseUrl: 'https://api.memu.so',
      autoSave: true,
      maxMemories: 10,
    },
  });

  useEffect(() => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      window.requestAnimationFrame(() => {
        rootElement.classList.add('loaded');
      });
    }
  }, []);

  return (
    <LanguageProvider language={settings.language}>
      <AppContent settings={settings} setSettings={setSettings} />
    </LanguageProvider>
  );
};

export default App;
