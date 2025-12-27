import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Settings,
  PanelLeftClose,
  PanelLeft,
  MessageSquarePlus,
  Trash,
  MoreHorizontal,
  Edit3,
  Pin,
  PinOff,
} from 'lucide-react';
import { ChatSession } from '../types';
import { useTranslation } from '../contexts/useTranslation';

interface SidebarProps {
  readonly isOpen: boolean;
  readonly toggleSidebar: () => void;
  readonly sessions: ChatSession[];
  readonly currentSessionId: string | null;
  readonly searchQuery: string;
  readonly onSearchQueryChange: (value: string) => void;
  readonly onNewChat: () => void;
  readonly onSelectChat: (id: string) => void;
  readonly onDeleteChat: (id: string) => void;
  readonly onClearAllChats: () => void;
  readonly onOpenSettings: () => void;
  readonly onRenameChat: (id: string, newTitle: string) => void;
  readonly onOpenRenameDialog: (id: string, currentTitle: string) => void;
  readonly onPinChat: (id: string) => void;
  readonly onUnpinChat: (id: string) => void;
  readonly onExportChat: (
    id: string,
    format: 'json' | 'markdown' | 'text'
  ) => void;
  readonly onImportChats: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  toggleSidebar,
  sessions,
  currentSessionId,
  searchQuery,
  onSearchQueryChange,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onClearAllChats,
  onOpenSettings,
  onOpenRenameDialog,
  onPinChat,
  onUnpinChat,
  onExportChat,
  onImportChats,
}) => {
  const { t } = useTranslation();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [exportPickerId, setExportPickerId] = useState<string | null>(null);
  const [showMini, setShowMini] = useState<boolean>(!isOpen);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasSearchFilter = searchQuery.trim().length > 0;
  const appIconSrc = `${import.meta.env.BASE_URL}XD.svg`;

  const closeMenu = useCallback(() => {
    setOpenMenuId(null);
    setExportPickerId(null);
  }, []);

  const sidebarTransitionMs = 300;
  const miniTransitionMs = 200;

  useEffect(() => {
    if (isOpen) {
      const handle = window.setTimeout(() => {
        setShowMini(false);
      }, 0);
      return () => window.clearTimeout(handle);
    }

    const handle = window.setTimeout(
      () => {
        setShowMini(true);
      },
      Math.max(0, sidebarTransitionMs - 60)
    );

    return () => window.clearTimeout(handle);
  }, [isOpen]);

  const handleSelectChat = useCallback(
    (id: string) => {
      onSelectChat(id);
      // Close sidebar on mobile after selection
      if (window.innerWidth < 768) {
        toggleSidebar();
      }
    },
    [onSelectChat, toggleSidebar]
  );

  // Close menu when clicking outside
  useEffect(() => {
    if (!openMenuId) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [closeMenu, openMenuId]);

  const handleMenuToggle = useCallback(
    (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      setOpenMenuId(prev => (prev === sessionId ? null : sessionId));
      setExportPickerId(null);
    },
    []
  );

  const handleMenuAction = useCallback(
    (e: React.MouseEvent, action: () => void) => {
      e.stopPropagation();
      closeMenu();
      action();
    },
    [closeMenu]
  );

  const handleExportToggle = useCallback(
    (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      setExportPickerId(prev => (prev === sessionId ? null : sessionId));
    },
    []
  );

  const shouldRenderMini = !isOpen || showMini;

  return (
    <>
      {/* Mobile mini sidebar when closed */}
      {shouldRenderMini && (
        <div
          className={`absolute left-4 top-6 z-[60] transition-[opacity,transform] ease-in-out ${
            showMini ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
          }`}
          style={{
            transformOrigin: 'left top',
            transitionDuration: `${miniTransitionMs}ms`,
          }}
          aria-hidden={!showMini}
        >
          <div className="sidebar-mini flex items-center gap-1 p-1 rounded-full">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-full hover:bg-[var(--panel-strong)] text-[var(--subtle)] transition-colors"
              title={t('newChat')}
            >
              <PanelLeft className="w-5 h-5" />
            </button>
            <button
              onClick={onNewChat}
              className="p-2 rounded-full hover:bg-[var(--panel-strong)] text-[var(--subtle)] transition-colors"
              title={t('newChat')}
            >
              <MessageSquarePlus className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Sidebar Panel */}
      <div
        className={`relative flex-shrink-0 overflow-hidden transition-[width] duration-300 ${
          isOpen ? 'w-64' : 'w-0'
        }`}
      >
        <div
          className={`sidebar-panel flex h-full w-64 flex-col transition-transform duration-300 ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="flex flex-col items-center p-4 flex-shrink-0 relative">
            <div className="flex w-full items-center justify-center gap-2 text-text font-bold text-xl mb-3 -translate-x-3">
              <img
                src={appIconSrc}
                alt=""
                className="w-6 h-6"
                aria-hidden="true"
              />
              <span>FlashChat X</span>
            </div>
            <button
              onClick={toggleSidebar}
              className="sidebar-close-btn absolute top-4 right-4 p-1 rounded transition-colors"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          </div>

          {/* New Chat Button */}
          <div className="px-3 mb-2 flex-shrink-0">
            <button
              onClick={onNewChat}
              className="sidebar-newchat flex items-center justify-center gap-2 w-full py-2 px-4 rounded-full transition-colors text-sm font-medium"
            >
              {t('newChat')}
            </button>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            <div className="-mx-2 px-3 mb-3 space-y-2">
              <input
                value={searchQuery}
                onChange={event => onSearchQueryChange(event.target.value)}
                placeholder={t('chatSearchPlaceholder')}
                className="w-full rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-subtle focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-between px-3 mb-2 mt-2">
              <span className="text-xs font-medium text-[var(--subtle)]">
                {t('today')}
              </span>
              {sessions.length > 0 && (
                <button
                  onClick={onClearAllChats}
                  className="flex items-center gap-1 text-xs text-[var(--subtle)] hover:text-red-600 transition-colors"
                  title={t('clearAllChats')}
                >
                  <Trash className="w-3 h-3" />
                  {t('clearAll')}
                </button>
              )}
            </div>
            {sessions.length === 0 ? (
              <div className="px-3 text-[var(--subtle)] text-sm">
                {hasSearchFilter ? t('noSearchResults') : t('noChats')}
              </div>
            ) : (
              sessions.map(session => {
                const isActive = currentSessionId === session.id;
                const pinned = session.isPinned;

                return (
                  <div key={session.id} className="relative">
                    <div
                      className={`sidebar-item flex items-center p-2 rounded-lg cursor-pointer text-sm mb-1 transition-colors group ${
                        isActive
                          ? 'bg-[var(--accent-soft)] text-[var(--accent)] active'
                          : 'text-[var(--text)]'
                      }`}
                      onClick={() => handleSelectChat(session.id)}
                    >
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        {pinned && (
                          <Pin className="w-3.5 h-3.5 flex-shrink-0 text-[var(--accent)]" />
                        )}
                        <MessageSquare className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{session.title}</span>
                      </div>
                      <button
                        onClick={e => handleMenuToggle(e, session.id)}
                        className="sidebar-more-btn p-1 rounded hover:bg-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                        title={t('more')}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    {openMenuId === session.id && (
                      <div
                        ref={menuRef}
                        className="sidebar-menu absolute right-0 top-8 bg-[var(--panel)] border border-[var(--border)] rounded-lg shadow-lg py-1 z-50 w-32"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={e =>
                            handleMenuAction(e, () =>
                              pinned
                                ? onUnpinChat(session.id)
                                : onPinChat(session.id)
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
                            handleMenuAction(e, () =>
                              onOpenRenameDialog(session.id, session.title)
                            )
                          }
                          className="rename-menu-btn flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text)] hover:bg-transparent transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {t('rename')}
                        </button>
                        <button
                          onClick={e => handleExportToggle(e, session.id)}
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
                                  handleMenuAction(e, () =>
                                    onExportChat(session.id, 'json')
                                  )
                                }
                                className="rounded-md px-2 py-1 text-sm text-[var(--text)] hover:bg-[var(--panel)]"
                              >
                                JSON
                              </button>
                              <button
                                onClick={e =>
                                  handleMenuAction(e, () =>
                                    onExportChat(session.id, 'markdown')
                                  )
                                }
                                className="rounded-md px-2 py-1 text-sm text-[var(--text)] hover:bg-[var(--panel)]"
                              >
                                Markdown
                              </button>
                              <button
                                onClick={e =>
                                  handleMenuAction(e, () =>
                                    onExportChat(session.id, 'text')
                                  )
                                }
                                className="rounded-md px-2 py-1 text-sm text-[var(--text)] hover:bg-[var(--panel)]"
                              >
                                TXT
                              </button>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={e =>
                            handleMenuAction(e, () => onDeleteChat(session.id))
                          }
                          className="delete-menu-btn flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--text)] hover:bg-transparent transition-colors"
                        >
                          <Trash className="w-3.5 h-3.5" />
                          {t('delete')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Settings Footer */}
          <div className="p-3 flex-shrink-0">
            <button
              onClick={onImportChats}
              className="sidebar-footer flex items-center gap-3 w-full p-2 rounded-lg transition-colors mb-2"
            >
              <MessageSquarePlus className="w-5 h-5" />
              <span className="font-medium text-sm text-[var(--text)]">
                {t('importChats')}
              </span>
            </button>
            <button
              onClick={onOpenSettings}
              className="sidebar-footer flex items-center gap-3 w-full p-2 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
              <span className="font-medium text-sm text-[var(--text)]">
                {t('settings')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
