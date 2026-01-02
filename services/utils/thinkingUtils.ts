/**
 * Thinking-related utility functions for AI providers
 * AI 供应商的思考相关工具函数
 */
import { ThinkingLevel } from '../../types';
import { THINKING_BUDGETS } from '../../constants';

/**
 * Budget to effort mapping for OpenAI reasoning
 */
const OPENAI_BUDGET_TO_EFFORT = [
    { max: 1024, effort: 'low' as ThinkingLevel },
    { max: 4096, effort: 'medium' as ThinkingLevel },
];

/**
 * Build thinking toggle options
 * 构建思考开关选项
 */
export const buildThinkingToggle = (useThinking: boolean) => {
    const type: 'enabled' | 'disabled' = useThinking ? 'enabled' : 'disabled';
    return { thinking: { type } };
};

/**
 * Resolve thinking level with fallback to medium
 * 解析思考级别，默认为 medium
 */
export const resolveThinkingLevel = (
    thinkingLevel?: ThinkingLevel
): ThinkingLevel => thinkingLevel || 'medium';

/**
 * Resolve thinking budget from level or custom value
 * 从级别或自定义值解析思考预算
 */
export const resolveThinkingBudget = (
    thinkingLevel?: ThinkingLevel,
    customBudget?: number
): number => {
    if (typeof customBudget === 'number' && Number.isFinite(customBudget)) {
        return customBudget;
    }
    return THINKING_BUDGETS[resolveThinkingLevel(thinkingLevel)];
};

/**
 * Get thinking budget for a level
 * 获取指定级别的思考预算
 */
export const getThinkingBudget = (thinkingLevel?: ThinkingLevel): number =>
    THINKING_BUDGETS[resolveThinkingLevel(thinkingLevel)];

/**
 * Resolve OpenAI reasoning effort from thinking level or budget
 * 从思考级别或预算解析 OpenAI 推理努力程度
 */
export const resolveOpenAIReasoningEffort = (
    thinkingLevel?: ThinkingLevel,
    customBudget?: number
): ThinkingLevel => {
    if (typeof customBudget === 'number' && Number.isFinite(customBudget)) {
        for (const rule of OPENAI_BUDGET_TO_EFFORT) {
            if (customBudget <= rule.max) {
                return rule.effort;
            }
        }
        return 'high';
    }
    return resolveThinkingLevel(thinkingLevel);
};

/**
 * Build thinking budget toggle options
 * 构建带预算的思考开关选项
 */
export const buildThinkingBudgetToggle = (
    useThinking: boolean,
    thinkingLevel?: ThinkingLevel,
    customBudget?: number
) => {
    const type: 'enabled' | 'disabled' = useThinking ? 'enabled' : 'disabled';
    if (!useThinking) {
        return { thinking: { type } };
    }
    return {
        thinking: {
            type,
            budget_tokens: resolveThinkingBudget(thinkingLevel, customBudget),
        },
    };
};
