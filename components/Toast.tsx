import React, { memo } from 'react';

export interface ToastData {
  readonly message: string;
  readonly tone?: 'error' | 'success' | 'info';
}

interface ToastProps {
  readonly toast: ToastData;
}

/**
 * Toast notification component for displaying temporary messages
 * 用于显示临时消息的 Toast 通知组件
 */
const Toast: React.FC<ToastProps> = memo(({ toast }) => {
  return (
    <div className="fixed bottom-6 right-6 z-[70]">
      <div
        className={`surface rounded-xl px-4 py-3 text-sm shadow-soft border transition-all ${
          toast.tone === 'error'
            ? 'border-red-500/30 text-red-400'
            : 'border-[var(--border)] text-[var(--text)]'
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
});

Toast.displayName = 'Toast';

export default Toast;
