import { useCallback, type MutableRefObject } from 'react';
import {
  buildHistory,
  loadStreamFactory,
  type StreamCommon,
  type StreamGenerator,
} from '../appUtils';
import type {
  ChatConfig,
  ChatSession,
  ExtendedMessage,
  LocalAttachment,
  Message,
  ProviderConfig,
  TokenUsage,
} from '../../types';

const resolveLanguageFromText = (text: string, fallback: string) => {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  if (/[\u4e00-\u9fff]/.test(trimmed)) return '简体中文';
  if (/[A-Za-z]/.test(trimmed)) return 'English';
  return fallback;
};

const resolveLanguageForReply = (
  message: string,
  history: ReturnType<typeof buildHistory>,
  fallback: string
) => {
  if (message.trim()) {
    return resolveLanguageFromText(message, fallback);
  }
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.role !== 'user') continue;
    const content = history[i]?.content || '';
    if (!content.trim()) continue;
    return resolveLanguageFromText(content, fallback);
  }
  return fallback;
};

type UseChatStreamOptions = {
  t: (key: string) => string;
  language: string;
  chatConfigRef: MutableRefObject<ChatConfig>;
  sessionsRef: MutableRefObject<ChatSession[]>;
  updateSessionMessages: (sessionId: string, messages: Message[]) => void;
};

export const useChatStream = ({
  t,
  language,
  chatConfigRef,
  sessionsRef,
  updateSessionMessages,
}: UseChatStreamOptions) => {
  const createProviderStream = useCallback(
    (
      providerConfig: ProviderConfig,
      history: ReturnType<typeof buildHistory>,
      message: string,
      localAttachments?: LocalAttachment[]
    ): StreamGenerator => {
      const activeChatConfig = chatConfigRef.current;
      const replyLanguage = resolveLanguageForReply(message, history, language);
      const common: StreamCommon = {
        history,
        message,
        localAttachments,
        useThinking: activeChatConfig.useThinking,
        useSearch: activeChatConfig.useSearch,
        thinkingLevel: activeChatConfig.thinkingLevel,
        language: replyLanguage,
        providerConfig,
        thinkingProcessLabel: t('thinkingProcess'),
        finalAnswerLabel: t('finalAnswer'),
      };

      return (async function* () {
        const streamFactory = await loadStreamFactory(providerConfig.provider);
        yield* streamFactory(common);
      })();
    },
    [chatConfigRef, language, t]
  );

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
    [sessionsRef, updateSessionMessages]
  );

  return { createProviderStream, processStreamAndUpdateMessages };
};
