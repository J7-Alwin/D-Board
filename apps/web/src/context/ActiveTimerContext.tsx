import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { myWorkApi } from '../api/myWork.api';
import { workApi, type WorkItem, type WorkItemAssignee } from '../api/work.api';

export interface ConflictModalInfo {
  runningTask: WorkItem;
  targetTask: { id: string; projectId: string; title: string };
  targetAction: 'start' | 'resume';
  onProceed: (choice: 'keep' | 'switch') => Promise<void>;
}

export interface ActiveTimerContextType {
  inProgressTasks: WorkItem[];
  activeTask: WorkItem | null;
  activeAssignee: WorkItemAssignee | null;
  isRunning: boolean;
  activeSeconds: number;
  sessionElapsedSeconds: number;
  isInCheckInWindow: boolean;
  isMissedCheckIn: boolean;
  actionLoading: string | null;
  conflictModalInfo: ConflictModalInfo | null;
  closeConflictModal: () => void;
  setActiveTaskId: (taskId: string) => void;
  pauseActiveTask: (taskId?: string, projectId?: string, pausedAt?: string) => Promise<void>;
  resumeTask: (taskId: string, projectId: string) => Promise<void>;
  checkInActiveTask: () => Promise<void>;
  requestStartTask: (projectId: string, task: WorkItem, onDone?: (item: WorkItem) => void) => Promise<void>;
  requestResumeTask: (projectId: string, task: WorkItem, onDone?: (item: WorkItem) => void) => Promise<void>;
  refreshTasks: () => Promise<void>;
}

const ActiveTimerContext = createContext<ActiveTimerContextType | undefined>(undefined);

