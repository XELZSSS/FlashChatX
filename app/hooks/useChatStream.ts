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

type UseChatStreamOptions = {
  t: (key: string) => string;
  chatConfigRef: MutableRefObject<ChatConfig>;
  sessionsRef: MutableRefObject<ChatSession[]>;
  updateSessionMessages: (sessionId: string, messages: Message[]) => void;
};

export const useChatStream = ({
  t,
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
      const common: StreamCommon = {
        history,
        message,
        localAttachments,
        useThinking: activeChatConfig.useThinking,
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
    [chatConfigRef, t]
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
