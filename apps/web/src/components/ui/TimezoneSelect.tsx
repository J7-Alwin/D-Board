import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SearchIcon } from './Icons';

export interface TimezoneOption {
  value: string;
  name: string;
  sub: string;
  flagType: 'globe' | 'us' | 'uk' | 'eu' | 'uae' | 'india' | 'singapore' | 'japan' | 'australia';
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  {
    value: 'UTC',
    name: 'UTC (Coordinated Universal Time)',
    sub: 'UTC',
    flagType: 'globe',
  },
  {
    value: 'America/New_York',
    name: 'Eastern Time (US & Canada)',
    sub: 'ET (UTC-05:00)',
    flagType: 'us',
  },
  {
    value: 'America/Chicago',
    name: 'Central Time (US & Canada)',
    sub: 'CT (UTC-06:00)',
    flagType: 'us',
  },
  {
    value: 'America/Denver',
    name: 'Mountain Time (US & Canada)',
    sub: 'MT (UTC-07:00)',
    flagType: 'us',
  },
  {
    value: 'America/Los_Angeles',
    name: 'Pacific Time (US & Canada)',
    sub: 'PT (UTC-08:00)',
    flagType: 'us',
  },
  {
    value: 'Europe/London',
    name: 'London / GMT',
    sub: 'GMT (UTC+00:00)',
    flagType: 'uk',
  },
  {
    value: 'Europe/Paris',
    name: 'Central European Time (Paris, Berlin)',
    sub: 'CET (UTC+01:00)',
    flagType: 'eu',
  },
  {
    value: 'Asia/Dubai',
    name: 'Gulf Standard Time (Dubai)',
    sub: 'GST (UTC+04:00)',
    flagType: 'uae',
  },
  {
    value: 'Asia/Kolkata',
    name: 'India Standard Time (IST)',
    sub: 'IST (UTC+05:30)',
    flagType: 'india',
  },
  {
    value: 'Asia/Singapore',
    name: 'Singapore / Hong Kong (SGT)',
    sub: 'SGT (UTC+08:00)',
    flagType: 'singapore',
  },
  {
    value: 'Asia/Tokyo',
    name: 'Tokyo / Japan Standard Time (JST)',
    sub: 'JST (UTC+09:00)',
    flagType: 'japan',
  },
  {
    value: 'Australia/Sydney',
    name: 'Sydney / AEST',
    sub: 'AEST (UTC+10:00)',
    flagType: 'australia',
  },
];

