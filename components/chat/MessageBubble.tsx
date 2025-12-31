import React, { memo, useCallback } from 'react';
import { Copy, Zap, Paperclip } from 'lucide-react';
import { ExtendedMessage, TokenUsage } from '../../types';
import { useTranslation } from '../../contexts/useTranslation';
import ThinkingSection from './ThinkingSection';

interface MessageBubbleProps {
  readonly message: ExtendedMessage;
  readonly isLast: boolean;
  readonly showInlineTyping: boolean;
  readonly cumulativeTokenUsage?: TokenUsage | null;
  readonly onCopyMessage: (content: string) => void;
  readonly onToggleThinking: (messageId: string, isCollapsed: boolean) => void;
}

const MessageAttachments: React.FC<{
  readonly attachments: ExtendedMessage['attachments'];
}> = memo(({ attachments }) => {
  if (!attachments?.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 mb-2">
      {attachments.map(file => (
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
});

MessageAttachments.displayName = 'MessageAttachments';

const TypingIndicator: React.FC = memo(() => (
  <div className="flex items-center mt-2 pl-1">
    <div className="typing-indicator">
      <div className="typing-dot"></div>
      <div className="typing-dot"></div>
      <div className="typing-dot"></div>
    </div>
  </div>
));

TypingIndicator.displayName = 'TypingIndicator';

const MessageBubble: React.FC<MessageBubbleProps> = memo(
  ({
    message,
    isLast,
    showInlineTyping,
    cumulativeTokenUsage,
    onCopyMessage,
    onToggleThinking,
  }) => {
    const { t } = useTranslation();
    const isUser = message.role === 'user';
    const isThinkingCollapsed = !!message.isThinkingCollapsed;
    const responseText = message.responseContent ?? message.content;

    const handleCopy = useCallback(() => {
      onCopyMessage(message.responseContent || message.content);
    }, [message.responseContent, message.content, onCopyMessage]);

    if (isUser) {
      return (
        <div className="flex w-full justify-end">
          <div className="flex max-w-5xl w-full flex-row-reverse gap-4 mx-auto">
            <div className="flex flex-col max-w-[95%] lg:max-w-[85%] items-end">
              <div className="user-bubble px-5 py-3 rounded-2xl rounded-tr-sm">
                <MessageAttachments attachments={message.attachments} />
                <p className="whitespace-pre-wrap text-base leading-relaxed">
                  {message.content}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex w-full justify-start">
        <div className="flex max-w-5xl w-full flex-row gap-4 mx-auto">
          <div className="flex flex-col max-w-[95%] lg:max-w-[85%] items-start">
            <div className="ai-bubble w-full">
              <ThinkingSection
                messageId={message.id}
                thinkingText={message.thinkingContent ?? null}
                isCollapsed={isThinkingCollapsed}
                onToggle={onToggleThinking}
              />

              {responseText && (
                <div className="prose prose-slate prose-sm max-w-none leading-relaxed break-words">
                  <p className="whitespace-pre-wrap text-base leading-relaxed">
                    {responseText}
                  </p>
                </div>
              )}

              {showInlineTyping && isLast && <TypingIndicator />}

              <div className="flex items-center gap-1 mt-3">
                <button
                  className="p-1.5 text-subtle hover:text-muted transition-colors"
                  title={t('copy')}
                  onClick={handleCopy}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {isLast && cumulativeTokenUsage && (
                  <div className="flex items-center gap-1 text-xs text-subtle">
                    <Zap className="w-3.5 h-3.5" />
                    <span>{cumulativeTokenUsage.total_tokens}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
