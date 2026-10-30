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
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={closeConflictModal}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          color: '#0F172A',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.16), 0 8px 16px -4px rgba(0, 0, 0, 0.08)',
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
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#FEF3C7',
                color: '#D97706',
                border: '1px solid #FDE68A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertCircleIcon size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0F172A' }}>
                Active Task Timer in Progress
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
                Only one task timer can run at a time
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeConflictModal}
            aria-label="Close modal"
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              color: '#000000',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Current Active Task Card */}
        <div
          style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
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
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#059669',
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10B981',
                    boxShadow: '0 0 6px #10B981',
                  }}
                />
                Currently Running
              </span>
            </div>
            <div
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#0F172A',
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
              background: '#F1F5F9',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              color: '#000000',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: '1rem',
              flexShrink: 0,
            }}
          >
            <ClockIcon size={16} style={{ color: '#000000' }} />
            <span>{timeFormatted}</span>
          </div>
        </div>

        {/* Question Prompt */}
        <div style={{ fontSize: '0.875rem', color: '#475569', lineHeight: '1.5' }}>
          You are starting/resuming <strong style={{ color: '#0F172A' }}>{targetTask.title}</strong>. How would you like to handle your timers?
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
              border: '1px solid #1D4ED8',
              borderRadius: '12px',
              padding: '0.9rem 1.1rem',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              transition: 'all 0.15s ease',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PlayIcon size={14} />
                <span>Start Timer for {targetTask.title}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#DBEAFE', marginTop: '2px' }}>
                Pause {runningTask.title} without resetting time, and start timer for this task
              </div>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#BFDBFE' }}>→</span>
          </button>

          {/* Option B: Keep first one running */}
          <button
            type="button"
            onClick={() => onProceed('keep')}
            disabled={actionLoading !== null}
            style={{
              background: '#FFFFFF',
              color: '#0F172A',
              border: '1.5px solid #CBD5E1',
              borderRadius: '12px',
              padding: '0.9rem 1.1rem',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PauseIcon size={14} style={{ color: '#64748B' }} />
                <span>Keep {runningTask.title} Running</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                {targetAction === 'start'
                  ? `Accept ${targetTask.title}, but keep its timer in Paused state`
                  : `Leave ${targetTask.title} in Paused state`}
              </div>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94A3B8' }}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
};
