import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { myWorkApi } from '../../api/myWork.api';
import { workApi, type WorkItem, type WorkItemAssignee } from '../../api/work.api';
import { ClockIcon, PlayIcon, CloseIcon, AlertCircleIcon } from '../ui/Icons';

export const ActiveTaskTimerBanner: React.FC = () => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [inProgressItems, setInProgressItems] = useState<WorkItem[]>([]);
  const [dismissedTaskIds, setDismissedTaskIds] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Tick every second for live timers
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadInProgressTasks = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await myWorkApi.getMyWork({ status: 'IN_PROGRESS' });
      if (res.success && res.data?.workItems) {
        setInProgressItems(res.data.workItems);
      }
    } catch {
      // Quiet fail in background
    }
  }, [user?.id]);

  useEffect(() => {
    loadInProgressTasks();
    const pollInterval = setInterval(loadInProgressTasks, 30000);
    return () => clearInterval(pollInterval);
  }, [loadInProgressTasks]);

  // Listen to socket events for work item updates
  useEffect(() => {
    if (!socket || !isConnected) return;
    const handleUpdate = () => {
      loadInProgressTasks();
    };
    socket.on('WORK_ITEM_UPDATED', handleUpdate);
    return () => {
      socket.off('WORK_ITEM_UPDATED', handleUpdate);
    };
  }, [socket, isConnected, loadInProgressTasks]);

  // Find task needing check-in or paused resume
  const activeAlert = useMemo(() => {
    if (!user?.id) return null;

    for (const item of inProgressItems) {
      if (dismissedTaskIds[item.id] && now - dismissedTaskIds[item.id] < 120000) {
        // Dismissed within last 2 minutes
        continue;
      }

      // Check assignee record for current user
      let assignee: WorkItemAssignee | undefined = item.assignees?.find((a) => a.userId === user.id);
      if (!assignee && item.assignedToId === user.id) {
        assignee = {
          id: 'temp',
          workItemId: item.id,
          userId: user.id,
          hasStarted: true,
          hasCompleted: false,
          totalDurationSeconds: 0,
          isPaused: false,
          lastSessionStartedAt: item.updatedAt || item.createdAt,
        } as WorkItemAssignee;
      }

      if (!assignee || !assignee.hasStarted || assignee.hasCompleted) {
        continue;
      }

      // Compute live seconds and session elapsed
      let total = assignee.totalDurationSeconds || 0;
      let sessionElapsed = 0;
      if (!assignee.isPaused && assignee.lastSessionStartedAt) {
        sessionElapsed = Math.max(0, Math.floor((now - new Date(assignee.lastSessionStartedAt).getTime()) / 1000));
      }

      const isSessionExpired = !assignee.isPaused && sessionElapsed >= 1800;
      const isPaused = Boolean(assignee.isPaused) || isSessionExpired;
      const effectiveSessionSec = Math.min(sessionElapsed, 1800);
      total += effectiveSessionSec;

      const isInCheckIn = !isPaused && sessionElapsed >= 1500 && sessionElapsed < 1800; // 25 to 30 min of session

      if (isInCheckIn || isPaused) {
        return {
          task: item,
          assignee,
          totalSeconds: total,
          cycleElapsed: sessionElapsed,
          isInCheckIn,
          isPaused,
        };
      }
    }
    return null;
  }, [inProgressItems, user?.id, now, dismissedTaskIds]);

  if (!activeAlert) return null;

  const { task, cycleElapsed, isInCheckIn, isPaused } = activeAlert;
  const cycleMinutes = Math.floor(cycleElapsed / 60);
  const cycleSecs = cycleElapsed % 60;
  const cycleStr = `${cycleMinutes.toString().padStart(2, '0')}:${cycleSecs.toString().padStart(2, '0')} / 30:00`;

  const handleCheckIn = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading('checkin');
    try {
      await workApi.checkInTimer(task.projectId, task.id);
      await loadInProgressTasks();
    } catch {
      // Handle error
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading('resume');
    try {
      await workApi.resumeTimer(task.projectId, task.id);
      await loadInProgressTasks();
    } catch {
      // Handle error
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedTaskIds((prev) => ({ ...prev, [task.id]: Date.now() }));
  };

  return (
    <div
      className={`global-floating-timer-bar ${isInCheckIn ? 'pulsing' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: isPaused ? '#EF4444' : '#F59E0B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            flexShrink: 0,
          }}
        >
          {isPaused ? <AlertCircleIcon size={18} /> : <ClockIcon size={18} />}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: '#F8FAFC',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '180px',
              }}
              title={task.title}
            >
              {task.title}
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: '4px',
                background: isPaused ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: isPaused ? '#FCA5A5' : '#FDE68A',
              }}
            >
              {isPaused ? 'Paused' : 'Check-In'}
            </span>
          </div>

          <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
            {isPaused
              ? 'Missed 30m check-in mark. Click resume.'
              : `Cycle: ${cycleStr} - Confirm working`}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isInCheckIn && !isPaused && (
          <button
            type="button"
            className="widm-checkin-btn"
            onClick={handleCheckIn}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'checkin' ? 'Saving...' : 'Continue Timer'}
          </button>
        )}

        {isPaused && (
          <button
            type="button"
            style={{
              background: '#3B82F6',
              color: '#FFFFFF',
              border: 'none',
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            onClick={handleResume}
            disabled={actionLoading !== null}
          >
            <PlayIcon size={12} />
            <span>{actionLoading === 'resume' ? 'Resuming...' : 'Resume'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748B',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '4px',
          }}
          title="Dismiss for 2 minutes"
        >
          <CloseIcon size={14} />
        </button>
      </div>
    </div>
  );
};
