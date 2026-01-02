import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useTranslation } from '../contexts/useTranslation';
import { ANIMATION } from '../constants';

interface RenameDialogProps {
    readonly isOpen: boolean;
    readonly initialTitle: string;
    readonly onConfirm: (newTitle: string) => void;
    readonly onCancel: () => void;
}

/**
 * Dialog component for renaming chat sessions
 * 用于重命名聊天会话的对话框组件
 */
const RenameDialog: React.FC<RenameDialogProps> = memo(
    ({ isOpen, initialTitle, onConfirm, onCancel }) => {
        const { t } = useTranslation();
        const [newTitle, setNewTitle] = useState(initialTitle);
        const [visible, setVisible] = useState(false);
        const [closing, setClosing] = useState(false);

        const openTimerRef = useRef<number | null>(null);
        const closeTimerRef = useRef<number | null>(null);
        const hideTimerRef = useRef<number | null>(null);

        // Sync initial title when dialog opens
        useEffect(() => {
            if (isOpen) {
                setNewTitle(initialTitle);
            }
        }, [isOpen, initialTitle]);

        // Handle open/close animation
        useEffect(() => {
            const clearAllTimers = () => {
                if (openTimerRef.current) {
                    window.clearTimeout(openTimerRef.current);
                    openTimerRef.current = null;
                }
                if (closeTimerRef.current) {
                    window.clearTimeout(closeTimerRef.current);
                    closeTimerRef.current = null;
                }
                if (hideTimerRef.current) {
                    window.clearTimeout(hideTimerRef.current);
                    hideTimerRef.current = null;
                }
            };

            if (isOpen) {
                clearAllTimers();
                openTimerRef.current = window.setTimeout(() => {
                    setVisible(true);
                    setClosing(false);
                }, 0);
                return clearAllTimers;
            }

            if (!visible) return;

            closeTimerRef.current = window.setTimeout(() => {
                setClosing(true);
            }, 0);

            hideTimerRef.current = window.setTimeout(() => {
                setVisible(false);
                setClosing(false);
            }, ANIMATION.RENAME_DIALOG_DURATION_MS);

            return clearAllTimers;
        }, [isOpen, visible]);

        const handleInputChange = useCallback(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                setNewTitle(e.target.value);
            },
            []
        );

        const handleKeyDown = useCallback(
            (e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') {
                    onConfirm(newTitle);
                } else if (e.key === 'Escape') {
                    onCancel();
                }
            },
            [newTitle, onConfirm, onCancel]
        );

        const handleConfirm = useCallback(() => {
            onConfirm(newTitle);
        }, [newTitle, onConfirm]);

        if (!visible) {
            return null;
        }

        return (
            <div
                className="rename-backdrop fixed inset-0 z-50 flex items-center justify-center"
                data-state={closing ? 'closing' : 'open'}
            >
                <div
                    className="RenameDialog rename-panel surface rounded-lg p-4 w-full max-w-md mx-4"
                    data-state={closing ? 'closing' : 'open'}
                >
                    <h3 className="text-lg font-medium mb-3">{t('renameChatTitle')}</h3>
                    <input
                        type="text"
                        value={newTitle}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--panel)] text-[var(--text)] focus:outline-none"
                        placeholder={t('newChatName')}
                        autoFocus
                    />
                    <div className="flex justify-end gap-2 mt-4">
                        <button
                            onClick={onCancel}
                            className="px-3 py-1.5 text-sm bg-[var(--panel)] border border-[var(--border)] rounded-md text-[var(--text)] transition-colors"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-md transition-colors"
                        >
                            {t('save')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }
);

RenameDialog.displayName = 'RenameDialog';

export default RenameDialog;
