import React, { useEffect, useMemo, useState } from 'react';
import Picker from '@emoji-mart/react';
import { useTranslation } from '../contexts/useTranslation';
import { getCachedEmojiData, loadEmojiData } from '../utils/emojiLoader';

interface EmojiPickerProps {
  readonly onSelect: (emoji: string) => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect }) => {
  const { language } = useTranslation();
  const locale = useMemo(
    () => (language === '简体中文' ? 'zh' : 'en'),
    [language]
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.getAttribute('data-theme') === 'dark'
      ? 'dark'
      : 'light';
  });
  const [emojiData, setEmojiData] = useState<unknown | null>(
    getCachedEmojiData()
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new globalThis.MutationObserver(() => {
      setTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (emojiData) return;
    let isMounted = true;
    loadEmojiData().then(data => {
      if (isMounted) {
        setEmojiData(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [emojiData]);

  return (
    <div className="emoji-picker">
      {emojiData ? (
        <Picker
          data={emojiData}
          theme={theme}
          locale={locale}
          set="native"
          onEmojiSelect={(emoji: { native?: string }) => {
            if (emoji?.native) {
              onSelect(emoji.native);
            }
          }}
          previewPosition="none"
          skinTonePosition="none"
          searchPosition="top"
        />
      ) : (
        <div className="text-xs text-subtle px-3 py-2">Loading...</div>
      )}
    </div>
  );
};

export default EmojiPicker;
