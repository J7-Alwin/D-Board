import React, { useState, useEffect } from 'react';
import { calendarApi, type CalendarItem } from '../../api/calendar.api';
import {
  GoogleIcon,
  GoogleCalendarBadgeIcon,
  CloseIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
} from '../ui/Icons';

interface GoogleCalendarSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CalendarItem[];
  projectName?: string;
  projectId?: string;
}

// Inline SVGs for specialized graphics in the modal
const LinkIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const LockIcon: React.FC<{ size?: number; className?: string }> = ({ size = 12, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const HelpCircleIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const SyncArrowsIcon: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <polyline points="3 3 3 8 8 8" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <polyline points="21 21 21 16 16 16" />
  </svg>
);

const SunSparks: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="2" x2="12" y2="7" />
    <line x1="4.93" y1="4.93" x2="8.46" y2="8.46" />
    <line x1="19.07" y1="4.93" x2="15.54" y2="8.46" />
  </svg>
);

const CurvedArrow: React.FC = () => (
  <svg width="44" height="34" viewBox="0 0 48 36" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: '#2563EB' }}>
    <path d="M4 32C18 32 36 28 42 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    <path d="M34 10L42 6L44 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const GoogleCalendarSyncModal: React.FC<GoogleCalendarSyncModalProps> = ({
  isOpen,
  onClose,
  items,
  projectName = 'All Projects',
  projectId,
}) => {
  const [copied, setCopied] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [feedToken, setFeedToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [rotatingToken, setRotatingToken] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const loadToken = async () => {
      setLoadingToken(true);
      setTokenError(null);
      try {
        const res = await calendarApi.createFeedToken(projectId);
        if (isMounted && res.success && res.data?.token) {
          setFeedToken(res.data.token);
        }
      } catch (err: any) {
        if (isMounted) setTokenError(err.message || 'Failed to initialize subscription token');
      } finally {
        if (isMounted) setLoadingToken(false);
      }
    };
    loadToken();
    return () => {
      isMounted = false;
    };
  }, [isOpen, projectId]);

  const handleRegenerateToken = async () => {
    if (rotatingToken) return;
    setRotatingToken(true);
    try {
      const res = await calendarApi.createFeedToken(projectId);
      if (res.success && res.data?.token) {
        setFeedToken(res.data.token);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to rotate subscription token');
    } finally {
      setRotatingToken(false);
    }
  };

  if (!isOpen) return null;

  // Generate .ics standard file content for Google Calendar import
  const generateICSContent = () => {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//D-Board//Development Workspace Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:D-Board (' + projectName + ')',
      'X-WR-TIMEZONE:UTC',
    ];

    items.forEach((item) => {
      const start = new Date(item.startAt)
        .toISOString()
        .replace(/[-:]/g, '')
        .split('.')[0] + 'Z';
      const end = new Date(item.endAt)
        .toISOString()
        .replace(/[-:]/g, '')
        .split('.')[0] + 'Z';
      const cleanSummary = (item.title || 'Event').replace(/,/g, '\\,').replace(/;/g, '\\;');
      const cleanDesc = (
        item.description ||
        (item.project?.name ? `Project: ${item.project.name}` : 'D-Board Task')
      )
        .replace(/\n/g, '\\n')
        .replace(/,/g, '\\,');

      lines.push(
        'BEGIN:VEVENT',
        `UID:${item.id}@d-board.workspace`,
        `DTSTAMP:${start}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${cleanSummary}`,
        `DESCRIPTION:${cleanDesc}`,
        item.location ? `LOCATION:${item.location}` : 'LOCATION:D-Board Workspace',
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  };

  const handleDownloadICS = () => {
    const icsData = generateICSContent();
    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `d-board-calendar-${new Date().toISOString().split('T')[0]}.ics`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const calendarFeedUrl = feedToken
    ? (projectId
        ? `${window.location.origin}/api/projects/${projectId}/calendar/feed.ics?token=${feedToken}`
        : `${window.location.origin}/api/calendar/feed.ics?token=${feedToken}`)
    : (projectId
        ? `${window.location.origin}/api/projects/${projectId}/calendar/feed.ics`
        : `${window.location.origin}/api/calendar/feed.ics`);

  const handleCopyFeed = () => {
    navigator.clipboard.writeText(calendarFeedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDirectOAuthSync = () => {
    alert('Direct 2-way Google Calendar OAuth synchronization is currently in development. You can immediately import your calendar using the .ics file download or subscribe to the live auto-updating feed URL below!');
  };


  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container gcal-sync-modal-luxury"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="gcal-modal-header">
          <div className="gcal-header-left">
            <div className="gcal-logo-badge">
              <GoogleCalendarBadgeIcon size={28} />
            </div>
            <div className="gcal-header-text">
              <h2 className="gcal-modal-title">Sync with Google Calendar</h2>
              <p className="gcal-modal-subtitle">
                Keep your D-Board milestones &amp; deadlines in sync with Google Calendar.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="gcal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="gcal-modal-body">
          {syncSuccess && (
            <div className="gcal-success-banner">
              <span className="gcal-check-circle-sm">
                <CheckIcon size={14} />
              </span>
              <span>
                Calendar file generated! Import the downloaded <code>.ics</code> file into Google Calendar Settings &gt; Import &amp; Export.
              </span>
            </div>
          )}

          {/* Section 1: 2-Column Split Hero */}
          <div className="gcal-hero-grid">
            {/* Left Column: Details & Call to action */}
            <div className="gcal-hero-left">
              <div className="gcal-hero-badge" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                <LinkIcon size={12} />
                <span>ACTIVE CAPABILITY</span>
              </div>

              <h1 className="gcal-hero-heading">Instant Calendar Export</h1>

              <p className="gcal-hero-desc">
                Download your standard RFC 5545 iCalendar file to import all deadlines and meetings into Google Calendar, Apple Calendar, or Outlook.
              </p>

              <div className="gcal-hero-features">
                <div className="gcal-hero-feature-row">
                  <span className="gcal-feature-icon-box">
                    <CheckIcon size={12} />
                  </span>
                  <span>Export all project deadlines, milestones, and meetings</span>
                </div>

                <div className="gcal-hero-feature-row">
                  <span className="gcal-feature-icon-box">
                    <CheckIcon size={12} />
                  </span>
                  <span>Compatible with Google, Apple, and Outlook calendars</span>
                </div>

                <div className="gcal-hero-feature-row">
                  <span className="gcal-feature-icon-box">
                    <CheckIcon size={12} />
                  </span>
                  <span>Live subscription feed available for background updates</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="gcal-hero-connect-btn"
                  onClick={() => {
                    handleDownloadICS();
                    setSyncSuccess(true);
                  }}
                >
                  <DownloadIcon size={18} />
                  <span>Download .ics Calendar File</span>
                  <ArrowRightIcon size={16} />
                </button>

                <button
                  type="button"
                  onClick={handleDirectOAuthSync}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    color: '#64748B',
                    cursor: 'pointer'
                  }}
                >
                  <GoogleIcon size={15} />
                  <span>Direct Google OAuth 2-Way Sync (Coming Soon)</span>
                </button>
              </div>

              <div className="gcal-security-note">
                <LockIcon size={12} />
                <span>Export contains only workspace calendar events you have permission to view.</span>
              </div>
            </div>

            {/* Right Column: Illustration Card */}
            <div className="gcal-illustration-card">
              {/* Top Row: D-Board app, Sync icon, Google Calendar app */}
              <div className="gcal-illus-top-row">
                <div className="gcal-app-item">
                  <div className="gcal-app-box dboard-box">
                    <span className="gcal-dboard-letter">D</span>
                  </div>
                  <span className="gcal-app-name">D-Board</span>
                </div>

                <div className="gcal-sync-arrow-box">
                  <SyncArrowsIcon size={28} />
                </div>

                <div className="gcal-app-item">
                  <div className="gcal-app-box gcal-box">
                    <GoogleCalendarBadgeIcon size={34} />
                  </div>
                  <span className="gcal-app-name">Google Calendar</span>
                </div>
              </div>

              {/* Calendar Mockup */}
              <div className="gcal-mockup-wrapper">
                <div className="gcal-spark-accent">
                  <SunSparks />
                </div>

                <div className="gcal-mockup-window">
                  <div className="gcal-mockup-header">
                    <button type="button" className="gcal-mockup-nav-btn" aria-label="Previous month">
                      <ChevronLeftIcon size={12} />
                    </button>
                    <span className="gcal-mockup-title">March 2026</span>
                    <button type="button" className="gcal-mockup-nav-btn" aria-label="Next month">
                      <ChevronRightIcon size={12} />
                    </button>
                  </div>

                  <div className="gcal-mockup-weekdays">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                    <span>Sun</span>
                  </div>

                  <div className="gcal-mockup-grid">
                    <div className="gcal-chip blue-chip">
                      <UserIcon size={10} />
                      <span className="chip-text">Design Review<br />10:00 AM</span>
                    </div>

                    <div className="gcal-chip green-chip">
                      <span className="gcal-chip-dot green" />
                      <span className="chip-text">Sprint Planning<br />2:00 PM</span>
                    </div>

                    <div className="gcal-chip purple-chip">
                      <span className="gcal-chip-dot purple" />
                      <span className="chip-text">Product Demo<br />11:00 AM</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Handwritten Note with Arrow */}
              <div className="gcal-handwritten-row">
                <div className="gcal-handwritten-note">
                  Your work,<br />
                  where you already plan.
                </div>
                <div className="gcal-handwritten-arrow">
                  <CurvedArrow />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Live Calendar Subscription Feed Card */}
          <div className="gcal-feed-card">
            <div className="gcal-feed-card-header">
              <div className="gcal-feed-icon-box">
                <LinkIcon size={18} />
              </div>
              <div className="gcal-feed-header-text">
                <h3 className="gcal-feed-title">Live Calendar Subscription Feed</h3>
                <p className="gcal-feed-desc">
                  Add via Google Calendar &ldquo;Other calendars &gt; From URL&rdquo; for live auto-updating sync.
                </p>
              </div>
            </div>

            <div className="gcal-feed-input-row">
              <div className="gcal-feed-input-box">
                <CopyIcon size={15} className="gcal-input-leading-icon" />
                <input
                  type="text"
                  readOnly
                  value={loadingToken ? 'Generating secure subscription link...' : calendarFeedUrl}
                  className="gcal-feed-input"
                />
              </div>
              <button
                type="button"
                onClick={handleCopyFeed}
                disabled={loadingToken}
                className="gcal-copy-btn"
              >
                <CopyIcon size={15} />
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B' }}>
                <LockIcon size={12} />
                <span>Private subscription token. Regenerate if ever exposed.</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleRegenerateToken}
                  disabled={rotatingToken || loadingToken}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563EB',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: rotatingToken ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  {rotatingToken ? 'Regenerating...' : 'Regenerate Secret URL'}
                </button>
                <button
                  type="button"
                  className="gcal-download-link"
                  onClick={handleDownloadICS}
                >
                  <DownloadIcon size={14} />
                  <span>Download .ics File</span>
                </button>
              </div>
            </div>
            {tokenError && (
              <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '6px' }}>
                {tokenError}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="gcal-modal-footer">
          <div className="gcal-footer-help">
            <HelpCircleIcon size={16} />
            <span>
              Need help? <a href="https://support.google.com/calendar/answer/37100" target="_blank" rel="noopener noreferrer" className="gcal-help-link">Learn how</a> to sync with Google Calendar.
            </span>
          </div>

          <button type="button" className="gcal-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
