import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from '../../router/Router';
import { notificationsApi, type NotificationItem } from '../../api/notifications.api';
import {
  BellIcon,
  CheckSquareIcon,
  MessageSquareIcon,
  FileTextIcon,
  CalendarIcon,
  UsersIcon,
  CloseIcon,
  MoreHorizontalIcon,
} from '../ui/Icons';

interface NotificationDropdownProps {
  unreadCount: number;
  onUnreadCountChange: (count: number) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  unreadCount,
  onUnreadCountChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { navigate } = useRouter();

  // Load preview notifications when dropdown opens
  const loadRecentNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.getNotifications({ page: 1, limit: 8 });
      if (res.success && res.data) {
        setNotifications(res.data.notifications);
        if (res.data.pagination.unreadCount > 0) {
          notificationsApi.markAllAsRead().catch(() => {});
          onUnreadCountChange(0);
          setNotifications((prev) =>
            prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
          );
        } else {
          onUnreadCountChange(0);
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  const toggleDropdown = () => {
    if (!isOpen) {
      loadRecentNotifications();
    }
    setIsOpen(!isOpen);
  };

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.readAt) {
      try {
        await notificationsApi.markAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, readAt: new Date().toISOString() } : n))
        );
        onUnreadCountChange(Math.max(0, unreadCount - 1));
      } catch {}
    }
    setIsOpen(false);
    navigate(notif.link);
  };

  const formatRelativeTime = (isoString: string) => {
    const now = new Date();
    const date = new Date(isoString);
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getNotificationTypeBadge = (type: string) => {
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'NOTE_MENTIONED':
      case 'NOTE_TEAM_UPDATED':
      case 'NOTE_CREATED':
      case 'NEW_NOTE':
        return (
          <div className="notif-mini-badge notif-badge-note" title="Note">
            <FileTextIcon size={10} />
          </div>
        );
      case 'WORK_COMMENTED':
      case 'COMMENT':
        return (
          <div className="notif-mini-badge notif-badge-comment" title="Comment">
            <MessageSquareIcon size={10} />
          </div>
        );
      case 'MEMBER_ADDED':
      case 'PROJECT_INVITED':
      case 'INVITATION_ACCEPTED':
      case 'TEAM_MEMBER_ADDED':
        return (
          <div className="notif-mini-badge notif-badge-member" title="Team Member">
            <UsersIcon size={10} />
          </div>
        );
      case 'CALENDAR_EVENT_CREATED':
      case 'DEADLINE_SOON':
      case 'DEADLINE_OVERDUE':
        return (
          <div className="notif-mini-badge notif-badge-calendar" title="Calendar">
            <CalendarIcon size={10} />
          </div>
        );
      case 'WORK_ASSIGNED':
      case 'WORK_STATUS_CHANGED':
      case 'WORK_COMPLETED':
        return (
          <div className="notif-mini-badge notif-badge-work" title="Work item">
            <CheckSquareIcon size={10} />
          </div>
        );
      case 'PROJECT_CREATED':
      case 'WORKSPACE_READY':
      default:
        return (
          <div className="notif-mini-badge notif-badge-bell" title="Notification">
            <BellIcon size={10} />
          </div>
        );
    }
  };

  const getProjectKey = (notif: NotificationItem) => {
    if (notif.project?.key) return notif.project.key;
    if ((notif as any)?.metadata?.projectKey) return (notif as any).metadata.projectKey;
    // Extract key from message e.g. "klxwnqklxk" (KL) or (TES)
    const parenMatch = notif.message.match(/\(([A-Z0-9_-]{2,10})\)/);
    if (parenMatch) return parenMatch[1];
    if (notif.project?.name) {
      return notif.project.name.substring(0, 3).toUpperCase();
    }
    return null;
  };

  return (
    <div className="notif-dropdown-wrapper" ref={dropdownRef}>
      {/* Navbar Bell Button */}
      <button
        type="button"
        className={`workspace-bell-btn ${isOpen ? 'active' : ''}`}
        title="Notifications"
        onClick={toggleDropdown}
        aria-label="Open notifications dropdown"
      >
        <BellIcon size={18} />
        {unreadCount > 0 && <span className="bell-red-dot" />}
      </button>

      {isOpen && (
        <div className="notif-dropdown-card">
          {/* Beak / Caret pointing to the bell button */}
          <div className="notif-dropdown-caret" aria-hidden="true" />

          {/* Header */}
          <div className="notif-dropdown-header">
            <div className="notif-header-title-box">
              <div className="notif-header-icon-squircle">
                <BellIcon size={20} />
              </div>
              <div>
                <h3 className="notif-dropdown-title">Notifications</h3>
                <p className="notif-dropdown-subtitle">
                  Stay updated on your project activities.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="notif-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close notifications"
            >
              <CloseIcon size={16} />
            </button>
          </div>

          {/* Body List */}
          <div className="notif-dropdown-body">
            {loading ? (
              <div className="notif-dropdown-loading">
                <div className="spinner-dots" />
                <span>Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notif-dropdown-empty">
                <div className="notif-empty-icon">🔔</div>
                <p className="notif-empty-title">All caught up</p>
                <p className="notif-empty-subtitle">No notifications right now.</p>
              </div>
            ) : (
              <div className="notif-items-list">
                {notifications.map((notif) => {
                  const isUnread = !notif.readAt;
                  const projectKey = getProjectKey(notif);

                  return (
                    <div
                      key={notif.id}
                      className={`notif-dropdown-item ${isUnread ? 'is-unread' : ''}`}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      {/* Avatar with Overlay Mini Badge */}
                      <div className="notif-actor-avatar-container">
                        {notif.actor?.avatarUrl ? (
                          <img
                            src={notif.actor.avatarUrl}
                            alt={notif.actor.fullName || notif.actor.username}
                            className="notif-avatar-img"
                          />
                        ) : (
                          <div className="notif-avatar-fallback">
                            {(
                              notif.actor?.fullName ||
                              notif.actor?.username ||
                              notif.title[0] ||
                              'D'
                            )[0].toUpperCase()}
                          </div>
                        )}
                        {getNotificationTypeBadge(notif.type)}
                      </div>

                      {/* Content Area */}
                      <div className="notif-content-area">
                        <h4 className="notif-title">{notif.title}</h4>
                        <p className="notif-message-text">{notif.message}</p>
                        {projectKey && (
                          <span className="notif-project-tag">{projectKey}</span>
                        )}
                      </div>

                      {/* Right Meta Column */}
                      <div className="notif-meta-col">
                        <span className="notif-time">{formatRelativeTime(notif.createdAt)}</span>
                        <button
                          type="button"
                          className="notif-more-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          title="More options"
                        >
                          <MoreHorizontalIcon size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="notif-dropdown-footer">
            <button
              type="button"
              className="notif-view-all-link"
              onClick={() => {
                setIsOpen(false);
                navigate('/app/notifications');
              }}
            >
              <span>View all notifications →</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default NotificationDropdown;
