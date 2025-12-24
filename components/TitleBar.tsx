import React, { useEffect, useState } from 'react';
import { Minus, Square, X } from 'lucide-react';

const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  const hasElectronAPI = !!window.electronAPI;

  useEffect(() => {
    if (!hasElectronAPI) return;

    window.electronAPI
      ?.getWindowState?.()
      ?.then(state => {
        if (state?.isMaximized !== undefined) {
          setIsMaximized(state.isMaximized);
        }
      })
      .catch(() => {
        // Swallow errors in dev server where Electron isn't available.
      });

    const unsubscribe =
      window.electronAPI?.onWindowStateChange?.(state => {
        if (state?.isMaximized !== undefined) {
          setIsMaximized(state.isMaximized);
        }
      }) ?? null;

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [hasElectronAPI]);

  const handleMinimize = () => {
    window.electronAPI?.minimize?.();
  };

  const handleToggleMaximize = () => {
    window.electronAPI?.toggleMaximize?.();
  };

  const handleClose = () => {
    window.electronAPI?.close?.();
  };

  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      <div className="titlebar-controls" aria-hidden={!hasElectronAPI}>
        <button
          className="titlebar-btn"
          type="button"
          onClick={handleMinimize}
          disabled={!hasElectronAPI}
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          className="titlebar-btn"
          type="button"
          onClick={handleToggleMaximize}
          disabled={!hasElectronAPI}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          <Square size={14} />
        </button>
        <button
          className="titlebar-btn titlebar-btn-close"
          type="button"
          onClick={handleClose}
          disabled={!hasElectronAPI}
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
