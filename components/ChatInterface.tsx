import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ExtendedMessage, TokenUsage } from '../types';
import { useTranslation } from '../contexts/useTranslation';
import { MessageBubble } from './chat';

interface ChatInterfaceProps {
  readonly messages: ExtendedMessage[];
  readonly isLoading: boolean;
  readonly scrollLockUntilRef?: React.MutableRefObject<number>;
  readonly onUpdateMessage?: (
    messageId: string,
    updates: Partial<ExtendedMessage>
  ) => void;
  readonly cumulativeTokenUsage?: TokenUsage | null;
}

const StandaloneTypingIndicator: React.FC = React.memo(() => (
  <div className="flex w-full justify-start">
    <div className="flex max-w-5xl w-full flex-row gap-4 mx-auto">
      <div className="flex items-center mt-2 pl-4">
        <div className="typing-indicator">
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
        </div>
      </div>
    </div>
  </div>
));

StandaloneTypingIndicator.displayName = 'StandaloneTypingIndicator';

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isLoading,
  scrollLockUntilRef,
  onUpdateMessage,
  cumulativeTokenUsage,
}) => {
  const { t } = useTranslation();
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const preventAutoScrollRef = useRef(false);
  const previousMessagesLength = useRef(messages.length);
  const isInitialLoadRef = useRef(true);
  const scrollAnimRef = useRef<number | null>(null);
  const scrollTargetRef = useRef<number | null>(null);

  const cancelScrollAnimation = useCallback(() => {
    if (scrollAnimRef.current !== null) {
      window.cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }
  }, []);

  const smoothScrollToBottom = useCallback(
    (durationMs: number) => {
      const container = containerRef.current;
      if (!container) return;
      const target = container.scrollHeight - container.clientHeight;
      if (target <= 0) return;
      if (scrollTargetRef.current === target) return;

      cancelScrollAnimation();
      scrollTargetRef.current = target;

      const start = container.scrollTop;
      const delta = target - start;
      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const eased = progress * (2 - progress);
        container.scrollTop = start + delta * eased;
        if (progress < 1) {
          scrollAnimRef.current = window.requestAnimationFrame(step);
        } else {
          scrollAnimRef.current = null;
        }
      };

      scrollAnimRef.current = window.requestAnimationFrame(step);
    },
    [cancelScrollAnimation]
  );

  useEffect(() => {
    const lockUntil = scrollLockUntilRef?.current || 0;
    const isScrollLocked = Date.now() < lockUntil;
    const hasNewMessages = messages.length > previousMessagesLength.current;
    const shouldScroll =
      !preventAutoScrollRef.current &&
      !isScrollLocked &&
      (hasNewMessages || isLoading || isInitialLoadRef.current);

    if (shouldScroll) {
      smoothScrollToBottom(isLoading ? 220 : 180);
    }

    previousMessagesLength.current = messages.length;
    preventAutoScrollRef.current = false;
    isInitialLoadRef.current = false;
  }, [messages, isLoading, scrollLockUntilRef, smoothScrollToBottom]);

  useEffect(() => {
    return () => cancelScrollAnimation();
  }, [cancelScrollAnimation]);

  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setShowCopySuccess(true);
        setTimeout(() => setShowCopySuccess(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy message: ', err);
      });
  }, []);

  const handleToggleThinking = useCallback(
    (messageId: string, isCollapsed: boolean) => {
      preventAutoScrollRef.current = true;

      if (onUpdateMessage) {
        onUpdateMessage(messageId, {
          isThinkingCollapsed: !isCollapsed,
        });
      }
    },
    [onUpdateMessage]
  );

  const lastMessage = messages[messages.length - 1];
  const showInlineTyping =
    isLoading &&
    lastMessage?.role === 'model' &&
    !lastMessage.content.trim() &&
    !lastMessage.responseContent?.trim();
  const showStandaloneTyping = isLoading && lastMessage?.role !== 'model';

  if (messages.length === 0) {
    return <div className="flex-1" />;
  }

  return (
    <div
      ref={containerRef}
      className="chat-interface flex-1 min-h-0 overflow-y-auto p-4 space-y-6 relative"
    >
      {messages.map((msg, index) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isLast={index === messages.length - 1}
          showInlineTyping={showInlineTyping}
          cumulativeTokenUsage={
            index === messages.length - 1 ? cumulativeTokenUsage : null
          }
          onCopyMessage={handleCopyMessage}
          onToggleThinking={handleToggleThinking}
        />
      ))}

      {showStandaloneTyping && <StandaloneTypingIndicator />}

      <div ref={endOfMessagesRef} />

      {/* Copy Success Toast */}
      {showCopySuccess && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 surface shadow-soft px-4 py-2 rounded-xl z-50 animate-fade-in">
          {t('copySuccess')}
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
