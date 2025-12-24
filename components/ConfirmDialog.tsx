import React, { useCallback, useEffect } from 'react';
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

  if (!isOpen) return null;

  return (
    <div
      className="ConfirmDialog fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="surface rounded-2xl max-w-md w-full shadow-soft p-6"
        onClick={e => e.stopPropagation()}
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
