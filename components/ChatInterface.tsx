import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Copy, Brain, Zap, Paperclip } from 'lucide-react';
import { ExtendedMessage, TokenUsage } from '../types';
import { useTranslation } from '../contexts/useTranslation';

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

  const toggleThinkingCollapse = useCallback(
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

  const renderThinking = useCallback(
    (
      msg: ExtendedMessage,
      thinkingText: string | null,
      isCollapsed: boolean
    ) => {
      if (!thinkingText) return null;

      return (
        <div className="thinking-section">
          <div
            className="thinking-header cursor-pointer"
            onClick={() => toggleThinkingCollapse(msg.id, isCollapsed)}
          >
            <div className="thinking-title">
              <Brain className="w-4 h-4" />
              {t('thinkingProcess')}
            </div>
          </div>
          <div
            className={`thinking-content overflow-hidden transition-all duration-300 ${
              isCollapsed ? 'max-h-0' : 'max-h-none'
            }`}
          >
            <div className="prose prose-slate prose-sm max-w-none leading-relaxed break-words">
              {thinkingText && (
                <p className="whitespace-pre-wrap text-base leading-relaxed">
                  {thinkingText}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    },
    [t, toggleThinkingCollapse]
  );

  const renderResponse = useCallback((text: string) => {
    if (!text) return null;

    return (
      <div className="prose prose-slate prose-sm max-w-none leading-relaxed break-words">
        <p className="whitespace-pre-wrap text-base leading-relaxed">{text}</p>
      </div>
    );
  }, []);

  const renderAttachments = useCallback((msg: ExtendedMessage) => {
    if (!msg.attachments?.length) return null;

    return (
      <div className="flex flex-col gap-2 mb-2">
        {msg.attachments.map(file => (
          <div
            key={`${file.provider}-${file.fileId}`}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 surface"
          >
            <Paperclip className="w-4 h-4 text-subtle" />
            <span className="text-sm">{file.name}</span>
          </div>
        ))}
      </div>
    );
  }, []);

  if (messages.length === 0) {
    return <div className="flex-1" />;
  }

  return (
    <div
      ref={containerRef}
      className="chat-interface flex-1 min-h-0 overflow-y-auto p-4 space-y-6 relative"
    >
      {messages.map((msg, index) => {
        const isUser = msg.role === 'user';
        const isThinkingCollapsed = !!msg.isThinkingCollapsed;
        const responseText = msg.responseContent ?? msg.content;

        return (
          <div
            key={msg.id}
            className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`flex max-w-5xl w-full ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-4 mx-auto`}
            >
              <div
                className={`flex flex-col max-w-[95%] lg:max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}
              >
                {isUser ? (
                  <div className="user-bubble px-5 py-3 rounded-2xl rounded-tr-sm">
                    {renderAttachments(msg)}
                    <p className="whitespace-pre-wrap text-base leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                ) : (
                  <div className="ai-bubble w-full">
                    {renderThinking(
                      msg,
                      msg.thinkingContent ?? null,
                      isThinkingCollapsed
                    )}
                    {renderResponse(responseText)}

                    {showInlineTyping && index === messages.length - 1 && (
                      <div className="flex items-center mt-2 pl-1">
                        <div className="typing-indicator">
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1 mt-3">
                      <button
                        className="p-1.5 text-subtle hover:text-muted transition-colors"
                        title={t('copy')}
                        onClick={() =>
                          handleCopyMessage(msg.responseContent || msg.content)
                        }
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {index === messages.length - 1 &&
                        cumulativeTokenUsage && (
                          <div className="flex items-center gap-1 text-xs text-subtle">
                            <Zap className="w-3.5 h-3.5" />
                            <span>{cumulativeTokenUsage.total_tokens}</span>
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {showStandaloneTyping && (
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
      )}

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
