import { useCallback, type MutableRefObject } from 'react';
import {
    saveConversationToMemory,
    retrieveRelevantMemories,
    formatConversationToString,
    isMemuAvailable,
    type MemuConfig,
} from '../../services/memuService';
import type { Message } from '../../types';

/**
 * Hook for managing MemU memory operations
 * 用于管理 MemU 记忆操作的 Hook
 */
export const useMemoryManager = (
    memuConfigRef: MutableRefObject<MemuConfig>
) => {
    /**
     * Retrieve relevant memories for a query
     * 为查询检索相关的记忆
     */
    const retrieveMemories = useCallback(
        async (query: string): Promise<string[]> => {
            const activeMemuConfig = memuConfigRef.current;
            if (!isMemuAvailable(activeMemuConfig) || !query.trim()) {
                return [];
            }

            try {
                const memories = await retrieveRelevantMemories(
                    'default_user', // In a real app, this would be the actual user ID
                    query,
                    'flashchatx_agent', // Agent ID
                    activeMemuConfig
                );

                return memories.map(memory => memory.content);
            } catch (error) {
                console.error('Failed to retrieve memories:', error);
                return [];
            }
        },
        [memuConfigRef]
    );

    /**
     * Save conversation to memory
     * 将对话保存到记忆中
     */
    const saveToMemory = useCallback(
        async (messages: Message[]): Promise<void> => {
            const activeMemuConfig = memuConfigRef.current;
            if (!isMemuAvailable(activeMemuConfig) || !activeMemuConfig.autoSave) {
                return;
            }

            try {
                const conversationString = formatConversationToString(
                    messages.map(msg => ({
                        role: msg.role,
                        content: msg.content,
                    }))
                );

                await saveConversationToMemory(
                    conversationString,
                    'default_user', // In a real app, this would be the actual user ID
                    'User', // In a real app, this would be the actual user name
                    'flashchatx_agent', // Agent ID
                    'FlashChat X Assistant', // Agent name
                    activeMemuConfig
                );
            } catch (error) {
                console.error('Failed to save conversation to memory:', error);
            }
        },
        [memuConfigRef]
    );

    /**
     * Check if MemU is currently available
     * 检查 MemU 是否当前可用
     */
    const isMemuEnabled = useCallback((): boolean => {
        return isMemuAvailable(memuConfigRef.current);
    }, [memuConfigRef]);

    return { retrieveMemories, saveToMemory, isMemuEnabled };
};
