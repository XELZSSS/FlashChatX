import React, { useEffect, useCallback } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../contexts/useTranslation';

interface InfoDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

const InfoDialog: React.FC<InfoDialogProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [handleClose, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="rounded-2xl max-w-md w-full p-6 border-0"
        style={{
          background: 'var(--panel)',
          color: 'var(--text)',
          boxShadow: 'none',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold text-muted">
              {t('projectInfo')}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="p-1 rounded-full hover:bg-[var(--panel-strong)] text-subtle transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message */}
        <p className="text-sm text-subtle mb-6 leading-relaxed">
          {t('projectDescription')}
        </p>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent)] text-white transition-colors text-sm font-medium"
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfoDialog;
