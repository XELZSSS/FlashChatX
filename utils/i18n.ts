import type { HistoryEntry } from './chatHistory';

export const resolveLanguageFromText = (text: string, fallback: string) => {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  if (/[\u4e00-\u9fff]/.test(trimmed)) return '简体中文';
  if (/[A-Za-z]/.test(trimmed)) return 'English';
  return fallback;
};

export const resolveLanguageForReply = (
  message: string,
  history: HistoryEntry[],
  fallback: string
) => {
  if (message.trim()) {
    return resolveLanguageFromText(message, fallback);
  }
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.role !== 'user') continue;
    const content = history[i]?.content || '';
    if (!content.trim()) continue;
    return resolveLanguageFromText(content, fallback);
  }
  return fallback;
};
