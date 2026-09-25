import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from '../../router/Router';
import { activityApi, type ActivityItem } from '../../api/activity.api';
import {
  ActivityIcon,
  CheckSquareIcon,
  MessageSquareIcon,
  UsersIcon,
  FolderIcon,
  FileTextIcon,
  CalendarIcon,
  SearchIcon,
  AlertCircleIcon,
} from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';

export const ActivityPage: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [category, setCategory] = useState<'all' | 'work' | 'comments' | 'members' | 'notes' | 'calendar' | 'files'>('all');
  const [dateRange, setDateRange] = useState<'7D' | '30D' | '90D' | 'ALL'>('30D');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await activityApi.getGlobalActivities({
        category,
        limit: 100,
      });
      if (res.success && res.data) {
        setActivities(res.data.activities);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load workspace activity');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Client-side date and search filtering
  const filteredActivities = useMemo(() => {
    let list = [...activities];

    // Date range filter
    if (dateRange !== 'ALL') {
      const now = Date.now();
      const days = dateRange === '7D' ? 7 : dateRange === '30D' ? 30 : 90;
      const cutoff = now - days * 24 * 60 * 60 * 1000;
      list = list.filter((act) => new Date(act.createdAt).getTime() >= cutoff);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((act) => {
        const actor = (act.actor?.fullName || act.actor?.username || '').toLowerCase();
        const workTitle = (act.workItem?.title || '').toLowerCase();
        const projName = (act.project?.name || '').toLowerCase();
        const preview = (act.metadata?.preview || act.metadata?.title || '').toLowerCase();
        return actor.includes(q) || workTitle.includes(q) || projName.includes(q) || preview.includes(q);
      });
    }

    return list;
  }, [activities, dateRange, searchQuery]);

  const formatRelativeTime = (iso: string): string => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderActivityText = (act: ActivityItem) => {
    const actorName = act.actor?.fullName || act.actor?.username || 'Team member';
    switch (act.type) {
      case 'PROJECT_CREATED':
        return (
          <>
            <strong>{actorName}</strong> created project{' '}
            <span className="font-semibold">{act.project?.name || 'workspace'}</span>
          </>
        );
      case 'WORK_CREATED':
        return (
          <>
            <strong>{actorName}</strong> created work item{' '}
            <span className="font-semibold">&ldquo;{act.workItem?.title || act.metadata?.title || 'task'}&rdquo;</span>
          </>
        );
      case 'WORK_STATUS_CHANGED':
        return (
          <>
            <strong>{actorName}</strong> changed status of{' '}
            <span className="font-semibold">&ldquo;{act.workItem?.title || 'task'}&rdquo;</span>
            {act.metadata?.toStatus ? ` to ${act.metadata.toStatus}` : ''}
          </>
        );
      case 'WORK_COMPLETED':
        return (
          <>
            <strong>{actorName}</strong> completed task{' '}
            <span className="font-semibold">&ldquo;{act.workItem?.title || 'task'}&rdquo;</span>
          </>
        );
      case 'COMMENT_ADDED':
        return (
          <>
            <strong>{actorName}</strong> commented on{' '}
            <span className="font-semibold">&ldquo;{act.workItem?.title || 'task'}&rdquo;</span>
          </>
        );
      case 'MEMBER_ADDED':
        return (
          <>
            <strong>{actorName}</strong> joined the project team
          </>
        );
      case 'NOTE_CREATED':
        return (
          <>
            <strong>{actorName}</strong> published a note{' '}
            <span className="font-semibold">&ldquo;{act.metadata?.title || 'documentation'}&rdquo;</span>
          </>
        );
      case 'CALENDAR_EVENT_CREATED':
        return (
          <>
            <strong>{actorName}</strong> scheduled a calendar event{' '}
            <span className="font-semibold">&ldquo;{act.metadata?.title || 'event'}&rdquo;</span>
          </>
        );
      case 'FILE_UPLOADED':
        return (
          <>
            <strong>{actorName}</strong> uploaded file{' '}
            <span className="font-semibold">&ldquo;{act.metadata?.name || 'attachment'}&rdquo;</span>
          </>
        );
      case 'FOLDER_CREATED':
        return (
          <>
            <strong>{actorName}</strong> created folder{' '}
            <span className="font-semibold">&ldquo;{act.metadata?.name || 'folder'}&rdquo;</span>
          </>
        );
      default:
        return (
          <>
            <strong>{actorName}</strong> updated workspace activity
          </>
        );
    }
  };

  const renderIcon = (type: string) => {
    if (type.includes('WORK') || type.includes('TASK')) return <CheckSquareIcon size={16} />;
    if (type.includes('COMMENT')) return <MessageSquareIcon size={16} />;
    if (type.includes('MEMBER')) return <UsersIcon size={16} />;
    if (type.includes('NOTE')) return <FileTextIcon size={16} />;
    if (type.includes('CALENDAR')) return <CalendarIcon size={16} />;
    if (type.includes('FILE') || type.includes('FOLDER')) return <FolderIcon size={16} />;
    return <ActivityIcon size={16} />;
  };

  return (
    <div className="activity-page-layout" style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1F2937' }}>
            <ActivityIcon size={18} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#111827' }}>Workspace Activity</h1>
        </div>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6B7280' }}>
          Real-time chronological stream of events across all projects you collaborate on.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: '#FFFFFF', padding: '12px 16px', borderRadius: '10px', border: '1px solid #E5E7EB', marginBottom: '1.5rem' }}>
        {/* Category Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'work', label: 'Tasks' },
              { id: 'comments', label: 'Comments' },
              { id: 'notes', label: 'Notes' },
              { id: 'calendar', label: 'Calendar' },
              { id: 'files', label: 'Files' },
              { id: 'members', label: 'Team' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setCategory(t.id)}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: category === t.id ? '#111827' : '#F3F4F6',
                color: category === t.id ? '#FFFFFF' : '#4B5563',
                transition: 'all 0.15s ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Date Range & Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: '8px', padding: '2px' }}>
            {(['7D', '30D', '90D', 'ALL'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDateRange(r)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: dateRange === r ? '#FFFFFF' : 'transparent',
                  color: dateRange === r ? '#111827' : '#6B7280',
                  boxShadow: dateRange === r ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                {r}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative' }}>
            <SearchIcon size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input
              type="text"
              placeholder="Filter activity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '5px 10px 5px 30px',
                fontSize: '12px',
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                width: '160px',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Activity Feed Card */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9CA3AF' }}>
            <div className="btn-spinner" style={{ width: '28px', height: '28px', margin: '0 auto 12px', borderColor: '#4B5563', borderTopColor: 'transparent' }} />
            <p style={{ fontSize: '13px', margin: 0 }}>Loading workspace activity...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#EF4444' }}>
            <AlertCircleIcon size={32} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>{error}</p>
            <Button size="sm" variant="outline" onClick={loadActivities}>
              Retry
            </Button>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#6B7280' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: '#9CA3AF' }}>
              <ActivityIcon size={22} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1F2937', margin: '0 0 6px' }}>No workspace activity found</h3>
            <p style={{ fontSize: '13px', color: '#9CA3AF', maxWidth: '380px', margin: '0 auto 16px' }}>
              {searchQuery || category !== 'all' || dateRange !== '30D'
                ? 'Try adjusting your filters or date range.'
                : 'Project updates, task assignments, notes, and comments will appear here.'}
            </p>
            {(searchQuery || category !== 'all' || dateRange !== '30D') && (
              <Button size="sm" variant="outline" onClick={() => { setCategory('all'); setDateRange('30D'); setSearchQuery(''); }}>
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredActivities.map((act, idx) => (
              <div
                key={act.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  padding: '16px 20px',
                  borderBottom: idx < filteredActivities.length - 1 ? '1px solid #F3F4F6' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  {/* Actor Avatar or Icon */}
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', marginTop: '2px' }}>
                    {act.actor?.avatarUrl ? (
                      <img src={act.actor.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#4B5563' }}>
                        {(act.actor?.fullName || act.actor?.username || 'U')[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Activity Details */}
                  <div>
                    <div style={{ fontSize: '13px', color: '#1F2937', lineHeight: '1.4', marginBottom: '4px' }}>
                      {renderActivityText(act)}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#9CA3AF' }}>
                      {act.project && (
                        <Link
                          to={`/app/projects/${act.project.id}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#4B5563',
                            background: '#F3F4F6',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textDecoration: 'none',
                            fontWeight: 500,
                          }}
                        >
                          <span>{act.project.name}</span>
                        </Link>
                      )}
                      <span>•</span>
                      <span>{formatRelativeTime(act.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Event Type Icon Pill */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: '#F9FAFB',
                    color: '#6B7280',
                    flexShrink: 0,
                  }}
                  title={act.type}
                >
                  {renderIcon(act.type)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
