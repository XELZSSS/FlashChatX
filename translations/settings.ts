/**
 * Settings panel translations
 * 设置面板翻译
 */
export const settings = {
    English: {
        // Tabs
        general: 'General',
        profile: 'Personal',
        data: 'Calculator',
        about: 'About',
        // Theme
        theme: 'Theme',
        light: 'Light',
        dark: 'Dark',
        system: 'System',
        language: 'Language',
        // Provider
        providerSettings: 'Provider',
        provider: 'Provider',
        apiKey: 'API Key',
        modelName: 'Model name',
        temperature: 'Diversity (temperature)',
        advancedParams: 'Advanced parameters',
        advancedParamsHint: 'Show top_p/top_k for compatible providers',
        topP: 'top_p',
        topK: 'top_k',
        thinkingBudget: 'Thinking budget (tokens)',
        thinkingBudgetPlaceholder: 'Auto (from thinking level)',
        thinkingBudgetHint:
            'This is an experimental feature; some providers may be incompatible. Use at your own discretion',
        apiUrl: 'API URL',
        apiUrlPlaceholder: 'https://api.example.com/v1',
        streaming: 'Streaming output',
        streamingDescription:
            'Stream responses token by token (disable for full replies only)',
        streamingHint:
            'Get the API URL and API key from the corresponding supplier platform in the About tab',
        clearApiKey: 'Clear API Key',
        confirmClearApiKey: 'Are you sure you want to clear the API key?',
        confirmResetProvider:
            'Are you sure you want to reset all provider settings? This will clear your API keys and model configurations.',
        autoModelSwitch:
            'This provider supports automatic switching between thinking and non-thinking models',
        // Thinking
        thinking: 'Thinking',
        showThinking: 'Show thinking',
        hideThinking: 'Hide thinking',
        thinkingLevel: 'Thinking level',
        thinkingLow: 'Low',
        thinkingMedium: 'Medium',
        thinkingHigh: 'High',
        thinkingProcess: 'Thinking Process',
        finalAnswer: 'Final Answer',
        // Search
        search: 'Web',
    },
    简体中文: {
        // Tabs
        general: '通用',
        profile: '个人',
        data: '计算器',
        about: '关于',
        // Theme
        theme: '主题',
        light: '亮色',
        dark: '暗色',
        system: '跟随系统',
        language: '语言',
        // Provider
        providerSettings: '供应商',
        provider: '供应商',
        apiKey: 'API 密钥',
        modelName: '模型名称',
        temperature: '多样性（温度）',
        advancedParams: '高级参数',
        advancedParamsHint: '兼容供应商可配置 top_p/top_k',
        topP: 'top_p',
        topK: 'top_k',
        thinkingBudget: '思考预算（tokens）',
        thinkingBudgetPlaceholder: '自动（跟随思考程度）',
        thinkingBudgetHint:
            '该功能属于实验性功能，部分供应商可能不兼容，自行考虑是否使用',
        apiUrl: 'API 地址',
        apiUrlPlaceholder: 'https://api.example.com/v1',
        streaming: '流式输出',
        streamingDescription: '开启后实时返回内容，关闭则等待完整回答',
        streamingHint: 'API地址和API密钥自行点开关于界面对应的供应商平台获取',
        clearApiKey: '清空API密钥',
        confirmClearApiKey: '确定要清空API密钥吗？',
        confirmResetProvider:
            '确定要重置所有供应商设置吗？这将清除您的API密钥和模型配置。',
        autoModelSwitch: '该供应商支持自动切换思考模型和非思考模型',
        // Thinking
        thinking: '思考',
        showThinking: '显示思考过程',
        hideThinking: '隐藏思考过程',
        thinkingLevel: '思考程度',
        thinkingLow: '低',
        thinkingMedium: '中',
        thinkingHigh: '高',
        thinkingProcess: '思考过程',
        finalAnswer: '最终回答',
        // Search
        search: '联网',
    },
};
