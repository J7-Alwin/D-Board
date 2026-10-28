import React from 'react';

/**
 * Background Atmosphere for the Fullscreen Tasks Board matching Pic 2
 * Soft pastel watercolor waves: cyan/sky-blue wave on the bottom-right,
 * soft emerald/mint curve along bottom-center, and warm central glow.
 */
export const TasksBoardBackgroundAtmosphere: React.FC = () => {
  return (
    <svg
      className="tasks-board-bg-atmosphere-svg"
      viewBox="0 0 1000 88"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <defs>
        {/* Soft cyan gradient for the bottom-right corner */}
        <linearGradient id="tb-cyan-grad" x1="100%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.55" />
          <stop offset="50%" stopColor="#E0F2FE" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        {/* Soft mint/emerald gradient for bottom-center */}
        <linearGradient id="tb-mint-grad" x1="50%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.6" />
          <stop offset="55%" stopColor="#D1FAE5" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#F0FDF4" stopOpacity="0" />
        </linearGradient>

        {/* Soft warm sun glow behind center artwork */}
        <radialGradient id="tb-sun-glow" cx="50%" cy="40%" r="35%">
          <stop offset="0%" stopColor="#FEF9C3" stopOpacity="0.45" />
          <stop offset="70%" stopColor="#ECFDF5" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Warm central ambient aura */}
      <rect x="340" y="0" width="380" height="88" fill="url(#tb-sun-glow)" />

      {/* Gentle center mint curve along bottom */}
      <path
        d="M 370 88 C 420 62 510 56 580 66 C 630 73 680 68 730 60 L 730 88 Z"
        fill="url(#tb-mint-grad)"
      />

      {/* Right-hand sky-blue atmosphere wave matching Pic 2 */}
      <path
        d="M 710 88 C 770 58 860 50 1000 64 L 1000 88 Z"
        fill="url(#tb-cyan-grad)"
      />
      <path
        d="M 800 88 C 870 66 930 62 1000 72 L 1000 88 Z"
        fill="#E0F2FE"
        opacity="0.4"
      />
    </svg>
  );
};

/**
 * Centered Handwritten Quote with increased font size and no green line
 */
export const TasksBoardQuote: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`tasks-board-quote-wrap ${className}`}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        userSelect: 'none',
        padding: '0 1.25rem',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <span
        style={{
          fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
          fontStyle: 'italic',
          fontSize: '1.3rem',
          color: '#1E293B',
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: '-0.015em',
          whiteSpace: 'nowrap',
        }}
      >
        Turn tasks into progress.
      </span>
    </div>
  );
};

/**
 * Mini Kanban Board Illustration positioned directly beside the buttons
 * Exactly replicates Pic 2 with lush foliage puffs, column header pills,
 * cards with avatar dots, flight loop trail, origami paper plane & 3 golden sparkle stars.
 */
