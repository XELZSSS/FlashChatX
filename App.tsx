import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import InputArea from './components/InputArea';
import SettingsModal from './components/SettingsModal';
import ConfirmDialog from './components/ConfirmDialog';
import TitleBar from './components/TitleBar';
import { loadProviderConfig } from './services/providerConfig';
import { searchAndFormat } from './services/searchService';
import {
  saveConversationToMemory,
  retrieveRelevantMemories,
  formatConversationToString,
  isMemuAvailable,
  loadMemuConfig,
  type MemuConfig,
} from './services/memuService';
import {
  ChatSession,
  ChatConfig,
  Message,
  ExtendedMessage,
  TokenUsage,
  UserSettings,
  Theme,
  ExtendedUserSettings,
  LocalAttachment,
  UploadedFileReference,
  ProviderType,
} from './types';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from './constants';
import { LanguageProvider } from './contexts/LanguageContext';
import { useTranslation } from './contexts/useTranslation';
import {
  supportsFileUpload,
  supportsToolFileHandling,
  uploadFilesForProvider,
} from './services/fileUpload';
import { isToolEnabled, READ_FILE_TOOL_NAME } from './services/toolRegistry';

// Use UUID for generating unique IDs
const generateId = () => uuidv4();

const getJSON = <T,>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(
      `Failed to parse localStorage key "${key}", using fallback.`,
      error
    );
    return fallback;
  }
};

const setJSON = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const MIN_SEND_INTERVAL_MS = 500;
const DEFAULT_CHAT_CONFIG: ChatConfig = {
  useThinking: false,
  useDeepThink: false,
  useSearch: false,
  thinkingLevel: 'medium',
};

const buildHistory = (messages: Message[]) => {
  const filteredMessages = messages.filter(
    m => !(m.role === 'model' && !m.content.trim())
  );

  return filteredMessages.map(m => ({
    role: m.role,
    content: m.content,
    attachments: m.attachments,
  }));
};

// Build history for display (filters out search results)
const buildDisplayHistory = (messages: Message[]) =>
  messages.filter(
    m =>
      !m.content.includes('根据搜索"') && !m.content.includes('未找到相关内容')
  );

type StreamGenerator = AsyncGenerator<string>;
type StreamFactory = (common: any) => StreamGenerator;

const streamFactoryCache = new Map<string, StreamFactory>();

const loadStreamFactory = (provider: string): Promise<StreamFactory> => {
  const cached = streamFactoryCache.get(provider);
  if (cached) return Promise.resolve(cached);

  switch (provider) {
    case 'z':
      return import('./services/zAIService').then(m => {
        streamFactoryCache.set(provider, m.streamZResponse);
        return m.streamZResponse;
      });
    case 'mimo':
      return import('./services/mimoService').then(m => {
        streamFactoryCache.set(provider, m.streamMimoResponse);
        return m.streamMimoResponse;
      });
    case 'z-intl':
      return import('./services/zIntlService').then(m => {
        streamFactoryCache.set(provider, m.streamZIntlResponse);
        return m.streamZIntlResponse;
      });
    case 'deepseek':
      return import('./services/deepseekService').then(m => {
        streamFactoryCache.set(provider, m.streamDeepSeekResponse);
        return m.streamDeepSeekResponse;
      });
    case 'openai-compatible':
      return import('./services/openaiCompatibleService').then(m => {
        streamFactoryCache.set(provider, m.streamOpenAICompatibleResponse);
        return m.streamOpenAICompatibleResponse;
      });
    case 'bailing':
      return import('./services/bailingService').then(m => {
        streamFactoryCache.set(provider, m.streamBailingResponse);
        return m.streamBailingResponse;
      });
    case 'longcat':
      return import('./services/longcatService').then(m => {
        streamFactoryCache.set(provider, m.streamLongCatResponse);
        return m.streamLongCatResponse;
      });
    case 'modelscope':
      return import('./services/modelscopeService').then(m => {
        streamFactoryCache.set(provider, m.streamModelScopeResponse);
        return m.streamModelScopeResponse;
      });
    case 'moonshot':
      return import('./services/moonshotService').then(m => {
        streamFactoryCache.set(provider, m.streamMoonshotResponse);
        return m.streamMoonshotResponse;
      });
    case 'minimax':
      return import('./services/minimaxService').then(m => {
        streamFactoryCache.set(provider, m.streamMiniMaxResponse);
        return m.streamMiniMaxResponse;
      });
    case 'google':
      return import('./services/googleService').then(m => {
        streamFactoryCache.set(provider, m.streamGoogleResponse);
        return m.streamGoogleResponse;
      });
    case 'anthropic':
      return import('./services/anthropicService').then(m => {
        streamFactoryCache.set(provider, m.streamAnthropicResponse);
        return m.streamAnthropicResponse;
      });
    default:
      return import('./services/openaiService').then(m => {
        streamFactoryCache.set(provider, m.streamOpenAIResponse);
        return m.streamOpenAIResponse;
      });
  }
};