// Circular Flag / Emblem SVGs
export const TimezoneFlagEmblem: React.FC<{ type: TimezoneOption['flagType']; size?: number }> = ({
  type,
  size = 24,
}) => {
  switch (type) {
    case 'globe':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10.5" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="1.2" />
          <ellipse cx="12" cy="12" rx="4.5" ry="10.5" stroke="#3B82F6" strokeWidth="1.2" />
          <line x1="1.5" y1="12" x2="22.5" y2="12" stroke="#3B82F6" strokeWidth="1.2" />
          <line x1="3.8" y1="7.2" x2="20.2" y2="7.2" stroke="#3B82F6" strokeWidth="1" />
          <line x1="3.8" y1="16.8" x2="20.2" y2="16.8" stroke="#3B82F6" strokeWidth="1" />
        </svg>
      );

    case 'us':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <mask id="tz-us-mask">
            <circle cx="12" cy="12" r="11" fill="#FFFFFF" />
          </mask>
          <g mask="url(#tz-us-mask)">
            <rect width="24" height="24" fill="#B22234" />
            <path
              d="M0 3.7h24M0 7.4h24M0 11.1h24M0 14.8h24M0 18.5h24M0 22.2h24"
              stroke="#FFFFFF"
              strokeWidth="1.85"
            />
            <rect width="11" height="12.5" fill="#3C3B6E" />
            <circle cx="2.5" cy="3" r="0.65" fill="#FFFFFF" />
            <circle cx="5.5" cy="3" r="0.65" fill="#FFFFFF" />
            <circle cx="8.5" cy="3" r="0.65" fill="#FFFFFF" />
            <circle cx="4" cy="5.2" r="0.65" fill="#FFFFFF" />
            <circle cx="7" cy="5.2" r="0.65" fill="#FFFFFF" />
            <circle cx="2.5" cy="7.4" r="0.65" fill="#FFFFFF" />
            <circle cx="5.5" cy="7.4" r="0.65" fill="#FFFFFF" />
            <circle cx="8.5" cy="7.4" r="0.65" fill="#FFFFFF" />
            <circle cx="4" cy="9.6" r="0.65" fill="#FFFFFF" />
            <circle cx="7" cy="9.6" r="0.65" fill="#FFFFFF" />
          </g>
          <circle cx="12" cy="12" r="11" stroke="#E2E8F0" strokeWidth="1" />
        </svg>
      );

    case 'uk':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <mask id="tz-uk-mask">
            <circle cx="12" cy="12" r="11" fill="#FFFFFF" />
          </mask>
          <g mask="url(#tz-uk-mask)">
            <rect width="24" height="24" fill="#012169" />
            <path d="M0 0 L24 24 M24 0 L0 24" stroke="#FFFFFF" strokeWidth="4.5" />
            <path d="M0 0 L24 24 M24 0 L0 24" stroke="#C8102E" strokeWidth="2" />
            <path d="M12 0 V24 M0 12 H24" stroke="#FFFFFF" strokeWidth="6" />
            <path d="M12 0 V24 M0 12 H24" stroke="#C8102E" strokeWidth="3.6" />
          </g>
          <circle cx="12" cy="12" r="11" stroke="#E2E8F0" strokeWidth="1" />
        </svg>
      );

    case 'eu':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="11" fill="#003399" />
          <g fill="#FFCC00">
            <circle cx="12" cy="4.5" r="0.9" />
            <circle cx="15.75" cy="5.5" r="0.9" />
            <circle cx="18.5" cy="8.25" r="0.9" />
            <circle cx="19.5" cy="12" r="0.9" />
            <circle cx="18.5" cy="15.75" r="0.9" />
            <circle cx="15.75" cy="18.5" r="0.9" />
            <circle cx="12" cy="19.5" r="0.9" />
            <circle cx="8.25" cy="18.5" r="0.9" />
            <circle cx="5.5" cy="15.75" r="0.9" />
            <circle cx="4.5" cy="12" r="0.9" />
            <circle cx="5.5" cy="8.25" r="0.9" />
            <circle cx="8.25" cy="5.5" r="0.9" />
          </g>
          <circle cx="12" cy="12" r="11" stroke="#E2E8F0" strokeWidth="1" />
        </svg>
      );

    case 'uae':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <mask id="tz-uae-mask">
            <circle cx="12" cy="12" r="11" fill="#FFFFFF" />
          </mask>
          <g mask="url(#tz-uae-mask)">
            <rect width="24" height="8" y="0" fill="#00732F" />
            <rect width="24" height="8" y="8" fill="#FFFFFF" />
            <rect width="24" height="8" y="16" fill="#000000" />
            <rect width="7.5" height="24" x="0" y="0" fill="#FF0000" />
          </g>
          <circle cx="12" cy="12" r="11" stroke="#E2E8F0" strokeWidth="1" />
        </svg>
      );

    case 'india':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <mask id="tz-in-mask">
            <circle cx="12" cy="12" r="11" fill="#FFFFFF" />
          </mask>
          <g mask="url(#tz-in-mask)">
            <rect width="24" height="8" y="0" fill="#FF9933" />
            <rect width="24" height="8" y="8" fill="#FFFFFF" />
            <rect width="24" height="8" y="16" fill="#138808" />
            <circle cx="12" cy="12" r="2.8" fill="none" stroke="#000080" strokeWidth="0.8" />
            <circle cx="12" cy="12" r="0.7" fill="#000080" />
            <line x1="12" y1="9.5" x2="12" y2="14.5" stroke="#000080" strokeWidth="0.5" />
            <line x1="9.5" y1="12" x2="14.5" y2="12" stroke="#000080" strokeWidth="0.5" />
          </g>
          <circle cx="12" cy="12" r="11" stroke="#E2E8F0" strokeWidth="1" />
        </svg>
      );

    case 'singapore':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <mask id="tz-sg-mask">
            <circle cx="12" cy="12" r="11" fill="#FFFFFF" />
          </mask>
          <g mask="url(#tz-sg-mask)">
            <rect width="24" height="12" y="0" fill="#ED2939" />
            <rect width="24" height="12" y="12" fill="#FFFFFF" />
            <path d="M4 3.5 a4 4 0 1 0 0 7 a3.5 3.5 0 1 1 0 -7" fill="#FFFFFF" />
            <circle cx="7.8" cy="5" r="0.5" fill="#FFFFFF" />
            <circle cx="9.2" cy="6" r="0.5" fill="#FFFFFF" />
            <circle cx="9.2" cy="8" r="0.5" fill="#FFFFFF" />
            <circle cx="7.8" cy="9" r="0.5" fill="#FFFFFF" />
            <circle cx="6.8" cy="7" r="0.5" fill="#FFFFFF" />
          </g>
          <circle cx="12" cy="12" r="11" stroke="#E2E8F0" strokeWidth="1" />
        </svg>
      );

    case 'japan':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="11" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
          <circle cx="12" cy="12" r="4.3" fill="#BC002D" />
        </svg>
      );

    case 'australia':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <mask id="tz-au-mask">
            <circle cx="12" cy="12" r="11" fill="#FFFFFF" />
          </mask>
          <g mask="url(#tz-au-mask)">
            <rect width="24" height="24" fill="#00008B" />
            <rect width="11" height="9" fill="#012169" />
            <path d="M0 0 L11 9 M11 0 L0 9" stroke="#FFFFFF" strokeWidth="2" />
            <path d="M0 0 L11 9 M11 0 L0 9" stroke="#C8102E" strokeWidth="0.8" />
            <path d="M5.5 0 V9 M0 4.5 H11" stroke="#FFFFFF" strokeWidth="2.5" />
            <path d="M5.5 0 V9 M0 4.5 H11" stroke="#C8102E" strokeWidth="1.2" />
            <circle cx="18" cy="4.5" r="0.8" fill="#FFFFFF" />
            <circle cx="20.5" cy="8.5" r="0.8" fill="#FFFFFF" />
            <circle cx="18" cy="12.5" r="0.8" fill="#FFFFFF" />
            <circle cx="15.5" cy="8.5" r="0.8" fill="#FFFFFF" />
            <circle cx="17.5" cy="17" r="1.3" fill="#FFFFFF" />
            <circle cx="6" cy="16" r="1.4" fill="#FFFFFF" />
          </g>
          <circle cx="12" cy="12" r="11" stroke="#E2E8F0" strokeWidth="1" />
        </svg>
      );

    default:
      return null;
  }
};

