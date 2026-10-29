import React from 'react';
import { useActiveTimer } from '../../context/ActiveTimerContext';
import { ClockIcon, CloseIcon, AlertCircleIcon, PlayIcon, PauseIcon } from '../ui/Icons';

export const TimerConflictModal: React.FC = () => {
  const { conflictModalInfo, closeConflictModal, actionLoading } = useActiveTimer();

  if (!conflictModalInfo) return null;

  const { runningTask, targetTask, targetAction, onProceed } = conflictModalInfo;

  // Format running duration
  const now = Date.now();
  const assignee = runningTask.assignees?.find((a) => !a.isPaused && a.lastSessionStartedAt);
  let totalSec = assignee?.totalDurationSeconds || 0;
  if (assignee?.lastSessionStartedAt) {
    const elapsed = Math.max(0, Math.floor((now - new Date(assignee.lastSessionStartedAt).getTime()) / 1000));
    totalSec += Math.min(elapsed, 1800);
  }
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const timeFormatted = hrs > 0
    ? `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100002,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={closeConflictModal}
    >
      <div
        style={{
          backgroundColor: '#0F172A',
          color: '#F8FAFC',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          maxWidth: '520px',
          width: '100%',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          animation: 'slide-up-timer 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertCircleIcon size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF' }}>
                Active Task Timer in Progress
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#94A3B8' }}>
                Only one task timer can run at a time
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeConflictModal}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Current Active Task Card */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#10B981',
                  background: 'rgba(16, 185, 129, 0.15)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10B981',
                    boxShadow: '0 0 8px #10B981',
                  }}
                />
                Currently Running
              </span>
            </div>
            <div
              style={{
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#F8FAFC',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={runningTask.title}
            >
              {runningTask.title}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(15, 23, 42, 0.8)',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#38BDF8',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: '1rem',
              flexShrink: 0,
            }}
          >
            <ClockIcon size={16} />
            <span>{timeFormatted}</span>
          </div>
        </div>

        {/* Question Prompt */}
        <div style={{ fontSize: '0.875rem', color: '#CBD5E1', lineHeight: '1.45' }}>
          You are starting/resuming <strong style={{ color: '#FFFFFF' }}>{targetTask.title}</strong>. How would you like to handle your timers?
        </div>

        {/* Action Choice Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Option A: Switch to new task timer */}
          <button
            type="button"
            onClick={() => onProceed('switch')}
            disabled={actionLoading !== null}
            style={{
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              color: '#FFFFFF',
              border: '1px solid rgba(59, 130, 246, 0.5)',
              borderRadius: '12px',
              padding: '0.9rem 1.1rem',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              transition: 'all 0.15s ease',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PlayIcon size={14} />
                <span>Start Timer for {targetTask.title}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#BFDBFE', marginTop: '2px' }}>
                Pause {runningTask.title} without resetting time, and start timer for this task
              </div>
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#93C5FD' }}>→</span>
          </button>

          {/* Option B: Keep first one running */}
          <button
            type="button"
            onClick={() => onProceed('keep')}
            disabled={actionLoading !== null}
            style={{
              background: '#1E293B',
              color: '#F8FAFC',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              padding: '0.9rem 1.1rem',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              transition: 'all 0.15s ease',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PauseIcon size={14} />
                <span>Keep {runningTask.title} Running</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
                {targetAction === 'start'
                  ? `Accept ${targetTask.title}, but keep its timer in Paused state`
                  : `Leave ${targetTask.title} in Paused state`}
              </div>
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8' }}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
};

