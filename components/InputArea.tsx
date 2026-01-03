import React, {
  Suspense,
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
} from 'react';
import { ChatConfig, LocalAttachment } from '../types';
import { useTranslation } from '../contexts/useTranslation';
import InfoDialog from './InfoDialog';
import { AttachmentList } from './common';
import InputToolbar from './chat/InputToolbar';

const EmojiPicker = React.lazy(() => import('./EmojiPicker'));

interface InputAreaProps {
  readonly input: string;
  readonly setInput: (val: string) => void;
  readonly onSend: (overrideInput?: string) => void;
  readonly isLoading: boolean;
  readonly isUploading: boolean;
  readonly showEmojiButton?: boolean;
  readonly config: ChatConfig;
  readonly setConfig: (val: ChatConfig) => void;
  readonly attachments: LocalAttachment[];
  readonly onAddAttachments: (files: File[]) => void;
  readonly onRemoveAttachment: (id: string) => void;
}

const InputArea: React.FC<InputAreaProps> = ({
  input,
  setInput,
  onSend,
  isLoading,
  isUploading,
  showEmojiButton = true,
  config,
  setConfig,
  attachments,
  onAddAttachments,
  onRemoveAttachment,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  const thinkingLevels = useMemo(
    (): Array<{ id: ChatConfig['thinkingLevel']; label: string }> => [
      { id: 'low', label: t('thinkingLow') },
      { id: 'medium', label: t('thinkingMedium') },
      { id: 'high', label: t('thinkingHigh') },
    ],
    [t]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${newHeight}px`;
  }, [input]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateHeight = () => {
      const height = container.offsetHeight || 0;
      document.documentElement.style.setProperty(
        '--chat-input-height',
        `${height}px`
      );
    };

    updateHeight();

    let observer: globalThis.ResizeObserver | null = null;
    if ('ResizeObserver' in window) {
      const Observer = window.ResizeObserver;
      observer = new Observer(updateHeight);
      observer.observe(container);
    }

    window.addEventListener('resize', updateHeight);

    return () => {
      window.removeEventListener('resize', updateHeight);
      if (observer) observer.disconnect();
    };
  }, [attachments.length, isEmojiOpen, isUploading, showEmojiButton]);

  useEffect(() => {
    if (!isEmojiOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!emojiPickerRef.current) return;
      const path = event.composedPath?.() || [];
      if (
        emojiPickerRef.current.contains(event.target as Node) ||
        path.includes(emojiPickerRef.current)
      ) {
        return;
      }
      setIsEmojiOpen(false);
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsEmojiOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEmojiOpen]);

  // Memoized input validation
  const canSend = useMemo(() => {
    const hasInput = input.trim().length > 0 || attachments.length > 0;
    return hasInput && !isLoading && !isUploading;
  }, [attachments.length, input, isLoading, isUploading]);

  const toggleThinking = useCallback(() => {
    setConfig(prev => ({ ...prev, useThinking: !prev.useThinking }));
  }, [setConfig]);

  const toggleSearch = useCallback(() => {
    setConfig(prev => ({ ...prev, useSearch: !prev.useSearch }));
  }, [setConfig]);

  const setThinkingLevel = useCallback(
    (level: ChatConfig['thinkingLevel']) => {
      setConfig(prev => ({ ...prev, thinkingLevel: level }));
    },
    [setConfig]
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []);
      if (!selectedFiles.length) {
        return;
      }

      onAddAttachments(selectedFiles);
      event.target.value = '';
    },
    [onAddAttachments]
  );

  const handleSend = useCallback(
    async (e?: React.SyntheticEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (canSend) {
        onSend();
      }
    },
    [canSend, onSend]
  );

  // Enhanced keyboard handler
  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        await handleSend();
      }
    },
    [handleSend]
  );

  const insertEmoji = useCallback(
    (emoji: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        setInput(prev => `${prev}${emoji}`);
        return;
      }

      const start = textarea.selectionStart ?? input.length;
      const end = textarea.selectionEnd ?? input.length;
      const nextValue = `${input.slice(0, start)}${emoji}${input.slice(end)}`;
      setInput(nextValue);
      setIsEmojiOpen(false);

      const nextCursor = start + emoji.length;
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextCursor, nextCursor);
      });

      return;
    },
    [input, setInput]
  );

  const openInfoDialog = useCallback(() => {
    setIsInfoDialogOpen(true);
  }, []);

  const closeInfoDialog = useCallback(() => {
    setIsInfoDialogOpen(false);
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const toggleEmojiPicker = useCallback(() => {
    setIsEmojiOpen(open => !open);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full max-w-5xl mx-auto px-4 pb-4 transition-all duration-300"
    >
      <div className="chat-input-shell input-shell rounded-[26px] transition-all duration-200 p-4 relative">
        {showEmojiButton && isEmojiOpen && (
          <div
            ref={emojiPickerRef}
            className="absolute left-0 bottom-full mb-3 z-50"
          >
            <Suspense
              fallback={
                <div className="emoji-picker text-xs text-subtle px-3 py-2">
                  Loading...
                </div>
              }
            >
              <EmojiPicker onSelect={insertEmoji} />
            </Suspense>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('enterMessage')}
          rows={1}
          className="w-full bg-transparent resize-none focus:outline-none max-h-[200px] text-base leading-relaxed"
          style={{ minHeight: '24px' }}
        />

        <AttachmentList
          attachments={attachments}
          onRemoveAttachment={onRemoveAttachment}
          isUploading={isUploading}
        />

        <InputToolbar
          t={t}
          config={config}
          thinkingLevels={thinkingLevels}
          isEmojiOpen={isEmojiOpen}
          showEmojiButton={showEmojiButton}
          isUploading={isUploading}
          canSend={canSend}
          fileInputRef={fileInputRef}
          onToggleThinking={toggleThinking}
          onSetThinkingLevel={setThinkingLevel}
          onToggleSearch={toggleSearch}
          onOpenFilePicker={openFilePicker}
          onToggleEmojiPicker={toggleEmojiPicker}
          onOpenInfoDialog={openInfoDialog}
          onFileSelect={handleFileSelect}
          onSend={handleSend}
        />
      </div>

      {/* Info Dialog */}
      <InfoDialog isOpen={isInfoDialogOpen} onClose={closeInfoDialog} />
    </div>
  );
};

export default InputArea;
