export const isThinkingEnabled = payload => {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.reasoning_effort) return true;
  if (payload.extra_body?.reasoning_split) return true;
  if (payload.thinking && typeof payload.thinking === 'object') {
    return payload.thinking.type === 'enabled';
  }
  return false;
};

export const createThinkTagStripper = () => {
  let inThinkBlock = false;
  let tagBuffer = '';
  const thinkTags = new Set(['think', '/think', 'thinking', '/thinking']);

  return text => {
    if (!text) return '';
    let source = tagBuffer + text;
    tagBuffer = '';
    let output = '';

    for (let i = 0; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '<') {
        const closeIdx = source.indexOf('>', i + 1);
        if (closeIdx === -1) {
          tagBuffer = source.slice(i);
          break;
        }
        const tag = source
          .slice(i + 1, closeIdx)
          .trim()
          .toLowerCase();
        if (thinkTags.has(tag)) {
          inThinkBlock = !tag.startsWith('/');
          i = closeIdx;
          continue;
        }
        if (!inThinkBlock) {
          output += source.slice(i, closeIdx + 1);
        }
        i = closeIdx;
        continue;
      }
      if (!inThinkBlock) output += ch;
    }

    return output;
  };
};

export const stripThinkingFromText = text => {
  const strip = createThinkTagStripper();
  return strip(text || '');
};

export const stripThinkingFromMessage = message => {
  if (!message || typeof message !== 'object') return;
  if (typeof message.content === 'string') {
    message.content = stripThinkingFromText(message.content);
  }
  if ('reasoning_content' in message) delete message.reasoning_content;
  if ('reasoning_details' in message) delete message.reasoning_details;
};

export const stripThinkingFromResponseData = data => {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data.choices)) {
    data.choices.forEach(choice => {
      if (choice?.message) {
        stripThinkingFromMessage(choice.message);
      }
      if (choice?.delta) {
        stripThinkingFromMessage(choice.delta);
      }
    });
  }
  return data;
};

export const createStreamThinkingFilter = () => {
  const strip = createThinkTagStripper();
  return data => {
    if (!data || data === '[DONE]') return data;
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      return strip(data);
    }
    if (Array.isArray(parsed.choices)) {
      parsed.choices.forEach(choice => {
        if (choice?.delta) {
          if ('reasoning_content' in choice.delta) {
            delete choice.delta.reasoning_content;
          }
          if ('reasoning_details' in choice.delta) {
            delete choice.delta.reasoning_details;
          }
          if (typeof choice.delta.content === 'string') {
            choice.delta.content = strip(choice.delta.content);
          }
        }
        if (choice?.message) {
          if ('reasoning_content' in choice.message) {
            delete choice.message.reasoning_content;
          }
          if ('reasoning_details' in choice.message) {
            delete choice.message.reasoning_details;
          }
          if (typeof choice.message.content === 'string') {
            choice.message.content = strip(choice.message.content);
          }
        }
      });
    }
    return JSON.stringify(parsed);
  };
};
