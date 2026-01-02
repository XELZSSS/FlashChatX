/**
 * Error message translations
 * 错误消息翻译
 */
export const errors = {
    English: {
        errorResponse:
            '\n\n*Error: Unable to generate response. Please try again.*',
        errorTitle: 'Error',
        errorDetails: 'Details:',
        errorHints: 'Common fixes:',
        errorUnknown: 'Unknown error.',
        errorMissingApiKey: 'Missing API key. Check the provider settings.',
        errorUnauthorized: 'Unauthorized (401). Verify your API key.',
        errorForbidden: 'Forbidden (403). Check API permissions or plan.',
        errorRateLimit: 'Rate limited (429). Slow down or try again later.',
        errorTimeout: 'Request timed out. Retry or check network.',
        errorNetwork: 'Network error. Check proxy or connectivity.',
        errorModelNotFound: 'Model not found. Check model name.',
        errorInvalidApiUrl: 'Invalid API URL. Check the provider API URL.',
        errorServer: 'Server error (5xx). Try again later.',
    },
    简体中文: {
        errorResponse: '\n\n*错误：无法生成回复。请重试。*',
        errorTitle: '错误',
        errorDetails: '详情：',
        errorHints: '常见处理方式：',
        errorUnknown: '未知错误。',
        errorMissingApiKey: '缺少 API 密钥，请检查供应商设置。',
        errorUnauthorized: '未授权（401），请检查 API 密钥。',
        errorForbidden: '无权限（403），请检查权限或套餐。',
        errorRateLimit: '触发限流（429），请稍后再试。',
        errorTimeout: '请求超时，请重试或检查网络。',
        errorNetwork: '网络错误，请检查代理或网络连接。',
        errorModelNotFound: '模型不存在，请检查模型名称。',
        errorInvalidApiUrl: 'API 地址无效，请检查供应商 API 地址。',
        errorServer: '服务器错误（5xx），请稍后再试。',
    },
};
