export const API_PROVIDERS = {
  openai: {
    keyEnvVar: 'OPENAI_API_KEY',
    modelEnvVar: 'OPENAI_MODEL',
    targetUrl: 'https://api.openai.com/v1/chat/completions',
    endpoint: '/api/openai',
  },
  xai: {
    keyEnvVar: 'XAI_API_KEY',
    modelEnvVar: 'XAI_MODEL',
    targetUrl: 'https://api.x.ai/v1/chat/completions',
    endpoint: '/api/xai',
  },
  z: {
    keyEnvVar: 'Z_API_KEY',
    modelEnvVar: 'Z_MODEL',
    targetUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    endpoint: '/api/z',
  },
  'z-intl': {
    keyEnvVar: 'Z_INTL_API_KEY',
    modelEnvVar: 'Z_INTL_MODEL',
    targetUrl: 'https://api.z.ai/api/paas/v4/chat/completions',
    endpoint: '/api/z-intl',
  },
  deepseek: {
    keyEnvVar: 'DEEPSEEK_API_KEY',
    modelEnvVar: 'DEEPSEEK_MODEL',
    targetUrl: 'https://api.deepseek.com/chat/completions',
    endpoint: '/api/deepseek',
  },
  'openai-compatible': {
    keyEnvVar: 'OPENAI_COMPATIBLE_API_KEY',
    modelEnvVar: 'OPENAI_COMPATIBLE_MODEL',
    urlEnvVar: 'OPENAI_COMPATIBLE_API_URL',
    targetUrl: 'https://api.openai.com/v1/chat/completions',
    endpoint: '/api/openai-compatible',
  },
  bailing: {
    keyEnvVar: 'BAILING_API_KEY',
    modelEnvVar: 'BAILING_MODEL',
    targetUrl: 'https://api.tbox.cn/api/llm/v1/chat/completions',
    endpoint: '/api/bailing',
  },
  longcat: {
    keyEnvVar: 'LONGCAT_API_KEY',
    modelEnvVar: 'LONGCAT_MODEL',
    targetUrl: 'https://api.longcat.chat/openai/v1/chat/completions',
    endpoint: '/api/longcat',
  },
  moonshot: {
    keyEnvVar: 'MOONSHOT_API_KEY',
    modelEnvVar: 'MOONSHOT_MODEL',
    targetUrl: 'https://api.moonshot.cn/v1/chat/completions',
    endpoint: '/api/moonshot',
  },
  minimax: {
    keyEnvVar: 'MINIMAX_API_KEY',
    modelEnvVar: 'MINIMAX_MODEL',
    targetUrl: 'https://api.minimax.chat/v1/chat/completions',
    endpoint: '/api/minimax',
  },
  gemini: {
    keyEnvVar: 'GEMINI_API_KEY',
    modelEnvVar: 'GEMINI_MODEL',
    targetUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    endpoint: '/api/gemini',
  },
  anthropic: {
    keyEnvVar: 'ANTHROPIC_API_KEY',
    modelEnvVar: 'ANTHROPIC_MODEL',
    targetUrl: 'https://api.anthropic.com/v1/messages',
    endpoint: '/api/anthropic',
  },
};

export const PATH_TO_PROVIDER = Object.entries(API_PROVIDERS).reduce(
  (acc, [provider, config]) => {
    acc[config.endpoint] = provider;
    return acc;
  },
  Object.create(null)
);

export const TIME_TOOL_PROVIDERS = new Set([
  'openai',
  'xai',
  'openai-compatible',
  'deepseek',
  'z',
  'z-intl',
  'minimax',
  'moonshot',
  'bailing',
  'longcat',
]);

export const SYSTEM_TIME_TOOL = {
  type: 'function',
  function: {
    name: 'get_system_time',
    description: 'Get the current system date and time from the server.',
    parameters: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          description: 'Optional format hint: "iso" or "local".',
        },
      },
    },
  },
};