export const ActiveTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [inProgressTasks, setInProgressTasks] = useState<WorkItem[]>([]);
  const [activeTaskId, setActiveTaskIdState] = useState<string | null>(() => {
    return localStorage.getItem('dboard_last_active_task_id') || null;
  });
  const [now, setNow] = useState<number>(Date.now());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [conflictModalInfo, setConflictModalInfo] = useState<ConflictModalInfo | null>(null);

  const isRunningRef = useRef(false);
  const activeTaskRef = useRef<WorkItem | null>(null);

  // 1-second ticker for smooth, live stopwatch
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch all started tasks for current user
  const loadTasks = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await myWorkApi.getMyWork({ tab: 'my-work' });
      if (res.success && res.data?.workItems) {
        // Filter tasks where current user has started and not completed, and status not COMPLETED
        const started = res.data.workItems.filter((item) => {
          if (item.status === 'COMPLETED') return false;
          const a = item.assignees?.find((asg) => asg.userId === user.id);
          return Boolean(a && a.hasStarted && !a.hasCompleted);
        });
        setInProgressTasks(started);
      }
    } catch {
      // Quiet background fetch
    }
  }, [user?.id]);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 15000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  // Listen to socket events
  useEffect(() => {
    if (!socket || !isConnected) return;
    const handleUpdate = () => {
      loadTasks();
    };
    socket.on('WORK_ITEM_UPDATED', handleUpdate);
    socket.on('WORK_UPDATED', handleUpdate);
    socket.on('WORK_STATUS_CHANGED', handleUpdate);
    return () => {
      socket.off('WORK_ITEM_UPDATED', handleUpdate);
      socket.off('WORK_UPDATED', handleUpdate);
      socket.off('WORK_STATUS_CHANGED', handleUpdate);
    };
  }, [socket, isConnected, loadTasks]);

  // Find currently running task if any
  const runningTask = useMemo(() => {
    if (!user?.id) return null;
    for (const item of inProgressTasks) {
      const a = item.assignees?.find((asg) => asg.userId === user.id);
      if (a && a.hasStarted && !a.hasCompleted && !a.isPaused && a.lastSessionStartedAt) {
        const elapsed = Math.max(0, Math.floor((now - new Date(a.lastSessionStartedAt).getTime()) / 1000));
        if (elapsed < 1800) {
          return item;
        }
      }
    }
    return null;
  }, [inProgressTasks, user?.id, now]);

  // Active task selection logic:
  // If a task is actively running, that task MUST be the activeTask.
  // Otherwise, use activeTaskId if it's in inProgressTasks, or fallback to first task.
  const activeTask = useMemo(() => {
    if (runningTask) return runningTask;
    if (activeTaskId) {
      const match = inProgressTasks.find((t) => t.id === activeTaskId);
      if (match) return match;
    }
    return inProgressTasks[0] || null;
  }, [runningTask, activeTaskId, inProgressTasks]);

  const setActiveTaskId = useCallback((taskId: string) => {
    setActiveTaskIdState(taskId);
    localStorage.setItem('dboard_last_active_task_id', taskId);
  }, []);

  useEffect(() => {
    if (activeTask?.id) {
      localStorage.setItem('dboard_last_active_task_id', activeTask.id);
    }
  }, [activeTask?.id]);

  activeTaskRef.current = activeTask;

  // Compute assignee & duration for activeTask
  const activeAssignee = useMemo(() => {
    if (!activeTask || !user?.id) return null;
    return activeTask.assignees?.find((a) => a.userId === user.id) || null;
  }, [activeTask, user?.id]);

  const { activeSeconds, sessionElapsedSeconds, isRunning, isInCheckInWindow, isMissedCheckIn } = useMemo(() => {
    if (!activeAssignee || !activeAssignee.hasStarted || activeAssignee.hasCompleted) {
      return {
        activeSeconds: 0,
        sessionElapsedSeconds: 0,
        isRunning: false,
        isInCheckInWindow: false,
        isMissedCheckIn: false,
      };
    }

    let total = activeAssignee.totalDurationSeconds || 0;
    let sessionSec = 0;
    if (!activeAssignee.isPaused && activeAssignee.lastSessionStartedAt) {
      sessionSec = Math.max(0, Math.floor((now - new Date(activeAssignee.lastSessionStartedAt).getTime()) / 1000));
    }

    const missed = !activeAssignee.isPaused && sessionSec >= 1800;
    const isPaused = Boolean(activeAssignee.isPaused) || missed;
    const effectiveSession = Math.min(sessionSec, 1800);
    total += effectiveSession;

    const running = !isPaused;
    const inCheckIn = running && sessionSec >= 1500 && sessionSec < 1800;

    return {
      activeSeconds: total,
      sessionElapsedSeconds: sessionSec,
      isRunning: running,
      isInCheckInWindow: inCheckIn,
      isMissedCheckIn: isPaused,
    };
  }, [activeAssignee, now]);

  isRunningRef.current = isRunning;

  // Heartbeat & Crash Detection Handling:
  // Write heartbeat every second when running
  useEffect(() => {
    if (isRunning && activeTask && user?.id) {
      const hb = {
        userId: user.id,
        taskId: activeTask.id,
        projectId: activeTask.projectId,
        title: activeTask.title,
        timestamp: Date.now(),
        seconds: activeSeconds,
      };
      localStorage.setItem('dboard_timer_heartbeat', JSON.stringify(hb));
    }
  }, [isRunning, activeTask, activeSeconds, user?.id, now]);

  // On mount: check if website closed or crashed during an active timer session
  useEffect(() => {
    if (!user?.id) return;
    const rawHb = localStorage.getItem('dboard_timer_heartbeat');
    if (rawHb) {
      try {
        const hb = JSON.parse(rawHb);
        if (hb.userId === user.id && hb.taskId && hb.projectId && hb.timestamp) {
          const diff = Date.now() - hb.timestamp;
          // If the heartbeat is older than 4 seconds, the tab was closed or crashed!
          if (diff > 4000) {
            localStorage.removeItem('dboard_timer_heartbeat');
            // Send pause call with the exact crash/close timestamp to credit accurate time
            workApi
              .pauseTimer(hb.projectId, hb.taskId, new Date(hb.timestamp).toISOString())
              .catch(() => { })
              .finally(() => {
                loadTasks();
              });
          }
        }
      } catch {
        localStorage.removeItem('dboard_timer_heartbeat');
      }
    }

    // Tab close / beforeunload / pagehide handler
    const handleUnload = () => {
      if (isRunningRef.current && activeTaskRef.current) {
        const t = activeTaskRef.current;
        // Mark heartbeat timestamp
        localStorage.setItem(
          'dboard_timer_heartbeat',
          JSON.stringify({
            userId: user.id,
            taskId: t.id,
            projectId: t.projectId,
            title: t.title,
            timestamp: Date.now(),
          })
        );
        // Dispatch keepalive fetch to pause timer immediately on tab close
        try {
          fetch(`/api/v1/projects/${t.projectId}/work/${t.id}/pause-timer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pausedAt: new Date().toISOString() }),
            keepalive: true,
          });
        } catch {
          // Ignore unload errors
        }
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [user?.id, loadTasks]);

  // Pause active timer
  const pauseActiveTask = useCallback(
    async (taskId?: string, projectId?: string, pausedAt?: string) => {
      const targetId = taskId || activeTask?.id;
      const targetProjId = projectId || activeTask?.projectId;
      if (!targetId || !targetProjId) return;

      setActionLoading('pause');
      try {
        localStorage.removeItem('dboard_timer_heartbeat');
        await workApi.pauseTimer(targetProjId, targetId, pausedAt);
        await loadTasks();
      } catch (err) {
        console.error('Failed to pause timer', err);
      } finally {
        setActionLoading(null);
      }
    },
    [activeTask?.id, activeTask?.projectId, loadTasks]
  );

  // Resume active timer
  const resumeTask = useCallback(
    async (taskId: string, projectId: string) => {
      setActionLoading('resume');
      try {
        await workApi.resumeTimer(projectId, taskId);
        setActiveTaskId(taskId);
        await loadTasks();
      } catch (err) {
        console.error('Failed to resume timer', err);
      } finally {
        setActionLoading(null);
      }
    },
    [setActiveTaskId, loadTasks]
  );

  // Check in active timer
  const checkInActiveTask = useCallback(async () => {
    if (!activeTask?.id || !activeTask?.projectId) return;
    setActionLoading('checkin');
    try {
      await workApi.checkInTimer(activeTask.projectId, activeTask.id);
      await loadTasks();
    } catch (err) {
      console.error('Failed to check in timer', err);
    } finally {
      setActionLoading(null);
    }
  }, [activeTask?.id, activeTask?.projectId, loadTasks]);

  // Intercept Start Task to enforce single running timer
  const requestStartTask = useCallback(
    async (projectId: string, task: WorkItem, onDone?: (item: WorkItem) => void) => {
      // Is there already a task running other than this task?
      if (runningTask && runningTask.id !== task.id) {
        // Show conflict modal asking user
        return new Promise<void>((resolve) => {
          setConflictModalInfo({
            runningTask,
            targetTask: { id: task.id, projectId, title: task.title },
            targetAction: 'start',
            onProceed: async (choice) => {
              setConflictModalInfo(null);
              setActionLoading('start');
              try {
                if (choice === 'keep') {
                  // Keep first one running, accept second task with its timer paused!
                  const res = await workApi.startTask(projectId, task.id, true);
                  if (res.success && res.data?.workItem) {
                    onDone?.(res.data.workItem);
                  }
                } else {
                  // Switch: pause first one, start second one with running timer
                  await workApi.pauseTimer(runningTask.projectId, runningTask.id);
                  const res = await workApi.startTask(projectId, task.id, false);
                  if (res.success && res.data?.workItem) {
                    setActiveTaskId(task.id);
                    onDone?.(res.data.workItem);
                  }
                }
                await loadTasks();
              } finally {
                setActionLoading(null);
                resolve();
              }
            },
          });
        });
      }

      // No conflicting running timer, start directly
      setActionLoading('start');
      try {
        const res = await workApi.startTask(projectId, task.id, false);
        if (res.success && res.data?.workItem) {
          setActiveTaskId(task.id);
          onDone?.(res.data.workItem);
        }
        await loadTasks();
      } finally {
        setActionLoading(null);
      }
    },
    [runningTask, setActiveTaskId, loadTasks]
  );

  // Intercept Resume Task to enforce single running timer
  const requestResumeTask = useCallback(
    async (projectId: string, task: WorkItem, onDone?: (item: WorkItem) => void) => {
      // Is there already a task running other than this task?
      if (runningTask && runningTask.id !== task.id) {
        return new Promise<void>((resolve) => {
          setConflictModalInfo({
            runningTask,
            targetTask: { id: task.id, projectId, title: task.title },
            targetAction: 'resume',
            onProceed: async (choice) => {
              setConflictModalInfo(null);
              if (choice === 'keep') {
                // Keep running task as is, do not resume target
                resolve();
                return;
              }
              // Switch: pause running task, resume target
              setActionLoading('resume');
              try {
                await workApi.pauseTimer(runningTask.projectId, runningTask.id);
                const res = await workApi.resumeTimer(projectId, task.id);
                if (res.success && res.data?.workItem) {
                  setActiveTaskId(task.id);
                  onDone?.(res.data.workItem);
                }
                await loadTasks();
              } finally {
                setActionLoading(null);
                resolve();
              }
            },
          });
        });
      }

      // No conflicting running timer, resume directly
      setActionLoading('resume');
      try {
        const res = await workApi.resumeTimer(projectId, task.id);
        if (res.success && res.data?.workItem) {
          setActiveTaskId(task.id);
          onDone?.(res.data.workItem);
        }
        await loadTasks();
      } finally {
        setActionLoading(null);
      }
    },
    [runningTask, setActiveTaskId, loadTasks]
  );

  const closeConflictModal = useCallback(() => {
    setConflictModalInfo(null);
  }, []);

  const value = {
    inProgressTasks,
    activeTask,
    activeAssignee,
    isRunning,
    activeSeconds,
    sessionElapsedSeconds,
    isInCheckInWindow,
    isMissedCheckIn,
    actionLoading,
    conflictModalInfo,
    closeConflictModal,
    setActiveTaskId,
    pauseActiveTask,
    resumeTask,
    checkInActiveTask,
    requestStartTask,
    requestResumeTask,
    refreshTasks: loadTasks,
  };

  return <ActiveTimerContext.Provider value={value}>{children}</ActiveTimerContext.Provider>;
};

const defaultTimerContext: ActiveTimerContextType = {
  inProgressTasks: [],
  activeTask: null,
  activeAssignee: null,
  isRunning: false,
  activeSeconds: 0,
  sessionElapsedSeconds: 0,
  isInCheckInWindow: false,
  isMissedCheckIn: false,
  actionLoading: null,
  conflictModalInfo: null,
  closeConflictModal: () => { },
  setActiveTaskId: () => { },
  pauseActiveTask: async () => { },
  resumeTask: async () => { },
  checkInActiveTask: async () => { },
  requestStartTask: async () => { },
  requestResumeTask: async () => { },
  refreshTasks: async () => { },
};

export const useActiveTimer = (): ActiveTimerContextType => {
  const context = useContext(ActiveTimerContext);
  return context || defaultTimerContext;
};