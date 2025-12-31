import React, { memo, forwardRef } from 'react';
import { MessageSquarePlus, Trash, Edit3, Pin, PinOff } from 'lucide-react';
import { ChatSession } from '../../types';
import { useTranslation } from '../../contexts/useTranslation';

interface SessionMenuProps {
  readonly session: ChatSession;
  readonly exportPickerId: string | null;
  readonly onPinChat: (id: string) => void;
  readonly onUnpinChat: (id: string) => void;
  readonly onOpenRenameDialog: (id: string, currentTitle: string) => void;
  readonly onExportChat: (
    id: string,
    format: 'json' | 'markdown' | 'text'
  ) => void;
  readonly onDeleteChat: (id: string) => void;
  readonly onMenuAction: (e: React.MouseEvent, action: () => void) => void;
  readonly onExportToggle: (e: React.MouseEvent, sessionId: string) => void;
}

const SessionMenu = memo(
  forwardRef<HTMLDivElement, SessionMenuProps>(
    (
      {
        session,
        exportPickerId,
        onPinChat,
        onUnpinChat,
        onOpenRenameDialog,
        onExportChat,
        onDeleteChat,
        onMenuAction,
        onExportToggle,
      },
      ref
    ) => {
      const { t } = useTranslation();
      const pinned = session.isPinned;

      return (
        <div
          ref={ref}
          className="sidebar-menu absolute right-0 top-8 bg-[var(--panel)] border border-[var(--border)] rounded-lg shadow-lg py-1 z-50 w-32"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={e =>
              onMenuAction(e, () =>
                pinned ? onUnpinChat(session.id) : onPinChat(session.id)
              )
            }
            className="pin-menu-btn flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text)] hover:bg-transparent transition-colors"
          >
            {pinned ? (
              <PinOff className="w-3.5 h-3.5" />
            ) : (
              <Pin className="w-3.5 h-3.5" />
            )}
            {pinned ? t('unpin') : t('pin')}
          </button>
          <button
            onClick={e =>
              onMenuAction(e, () =>
                onOpenRenameDialog(session.id, session.title)
              )
            }
            className="rename-menu-btn flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text)] hover:bg-transparent transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            {t('rename')}
          </button>
          <button
            onClick={e => onExportToggle(e, session.id)}
            className="export-menu-btn flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text)] hover:bg-transparent transition-colors"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            {t('exportChat')}
          </button>
          {exportPickerId === session.id && (
            <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] p-2">
              <div className="text-xs text-[var(--subtle)] mb-2">
                {t('exportFormat')}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={e =>
                    onMenuAction(e, () => onExportChat(session.id, 'json'))
                  }
                  className="rounded-md px-2 py-1 text-sm text-[var(--text)] hover:bg-[var(--panel)]"
                >
                  JSON
                </button>
                <button
                  onClick={e =>
                    onMenuAction(e, () => onExportChat(session.id, 'markdown'))
                  }
                  className="rounded-md px-2 py-1 text-sm text-[var(--text)] hover:bg-[var(--panel)]"
                >
                  Markdown
                </button>
                <button
                  onClick={e =>
                    onMenuAction(e, () => onExportChat(session.id, 'text'))
                  }
                  className="rounded-md px-2 py-1 text-sm text-[var(--text)] hover:bg-[var(--panel)]"
                >
                  TXT
                </button>
              </div>
            </div>
          )}
          <button
            onClick={e => onMenuAction(e, () => onDeleteChat(session.id))}
            className="delete-menu-btn flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text)] hover:bg-transparent transition-colors"
          >
            <Trash className="w-3.5 h-3.5" />
            {t('delete')}
          </button>
        </div>
      );
    }
  )
);

SessionMenu.displayName = 'SessionMenu';

export default SessionMenu;
