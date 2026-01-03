import { useCallback, type MutableRefObject } from 'react';
import { generateId } from '../../appUtils';
import type { HistoryEntry } from '../../../utils/chatHistory';
import {
  MIN_SEND_INTERVAL_MS,
  TOOL_SEARCH_PROVIDERS,
} from '../../chatConstants';
import { loadProviderConfig } from '../../../services/config/providerConfig';
import { searchAndFormat } from '../../../services/tools/searchService';
import { type MemuConfig } from '../../../services/config/memuService';
import { resolveAttachmentsForRequest } from '../../../services/tools/attachmentFlow';
import { buildContextForRequest } from '../../utils/contextBuilder';
import {
  buildSessionTitleFromInput,
  ensureSession,
} from '../../utils/sessionFactory';
import { useErrorFormatter } from './useErrorFormatter';
import { useMemoryManager } from './useMemoryManager';
import type {
  ChatConfig,
  ChatSession,
  ExtendedMessage,
  LocalAttachment,
  Message,
  ProviderConfig,
  ProviderType,
  UploadedFileReference,
} from '../../../types';

type UseSendMessageOptions = {
  t: (key: string) => string;
  inputRef: MutableRefObject<string>;
  isLoadingRef: MutableRefObject<boolean>;
  currentSessionIdRef: MutableRefObject<string | null>;
  currentSessionRef: MutableRefObject<ChatSession | null>;
  memuConfigRef: MutableRefObject<MemuConfig>;
  attachmentsRef: MutableRefObject<LocalAttachment[]>;
  isSendingRef: MutableRefObject<boolean>;
  inFlightSessionRef: MutableRefObject<string | null>;
  lastSendAtRef: MutableRefObject<number>;
  currentActionRef: MutableRefObject<'send' | 'regenerate' | null>;
  chatConfigRef: MutableRefObject<ChatConfig>;
  setIsLoading: (value: boolean) => void;
  setInput: (value: string) => void;
  setAttachments: (value: LocalAttachment[]) => void;
  setCurrentSessionId: (id: string | null) => void;
  setSessionsWithRef: (updater: (prev: ChatSession[]) => ChatSession[]) => void;
  updateSessionMessages: (sessionId: string, messages: Message[]) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  buildAttachmentRefs: (
    provider: ProviderType,
    items: LocalAttachment[]
  ) => UploadedFileReference[];
  updateAttachment: (id: string, updates: Partial<LocalAttachment>) => void;
  createProviderStream: (
    providerConfig: ProviderConfig,
    history: HistoryEntry[],
    message: string,
    localAttachments?: LocalAttachment[]
  ) => AsyncGenerator<string>;
  processStreamAndUpdateMessages: (
    stream: AsyncGenerator<string>,
    placeholderAiMsg: ExtendedMessage,
    existingMessages: ExtendedMessage[],
    sessionId: string
  ) => Promise<void>;
};

