import { useCallback, type MutableRefObject } from 'react';
import {
  loadStreamFactory,
  type StreamCommon,
  type StreamGenerator,
} from '../../appUtils';
import { buildHistory } from '../../../utils/chatHistory';
import { resolveLanguageForReply } from '../../../utils/i18n';
import { parseStreamChunk } from '../../../utils/streamParser';
import type {
  ChatConfig,
  ChatSession,
  ExtendedMessage,
  LocalAttachment,
  Message,
  ProviderConfig,
  TokenUsage,
} from '../../../types';

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
        const parsed = parseStreamChunk(chunk);

        if (parsed.kind === 'ignore') continue;
        if (parsed.kind === 'startThinking') {
          isThinkingPhase = true;
          continue;
        }
        if (parsed.kind === 'endThinking') {
          isThinkingPhase = false;
          continue;
        }
        if (parsed.kind === 'tokenUsage') {
          const usage = parsed.usage;
          if (tokenUsage) {
            tokenUsage = {
              prompt_tokens:
                tokenUsage.prompt_tokens + (usage.prompt_tokens || 0),
              completion_tokens:
                tokenUsage.completion_tokens + (usage.completion_tokens || 0),
              total_tokens: tokenUsage.total_tokens + (usage.total_tokens || 0),
              prompt_tokens_details: {
                cached_tokens:
                  (tokenUsage.prompt_tokens_details?.cached_tokens || 0) +
                  (usage.prompt_tokens_details?.cached_tokens || 0),
              },
            };
          } else {
            tokenUsage = usage;
          }
          continue;
        }

        if (parsed.kind === 'thinking') {
          isThinkingPhase = true;
          thinkingContent += parsed.value;
          scheduleUpdate();
          continue;
        }

        if (parsed.kind === 'content') {
          if (isThinkingPhase) {
            thinkingContent += parsed.value;
          } else {
            responseContent += parsed.value;
          }
          scheduleUpdate();
        }
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
