import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useActiveTimer } from '../../context/ActiveTimerContext';
import {
  ClockIcon,
  PlayIcon,
  PauseIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DragHandleDotsIcon,
  RotateCcwIcon,
  MinimizeIcon,
} from '../ui/Icons';

const CLOCK_SIZE = 46;
const MODAL_WIDTH = 340;

// Helper to calculate modal coordinates from clock coordinates
const getModalCoordsFromClock = (clock: { x: number; y: number }): { x: number; y: number } => {
  const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const winHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  let modalX: number;
  if (clock.x > (winWidth - MODAL_WIDTH) / 2) {
    // Docked towards right side: keep right edge aligned with clock right edge
    modalX = Math.max(0, Math.min(winWidth - MODAL_WIDTH, clock.x + CLOCK_SIZE - MODAL_WIDTH));
  } else {
    // Docked towards left side: keep left edge aligned
    modalX = Math.max(0, Math.min(winWidth - MODAL_WIDTH, clock.x));
  }
  const modalY = Math.max(0, Math.min(winHeight - 140, clock.y));
  return { x: modalX, y: modalY };
};

// Helper to calculate clock coordinates from modal coordinates
const getClockCoordsFromModal = (modal: { x: number; y: number }): { x: number; y: number } => {
  const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const winHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  let clockX: number;
  if (modal.x > (winWidth - MODAL_WIDTH) / 2) {
    // Right side: place clock at top-right of modal (near minimize button)
    clockX = Math.max(0, Math.min(winWidth - CLOCK_SIZE, modal.x + MODAL_WIDTH - CLOCK_SIZE));
  } else {
    // Left side: place clock at top-left of modal
    clockX = Math.max(0, Math.min(winWidth - CLOCK_SIZE, modal.x));
  }
  const clockY = Math.max(0, Math.min(winHeight - CLOCK_SIZE, modal.y));
  return { x: clockX, y: clockY };
};