export const useSendMessage = ({
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
}: UseSendMessageOptions) => {
  // Use extracted hooks for error formatting and memory management
  const { formatErrorMessage } = useErrorFormatter(t);
  const { retrieveMemories, saveToMemory, isMemuEnabled } =
    useMemoryManager(memuConfigRef);

  const fetchSearchMessage = useCallback(
    async (query: string, providerConfig: ProviderConfig) => {
      if (!chatConfigRef.current.useSearch || !query.trim()) {
        return null;
      }

      const shouldUseToolSearch = TOOL_SEARCH_PROVIDERS.has(
        providerConfig.provider
      );
      if (shouldUseToolSearch) {
        return null;
      }

      try {
        const searchResults = await searchAndFormat({ query });
        if (!searchResults) return null;

        return {
          id: generateId(),
          role: 'user',
          content: searchResults,
          timestamp: Date.now(),
        } satisfies Message;
      } catch (error) {
        console.error('搜索错误:', error);
        return null;
      }
    },
    [chatConfigRef]
  );

  const handleSendMessage = useCallback(
    async (overrideInput?: string) => {
      const now = Date.now();
      const activeInput = inputRef.current;
      const activeIsLoading = isLoadingRef.current;
      const activeSessionIdState = currentSessionIdRef.current;
      const activeSessionState = currentSessionRef.current;
      const activeAttachments = attachmentsRef.current;
      const hasAttachments = activeAttachments.length > 0;
      const rawInput = overrideInput ?? activeInput;
      const trimmedInput = rawInput.trim();
      const titleBase =
        trimmedInput || (hasAttachments ? activeAttachments[0].file.name : '');

      if (
        (!trimmedInput && !hasAttachments) ||
        activeIsLoading ||
        isSendingRef.current ||
        currentActionRef.current === 'regenerate' ||
        now - lastSendAtRef.current < MIN_SEND_INTERVAL_MS
      ) {
        return;
      }

      isSendingRef.current = true;
      currentActionRef.current = 'send';
      setIsLoading(true);
      lastSendAtRef.current = now;

      const { activeSessionId, activeSession } = ensureSession({
        sessionId: activeSessionIdState,
        session: activeSessionState,
        titleBase,
        setSessionsWithRef,
        setCurrentSessionId,
      });

      if (!activeSession) {
        currentActionRef.current = null;
        isSendingRef.current = false;
        setIsLoading(false);
        return; // Should not happen
      }

      // Avoid sending another request while the same session is still in-flight
      if (inFlightSessionRef.current === activeSessionId) {
        currentActionRef.current = null;
        isSendingRef.current = false;
        setIsLoading(false);
        return;
      }
      inFlightSessionRef.current = activeSessionId;

      const providerConfig = loadProviderConfig();
      const attachmentResult = await resolveAttachmentsForRequest({
        providerConfig,
        attachments: activeAttachments,
        updateAttachment,
        buildAttachmentRefs,
        t,
      });
      if (attachmentResult.shouldAbort) {
        inFlightSessionRef.current = null;
        currentActionRef.current = null;
        isSendingRef.current = false;
        setIsLoading(false);
        return;
      }

      const uploadedFiles = attachmentResult.uploadedFiles;
      const localAttachmentsForRequest =
        attachmentResult.localAttachmentsForRequest;

      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: rawInput,
        attachments: uploadedFiles.length ? uploadedFiles : undefined,
        timestamp: Date.now(),
      };

      // Optimistic update
      let updatedMessages = [...activeSession.messages, userMessage];
      updateSessionMessages(activeSessionId, updatedMessages);

      // Update title if it's the first message
      if (activeSession.messages.length === 0) {
        updateSessionTitle(
          activeSessionId,
          buildSessionTitleFromInput(titleBase)
        );
      }

      setInput('');
      if (hasAttachments) {
        setAttachments([]);
      }

      const queryInput = titleBase;
      const memuEnabled = isMemuEnabled();
      const [memoryContents, searchMessage] = await Promise.all([
        memuEnabled
          ? retrieveMemories(queryInput)
          : Promise.resolve<string[]>([]),
        fetchSearchMessage(queryInput, providerConfig),
      ]);

      const { historyForAPI } = buildContextForRequest({
        userMessage,
        updatedMessages,
        memoryContents,
        searchMessage,
        memuEnabled,
      });

      // Prepare history for API
      const history = historyForAPI;

      try {
        const aiMessageId = generateId();

        // Add placeholder AI message
        const placeholderAiMsg: ExtendedMessage = {
          id: aiMessageId,
          role: 'model',
          content: '',
          timestamp: Date.now(),
        };
        updateSessionMessages(activeSessionId, [
          ...updatedMessages,
          placeholderAiMsg,
        ]);

        const stream = createProviderStream(
          providerConfig,
          history,
          userMessage.content,
          localAttachmentsForRequest
        );

        await processStreamAndUpdateMessages(
          stream,
          placeholderAiMsg,
          updatedMessages,
          activeSessionId
        );

        // Save conversation to memory after getting response (only if MemU is enabled)
        if (memuEnabled) {
          const finalMessages = [...updatedMessages, placeholderAiMsg];
          await saveToMemory(finalMessages);
        }
      } catch (error) {
        console.error('Error sending message:', error);

        const errorMessage = formatErrorMessage(error);

        const aiMessageId = generateId();
        const errorMsg: ExtendedMessage = {
          id: aiMessageId,
          role: 'model',
          content: errorMessage,
          timestamp: Date.now(),
        };
        updateSessionMessages(activeSessionId, [...updatedMessages, errorMsg]);
      } finally {
        inFlightSessionRef.current = null;
        currentActionRef.current = null;
        isSendingRef.current = false;
        setIsLoading(false);
      }
    },
    [
      buildAttachmentRefs,
      fetchSearchMessage,
      formatErrorMessage,
      createProviderStream,
      processStreamAndUpdateMessages,
      retrieveMemories,
      saveToMemory,
      setAttachments,
      setCurrentSessionId,
      setInput,
      setIsLoading,
      setSessionsWithRef,
      t,
      updateAttachment,
      updateSessionMessages,
      updateSessionTitle,
      attachmentsRef,
      currentActionRef,
      currentSessionIdRef,
      currentSessionRef,
      inFlightSessionRef,
      inputRef,
      isLoadingRef,
      isSendingRef,
      lastSendAtRef,
      isMemuEnabled,
    ]
  );

  return { handleSendMessage };
};
