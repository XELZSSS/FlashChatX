import { getLastUserQueryText } from './messages.js';

export const getToolChoiceMode = toolChoice => {
  if (!toolChoice) return null;
  if (typeof toolChoice === 'string') {
    if (toolChoice === 'none') return 'none';
    if (toolChoice === 'auto') return 'auto';
    if (toolChoice === 'required') return 'required';
    return 'unknown';
  }
  if (typeof toolChoice === 'object') {
    const type = toolChoice.type;
    if (type === 'none') return 'none';
    if (type === 'auto') return 'auto';
    if (type === 'any') return 'required';
    if (type === 'tool' || type === 'function') return 'specific';
  }
  return 'unknown';
};

export const hasSystemTimeTool = tools => {
  if (!Array.isArray(tools) || tools.length === 0) return null;
  return tools.some(tool => tool?.function?.name === 'get_system_time');
};

export const shouldTriggerSystemTimeTool = payload => {
  if (!payload) return false;
  const toolChoiceMode = getToolChoiceMode(payload.tool_choice);
  if (toolChoiceMode === 'none' || toolChoiceMode === 'specific') {
    return false;
  }
  if (
    toolChoiceMode &&
    toolChoiceMode !== 'auto' &&
    toolChoiceMode !== 'required'
  ) {
    return false;
  }
  if (Array.isArray(payload.allowed_tools) && payload.allowed_tools.length) {
    if (!payload.allowed_tools.includes('get_system_time')) return false;
  }
  const toolPresence = hasSystemTimeTool(payload.tools);
  if (toolPresence === false) return false;
  const text = getLastUserQueryText(payload.messages || []);
  if (!text) return false;
  const normalized = text.toLowerCase();
  const hasChinese = /[\u4e00-\u9fa5]/.test(text);
  const excludes = [
    '时间复杂度',
    '时间管理',
    '时间轴',
    'timeline',
    'complexity',
    'time complexity',
  ];
  if (excludes.some(term => normalized.includes(term))) return false;

  if (hasChinese) {
    const cnCore = [
      '时间',
      '日期',
      '星期',
      '几号',
      '几点',
      '多少点',
      '几点钟',
      '现在几点',
      '当前几点',
      '今天几号',
      '今天是几号',
      '今天几月几号',
      '现在几号',
      '现在几月几号',
      '几月几号',
      '今天日期',
      '现在日期',
      '星期几',
      '礼拜几',
      '周几',
      '周几号',
      '今天周几',
      '现在周几',
      '几时',
      '多晚了',
    ];
    const cnQuery = [
      '现在',
      '当前',
      '今天',
      '此刻',
      '几',
      '多少',
      '吗',
      '呢',
      '？',
      '?',
    ];
    const hasCore = cnCore.some(term => text.includes(term));
    const hasQuery = cnQuery.some(term => text.includes(term));
    return hasCore && hasQuery;
  }

  const enCore = [
    'time',
    'date',
    'day',
    'weekday',
    'what time',
    'current time',
    'time is it',
    'today',
    'what date',
    'what day',
    "what's the date",
    "what's the time",
    'what time now',
    'what day is it',
    "today's date",
    'current date',
  ];
  const enQuery = ['what', 'now', 'current', 'today', 'date', 'day', '?'];
  const hasCore = enCore.some(term => normalized.includes(term));
  const hasQuery = enQuery.some(term => normalized.includes(term));
  return hasCore && hasQuery;
};

export const buildSystemTimeResult = args => {
  const now = new Date();
  const format = args?.format;
  const timeZone =
    Intl.DateTimeFormat?.().resolvedOptions?.().timeZone || 'local';
  const payload = {
    local: now.toLocaleString(),
    weekday: now.toLocaleDateString(undefined, { weekday: 'long' }),
    date: now.toLocaleDateString(),
    timeZone,
    timestamp: now.getTime(),
  };
  return JSON.stringify(format === 'iso' ? payload : payload);
};

export const mergeTools = (tools, toolToAdd) => {
  const list = Array.isArray(tools) ? [...tools] : [];
  const exists = list.some(
    tool => tool?.function?.name === toolToAdd.function.name
  );
  if (!exists) {
    list.push(toolToAdd);
  }
  return list;
};
