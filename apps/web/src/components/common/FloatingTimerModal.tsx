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
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
    hasMoved: boolean;
  } | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem('dboard_floating_timer_collapsed', isCollapsed ? 'true' : 'false');
  }, [isCollapsed]);

  // Initialize position at top right of viewport
  useEffect(() => {
    const saved = localStorage.getItem('dboard_floating_timer_coords');
    const width = isCollapsed ? 48 : 340;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const boundedX = Math.max(0, Math.min(parsed.x, window.innerWidth - width));
          const boundedY = Math.max(0, Math.min(parsed.y, window.innerHeight - 50));
          setPosition({ x: boundedX, y: boundedY });
          return;
        }
      } catch {
        // Fallback below
      }
    }
    // Default top right position (placed near extreme right edge: 8px from right edge)
    const defaultX = Math.max(0, window.innerWidth - width - 8);
    setPosition({ x: defaultX, y: 76 });
}, [isCollapsed]);

// Keep inside screen if window resizes
useEffect(() => {
  const handleResize = () => {
    setPosition((prev) => {
      if (!prev) return null;
      const width = isCollapsed ? 48 : (modalRef.current?.offsetWidth || 340);
      const height = isCollapsed ? 48 : (modalRef.current?.offsetHeight || 120);
      const boundedX = Math.max(0, Math.min(prev.x, window.innerWidth - width));
      const boundedY = Math.max(0, Math.min(prev.y, window.innerHeight - height));
      return { x: boundedX, y: boundedY };
    });
  };
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed]);

  // Mouse down: start dragging or click tracking
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      // If user clicked a button or interactive child, don't initiate drag
      if (!isCollapsed && (target.closest('button') || target.closest('a') || target.closest('input'))) {
        return;
      }
      e.preventDefault();

  setPosition((currentPos) => {
    const width = isCollapsed ? 48 : 340;
    const pos = currentPos || { x: Math.max(0, window.innerWidth - width - 8), y: 76 };
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: pos.x,
      startY: pos.y,
      hasMoved: false,
    };
    return pos;
  });
},
  [isCollapsed]
);

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
      const currentWidth = isCollapsed ? 48 : (modalRef.current?.offsetWidth || 340);
      const currentHeight = isCollapsed ? 48 : (modalRef.current?.offsetHeight || 120);

      const newX = dragStartRef.current.startX + deltaX;
      const newY = dragStartRef.current.startY + deltaY;

      // Allow movement to the absolute extreme right (0px from right edge)
      const maxX = Math.max(0, window.innerWidth - currentWidth);
      const maxY = Math.max(0, window.innerHeight - currentHeight);

      const boundedX = Math.max(0, Math.min(newX, maxX));
      const boundedY = Math.max(0, Math.min(newY, maxY));

      setPosition({ x: boundedX, y: boundedY });
    }
  };

  const handleMouseUp = () => {
    if (!dragStartRef.current) return;
    const wasMoved = dragStartRef.current.hasMoved;
    setIsDragging(false);

    if (!wasMoved && isCollapsed) {
      // Simple click on collapsed clock icon -> expand to full modal!
      setIsCollapsed(false);
      setPosition((currentPos) => {
        if (!currentPos) return null;
        const fullWidth = 340;
        // Ensure modal stays within screen bounds when expanding
        const boundedX = Math.max(0, Math.min(currentPos.x, window.innerWidth - fullWidth));
        const boundedY = Math.max(0, Math.min(currentPos.y, window.innerHeight - 150));
        localStorage.setItem('dboard_floating_timer_coords', JSON.stringify({ x: boundedX, y: boundedY }));
        return { x: boundedX, y: boundedY };
      });
    } else {
      // Save dragged coordinates
      setPosition((finalPos) => {
        if (finalPos) {
          localStorage.setItem('dboard_floating_timer_coords', JSON.stringify(finalPos));
        }
        return finalPos;
      });
    }

    dragStartRef.current = null;
  };

  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  return () => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };
  }, [isCollapsed]);

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

if (!position) {
  return null;
}

