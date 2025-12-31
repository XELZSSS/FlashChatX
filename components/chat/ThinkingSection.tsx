import React, { memo, useCallback } from 'react';
import { Brain } from 'lucide-react';
import { useTranslation } from '../../contexts/useTranslation';

interface ThinkingSectionProps {
  readonly messageId: string;
  readonly thinkingText: string | null;
  readonly isCollapsed: boolean;
  readonly onToggle: (messageId: string, isCollapsed: boolean) => void;
}

const ThinkingSection: React.FC<ThinkingSectionProps> = memo(
  ({ messageId, thinkingText, isCollapsed, onToggle }) => {
    const { t } = useTranslation();

    const handleClick = useCallback(() => {
      onToggle(messageId, isCollapsed);
    }, [messageId, isCollapsed, onToggle]);

    if (!thinkingText) {
      return null;
    }

    return (
      <div className="thinking-section">
        <div className="thinking-header cursor-pointer" onClick={handleClick}>
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
            <p className="whitespace-pre-wrap text-base leading-relaxed">
              {thinkingText}
            </p>
          </div>
        </div>
      </div>
    );
  }
);

ThinkingSection.displayName = 'ThinkingSection';

export default ThinkingSection;
