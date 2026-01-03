import { useMemo } from 'react';
import { buildDisplayHistory } from '../../../utils/chatHistory';
import type {
  ExtendedMessage,
  LocalAttachment,
  TokenUsage,
} from '../../../types';

type UseAppDerivedStateOptions = {
  currentMessages: ExtendedMessage[];
  attachments: LocalAttachment[];
  hasHydrated: { current: boolean };
  isRestoring: boolean;
  currentSessionId: string | null;
};

export const useAppDerivedState = ({
  currentMessages,
  attachments,
  hasHydrated,
  isRestoring,
  currentSessionId,
}: UseAppDerivedStateOptions) => {
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
    } satisfies TokenUsage;
  }, [currentMessages]);

  const displayMessages = useMemo(
    () => buildDisplayHistory(currentMessages),
    [currentMessages]
  );

  const isUploading = useMemo(
    () => attachments.some(item => item.status === 'uploading'),
    [attachments]
  );

  const showWelcome =
    hasHydrated.current &&
    !isRestoring &&
    (!currentSessionId || currentMessages.length === 0);

  return { cumulativeTokenUsage, displayMessages, isUploading, showWelcome };
};