const AppContent: React.FC<{
  settings: ExtendedUserSettings;
  setSettings: (s: ExtendedUserSettings) => void;
}> = ({ settings, setSettings }) => {
  const { t } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return getJSON<boolean>('ds_sidebar_open', true);
  });

  // Restore state from localStorage on initialization to ensure correct recovery after refresh
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  // Sort sessions: pinned sessions first, then by update time (newest first)
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      // First sort by pinned status (pinned first)
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      // Then sort by update time (newest first)
      return b.updatedAt - a.updatedAt;
    });
  }, [sessions]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatConfig, setChatConfig] = useState<ChatConfig>(DEFAULT_CHAT_CONFIG);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [isRestoring, setIsRestoring] = useState(true);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  } | null>(null);
  const fileCounterRef = useRef(1);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredSessions = useMemo(() => {
    const query = chatSearchQuery.trim().toLowerCase();
    const hasQuery = query.length > 0;
    if (!hasQuery) {
      return sortedSessions;
    }

    return sortedSessions.filter(session => {
      if (session.title?.toLowerCase().includes(query)) {
        return true;
      }

      return session.messages.some(message => {
        const content = message.content?.toLowerCase() || '';
        if (content.includes(query)) {
          return true;
        }
        if (message.responseContent?.toLowerCase().includes(query)) {
          return true;
        }
        if (message.thinkingSummary?.toLowerCase().includes(query)) {
          return true;
        }
        if (message.thinkingContent?.toLowerCase().includes(query)) {
          return true;
        }
        if (message.attachments?.length) {
          return message.attachments.some(file =>
            file.name?.toLowerCase().includes(query)
          );
        }
        return false;
      });
    });
  }, [chatSearchQuery, sortedSessions]);

  const formatErrorMessage = useCallback(
    (error: unknown) => {
      const raw =
        error instanceof Error ? error.message?.trim() : String(error || '');
      const normalized = raw.toLowerCase();
      const hints: string[] = [];

      if (normalized.includes('api key') || normalized.includes('apikey')) {
        hints.push(t('errorMissingApiKey'));
      }
      if (normalized.includes('401') || normalized.includes('unauthorized')) {
        hints.push(t('errorUnauthorized'));
      }
      if (normalized.includes('403') || normalized.includes('forbidden')) {
        hints.push(t('errorForbidden'));
      }
      if (normalized.includes('429') || normalized.includes('rate limit')) {
        hints.push(t('errorRateLimit'));
      }
      if (normalized.includes('timeout') || normalized.includes('timed out')) {
        hints.push(t('errorTimeout'));
      }
      if (
        normalized.includes('network') ||
        normalized.includes('econn') ||
        normalized.includes('fetch')
      ) {
        hints.push(t('errorNetwork'));
      }
      if (normalized.includes('model') && normalized.includes('not')) {
        hints.push(t('errorModelNotFound'));
      }
      if (normalized.includes('api url') || normalized.includes('apiurl')) {
        hints.push(t('errorInvalidApiUrl'));
      }
      if (
        normalized.includes('500') ||
        normalized.includes('502') ||
        normalized.includes('503') ||
        normalized.includes('504')
      ) {
        hints.push(t('errorServer'));
      }

      const details = raw ? `${t('errorDetails')}\n${raw}` : t('errorUnknown');
      const hintText = hints.length
        ? `\n\n${t('errorHints')}\n- ${hints.join('\n- ')}`
        : '';

      return `${t('errorTitle')}\n${details}${hintText}`;
    },
    [t]
  );
  const sessionsRef = useRef<ChatSession[]>([]);
  const isSendingRef = useRef(false);
  const inFlightSessionRef = useRef<string | null>(null);
  const lastSendAtRef = useRef(0);
  const currentActionRef = useRef<'send' | 'regenerate' | null>(null);
  const inputRef = useRef(input);
  const attachmentsRef = useRef<LocalAttachment[]>(attachments);
  const currentSessionIdRef = useRef<string | null>(currentSessionId);
  const currentSessionRef = useRef<ChatSession | null>(null);
  const isLoadingRef = useRef(isLoading);
  const chatConfigRef = useRef(chatConfig);
  const memuConfigRef = useRef<MemuConfig>(loadMemuConfig());

  // MemU related state
  const [memuConfig, setMemuConfig] = useState<MemuConfig>(() =>
    loadMemuConfig()
  );

  const setSessionsWithRef = useCallback(
    (updater: (prev: ChatSession[]) => ChatSession[]) => {
      setSessions(prev => {
        const next = updater(prev);
        sessionsRef.current = next;
        return next;
      });
    },
    []
  );

  const hasHydrated = useRef(false);

  const currentSession = useMemo(
    () => sessions.find(s => s.id === currentSessionId) || null,
    [sessions, currentSessionId]
  );
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);
  const currentMessages = useMemo(() => {
    return currentSession ? currentSession.messages : [];
  }, [currentSession]);

  // Calculate cumulative token usage for the current session
  const cumulativeTokenUsage = useMemo(() => {
    if (!currentMessages.length) return null;

    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let cachedTokens = 0;

    currentMessages.forEach(msg => {
      if (msg.tokenUsage) {
        totalTokens += msg.tokenUsage.total_tokens;
        promptTokens += msg.tokenUsage.prompt_tokens;
        completionTokens += msg.tokenUsage.completion_tokens;
        cachedTokens +=
          msg.tokenUsage.prompt_tokens_details?.cached_tokens || 0;
      }
    });

    return {
      total_tokens: totalTokens,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      prompt_tokens_details: {
        cached_tokens: cachedTokens,
      },
    };
  }, [currentMessages]);

  const displayMessages = useMemo(
    () => buildDisplayHistory(currentMessages),
    [currentMessages]
  );
  const isUploading = useMemo(
    () => attachments.some(item => item.status === 'uploading'),
    [attachments]
  );
  // Only show welcome if we have hydrated, not restoring, and there's no current session or messages
  const showWelcome =
    hasHydrated.current &&
    !isRestoring &&
    (!currentSessionId || currentMessages.length === 0);

  // Restore all state from localStorage when component mounts
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    chatConfigRef.current = chatConfig;
  }, [chatConfig]);

  useEffect(() => {
    memuConfigRef.current = memuConfig;
  }, [memuConfig]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = useCallback(
    (message: string, tone: 'success' | 'error') => {
      setToast({ message, tone });
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, 2200);
    },
    []
  );

  useEffect(() => {
    // Restore session list
    const savedSessions = getJSON<ChatSession[]>('ds_sessions', []);
    if (savedSessions.length > 0) {
      sessionsRef.current = savedSessions;
      setSessions(savedSessions);
    }

    // Restore current session ID
    const savedSessionId = getJSON<string | null>('ds_current_session', null);
    setCurrentSessionId(savedSessionId);

    // Restore chat configuration
    const savedChatConfig = getJSON<Partial<ChatConfig>>(
      'ds_chat_config',
      DEFAULT_CHAT_CONFIG
    );
    setChatConfig({ ...DEFAULT_CHAT_CONFIG, ...savedChatConfig });

    // Restore MemU configuration
    const savedMemuConfig = getJSON<MemuConfig>(
      STORAGE_KEYS.MEMU_CONFIG,
      loadMemuConfig()
    );
    setMemuConfig(savedMemuConfig);

    // Restore sidebar state
    const savedSidebarState = getJSON<boolean>('ds_sidebar_open', true);
    setIsSidebarOpen(savedSidebarState);

    // Mark as hydrated and stop restoring in the next tick to ensure state updates are processed
    setTimeout(() => {
      hasHydrated.current = true;
      setIsRestoring(false);
    }, 0);
  }, []);

  // Persist state pieces together once hydrated
  useEffect(() => {
    if (!hasHydrated.current) return;
    setJSON('ds_sessions', sessions);
    setJSON('ds_current_session', currentSessionId);
    setJSON('ds_chat_config', chatConfig);
    setJSON(STORAGE_KEYS.MEMU_CONFIG, memuConfig);
    setJSON('ds_sidebar_open', isSidebarOpen);
  }, [sessions, currentSessionId, chatConfig, memuConfig, isSidebarOpen]);

  const createNewChat = useCallback(() => {
    // Reset to welcome view without adding a sidebar card
    setCurrentSessionId(null);
    setInput('');
  }, []);

  const handleDeleteChat = useCallback(
    (id: string) => {
      setSessionsWithRef(prev => prev.filter(s => s.id !== id));
      setCurrentSessionId(prev => (prev === id ? null : prev));
    },
    [setSessionsWithRef]
  );

  const handleClearAllChats = useCallback(() => {
    setIsClearConfirmOpen(true);
  }, []);

  const confirmClearAllChats = useCallback(() => {
    setSessionsWithRef(() => []);
    setCurrentSessionId(null);
    setInput('');
    setIsClearConfirmOpen(false);
  }, [setSessionsWithRef]);

  const updateSessionMessages = useCallback(
    (sessionId: string, messages: Message[]) => {
      setSessionsWithRef(prev =>
        prev.map(s =>
          s.id === sessionId ? { ...s, messages, updatedAt: Date.now() } : s
        )
      );
    },
    [setSessionsWithRef]
  );

  const updateSessionTitle = useCallback(
    (sessionId: string, title: string) => {
      setSessionsWithRef(prev =>
        prev.map(s => (s.id === sessionId ? { ...s, title } : s))
      );
    },
    [setSessionsWithRef]
  );

  const updateSessionPinStatus = useCallback(
    (sessionId: string, isPinned: boolean) => {
      setSessionsWithRef(prev =>
        prev.map(s => (s.id === sessionId ? { ...s, isPinned } : s))
      );
    },
    [setSessionsWithRef]
  );

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
    (sessionId: string, newTitle: string) => {
      updateSessionTitle(sessionId, newTitle);
    },
    [updateSessionTitle]
  );

  const handleOpenRenameDialog = useCallback(
    (sessionId: string, currentTitle: string) => {
      setRenameSessionId(sessionId);
      setNewTitle(currentTitle);
      setIsRenameDialogOpen(true);
    },
    []
  );

  const handleRenameConfirm = useCallback(() => {
    if (renameSessionId && newTitle.trim()) {
      handleRenameChat(renameSessionId, newTitle.trim());
      setIsRenameDialogOpen(false);
      setRenameSessionId(null);
      setNewTitle('');
    }
  }, [handleRenameChat, newTitle, renameSessionId]);

  const handleRenameCancel = useCallback(() => {
    setIsRenameDialogOpen(false);
    setRenameSessionId(null);
    setNewTitle('');
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const downloadTextFile = useCallback((filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const buildExportFilename = useCallback((format: string) => {
    const date = new Date();
    const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(date.getDate()).padStart(2, '0')}`;
    return `flashchatx-export-${stamp}.${format}`;
  }, []);

  const formatMarkdownSession = useCallback(
    (session: ChatSession) => {
      const createdAt =
        session.messages[0]?.timestamp || session.updatedAt || Date.now();
      const lines: string[] = [];
      lines.push(`# ${session.title || t('untitled')}`);
      lines.push(`- id: ${session.id}`);
      lines.push(`- createdAt: ${createdAt}`);
      lines.push(`- updatedAt: ${session.updatedAt}`);
      lines.push(`- pinned: ${session.isPinned ? 'true' : 'false'}`);
      lines.push('');
      session.messages.forEach(message => {
        const roleLabel = message.role === 'user' ? 'User' : 'Assistant';
        lines.push(`## ${roleLabel}`);
        if (message.attachments?.length) {
          lines.push('> attachments:');
          message.attachments.forEach(file => {
            lines.push(
              `> - ${file.name} (${file.provider}:${file.fileId}, ${file.size} bytes)`
            );
          });
        }
        lines.push(message.content || '');
        lines.push('');
      });
      return lines.join('\n');
    },
    [t]
  );

  const formatTextSession = useCallback((session: ChatSession) => {
    const lines: string[] = [];
    session.messages.forEach(message => {
      const roleLabel = message.role === 'user' ? 'User' : 'Assistant';
      lines.push(`${roleLabel}: ${message.content || ''}`);
      lines.push('');
    });
    return lines.join('\n');
  }, []);

  const exportChatById = useCallback(
    (id: string, format: 'json' | 'markdown' | 'text') => {
      const target = sessions.find(session => session.id === id);
      if (!target) return;
      if (!target.messages.length) return;

      if (format === 'json') {
        const payload = {
          version: 1,
          exportedAt: Date.now(),
          sessions: [target],
        };
        downloadTextFile(
          buildExportFilename('json'),
          JSON.stringify(payload, null, 2)
        );
        return;
      }

      if (format === 'markdown') {
        const content = formatMarkdownSession(target);
        downloadTextFile(buildExportFilename('md'), content);
        return;
      }

      const content = formatTextSession(target);
      downloadTextFile(buildExportFilename('txt'), content);
    },
    [
      buildExportFilename,
      downloadTextFile,
      formatMarkdownSession,
      formatTextSession,
      sessions,
    ]
  );

  const createImportedMessage = useCallback(
    (
      role: 'user' | 'model',
      content: string,
      timestamp: number,
      extras?: Partial<ExtendedMessage>
    ): ExtendedMessage => {
      const baseMessage: ExtendedMessage = {
        id: `${generateId()}-${fileCounterRef.current++}`,
        role,
        content: content || '',
        timestamp,
      };

      if (!extras) {
        return baseMessage;
      }

      return {
        ...baseMessage,
        ...(extras.attachments?.length
          ? { attachments: extras.attachments }
          : {}),
        ...(extras.isThinking !== undefined
          ? { isThinking: extras.isThinking }
          : {}),
        ...(extras.thinkingContent
          ? { thinkingContent: extras.thinkingContent }
          : {}),
        ...(extras.thinkingSummary
          ? { thinkingSummary: extras.thinkingSummary }
          : {}),
        ...(extras.responseContent
          ? { responseContent: extras.responseContent }
          : {}),
        ...(extras.isThinkingCollapsed !== undefined
          ? { isThinkingCollapsed: extras.isThinkingCollapsed }
          : {}),
        ...(extras.tokenUsage ? { tokenUsage: extras.tokenUsage } : {}),
      };
    },
    []
  );

  const parseJsonImport = useCallback(
    (raw: string): ChatSession[] => {
      const data = JSON.parse(raw);
      const sessionsList = Array.isArray(data) ? data : data.sessions;
      if (!Array.isArray(sessionsList)) {
        return [];
      }
      return sessionsList
        .filter(item => item && Array.isArray(item.messages))
        .map(item => {
          const messages: Message[] = item.messages.map(
            (msg: Message, index: number) => {
              const msgData = msg as Message & Partial<ExtendedMessage>;
              return createImportedMessage(
                msgData.role === 'model' ? 'model' : 'user',
                msgData.content || '',
                msgData.timestamp || Date.now() + index,
                {
                  attachments: msgData.attachments,
                  isThinking: msgData.isThinking,
                  thinkingContent: msgData.thinkingContent,
                  thinkingSummary: msgData.thinkingSummary,
                  responseContent: msgData.responseContent,
                  isThinkingCollapsed: msgData.isThinkingCollapsed,
                  tokenUsage: msgData.tokenUsage,
                }
              );
            }
          );
          const updatedAt =
            item.updatedAt ||
            messages[messages.length - 1]?.timestamp ||
            Date.now();
          return {
            id: generateId(),
            title: item.title || t('untitled'),
            messages,
            updatedAt,
            isPinned: Boolean(item.isPinned),
          } as ChatSession;
        });
    },
    [createImportedMessage, t]
  );

  const parseMarkdownImport = useCallback(
    (raw: string): ChatSession[] => {
      const blocks = raw.split(/\n---\n/g);
      const sessionsList: ChatSession[] = [];

      blocks.forEach(block => {
        const lines = block.split('\n');
        let title = '';
        const messages: Message[] = [];
        let currentRole: 'user' | 'model' | null = null;
        let buffer: string[] = [];

        const flushBuffer = () => {
          if (!currentRole) return;
          const content = buffer.join('\n').trimEnd();
          const timestamp = Date.now() + messages.length;
          messages.push(createImportedMessage(currentRole, content, timestamp));
          buffer = [];
        };

        lines.forEach(line => {
          if (line.startsWith('# ')) {
            title = line.slice(2).trim();
            return;
          }
          if (line.startsWith('## ')) {
            flushBuffer();
            const roleLabel = line.slice(3).trim().toLowerCase();
            currentRole = roleLabel.startsWith('user') ? 'user' : 'model';
            return;
          }
          if (line.startsWith('> attachments:')) {
            return;
          }
          if (line.startsWith('> -')) {
            return;
          }
          if (line.startsWith('- ') && !currentRole) {
            return;
          }
          buffer.push(line);
        });

        flushBuffer();
        if (messages.length) {
          sessionsList.push({
            id: generateId(),
            title: title || t('untitled'),
            messages,
            updatedAt: messages[messages.length - 1]?.timestamp || Date.now(),
          });
        }
      });

      return sessionsList;
    },
    [createImportedMessage, t]
  );

  const parseTextImport = useCallback(
    (raw: string): ChatSession[] => {
      const lines = raw.split('\n');
      const messages: Message[] = [];
      let currentRole: 'user' | 'model' | null = null;
      let buffer: string[] = [];

      const flushBuffer = () => {
        if (!currentRole) return;
        const content = buffer.join('\n').trimEnd();
        const timestamp = Date.now() + messages.length;
        messages.push(createImportedMessage(currentRole, content, timestamp));
        buffer = [];
      };

      lines.forEach(line => {
        if (line.startsWith('User:')) {
          flushBuffer();
          currentRole = 'user';
          buffer.push(line.replace(/^User:\s?/, ''));
          return;
        }
        if (line.startsWith('Assistant:')) {
          flushBuffer();
          currentRole = 'model';
          buffer.push(line.replace(/^Assistant:\s?/, ''));
          return;
        }
        buffer.push(line);
      });

      flushBuffer();
      if (!messages.length) return [];

      return [
        {
          id: generateId(),
          title: t('untitled'),
          messages,
          updatedAt: messages[messages.length - 1]?.timestamp || Date.now(),
        },
      ];
    },
    [createImportedMessage, t]
  );

  const importChats = useCallback(
    async (file: File) => {
      const text = await file.text();
      const name = file.name.toLowerCase();
      let imported: ChatSession[] = [];

      try {
        if (name.endsWith('.json')) {
          imported = parseJsonImport(text);
        } else if (name.endsWith('.md') || name.endsWith('.markdown')) {
          imported = parseMarkdownImport(text);
        } else {
          imported = parseTextImport(text);
        }
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
      parseJsonImport,
      parseMarkdownImport,
      parseTextImport,
      t,
      setSessionsWithRef,
      showToast,
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

  const handleSelectChat = useCallback((id: string) => {
    setCurrentSessionId(id);
    currentSessionIdRef.current = id;
    currentSessionRef.current =
      sessionsRef.current.find(session => session.id === id) || null;
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
    [setSessionsWithRef]
  );

  // Retrieve relevant memories based on current input
  const retrieveMemories = useCallback(
    async (query: string): Promise<string[]> => {
      const activeMemuConfig = memuConfigRef.current;
      if (!isMemuAvailable(activeMemuConfig) || !query.trim()) {
        return [];
      }

      try {
        const memories = await retrieveRelevantMemories(
          'default_user', // In a real app, this would be the actual user ID
          query,
          'flashchatx_agent', // Agent ID
          activeMemuConfig
        );

        return memories.map(memory => memory.content);
      } catch (error) {
        console.error('Failed to retrieve memories:', error);
        return [];
      }
    },
    []
  );

  // Save conversation to memory
  const saveToMemory = useCallback(async (messages: Message[]) => {
    const activeMemuConfig = memuConfigRef.current;
    if (!isMemuAvailable(activeMemuConfig) || !activeMemuConfig.autoSave) {
      return;
    }

    try {
      const conversationString = formatConversationToString(
        messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        }))
      );

      await saveConversationToMemory(
        conversationString,
        'default_user', // In a real app, this would be the actual user ID
        'User', // In a real app, this would be the actual user name
        'flashchatx_agent', // Agent ID
        'FlashChat X Assistant', // Agent name
        activeMemuConfig
      );
    } catch (error) {
      console.error('Failed to save conversation to memory:', error);
    }
  }, []);

  const fetchSearchMessage = useCallback(async (query: string) => {
    if (!chatConfigRef.current.useSearch || !query.trim()) {
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
  }, []);

  const buildAttachmentId = useCallback((file: File) => {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }, []);

  const buildAttachmentRefs = useCallback(
    (
      provider: ProviderType,
      items: LocalAttachment[]
    ): UploadedFileReference[] =>
      items.map(item => ({
        provider,
        fileId: item.id,
        name: item.file.name,
        size: item.file.size,
        mimeType: item.file.type || undefined,
      })),
    []
  );

  const handleAddAttachments = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      setAttachments(prev => {
        const existing = new Set(prev.map(item => item.id));
        const next = [...prev];
        files.forEach(file => {
          const id = buildAttachmentId(file);
          if (!existing.has(id)) {
            next.push({ id, file, status: 'ready' });
          }
        });
        return next;
      });
    },
    [buildAttachmentId]
  );

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateAttachment = useCallback(
    (id: string, updates: Partial<LocalAttachment>) => {
      setAttachments(prev =>
        prev.map(item => (item.id === id ? { ...item, ...updates } : item))
      );
    },
    []
  );

  const createProviderStream = useCallback(
    (
      providerConfig: ReturnType<typeof loadProviderConfig>,
      history: ReturnType<typeof buildHistory>,
      message: string,
      localAttachments?: LocalAttachment[]
    ): StreamGenerator => {
      const activeChatConfig = chatConfigRef.current;
      const common = {
        history: history as any,
        message,
        localAttachments,
        useThinking: activeChatConfig.useThinking,
        useDeepThink: activeChatConfig.useDeepThink,
        useSearch: activeChatConfig.useSearch,
        thinkingLevel: activeChatConfig.thinkingLevel,
        providerConfig,
        thinkingProcessLabel: t('thinkingProcess'),
        finalAnswerLabel: t('finalAnswer'),
      };

      return (async function* () {
        const streamFactory = await loadStreamFactory(providerConfig.provider);
        yield* streamFactory(common);
      })();
    },
    [t]
  );

  // Helper function to process stream and update messages
  const processStreamAndUpdateMessages = useCallback(
    async (
      stream: AsyncGenerator<string>,
      placeholderAiMsg: ExtendedMessage,
      existingMessages: ExtendedMessage[],
      sessionId: string
    ) => {
      let thinkingContent = '';
      let responseContent = '';
      const baseMessage = {
        id: placeholderAiMsg.id,
        role: placeholderAiMsg.role,
        timestamp: placeholderAiMsg.timestamp,
      };
      let tokenUsage: TokenUsage | undefined;
      let isThinkingPhase = false;

      const getBaseMessages = () => {
        const liveSession = sessionsRef.current.find(s => s.id === sessionId);
        const liveMessages = liveSession?.messages ?? existingMessages;
        return liveMessages.filter(msg => msg.id !== placeholderAiMsg.id);
      };

      const buildStreamMessage = (
        responseText: string,
        thinking: string | undefined,
        collapsed: boolean
      ): ExtendedMessage => ({
        ...baseMessage,
        content: responseText,
        thinkingContent: thinking,
        thinkingSummary: undefined,
        responseContent: responseText || undefined,
        isThinkingCollapsed: collapsed,
        tokenUsage,
      });

      let pendingUpdate = false;
      let rafId: number | null = null;

      const flushUpdate = () => {
        pendingUpdate = false;
        rafId = null;
        const updatedMsg = buildStreamMessage(
          responseContent,
          thinkingContent || undefined,
          false
        );
        updateSessionMessages(sessionId, [...getBaseMessages(), updatedMsg]);
      };

      const scheduleUpdate = () => {
        if (pendingUpdate) return;
        pendingUpdate = true;
        rafId = window.requestAnimationFrame(flushUpdate);
      };

      for await (const chunk of stream) {
        if (!chunk) continue;
        if (chunk.startsWith('__THINKING__')) {
          isThinkingPhase = true;
          thinkingContent += chunk.replace('__THINKING__', '');
          scheduleUpdate();
          continue;
        }
        if (chunk === '__END_THINKING__') {
          isThinkingPhase = false;
          continue;
        }
        if (chunk === '<thinking>') {
          isThinkingPhase = true;
          continue;
        }
        if (chunk === '</thinking>') {
          isThinkingPhase = false;
          continue;
        }
        if (chunk.startsWith('__TOKEN_USAGE__')) {
          try {
            tokenUsage = JSON.parse(chunk.replace('__TOKEN_USAGE__', ''));
          } catch (error) {
            console.error('Failed to parse token usage:', error);
          }
          continue;
        }

        if (isThinkingPhase) {
          thinkingContent += chunk;
        } else {
          responseContent += chunk;
        }
        scheduleUpdate();
      }

      if (responseContent || thinkingContent) {
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId);
          rafId = null;
        }
        const updatedMsg = buildStreamMessage(
          responseContent,
          thinkingContent || undefined,
          !!thinkingContent
        );
        updateSessionMessages(sessionId, [...getBaseMessages(), updatedMsg]);
      }
    },
    [updateSessionMessages]
  );

  const handleSendMessage = useCallback(
    async (overrideInput?: string) => {
      const now = Date.now();
      const activeInput = inputRef.current;
      const activeIsLoading = isLoadingRef.current;
      const activeSessionIdState = currentSessionIdRef.current;
      const activeSessionState = currentSessionRef.current;
      const activeMemuConfig = memuConfigRef.current;
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

      let activeSessionId = activeSessionIdState;
      let activeSession = activeSessionState;

      // Create new session if none exists or the referenced session is missing
      if (!activeSessionIdState || !activeSessionState) {
        const newSession: ChatSession = {
          id: generateId(),
          title: titleBase.slice(0, 30) + (titleBase.length > 30 ? '...' : ''),
          messages: [],
          updatedAt: Date.now(),
        };
        setSessionsWithRef(prev => [newSession, ...prev]);
        setCurrentSessionId(newSession.id);
        activeSessionId = newSession.id;
        activeSession = newSession;
      } else {
        activeSessionId = activeSessionIdState;
        activeSession = activeSessionState;
      }

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
      const { provider } = providerConfig;
      let uploadedFiles: UploadedFileReference[] = [];
      let localAttachmentsForRequest: LocalAttachment[] | undefined;

      if (hasAttachments) {
        if (!supportsFileUpload(provider)) {
          if (
            supportsToolFileHandling(provider) &&
            isToolEnabled(providerConfig.toolConfig, READ_FILE_TOOL_NAME)
          ) {
            localAttachmentsForRequest = [...activeAttachments];
            uploadedFiles = buildAttachmentRefs(provider, activeAttachments);
          } else {
            activeAttachments.forEach(item =>
              updateAttachment(item.id, {
                status: 'error',
                error: t('fileUploadUnsupported'),
              })
            );
            inFlightSessionRef.current = null;
            currentActionRef.current = null;
            isSendingRef.current = false;
            setIsLoading(false);
            return;
          }
        } else {
          try {
            uploadedFiles = await uploadFilesForProvider(
              providerConfig,
              activeAttachments,
              updateAttachment,
              t
            );
          } catch (error) {
            const message =
              error instanceof Error ? error.message : t('fileUploadFailed');
            activeAttachments.forEach(item =>
              updateAttachment(item.id, { status: 'error', error: message })
            );
            inFlightSessionRef.current = null;
            currentActionRef.current = null;
            isSendingRef.current = false;
            setIsLoading(false);
            return;
          }
        }
      }

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
          titleBase.slice(0, 30) + (titleBase.length > 30 ? '...' : '')
        );
      }

      setInput('');
      if (hasAttachments) {
        setAttachments([]);
      }

      const queryInput = titleBase;
      const memuEnabled = isMemuAvailable(activeMemuConfig);
      const [memoryContents, searchMessage] = await Promise.all([
        memuEnabled
          ? retrieveMemories(queryInput)
          : Promise.resolve<string[]>([]),
        fetchSearchMessage(queryInput),
      ]);

      let contextMessages: Message[] = [];
      let historyForAPI: any[] = [];

      if (memuEnabled) {
        if (memoryContents.length) {
          const memoryContext = memoryContents.join('\n\n');
          contextMessages.push({
            id: generateId(),
            role: 'user',
            content: `相关记忆:\n${memoryContext}`,
            timestamp: Date.now(),
          });
        }

        if (searchMessage) {
          contextMessages.push(searchMessage);
        }

        // For MemU-enabled mode, use minimal history (only current message + context)
        historyForAPI = buildHistory([userMessage, ...contextMessages]);
      } else {
        // Use traditional conversation history when MemU is disabled, but only include search in API history
        const searchContext = searchMessage ? [searchMessage] : [];
        historyForAPI = buildHistory([...updatedMessages, ...searchContext]);
      }

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
      t,
      updateAttachment,
      processStreamAndUpdateMessages,
      createProviderStream,
      retrieveMemories,
      saveToMemory,
      updateSessionMessages,
      updateSessionTitle,
      setSessionsWithRef,
      setAttachments,
    ]
  );

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

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
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
        onCancel={closeClearConfirm}
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
      {isRenameDialogOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="RenameDialog surface rounded-lg p-4 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium mb-3">{t('renameChatTitle')}</h3>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleRenameConfirm();
                } else if (e.key === 'Escape') {
                  handleRenameCancel();
                }
              }}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--panel)] text-[var(--text)] focus:outline-none"
              placeholder={t('newChatName')}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={handleRenameCancel}
                className="px-3 py-1.5 text-sm bg-[var(--panel)] border border-[var(--border)] rounded-md text-[var(--text)] transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleRenameConfirm}
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
  const [settings, setSettings] = useState<ExtendedUserSettings>(() => {
    const baseSettings = getJSON<UserSettings>('ds_settings', DEFAULT_SETTINGS);
    const memuSettings = getJSON<any>('ds_memu_config', {
      enabled: false,
      apiKey: '',
      baseUrl: 'https://api.memu.so',
      autoSave: true,
      maxMemories: 10,
    });

    return {
      ...baseSettings,
      memu: memuSettings,
    };
  });

  useEffect(() => {
    setJSON('ds_settings', settings);
  }, [settings]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const resolveTheme = (): Theme =>
      settings.theme === 'system'
        ? mediaQuery.matches
          ? 'dark'
          : 'light'
        : settings.theme;

    const applyTheme = (nextTheme: Theme) => {
      const isDarkTheme = nextTheme === 'dark';
      const bgColor = isDarkTheme ? '#0a0a0a' : '#ffffff';

      document.documentElement.setAttribute('data-theme', nextTheme);
      document.documentElement.style.backgroundColor = bgColor;
      document.documentElement.style.colorScheme = isDarkTheme
        ? 'dark'
        : 'light';
      document.body.style.backgroundColor = bgColor;

      window.electronAPI?.setBackgroundColor?.(bgColor);
    };

    const handleSystemChange = (event: MediaQueryListEvent) => {
      if (settings.theme === 'system') {
        applyTheme(event.matches ? 'dark' : 'light');
      }
    };

    applyTheme(resolveTheme());
    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, [settings.theme]);

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
