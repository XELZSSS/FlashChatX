import React from 'react';
import {
  ArrowUp,
  Globe,
  Brain,
  AlertTriangle,
  Paperclip,
  Smile,
} from 'lucide-react';
import type { ChatConfig } from '../../types';
import { ToggleButton } from '../common';

type ThinkingLevelOption = {
  id: ChatConfig['thinkingLevel'];
  label: string;
};

interface InputToolbarProps {
  readonly t: (key: string) => string;
  readonly config: ChatConfig;
  readonly thinkingLevels: ThinkingLevelOption[];
  readonly isEmojiOpen: boolean;
  readonly showEmojiButton: boolean;
  readonly isUploading: boolean;
  readonly canSend: boolean;
  readonly fileInputRef: React.RefObject<HTMLInputElement>;
  readonly onToggleThinking: () => void;
  readonly onSetThinkingLevel: (level: ChatConfig['thinkingLevel']) => void;
  readonly onToggleSearch: () => void;
  readonly onOpenFilePicker: () => void;
  readonly onToggleEmojiPicker: () => void;
  readonly onOpenInfoDialog: () => void;
  readonly onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onSend: (e?: React.SyntheticEvent) => void;
}

const InputToolbar: React.FC<InputToolbarProps> = ({
  t,
  config,
  thinkingLevels,
  isEmojiOpen,
  showEmojiButton,
  isUploading,
  canSend,
  fileInputRef,
  onToggleThinking,
  onSetThinkingLevel,
  onToggleSearch,
  onOpenFilePicker,
  onToggleEmojiPicker,
  onOpenInfoDialog,
  onFileSelect,
  onSend,
}) => (
  <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
    <div className="flex items-center gap-2">
      <ToggleButton
        active={config.useThinking}
        onClick={onToggleThinking}
        label={t('thinking')}
        icon={Brain}
      />

      {config.useThinking && (
        <div className="flex items-center gap-1.5 rounded-full border px-2 py-1 surface">
          <div className="flex items-center gap-1">
            {thinkingLevels.map(level => {
              const isActive = config.thinkingLevel === level.id;
              return (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => onSetThinkingLevel(level.id)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-subtle hover:text-[var(--text)]'
                  }`}
                >
                  {level.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ToggleButton
        active={config.useSearch}
        onClick={onToggleSearch}
        label={t('search')}
        icon={Globe}
        title={config.useSearch ? 'Web search enabled' : 'Enable web search'}
      />

      <ToggleButton
        active={false}
        onClick={onOpenFilePicker}
        label={t('uploadFile')}
        icon={Paperclip}
        disabled={isUploading}
      />

      {showEmojiButton && (
        <ToggleButton
          active={isEmojiOpen}
          onClick={onToggleEmojiPicker}
          label={t('emojiButtonLabel')}
          icon={Smile}
        />
      )}

      <ToggleButton
        active={false}
        onClick={onOpenInfoDialog}
        label={t('projectInfo')}
        icon={AlertTriangle}
      />
    </div>

    <div className="flex items-center gap-3">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".txt,.md,.docx,.xlsx,.pdf,.png,.jpg,.jpeg,.bmp,.gif,.webp,.tif,.tiff"
        onChange={onFileSelect}
      />
      <button
        onClick={onSend}
        disabled={!canSend}
        className={`send-btn w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
          canSend
            ? 'bg-[var(--accent)] hover:bg-[var(--accent)] text-white'
            : 'bg-[var(--accent-soft)] text-white cursor-not-allowed'
        }`}
      >
        <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
      </button>
    </div>
  </div>
);

export default InputToolbar;
