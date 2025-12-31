import React, { memo, useRef } from 'react';
import { MessageSquare, MoreHorizontal, Pin } from 'lucide-react';
import { ChatSession } from '../../types';
import { useTranslation } from '../../contexts/useTranslation';
import SessionMenu from './SessionMenu';

interface SessionItemProps {
  readonly session: ChatSession;
  readonly isActive: boolean;
  readonly openMenuId: string | null;
  readonly exportPickerId: string | null;
  readonly onSelectChat: (id: string) => void;
  readonly onMenuToggle: (e: React.MouseEvent, sessionId: string) => void;
  readonly onMenuAction: (e: React.MouseEvent, action: () => void) => void;
  readonly onExportToggle: (e: React.MouseEvent, sessionId: string) => void;
  readonly onPinChat: (id: string) => void;
  readonly onUnpinChat: (id: string) => void;
  readonly onOpenRenameDialog: (id: string, currentTitle: string) => void;
  readonly onExportChat: (
    id: string,
    format: 'json' | 'markdown' | 'text'
  ) => void;
  readonly onDeleteChat: (id: string) => void;
}

const SessionItem: React.FC<SessionItemProps> = memo(
  ({
    session,
    isActive,
    openMenuId,
    exportPickerId,
    onSelectChat,
    onMenuToggle,
    onMenuAction,
    onExportToggle,
    onPinChat,
    onUnpinChat,
    onOpenRenameDialog,
    onExportChat,
    onDeleteChat,
  }) => {
    const { t } = useTranslation();
    const menuRef = useRef<HTMLDivElement>(null);
    const pinned = session.isPinned;
    const isMenuOpen = openMenuId === session.id;

    return (
      <div className="relative">
        <div
          className={`sidebar-item flex items-center p-2 rounded-lg cursor-pointer text-sm mb-1 transition-colors group ${
            isActive
              ? 'bg-[var(--accent-soft)] text-[var(--accent)] active'
              : 'text-[var(--text)]'
          }`}
          onClick={() => onSelectChat(session.id)}
        >
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            {pinned && (
              <Pin className="w-3.5 h-3.5 flex-shrink-0 text-[var(--accent)]" />
            )}
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{session.title}</span>
          </div>
          <button
            onClick={e => onMenuToggle(e, session.id)}
            className="sidebar-more-btn p-1 rounded hover:bg-transparent opacity-0 group-hover:opacity-100 transition-opacity"
            title={t('more')}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {isMenuOpen && (
          <SessionMenu
            ref={menuRef}
            session={session}
            exportPickerId={exportPickerId}
            onPinChat={onPinChat}
            onUnpinChat={onUnpinChat}
            onOpenRenameDialog={onOpenRenameDialog}
            onExportChat={onExportChat}
            onDeleteChat={onDeleteChat}
            onMenuAction={onMenuAction}
            onExportToggle={onExportToggle}
          />
        )}
      </div>
    );
  }
);

SessionItem.displayName = 'SessionItem';

export default SessionItem;
