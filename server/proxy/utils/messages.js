export const getMessageText = message => {
  if (!message) return '';
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(part => part && part.type === 'text')
      .map(part => part.text || '')
      .join('');
  }
  return '';
};

export const isSearchContextText = text => {
  if (!text) return false;
  return (
    text.includes('根据搜索"') ||
    text.includes('未找到相关内容') ||
    text.includes('Based on the search results for "') ||
    text.includes('No relevant information found about "') ||
    text.startsWith('根据搜索') ||
    text.startsWith('Based on the search results')
  );
};

export const isMemoryContextText = text =>
  typeof text === 'string' && text.startsWith('相关记忆:');

export const getLastUserMessageText = messages => {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') {
      return getMessageText(messages[i]);
    }
  }
  return '';
};

export const getLastUserQueryText = messages => {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role !== 'user') continue;
    const text = getMessageText(msg);
    if (!text) continue;
    if (isSearchContextText(text) || isMemoryContextText(text)) {
      continue;
    }
    return text;
  }
  return getLastUserMessageText(messages);
};