export interface TimezoneSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export const TimezoneSelect: React.FC<TimezoneSelectProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Current selected timezone
  const selectedOption = useMemo(() => {
    return TIMEZONE_OPTIONS.find((opt) => opt.value === value) || TIMEZONE_OPTIONS[0];
  }, [value]);

  // Filtered timezone list
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return TIMEZONE_OPTIONS;
    const q = searchQuery.toLowerCase().trim();
    return TIMEZONE_OPTIONS.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        opt.sub.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className="as-field-group as-span-2 tz-select-container" ref={containerRef}>
      <label className="as-field-label">Timezone</label>

      {/* Trigger Button */}
      <button
        type="button"
        className={`tz-trigger-box ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="tz-trigger-left">
          <TimezoneFlagEmblem type={selectedOption.flagType} size={22} />
          <span className="tz-trigger-name">{selectedOption.name}</span>
        </div>
        <span className={`tz-chevron-icon ${isOpen ? 'rotated' : ''}`}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="tz-popover-card" role="listbox">
          {/* Search Input Bar */}
          <div className="tz-search-row">
            <div className="tz-search-input-wrap">
              <SearchIcon size={16} className="tz-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search timezones..."
                className="tz-search-input"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="tz-options-list">
            {filteredOptions.length === 0 ? (
              <div className="tz-empty-state">No matching timezones found</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    className={`tz-option-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <div className="tz-option-flag">
                      <TimezoneFlagEmblem type={opt.flagType} size={24} />
                    </div>
                    <div className="tz-option-text-col">
                      <span className="tz-option-name">{opt.name}</span>
                      <span className="tz-option-sub">{opt.sub}</span>
                    </div>
                    {isSelected && (
                      <span className="tz-check-icon">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#2563EB"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
      <span className="as-field-hint tz-subtitle">
        Used for deadline milestones, calendar scheduling, and activity feeds.
      </span>
    </div>
  );
};