export const TasksBoardIllustration: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`tasks-board-illustration-wrap ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        userSelect: 'none',
        flexShrink: 0,
        position: 'relative',
        zIndex: 1,
        marginRight: '0.25rem',
      }}
    >
      <svg
        width="238"
        height="70"
        viewBox="0 0 238 70"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
        aria-hidden="true"
      >
        <defs>
          <filter id="tb-mini-board-shadow" x="-12%" y="-12%" width="128%" height="128%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.07" />
          </filter>
        </defs>

        {/* 1. Large 4-point Golden Sparkle Star on the left */}
        <path
          d="M 14 26 Q 14 31 9 31 Q 14 31 14 36 Q 14 31 19 31 Q 14 31 14 26 Z"
          fill="#F59E0B"
        />

        {/* 2. Small 4-point Golden Sparkle Star on lower-left */}
        <path
          d="M 7 42 Q 7 45 4 45 Q 7 45 7 48 Q 7 45 10 45 Q 7 45 7 42 Z"
          fill="#FBBF24"
        />

        {/* 3. 4-point Golden Sparkle Star on top-right above column 3 */}
        <path
          d="M 166 11 Q 166 15 162 15 Q 166 15 166 19 Q 166 15 170 15 Q 166 15 166 11 Z"
          fill="#F59E0B"
        />

        {/* Lush Greenery / Foliage under the mini board matching Pic 2 */}
        {/* Soft pastel mint/green hill mound cloud under base of board */}
        <path
          d="M 22 68 C 30 55 48 53 62 59 C 74 53 92 51 110 57 C 126 51 144 53 156 59 C 166 55 178 58 184 68 Z"
          fill="#A7F3D0"
          opacity="0.55"
        />
        <path
          d="M 28 68 C 36 59 48 57 62 63 C 76 57 94 57 110 62 C 124 57 138 59 148 64 C 158 61 170 64 176 68 Z"
          fill="#6EE7B7"
          opacity="0.7"
        />

        {/* Botanical leaf sprigs on the left rising up past board */}
        <path
          d="M 16 63 C 8 50 11 34 23 32 C 27 42 23 55 16 63 Z"
          fill="#059669"
        />
        <path
          d="M 22 65 C 15 53 20 40 32 38 C 35 48 30 59 22 65 Z"
          fill="#10B981"
        />
        <path
          d="M 27 67 C 27 53 37 43 45 47 C 43 57 36 63 27 67 Z"
          fill="#34D399"
          opacity="0.95"
        />

        {/* Mini Kanban Board Container */}
        <g filter="url(#tb-mini-board-shadow)">
          <rect
            x="26"
            y="7"
            width="140"
            height="55"
            rx="8"
            fill="#FFFFFF"
            stroke="#E2E8F0"
            strokeWidth="1.2"
          />

          {/* Column Dividers inside board */}
          <line x1="72.6" y1="8" x2="72.6" y2="61" stroke="#F1F5F9" strokeWidth="1" />
          <line x1="119.3" y1="8" x2="119.3" y2="61" stroke="#F1F5F9" strokeWidth="1" />

          {/* Column 1 (Blue) */}
          <circle cx="37.5" cy="17.5" r="3.2" fill="#2563EB" />
          <rect x="43.5" y="15.5" width="18" height="4" rx="2" fill="#2563EB" />
          {/* Card 1 */}
          <rect x="32" y="24" width="35" height="13.5" rx="3.5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.8" />
          <circle cx="38" cy="30.5" r="2.2" fill="#CBD5E1" />
          <rect x="43" y="28.5" width="18" height="2" rx="1" fill="#94A3B8" />
          <rect x="43" y="32" width="11" height="1.8" rx="0.9" fill="#E2E8F0" />
          {/* Card 2 */}
          <rect x="32" y="41" width="35" height="13.5" rx="3.5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.8" />
          <circle cx="38" cy="47.5" r="2.2" fill="#CBD5E1" />
          <rect x="43" y="45.5" width="16" height="2" rx="1" fill="#94A3B8" />
          <rect x="43" y="49" width="10" height="1.8" rx="0.9" fill="#E2E8F0" />

          {/* Column 2 (Golden / Amber) */}
          <circle cx="79.5" cy="17.5" r="3.2" fill="#F59E0B" />
          <rect x="85.5" y="15.5" width="18" height="4" rx="2" fill="#F59E0B" />
          {/* Card 1 */}
          <rect x="74" y="24" width="35" height="13.5" rx="3.5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.8" />
          <circle cx="80" cy="30.5" r="2.2" fill="#CBD5E1" />
          <rect x="85" y="28.5" width="18" height="2" rx="1" fill="#94A3B8" />
          <rect x="85" y="32" width="12" height="1.8" rx="0.9" fill="#E2E8F0" />
          {/* Card 2 */}
          <rect x="74" y="41" width="35" height="13.5" rx="3.5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.8" />
          <circle cx="80" cy="47.5" r="2.2" fill="#CBD5E1" />
          <rect x="85" y="45.5" width="15" height="2" rx="1" fill="#94A3B8" />
          <rect x="85" y="49" width="9" height="1.8" rx="0.9" fill="#E2E8F0" />

          {/* Column 3 (Green) */}
          <circle cx="122.5" cy="17.5" r="3.2" fill="#10B981" />
          <rect x="128.5" y="15.5" width="18" height="4" rx="2" fill="#10B981" />
          {/* Card 1 */}
          <rect x="117" y="24" width="35" height="13.5" rx="3.5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.8" />
          <circle cx="123" cy="30.5" r="2.2" fill="#CBD5E1" />
          <rect x="128" y="28.5" width="18" height="2" rx="1" fill="#94A3B8" />
          <rect x="128" y="32" width="11" height="1.8" rx="0.9" fill="#E2E8F0" />
          {/* Card 2 */}
          <rect x="117" y="41" width="35" height="13.5" rx="3.5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.8" />
          <circle cx="123" cy="47.5" r="2.2" fill="#CBD5E1" />
          <rect x="128" y="45.5" width="14" height="2" rx="1" fill="#94A3B8" />
          <rect x="128" y="49" width="8" height="1.8" rx="0.9" fill="#E2E8F0" />
        </g>

        {/* Flight Dotted Loop Trail */}
        <path
          d="M 166 52 C 176 58 190 56 188 44 C 185 34 168 36 172 49 C 175 58 192 48 206 32"
          stroke="#94A3B8"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          strokeLinecap="round"
          fill="none"
        />

        {/* Paper Airplane Flying Upward-Right matching Pic 2 */}
        <g transform="translate(204, 18) rotate(22)">
          <polygon points="0,11 18,0 2,18 7,11" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.3" strokeLinejoin="round" />
          <polygon points="7,11 18,0 11,16" fill="#F8FAFC" stroke="#1E293B" strokeWidth="1.3" strokeLinejoin="round" />
          <polygon points="0,11 7,11 6,16" fill="#E2E8F0" stroke="#1E293B" strokeWidth="1.3" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
};

// Backwards-compatible compound component
export const TasksBoardHeaderArt: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <>
      <TasksBoardQuote className={className} />
      <TasksBoardIllustration className={className} />
    </>
  );
};