export const FloatingTimerModal: React.FC = () => {
  const {
    inProgressTasks,
    activeTask,
    isRunning,
    activeSeconds,
    sessionElapsedSeconds,
    isInCheckInWindow,
    isMissedCheckIn,
    actionLoading,
    pauseActiveTask,
    resumeTask,
    checkInActiveTask,
  } = useActiveTimer();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('dboard_floating_timer_collapsed') === 'true';
  });

  // Track clock icon position and expanded modal position separately
  const [clockCoords, setClockCoords] = useState<{ x: number; y: number }>(() => {
    const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const defaultClock = { x: Math.max(0, winWidth - CLOCK_SIZE - 12), y: 76 };

    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('dboard_floating_timer_coords') : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.clockX === 'number' && typeof parsed.clockY === 'number') {
          return {
            x: Math.max(0, Math.min(winWidth - CLOCK_SIZE, parsed.clockX)),
            y: Math.max(0, Math.min(window.innerHeight - CLOCK_SIZE, parsed.clockY)),
          };
        }
        // Backward compatibility for legacy single { x, y }
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const isRight = parsed.x > (winWidth - MODAL_WIDTH) / 2;
          const x = isRight ? Math.min(winWidth - CLOCK_SIZE, parsed.x + MODAL_WIDTH - CLOCK_SIZE) : parsed.x;
          return {
            x: Math.max(0, Math.min(winWidth - CLOCK_SIZE, x)),
            y: Math.max(0, Math.min(window.innerHeight - CLOCK_SIZE, parsed.y)),
          };
        }
      } catch {
        // fallback
      }
    }
    return defaultClock;
  });

  const [modalCoords, setModalCoords] = useState<{ x: number; y: number }>(() => {
    const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const defaultModal = { x: Math.max(0, winWidth - MODAL_WIDTH - 12), y: 76 };

    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('dboard_floating_timer_coords') : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.modalX === 'number' && typeof parsed.modalY === 'number') {
          return {
            x: Math.max(0, Math.min(winWidth - MODAL_WIDTH, parsed.modalX)),
            y: Math.max(0, Math.min(window.innerHeight - 120, parsed.modalY)),
          };
        }
        if (typeof parsed.clockX === 'number' && typeof parsed.clockY === 'number') {
          return getModalCoordsFromClock({ x: parsed.clockX, y: parsed.clockY });
        }
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return {
            x: Math.max(0, Math.min(winWidth - MODAL_WIDTH, parsed.x)),
            y: Math.max(0, Math.min(window.innerHeight - 120, parsed.y)),
          };
        }
      } catch {
        // fallback
      }
    }
    return defaultModal;
  });

  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
    hasMoved: boolean;
  } | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  // Save coordinates to localStorage helper
  const saveCoords = (clock: { x: number; y: number }, modal: { x: number; y: number }) => {
    try {
      localStorage.setItem(
        'dboard_floating_timer_coords',
        JSON.stringify({
          clockX: clock.x,
          clockY: clock.y,
          modalX: modal.x,
          modalY: modal.y,
        })
      );
    } catch {
      // ignore
    }
  };

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem('dboard_floating_timer_collapsed', isCollapsed ? 'true' : 'false');
  }, [isCollapsed]);

  // Keep coordinates safely bounded inside screen on resize
  useEffect(() => {
    const handleResize = () => {
      setClockCoords((prev) => ({
        x: Math.max(0, Math.min(prev.x, window.innerWidth - CLOCK_SIZE)),
        y: Math.max(0, Math.min(prev.y, window.innerHeight - CLOCK_SIZE)),
      }));
      setModalCoords((prev) => {
        const width = modalRef.current?.offsetWidth || MODAL_WIDTH;
        const height = modalRef.current?.offsetHeight || 120;
        return {
          x: Math.max(0, Math.min(prev.x, window.innerWidth - width)),
          y: Math.max(0, Math.min(prev.y, window.innerHeight - height)),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse down: start dragging or click tracking
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      // If user clicked an interactive child, don't initiate drag
      if (!isCollapsed && (target.closest('button') || target.closest('a') || target.closest('input'))) {
        return;
      }
      e.preventDefault();

      if (isCollapsed) {
        dragStartRef.current = {
          mouseX: e.clientX,
          mouseY: e.clientY,
          startX: clockCoords.x,
          startY: clockCoords.y,
          hasMoved: false,
        };
      } else {
        dragStartRef.current = {
          mouseX: e.clientX,
          mouseY: e.clientY,
          startX: modalCoords.x,
          startY: modalCoords.y,
          hasMoved: false,
        };
      }
    },
    [isCollapsed, clockCoords, modalCoords]
  );

  // Mouse move and Mouse up handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      // Only treat as drag if movement exceeds 3px
      if (!dragStartRef.current.hasMoved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
        dragStartRef.current.hasMoved = true;
        setIsDragging(true);
      }

      if (dragStartRef.current.hasMoved) {
        if (isCollapsed) {
          const newX = dragStartRef.current.startX + deltaX;
          const newY = dragStartRef.current.startY + deltaY;
          const boundedX = Math.max(0, Math.min(newX, window.innerWidth - CLOCK_SIZE));
          const boundedY = Math.max(0, Math.min(newY, window.innerHeight - CLOCK_SIZE));
          setClockCoords({ x: boundedX, y: boundedY });
        } else {
          const currentWidth = modalRef.current?.offsetWidth || MODAL_WIDTH;
          const currentHeight = modalRef.current?.offsetHeight || 120;
          const newX = dragStartRef.current.startX + deltaX;
          const newY = dragStartRef.current.startY + deltaY;
          const boundedX = Math.max(0, Math.min(newX, window.innerWidth - currentWidth));
          const boundedY = Math.max(0, Math.min(newY, window.innerHeight - currentHeight));
          setModalCoords({ x: boundedX, y: boundedY });
        }
      }
    };

    const handleMouseUp = () => {
      if (!dragStartRef.current) return;
      const wasMoved = dragStartRef.current.hasMoved;
      setIsDragging(false);

      if (isCollapsed) {
        if (!wasMoved) {
          // Simple click on collapsed clock icon -> expand to full modal!
          // Synchronize modal position anchored to clock without shifting clock position!
          const newModal = getModalCoordsFromClock(clockCoords);
          setModalCoords(newModal);
          saveCoords(clockCoords, newModal);
          setIsCollapsed(false);
        } else {
          // User dragged the clock icon: keep clock position, compute synced modal, and save
          setClockCoords((latestClock) => {
            const newModal = getModalCoordsFromClock(latestClock);
            setModalCoords(newModal);
            saveCoords(latestClock, newModal);
            return latestClock;
          });
        }
      } else {
        if (wasMoved) {
          // User dragged the expanded modal: sync clock coordinates to new modal position
          setModalCoords((latestModal) => {
            const newClock = getClockCoordsFromModal(latestModal);
            setClockCoords(newClock);
            saveCoords(newClock, latestModal);
            return latestModal;
          });
        }
      }

      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isCollapsed, clockCoords]);

  // Format active seconds
  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timerDisplay = useMemo(() => formatTimer(activeSeconds), [activeSeconds]);

  // Current cycle string: e.g. "12:45 / 30:00"
  const cycleMinutes = Math.floor(sessionElapsedSeconds / 60);
  const cycleSecs = sessionElapsedSeconds % 60;
  const cycleStr = `${cycleMinutes.toString().padStart(2, '0')}:${cycleSecs.toString().padStart(2, '0')} / 30:00`;

  // Filter other tasks user has started
  const otherTasks = useMemo(() => {
    if (!activeTask) return inProgressTasks;
    return inProgressTasks.filter((t) => t.id !== activeTask.id);
  }, [inProgressTasks, activeTask]);

  // If no started tasks exist, do not display
  if (inProgressTasks.length === 0 && !activeTask) {
    return null;
  }

  // COLLAPSED STATE: Black button with White Clock Icon and 3-color state ring (NO DOTS)
  if (isCollapsed) {
    // 3 states: Blue when running, Yellow when continue/check-in window, Red when paused
    const stateColor = isRunning
      ? (isInCheckInWindow ? '#EAB308' : '#2563EB')
      : '#EF4444';

    const glowColor = isRunning
      ? (isInCheckInWindow ? 'rgba(234, 179, 8, 0.45)' : 'rgba(37, 99, 235, 0.45)')
      : 'rgba(239, 68, 68, 0.45)';

    return (
      <div
        ref={modalRef}
        onMouseDown={handleMouseDown}
        style={{
          position: 'fixed',
          left: `${clockCoords.x}px`,
          top: `${clockCoords.y}px`,
          zIndex: 99999,
          width: `${CLOCK_SIZE}px`,
          height: `${CLOCK_SIZE}px`,
          borderRadius: '50%',
          backgroundColor: '#000000',
          border: `3.5px solid ${stateColor}`,
          boxShadow: `0 0 16px ${glowColor}, 0 8px 24px rgba(0, 0, 0, 0.25)`,
          cursor: isDragging ? 'grabbing' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: isDragging ? 'none' : 'box-shadow 0.2s ease, border-color 0.2s ease',
          userSelect: 'none',
        }}
        title={activeTask ? `${activeTask.title} (${timerDisplay}) - Click to expand` : 'Click to expand timer'}
      >
        {/* White Clock Icon, Surrounding Black, Border in State Color */}
        <ClockIcon
          size={22}
          style={{
            color: '#FFFFFF',
          }}
        />
      </div>
    );
  }

  // EXPANDED STATE: Full White Modal with Black Icons
  return (
    <div
      ref={modalRef}
      style={{
        position: 'fixed',
        left: `${modalCoords.x}px`,
        top: `${modalCoords.y}px`,
        zIndex: 99999,
        width: `${MODAL_WIDTH}px`,
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: isInCheckInWindow ? '1.5px solid #F59E0B' : '1px solid #E2E8F0',
        boxShadow: isInCheckInWindow
          ? '0 0 24px rgba(245, 158, 11, 0.2), 0 16px 36px rgba(0, 0, 0, 0.12)'
          : '0 16px 36px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.05)',
        color: '#000000',
        userSelect: isDragging ? 'none' : 'auto',
        transition: isDragging ? 'none' : 'border-color 0.2s, box-shadow 0.2s',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Draggable Header Bar */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          padding: '0.65rem 0.85rem',
          backgroundColor: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <div style={{ color: '#000000', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <DragHandleDotsIcon size={14} />
          </div>

          {/* Status Badge */}
          {isRunning ? (
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: isInCheckInWindow ? '#FFFBEB' : '#ECFDF5',
                color: isInCheckInWindow ? '#D97706' : '#059669',
                border: isInCheckInWindow ? '1px solid #FDE68A' : '1px solid #A7F3D0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: isInCheckInWindow ? '#F59E0B' : '#10B981',
                  boxShadow: isInCheckInWindow ? '0 0 6px #F59E0B' : '0 0 6px #10B981',
                  animation: 'pulse 1.5s infinite',
                }}
              />
              {isInCheckInWindow ? 'Check-In Due' : 'Running'}
            </span>
          ) : (
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: '#FEF2F2',
                color: '#DC2626',
                border: '1px solid #FECACA',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#EF4444',
                }}
              />
              {isMissedCheckIn ? 'Paused (Missed 30m)' : 'Paused'}
            </span>
          )}
        </div>

        {/* Action Controls in Header: Tasks Dropdown & Collapse Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Dropdown toggle for all active tasks */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            style={{
              background: isExpanded ? '#EFF6FF' : '#F1F5F9',
              border: '1px solid #E2E8F0',
              color: '#000000',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
            title={isExpanded ? 'Collapse active tasks' : 'View all active tasks'}
          >
            <span>{inProgressTasks.length} {inProgressTasks.length === 1 ? 'task' : 'tasks'}</span>
            {isExpanded ? <ChevronUpIcon size={12} style={{ color: '#000000' }} /> : <ChevronDownIcon size={12} style={{ color: '#000000' }} />}
          </button>

          {/* Collapse to Clock Icon Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(true);
            }}
            style={{
              background: '#F1F5F9',
              border: '1px solid #E2E8F0',
              color: '#000000',
              borderRadius: '6px',
              width: '24px',
              height: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title="Collapse to floating clock icon"
          >
            <MinimizeIcon size={12} style={{ color: '#000000' }} />
          </button>
        </div>
      </div>

      {/* Main Active Task Timer Section */}
      {activeTask ? (
        <div style={{ padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Task Title */}
          <div>
            <div
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#000000',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={activeTask.title}
            >
              {activeTask.title}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
              {isRunning
                ? isInCheckInWindow
                  ? 'Confirm you are working before 30m mark'
                  : `Cycle: ${cycleStr}`
                : isMissedCheckIn
                  ? 'Missed 30m check-in mark. Click resume to continue.'
                  : 'Timer paused. Ready to resume.'}
            </div>
          </div>

          {/* Timer Display and Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            {/* Stopwatch Clock with BLACK Clock Icon and Black / High-Contrast Digits */}
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '1.45rem',
                fontWeight: 800,
                color: '#000000',
                letterSpacing: '1px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <ClockIcon size={20} style={{ color: '#000000' }} />
              <span>{timerDisplay}</span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Check-In / Continue Button (appears in 25-30m window) */}
              {isInCheckInWindow && isRunning && (
                <button
                  type="button"
                  onClick={checkInActiveTask}
                  disabled={actionLoading !== null}
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.45rem 0.8rem',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
                    whiteSpace: 'nowrap',
                  }}
                  title="Check in to continue next 25-30m cycle"
                >
                  <RotateCcwIcon size={12} />
                  <span>{actionLoading === 'checkin' ? 'Saving...' : 'Continue'}</span>
                </button>
              )}

              {/* Pause Button (when running) */}
              {isRunning && (
                <button
                  type="button"
                  onClick={() => pauseActiveTask()}
                  disabled={actionLoading !== null}
                  style={{
                    background: '#FEF2F2',
                    color: '#DC2626',
                    border: '1px solid #FECACA',
                    borderRadius: '8px',
                    padding: '0.45rem 0.75rem',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    whiteSpace: 'nowrap',
                  }}
                  title="Pause active timer"
                >
                  <PauseIcon size={12} />
                  <span>{actionLoading === 'pause' ? 'Pausing...' : 'Pause'}</span>
                </button>
              )}

              {/* Resume Button (when paused) */}
              {!isRunning && (
                <button
                  type="button"
                  onClick={() => resumeTask(activeTask.id, activeTask.projectId)}
                  disabled={actionLoading !== null}
                  style={{
                    background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.45rem 0.85rem',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.35)',
                    whiteSpace: 'nowrap',
                  }}
                  title="Resume active timer"
                >
                  <PlayIcon size={12} />
                  <span>{actionLoading === 'resume' ? 'Resuming...' : 'Resume'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '1rem', textAlign: 'center', color: '#64748B', fontSize: '0.8rem' }}>
          No active task timer
        </div>
      )
      }

      {/* Expandable Dropdown: All Active Tasks (Paused & Running) */}
      {
        isExpanded && (
          <div
            style={{
              borderTop: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <div
              style={{
                padding: '0.2rem 0.4rem',
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: '#64748B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>All Started Tasks</span>
              <span>Only 1 runs at a time</span>
            </div>

            {otherTasks.length === 0 ? (
              <div style={{ padding: '0.75rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.75rem' }}>
                No other started tasks.
              </div>
            ) : (
              otherTasks.map((item) => {
                const asg = item.assignees?.find((a) => !a.hasCompleted);
                const totalSec = asg?.totalDurationSeconds || 0;
                const formatted = formatTimer(totalSec);

                return (
                  <div
                    key={item.id}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      padding: '0.6rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: '#000000',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={item.title}
                      >
                        {item.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontFamily: 'monospace',
                            color: '#64748B',
                          }}
                        >
                          {formatted}
                        </span>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: '#FEF2F2',
                            color: '#DC2626',
                            border: '1px solid #FEE2E2',
                          }}
                        >
                          Paused
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => resumeTask(item.id, item.projectId)}
                      disabled={actionLoading !== null}
                      style={{
                        background: '#3B82F6',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.35rem 0.65rem',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                      }}
                      title="Make this the active running timer"
                    >
                      <PlayIcon size={10} />
                      <span>Resume</span>
                    </button>
                  </div >
                );
              })
            )}
          </div >
        )}
    </div >
  );
};
