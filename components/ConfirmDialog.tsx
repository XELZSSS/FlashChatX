import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '../contexts/useTranslation';

interface ConfirmDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmText?: string;
  readonly cancelText?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly confirmButtonClass?: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  confirmButtonClass = 'bg-red-600 hover:bg-red-700 text-white',
}) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const modalTransitionMs = 160;
  const handleKeyDown = useCallback(
    (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel]
  );

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, isOpen]);

  useEffect(() => {
    if (isOpen) {
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
      openTimerRef.current = window.setTimeout(() => {
        setIsVisible(true);
        setIsClosing(false);
      }, 0);
      return () => {
        if (openTimerRef.current) {
          window.clearTimeout(openTimerRef.current);
          openTimerRef.current = null;
        }
      };
    }

    if (!isVisible) return;
    closeTimerRef.current = window.setTimeout(() => {
      setIsClosing(true);
    }, 0);
    hideTimerRef.current = window.setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
    }, modalTransitionMs);

    return () => {
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
  }, [isOpen, isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className="ConfirmDialog confirm-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onCancel}
      data-state={isClosing ? 'closing' : 'open'}
    >
      <div
        className="confirm-panel surface rounded-2xl max-w-md w-full shadow-soft p-6"
        onClick={e => e.stopPropagation()}
        data-state={isClosing ? 'closing' : 'open'}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-muted">{title}</h3>
          <button
            onClick={onCancel}
            className="p-1 rounded-full hover:bg-[var(--panel-strong)] text-subtle transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message */}
        <p className="text-sm text-subtle mb-6 leading-relaxed">{message}</p>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border surface text-text hover:bg-[var(--panel-strong)] transition-colors text-sm font-medium"
          >
            {cancelText || t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl transition-colors text-sm font-medium ${confirmButtonClass}`}
          >
            {confirmText || t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
