import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from '../../router/Router';
import {
  notificationsApi,
  type NotificationItem,
  type NotificationCategory,
  type NotificationType,
} from '../../api/notifications.api';
import {
  BellIcon,
  CheckSquareIcon,
  MessageSquareIcon,
  FileTextIcon,
  MailIcon,
  SettingsIcon,
  CheckIcon,
  TrashIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
  AtSignIcon,
  CalendarIcon,
} from '../../components/ui/Icons';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { Button } from '../../components/ui/Button';
import { NotificationsHeaderAtmosphere } from '../../components/common/HeaderAtmosphereArt';

export const NotificationsPage: React.FC = () => {
  const { navigate } = useRouter();
  const [activeTab, setActiveTab] = useState<NotificationCategory>('ALL');
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest' | 'unread'>('latest');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await notificationsApi.getNotifications({
        category: activeTab,
        page,
        limit: 25,
      });

      if (res.success && res.data) {
        setNotifications(res.data.notifications);
        setTotal(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
        setUnreadCount(res.data.pagination.unreadCount);

        // Auto mark all notifications as read upon opening the notifications page
        if (res.data.pagination.unreadCount > 0) {
          notificationsApi.markAllAsRead(activeTab).catch(() => {});
          setNotifications((prev) =>
            prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
          );
          setUnreadCount(0);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleTabChange = (category: NotificationCategory) => {
    setActiveTab(category);
    setPage(1);
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead(activeTab);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {}
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await notificationsApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch {}
  };

  const handleCardClick = async (notif: NotificationItem) => {
    if (!notif.readAt) {
      try {
        await notificationsApi.markAsRead(notif.id);
      } catch {}
    }
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
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getBadgeDetails = (type: NotificationType) => {
    switch (type) {
      case 'NOTE_TEAM_UPDATED':
      case 'NOTE_MENTIONED':
        return {
          icon: <FileTextIcon size={11} />,
          bg: '#FEF3C7',
          color: '#D97706',
          borderColor: '#FDE68A',
        };
      case 'WORK_ASSIGNED':
      case 'WORK_STATUS_CHANGED':
      case 'WORK_COMPLETED':
        return {
          icon: <CheckIcon size={11} />,
          bg: '#EFF6FF',
          color: '#2563EB',
          borderColor: '#DBEAFE',
        };
      case 'WORK_MENTIONED':
        return {
          icon: <AtSignIcon size={11} />,
          bg: '#FEE2E2',
          color: '#EF4444',
          borderColor: '#FECACA',
        };
      case 'WORK_COMMENTED':
        return {
          icon: <MessageSquareIcon size={11} />,
          bg: '#F0FDF4',
          color: '#16A34A',
          borderColor: '#DCFCE7',
        };
      case 'PROJECT_INVITED':
      case 'INVITATION_ACCEPTED':
      case 'INVITATION_DECLINED':
        return {
          icon: <MailIcon size={11} />,
          bg: '#DCFCE7',
          color: '#16A34A',
          borderColor: '#BBF7D0',
        };
      case 'CALENDAR_EVENT_CREATED':
      case 'CALENDAR_EVENT_UPDATED':
        return {
          icon: <CalendarIcon size={11} />,
          bg: '#EFF6FF',
          color: '#2563EB',
          borderColor: '#DBEAFE',
        };
      default:
        return {
          icon: <SettingsIcon size={11} />,
          bg: '#F1F5F9',
          color: '#475569',
          borderColor: '#E2E8F0',
        };
    }
  };

  const filterTabs: Array<{ id: NotificationCategory; label: string; icon?: React.ReactNode }> = [
    { id: 'ALL', label: 'All' },
    { id: 'MENTIONS', label: 'Mentions', icon: <AtSignIcon size={14} /> },
    { id: 'ASSIGNMENTS', label: 'Assignments', icon: <CheckSquareIcon size={14} /> },
    { id: 'COMMENTS', label: 'Comments', icon: <MessageSquareIcon size={14} /> },
    { id: 'INVITATIONS', label: 'Invitations', icon: <MailIcon size={14} /> },
    { id: 'EVENTS', label: 'Events', icon: <CalendarIcon size={14} /> },
    { id: 'SYSTEM', label: 'System', icon: <SettingsIcon size={14} /> },
  ];

  const displayedNotifications = useMemo(() => {
    let list = [...notifications];
    if (sortOrder === 'latest') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortOrder === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortOrder === 'unread') {
      list.sort((a, b) => {
        if (!a.readAt && b.readAt) return -1;
        if (a.readAt && !b.readAt) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    return list;
  }, [notifications, sortOrder]);

  return (
    <div className="cal-experience-root notifications-page-experience">
      {/* Top Floating Header Card */}
      <div className="cal-page-header notif-page-top-header">
        <div className="cal-header-left">
          <div className="cal-title-row">
            <span className="cal-header-icon-box notif-icon-box">
              <BellIcon size={24} />
            </span>
            <h1 className="cal-header-title">Notifications</h1>
          </div>
          <p className="cal-header-subtitle">
            Stay updated on assignments, mentions, comments, and project milestones.
          </p>
        </div>

        {/* Atmosphere Quote & Illustration Artwork */}
        <NotificationsHeaderAtmosphere />
      </div>

      {/* Main Section Card */}
      <div className="cal-card-primary notif-card-primary">
        {/* Toolbar Header Row: Filter Pills + Sort Dropdown */}
        <div className="notif-controls-toolbar">
          {/* Pill Tabs */}
          <div className="notif-filter-pills-wrap">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`notif-filter-pill ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Right Toolbar Actions */}
          <div className="notif-toolbar-right">
            {unreadCount > 0 && (
              <button
                type="button"
                className="notif-mark-read-pill"
                onClick={handleMarkAllAsRead}
                title="Mark all as read"
              >
                <CheckIcon size={13} />
                <span>Mark all read</span>
              </button>
            )}

            <CustomSelect
              value={sortOrder}
              onChange={(val) => setSortOrder(val as any)}
              compact
              fullWidth={false}
              options={[
                { value: 'latest', label: 'Latest First' },
                { value: 'oldest', label: 'Oldest First' },
                { value: 'unread', label: 'Unread First' },
              ]}
            />
          </div>
        </div>

        {/* Notification Items List */}
        {loading ? (
          <div className="notif-page-loading">
            <div className="btn-spinner" />
            <p>Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="notif-page-error">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={fetchNotifications}>
              Retry
            </Button>
          </div>
        ) : displayedNotifications.length === 0 ? (
          <div className="notif-page-empty">
            <div className="notif-empty-illustration-box">
              <BellIcon size={32} />
            </div>
            <h3 className="notif-empty-headline">You're all caught up</h3>
            <p className="notif-empty-desc">
              No notifications match this category at the moment.
            </p>
          </div>
        ) : (
          <div className="notif-page-list">
            {displayedNotifications.map((notif) => {
              const badge = getBadgeDetails(notif.type);
              const actorName = notif.actor?.fullName || notif.actor?.username || 'System';
              const actorInitial = actorName.trim()[0].toUpperCase();

              return (
                <div
                  key={notif.id}
                  className="notif-card-item"
                  onClick={() => handleCardClick(notif)}
                >
                  {/* Left Column: Avatar & Overlapping Badge */}
                  <div className="notif-card-avatar-wrapper">
                    {notif.actor?.avatarUrl ? (
                      <img
                        src={notif.actor.avatarUrl}
                        alt={actorName}
                        className="notif-card-avatar-img"
                      />
                    ) : (
                      <div className="notif-card-avatar-fallback">{actorInitial}</div>
                    )}

                    {/* Category Icon Badge */}
                    <div
                      className="notif-card-badge-circle"
                      style={{
                        backgroundColor: badge.bg,
                        color: badge.color,
                        borderColor: badge.borderColor,
                      }}
                      title={notif.type}
                    >
                      {badge.icon}
                    </div>
                  </div>

                  {/* Center Column: Title, Message & Tag Pills */}
                  <div className="notif-card-body">
                    <h3 className="notif-card-title">{notif.title}</h3>
                    <p className="notif-card-message">{notif.message}</p>

                    {/* Metadata Tags Row */}
                    <div className="notif-card-tags-row">
                      {notif.project && (
                        <span className="notif-pill-tag notif-pill-project">
                          {notif.project.name} {notif.project.key ? `(${notif.project.key})` : ''}
                        </span>
                      )}
                      {notif.workItem && (
                        <span className="notif-pill-tag notif-pill-work">
                          <CheckSquareIcon size={12} />
                          <span>{notif.workItem.title}</span>
                        </span>
                      )}
                      {notif.note && (
                        <span className="notif-pill-tag notif-pill-note">
                          <FileTextIcon size={12} />
                          <span>{notif.note.title}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Time & Quick Actions */}
                  <div className="notif-card-actions-col">
                    <span className="notif-card-time">{formatRelativeTime(notif.createdAt)}</span>

                    <div className="notif-action-btns-group" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="notif-icon-action-btn notif-btn-delete"
                        title="Delete notification"
                        onClick={(e) => handleDeleteNotification(e, notif.id)}
                      >
                        <TrashIcon size={16} />
                      </button>

                      <button
                        type="button"
                        className="notif-icon-action-btn notif-btn-open"
                        title="Open resource"
                        onClick={() => handleCardClick(notif)}
                      >
                        <ExternalLinkIcon size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer if needed */}
        {totalPages > 1 && (
          <div className="notif-pagination-footer">
            <span className="notif-pagination-info">
              Showing Page {page} of {totalPages} ({total} total)
            </span>
            <div className="notif-pagination-controls">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                leftIcon={<ArrowLeftIcon size={14} />}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                rightIcon={<ArrowRightIcon size={14} />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