// COLLAPSED STATE: Floating Clock Icon
if (isCollapsed) {
  return (
    <div
      ref={modalRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 99999,
        width: '46px',
        height: '46px',
        borderRadius: '50%',
        backgroundColor: '#0F172A',
        backdropFilter: 'blur(16px)',
        border: isInCheckInWindow
          ? '2px solid #F59E0B'
          : isRunning
            ? '2px solid #3B82F6'
            : '1.5px solid rgba(255, 255, 255, 0.25)',
        boxShadow: isInCheckInWindow
          ? '0 0 20px rgba(245, 158, 11, 0.5), 0 8px 24px rgba(0, 0, 0, 0.6)'
          : isRunning
            ? '0 0 16px rgba(59, 130, 246, 0.4), 0 8px 24px rgba(0, 0, 0, 0.6)'
            : '0 8px 24px rgba(0, 0, 0, 0.6)',
        cursor: isDragging ? 'grabbing' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease, border-color 0.2s ease',
        userSelect: 'none',
      }}
      title={activeTask ? `${activeTask.title} (${timerDisplay}) - Click to expand` : 'Click to expand timer'}
    >
      <ClockIcon
        size={22}
        style={{
          color: isRunning
            ? '#38BDF8'
            : isInCheckInWindow
              ? '#F59E0B'
              : isMissedCheckIn
                ? '#EF4444'
                : '#F8FAFC',
        }}
      />

      {/* Status Dot */}
      <span
        style={{
          position: 'absolute',
          top: '3px',
          right: '3px',
          width: '9px',
          height: '9px',
          borderRadius: '50%',
          backgroundColor: isInCheckInWindow ? '#F59E0B' : isRunning ? '#10B981' : '#EF4444',
          boxShadow: isInCheckInWindow
            ? '0 0 8px #F59E0B'
            : isRunning
              ? '0 0 8px #10B981'
              : '0 0 6px #EF4444',
          border: '1.5px solid #0F172A',
        }}
      />
    </div>
  );
}

// EXPANDED STATE: Full Floating Timer Modal (as in pic 1 & pic 2)
return (
  <div
    ref={modalRef}
    style={{
      position: 'fixed',
      left: `${position.x}px`,
      top: `${position.y}px`,
      zIndex: 99999,
      width: '340px',
      backgroundColor: 'rgba(15, 23, 42, 0.94)',
      backdropFilter: 'blur(16px)',
      borderRadius: '16px',
      border: isInCheckInWindow
        ? '1.5px solid #F59E0B'
        : isRunning
          ?'1px solid rgba(59, 130, 246, 0.4)'
        : '1px solid rgba(255, 255, 255, 0.15)',
      boxShadow: isInCheckInWindow
        ? '0 0 25px rgba(245, 158, 11, 0.4), 0 20px 35px rgba(0, 0, 0, 0.5)'
        : isRunning
          ?'0 0 20px rgba(59, 130, 246, 0.25), 0 20px 35px rgba(0, 0, 0, 0.5)'
        : '0 20px 35px rgba(0, 0, 0, 0.5)',
      color: '#FFFFFF',
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
        backgroundColor: 'rgba(30, 41, 59, 0.7)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        cursor: isDragging ? 'grabbing' : 'grab',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        <div style={{ color: '#64748B', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
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
              backgroundColor: isInCheckInWindow ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              color: isInCheckInWindow ? '#FDE68A' : '#6EE7B7',
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
                boxShadow: isInCheckInWindow ? '0 0 8px #F59E0B' : '0 0 8px #10B981',
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
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              color: '#FCA5A5',
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
            background: isExpanded ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: isExpanded ? '#60A5FA' : '#94A3B8',
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
          {isExpanded ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
        </button>

        {/* Collapse to Clock Icon Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(true);
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: '#94A3B8',
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
          <MinimizeIcon size={12} />
        </button>
      </div>
    </div>

    {/* Main Active Task Timer Section */}
    {activeTask ? (
        <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Task Title */}
          <div>
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                color: '#F8FAFC',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={activeTask.title}
            >
              {activeTask.title}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>
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
            {/* Stopwatch Clock */}
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '1.45rem',
                fontWeight: 800,
                color: isRunning ? (isInCheckInWindow ? '#FDE68A' : '#38BDF8') : '#F87171',
                letterSpacing: '1px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <ClockIcon size={20} style={{ color: isRunning ? '#38BDF8' : '#F87171' }} />
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
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
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
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#FCA5A5',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
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
        <div style={{ padding: '1rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.8rem' }}>
          No active task timer
        </div>
      )}

        {/* Expandable Dropdown: All Active Tasks (Paused & Running) */}
        {isExpanded && (
          <div
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(15, 23, 42, 0.98)',
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
              <div style={{ padding: '0.75rem', textAlign: 'center', color: '#64748B', fontSize: '0.75rem' }}>
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
                      background: 'rgba(30, 41, 59, 0.6)',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      padding: '0.6rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: '#F8FAFC',
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
                            color: '#94A3B8',
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
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: '#FCA5A5',
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
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
};
