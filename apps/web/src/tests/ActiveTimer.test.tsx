// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import React from 'react';
import { ActiveTimerProvider, useActiveTimer } from '../context/ActiveTimerContext';
import { FloatingTimerModal } from '../components/common/FloatingTimerModal';
import { TimerConflictModal } from '../components/common/TimerConflictModal';
import { myWorkApi } from '../api/myWork.api';
import { workApi, type WorkItem } from '../api/work.api';
import * as AuthContextModule from '../context/AuthContext';
import * as SocketContextModule from '../context/SocketContext';

describe('Single Active Timer & Floating Modal Tests', () => {
  const mockUser = {
    id: 'user_123',
    username: 'alice',
    fullName: 'Alice Developer',
    email: 'alice@example.com',
  };

  const createMockTask = (id: string, title: string, isPaused: boolean, totalDuration: number, lastSessionStartedAt: string | null): WorkItem => ({
    id,
    projectId: 'proj_1',
    title,
    type: 'TASK',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    createdById: 'user_123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assignees: [
      {
        id: `asg_${id}`,
        workItemId: id,
        userId: 'user_123',
        assignedAt: new Date().toISOString(),
        hasStarted: true,
        hasCompleted: false,
        isPaused,
        totalDurationSeconds: totalDuration,
        lastSessionStartedAt,
        lastCheckInCycle: 1,
      },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUser as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
    });

    vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue({
      socket: {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      } as any,
      isConnected: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ActiveTimerProvider>{children}</ActiveTimerProvider>
  );

  it('detects a running task and calculates active seconds', async () => {
    const startedAt = new Date(Date.now() - 60000).toISOString(); // 60 seconds ago
    const taskRunning = createMockTask('task_1', 'Develop Auth Flow', false, 3600, startedAt);

    vi.spyOn(myWorkApi, 'getMyWork').mockResolvedValue({
      success: true,
      data: {
        workItems: [taskRunning],
        summary: {} as any,
        pagination: {} as any,
      },
    });

    const { result } = renderHook(() => useActiveTimer(), { wrapper });

    await act(async () => {
      await result.current.refreshTasks();
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.activeTask?.id).toBe('task_1');
    // 3600s + ~60s elapsed
    expect(result.current.activeSeconds).toBeGreaterThanOrEqual(3659);
  });

  it('triggers conflict modal when user starts Task 2 while Task 1 is running', async () => {
    const startedAt = new Date(Date.now() - 30000).toISOString();
    const task1 = createMockTask('task_1', 'Develop Auth Flow', false, 1200, startedAt);
    const task2 = createMockTask('task_2', 'Fix Navbar Bug', true, 0, null);

    vi.spyOn(myWorkApi, 'getMyWork').mockResolvedValue({
      success: true,
      data: {
        workItems: [task1, task2],
        summary: {} as any,
        pagination: {} as any,
      },
    });

    const pauseSpy = vi.spyOn(workApi, 'pauseTimer').mockResolvedValue({ success: true, message: 'Paused', data: { workItem: task1 } });
    const startSpy = vi.spyOn(workApi, 'startTask').mockResolvedValue({ success: true, message: 'Started', data: { workItem: task2 } });

    const { result } = renderHook(() => useActiveTimer(), { wrapper });

    await act(async () => {
      await result.current.refreshTasks();
    });

    expect(result.current.isRunning).toBe(true);

    // Request start on task2
    act(() => {
      result.current.requestStartTask('proj_1', task2);
    });

    // Conflict modal should be active!
    expect(result.current.conflictModalInfo).not.toBeNull();
    expect(result.current.conflictModalInfo?.runningTask.id).toBe('task_1');
    expect(result.current.conflictModalInfo?.targetTask.id).toBe('task_2');

    // Scenario A: User chooses "keep" (keep task 1 running, accept task 2 with timer paused)
    await act(async () => {
      await result.current.conflictModalInfo?.onProceed('keep');
    });

    expect(startSpy).toHaveBeenCalledWith('proj_1', 'task_2', true); // startPaused = true!
    expect(pauseSpy).not.toHaveBeenCalled(); // task 1 was NOT paused
  });

  it('pauses Task 1 and starts Task 2 when user chooses switch in conflict modal', async () => {
    const startedAt = new Date(Date.now() - 30000).toISOString();
    const task1 = createMockTask('task_1', 'Develop Auth Flow', false, 1200, startedAt);
    const task2 = createMockTask('task_2', 'Fix Navbar Bug', true, 0, null);

    vi.spyOn(myWorkApi, 'getMyWork').mockResolvedValue({
      success: true,
      data: {
        workItems: [task1, task2],
        summary: {} as any,
        pagination: {} as any,
      },
    });

    const pauseSpy = vi.spyOn(workApi, 'pauseTimer').mockResolvedValue({ success: true, message: 'Paused', data: { workItem: task1 } });
    const startSpy = vi.spyOn(workApi, 'startTask').mockResolvedValue({ success: true, message: 'Started', data: { workItem: task2 } });

    const { result } = renderHook(() => useActiveTimer(), { wrapper });

    await act(async () => {
      await result.current.refreshTasks();
    });

    act(() => {
      result.current.requestStartTask('proj_1', task2);
    });

    expect(result.current.conflictModalInfo).not.toBeNull();

    // User chooses "switch"
    await act(async () => {
      await result.current.conflictModalInfo?.onProceed('switch');
    });

    expect(pauseSpy).toHaveBeenCalledWith('proj_1', 'task_1');
    expect(startSpy).toHaveBeenCalledWith('proj_1', 'task_2', false);
  });

  it('calculates 25-30 minute check-in window and resets cycle on check-in', async () => {
    // 26 minutes elapsed in current session = 1560 seconds
    const startedAt = new Date(Date.now() - 1560000).toISOString();
    const task1 = createMockTask('task_1', 'Long Running Code Review', false, 4500, startedAt);

    vi.spyOn(myWorkApi, 'getMyWork').mockResolvedValue({
      success: true,
      data: {
        workItems: [task1],
        summary: {} as any,
        pagination: {} as any,
      },
    });

    const checkInSpy = vi.spyOn(workApi, 'checkInTimer').mockResolvedValue({
      success: true,
      message: 'Continued',
      data: { workItem: task1 },
    });

    const { result } = renderHook(() => useActiveTimer(), { wrapper });

    await act(async () => {
      await result.current.refreshTasks();
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.isInCheckInWindow).toBe(true);

    // Call checkIn
    await act(async () => {
      await result.current.checkInActiveTask();
    });

    expect(checkInSpy).toHaveBeenCalledWith('proj_1', 'task_1');
  });

  it('recovers crashed/unclosed session on mount and pauses at the crash timestamp', async () => {
    const crashTimestamp = Date.now() - 10000; // crashed 10s ago
    localStorage.setItem(
      'dboard_timer_heartbeat',
      JSON.stringify({
        userId: 'user_123',
        taskId: 'task_crashed',
        projectId: 'proj_1',
        title: 'Crashed Task',
        timestamp: crashTimestamp,
        seconds: 4500,
      })
    );

    const pauseSpy = vi.spyOn(workApi, 'pauseTimer').mockResolvedValue({
      success: true,
      message: 'Paused',
      data: { workItem: createMockTask('task_crashed', 'Crashed Task', true, 4500, null) },
    });

    vi.spyOn(myWorkApi, 'getMyWork').mockResolvedValue({
      success: true,
      data: {
        workItems: [createMockTask('task_crashed', 'Crashed Task', true, 4500, null)],
        summary: {} as any,
        pagination: {} as any,
      },
    });

    renderHook(() => useActiveTimer(), { wrapper });

    expect(pauseSpy).toHaveBeenCalledWith('proj_1', 'task_crashed', new Date(crashTimestamp).toISOString());
    expect(localStorage.getItem('dboard_timer_heartbeat')).toBeNull();
  });

  it('renders FloatingTimerModal and allows pause/resume and task switching', async () => {
    const startedAt = new Date(Date.now() - 120000).toISOString();
    const taskRunning = createMockTask('task_1', 'Write Documentation', false, 120, startedAt);
    const taskPaused = createMockTask('task_2', 'Review PRs', true, 600, null);

    vi.spyOn(myWorkApi, 'getMyWork').mockResolvedValue({
      success: true,
      data: {
        workItems: [taskRunning, taskPaused],
        summary: {} as any,
        pagination: {} as any,
      },
    });

    const pauseSpy = vi.spyOn(workApi, 'pauseTimer').mockResolvedValue({ success: true, message: 'Paused', data: { workItem: taskRunning } });
    const resumeSpy = vi.spyOn(workApi, 'resumeTimer').mockResolvedValue({ success: true, message: 'Resumed', data: { workItem: taskPaused } });

    render(
      <ActiveTimerProvider>
        <FloatingTimerModal />
      </ActiveTimerProvider>
    );

    // Should display task title and pause button
    expect(await screen.findByText('Write Documentation')).toBeTruthy();
    const pauseButton = screen.getByTitle('Pause active timer');
    expect(pauseButton).toBeTruthy();

    // Click pause
    fireEvent.click(pauseButton);
    expect(pauseSpy).toHaveBeenCalled();

    // Click expand dropdown to view other tasks
    const toggleButton = screen.getByTitle('View all active tasks');
    fireEvent.click(toggleButton);

    // Paused task should be listed with Resume button
    expect(await screen.findByText('Review PRs')).toBeTruthy();
    const resumeOtherButton = screen.getByTitle('Make this the active running timer');
    fireEvent.click(resumeOtherButton);

    expect(resumeSpy).toHaveBeenCalledWith('proj_1', 'task_2');
  });

  it('renders TimerConflictModal when conflictModalInfo is populated', async () => {
    const task1 = createMockTask('task_1', 'Implement Redux', false, 3600, new Date().toISOString());
    const task2 = createMockTask('task_2', 'Style Header', true, 0, null);

    vi.spyOn(myWorkApi, 'getMyWork').mockResolvedValue({
      success: true,
      data: {
        workItems: [task1, task2],
        summary: {} as any,
        pagination: {} as any,
      },
    });

    const TestComponent = () => {
      const { requestStartTask, refreshTasks } = useActiveTimer();
      React.useEffect(() => {
        refreshTasks();
      }, [refreshTasks]);

      return (
        <div>
          <button type="button" onClick={() => requestStartTask('proj_1', task2)}>
            Start Task 2
          </button>
          <TimerConflictModal />
        </div>
      );
    };

    render(
      <ActiveTimerProvider>
        <TestComponent />
      </ActiveTimerProvider>
    );

    // Allow tasks to load
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Click Start Task 2
    const startBtn = screen.getByText('Start Task 2');
    await act(async () => {
      fireEvent.click(startBtn);
    });

    // Conflict modal should appear
    expect(await screen.findByText('Active Task Timer in Progress')).toBeTruthy();
    expect(screen.getByText('Keep Implement Redux Running')).toBeTruthy();
    expect(screen.getByText('Start Timer for Style Header')).toBeTruthy();
  });

  it('collapses to a floating clock icon when collapse button is pressed and re-opens full modal when clicked', async () => {
    const startedAt = new Date(Date.now() - 30000).toISOString();
    const taskRunning = createMockTask('task_1', 'Fix Layout Bug', false, 30, startedAt);

    vi.spyOn(myWorkApi, 'getMyWork').mockResolvedValue({
      success: true,
      data: {
        workItems: [taskRunning],
        summary: {} as any,
        pagination: {} as any,
      },
    });

    render(
      <ActiveTimerProvider>
        <FloatingTimerModal />
      </ActiveTimerProvider>
    );

    expect(await screen.findByText('Fix Layout Bug')).toBeTruthy();

    // Click collapse button
    const collapseBtn = screen.getByTitle('Collapse to floating clock icon');
    fireEvent.click(collapseBtn);

    // Modal content should no longer be visible, clock floating icon should be visible
    expect(screen.queryByText('Fix Layout Bug')).toBeNull();
    const clockIcon = screen.getByTitle(/Click to expand/i);
    expect(clockIcon).toBeTruthy();

    // Mouse down and mouse up (click without drag) on the floating clock icon
    fireEvent.mouseDown(clockIcon, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(window);

    // Full modal should open again!
    expect(await screen.findByText('Fix Layout Bug')).toBeTruthy();
  });
});
