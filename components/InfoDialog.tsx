import React, { useEffect, useCallback, useRef, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../contexts/useTranslation';

interface InfoDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

const InfoDialog: React.FC<InfoDialogProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const modalTransitionMs = 160;
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
      className="InfoDialog info-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={handleClose}
      data-state={isClosing ? 'closing' : 'open'}
    >
      <div
        className="info-panel rounded-2xl max-w-md w-full p-6 border-0"
        style={{
          background: 'var(--panel)',
          color: 'var(--text)',
          boxShadow: 'none',
        }}
        onClick={e => e.stopPropagation()}
        data-state={isClosing ? 'closing' : 'open'}
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
