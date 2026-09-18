import React from 'react';

export const CalendarHeaderAtmosphere: React.FC = () => {
  return (
    <div className="cal-header-art-container" aria-hidden="true">
      <div className="cal-quote-text-group">
        <span className="cal-quote-text">Plan today, build tomorrow.</span>
        <svg
          className="cal-quote-underline-svg"
          viewBox="0 0 120 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 12C35 3 85 2 117 10M55 14C75 9 95 8 115 13"
            stroke="#22C55E"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <svg
        className="cal-header-art-svg"
        viewBox="0 0 175 74"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="cal-hill-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="25%" stopColor="#E6F7ED" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#D1FAE5" stopOpacity="1" />
          </linearGradient>
          <filter id="cal-card-shadow" x="-10%" y="-10%" width="125%" height="125%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0F172A" floodOpacity="0.06" />
          </filter>
        </defs>

        {/* Soft Background Hills */}
        <path
          d="M0 74 C30 54 75 48 118 58 C145 64 165 56 175 52 L175 74 L0 74 Z"
          fill="url(#cal-hill-grad)"
        />

        {/* Sun */}
        <circle cx="108" cy="21" r="10.5" fill="#FDE047" opacity="0.95" />

        {/* Soft Clouds */}
        <path
          d="M90 25 C90 22 93 20 96 20 C98 20 100 21 101 23 C103 22 106 23 107 25 C108 27 107 29 105 29 L92 29 C90 29 90 27 90 25 Z"
          fill="#F1F5F9"
          opacity="0.85"
        />
        <path
          d="M125 17 C125 14 128 12 131 12 C133 12 135 13 136 15 C138 14 141 15 142 17 C143 19 142 21 140 21 L127 21 C125 21 125 19 125 17 Z"
          fill="#F1F5F9"
          opacity="0.85"
        />
        <path
          d="M142 27 C142 25 144 23 147 23 C149 23 150 24 151 25 C152 24 155 25 156 26 C157 28 156 30 154 30 L144 30 C142 30 142 28 142 27 Z"
          fill="#F1F5F9"
          opacity="0.8"
        />

        {/* Right background hill slope */}
        <path d="M125 74 C138 52 156 43 175 50 L175 74 Z" fill="#A7F3D0" />

        {/* Desk Calendar Base Card */}
        <g filter="url(#cal-card-shadow)">
          <rect
            x="52"
            y="24"
            width="56"
            height="43"
            rx="6"
            fill="#FFFFFF"
            stroke="#E2E8F0"
            strokeWidth="1.2"
          />
        </g>

        {/* Binder Rings at Top */}
        <rect x="62" y="19" width="3.5" height="9" rx="1.75" fill="#475569" />
        <rect x="78" y="19" width="3.5" height="9" rx="1.75" fill="#475569" />
        <rect x="94" y="19" width="3.5" height="9" rx="1.75" fill="#475569" />

        {/* Dot Matrix (4 columns x 3 rows) */}
        {/* Row 1 */}
        <circle cx="64" cy="37" r="2.3" fill="#CBD5E1" />
        <circle cx="75" cy="37" r="2.3" fill="#CBD5E1" />
        <circle cx="86" cy="37" r="2.3" fill="#10B981" />
        <circle cx="97" cy="37" r="2.3" fill="#CBD5E1" />

        {/* Row 2 */}
        <circle cx="64" cy="47" r="2.3" fill="#CBD5E1" />
        <circle cx="75" cy="47" r="2.3" fill="#10B981" />
        <circle cx="86" cy="47" r="2.3" fill="#CBD5E1" />
        <circle cx="97" cy="47" r="2.3" fill="#CBD5E1" />

        {/* Row 3 */}
        <circle cx="64" cy="57" r="2.3" fill="#CBD5E1" />
        <circle cx="75" cy="57" r="2.3" fill="#CBD5E1" />
        <circle cx="86" cy="57" r="2.3" fill="#10B981" />
        <circle cx="97" cy="57" r="2.3" fill="#CBD5E1" />

        {/* Evergreen Tree on Right */}
        {/* Trunk */}
        <rect x="151" y="53" width="3.5" height="17" rx="1" fill="#78350F" />
        {/* Foliage Left */}
        <path
          d="M152.75 22 C146 22 143 36 144 54 C145 58 152.75 58 152.75 58 Z"
          fill="#10B981"
        />
        {/* Foliage Right (Shadowed) */}
        <path
          d="M152.75 22 C159.5 22 162.5 36 161.5 54 C160.5 58 152.75 58 152.75 58 Z"
          fill="#059669"
        />
        {/* Subtle Branch Highlights */}
        <path
          d="M149 34 L152.75 32 L156 34 M148 44 L152.75 41 L157 44"
          stroke="#34D399"
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />

        {/* Foreground Slope */}
        <path d="M25 74 C60 66 110 64 175 70 L175 74 Z" fill="#6EE7B7" opacity="0.3" />
      </svg>
    </div>
  );
};

export const FilesHeaderAtmosphere: React.FC = () => {
  return (
    <div className="cal-header-art-container files-art-container" aria-hidden="true">
      <div className="cal-quote-text-group">
        <span className="cal-quote-text">Organize today, access tomorrow.</span>
        <svg
          className="cal-quote-underline-svg"
          viewBox="0 0 120 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 12C35 3 85 2 117 10M55 14C75 9 95 8 115 13"
            stroke="#22C55E"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <svg
        className="cal-header-art-svg"
        viewBox="0 0 175 74"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="files-hill-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="25%" stopColor="#E6F7ED" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#D1FAE5" stopOpacity="1" />
          </linearGradient>
          <filter id="doc-card-shadow" x="-10%" y="-10%" width="125%" height="125%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0F172A" floodOpacity="0.06" />
          </filter>
        </defs>

        {/* Soft Background Hills */}
        <path
          d="M0 74 C30 54 75 48 118 58 C145 64 165 56 175 52 L175 74 L0 74 Z"
          fill="url(#files-hill-grad)"
        />

        {/* Sun */}
        <circle cx="102" cy="21" r="10.5" fill="#FDE047" opacity="0.95" />

        {/* Wind / flourish arc */}
        <path
          d="M125 19 C140 7 153 19 149 33"
          stroke="#86EFAC"
          strokeDasharray="3,3"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />

        {/* Soft Clouds */}
        <path
          d="M82 27 C82 24 85 22 88 22 C90 22 92 23 93 24 C95 23 98 24 99 26 C100 28 99 30 97 30 L84 30 C82 30 82 28 82 27 Z"
          fill="#F1F5F9"
          opacity="0.85"
        />
        <path
          d="M142 27 C142 25 144 23 147 23 C149 23 150 24 151 25 C152 24 155 25 156 26 C157 28 156 30 154 30 L144 30 C142 30 142 28 142 27 Z"
          fill="#F1F5F9"
          opacity="0.8"
        />

        {/* Right background hill */}
        <path d="M125 74 C138 52 156 43 175 50 L175 74 Z" fill="#A7F3D0" opacity="0.6" />

        {/* Open Green Folder Back Tab */}
        <path
          d="M52 35 L66 35 L72 39 L108 39 C110.5 39 112 40.5 112 43 L112 68 C112 70.5 110.5 72 108 72 L52 72 C49.5 72 48 70.5 48 68 L48 39 C48 36.5 49.5 35 52 35 Z"
          fill="#86EFAC"
        />

        {/* Document Sheet Sticking Out (with Folded Corner & Blue Lines) */}
        <g filter="url(#doc-card-shadow)">
          <path
            d="M72 21 L94 21 L105 32 L105 62 C105 64 103.5 65.5 101.5 65.5 L72 65.5 C70 65.5 68.5 64 68.5 62 L68.5 24.5 C68.5 22.5 70 21 72 21 Z"
            fill="#FFFFFF"
            stroke="#E2E8F0"
            strokeWidth="1.2"
          />
        </g>

        {/* Folded Top-Right Corner */}
        <path d="M94 21 L94 32 L105 32 Z" fill="#E2E8F0" />
        <path d="M94 21 L105 32" stroke="#CBD5E1" strokeWidth="0.8" />

        {/* Blue Document Lines */}
        <line x1="74" y1="40" x2="98" y2="40" stroke="#3B82F6" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="74" y1="47" x2="96" y2="47" stroke="#60A5FA" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="74" y1="54" x2="90" y2="54" stroke="#93C5FD" strokeWidth="2.2" strokeLinecap="round" />

        {/* Front Folder Flap (Angled Forward) */}
        <path
          d="M47 43 L113 43 L109 69 C108.5 70.5 107 71.5 105 71.5 L51 71.5 C49 71.5 47.5 70.5 47 69 Z"
          fill="#A7F3D0"
        />

        {/* Evergreen Tree on Right */}
        {/* Trunk */}
        <rect x="153" y="53" width="3.5" height="17" rx="1" fill="#78350F" />
        {/* Foliage Left */}
        <path
          d="M154.75 22 C148 22 145 36 146 54 C147 58 154.75 58 154.75 58 Z"
          fill="#10B981"
        />
        {/* Foliage Right (Shadowed) */}
        <path
          d="M154.75 22 C161.5 22 164.5 36 163.5 54 C162.5 58 154.75 58 154.75 58 Z"
          fill="#059669"
        />
        {/* Subtle Branch Highlights */}
        <path
          d="M151 34 L154.75 32 L158 34 M150 44 L154.75 41 L159 44"
          stroke="#34D399"
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
      </svg>
    </div>
  );
};

export const NotesHeaderAtmosphere: React.FC = () => {
  return (
    <div className="cal-header-art-container notes-art-container" aria-hidden="true">
      <div className="cal-quote-text-group">
        <span className="cal-quote-text">Write today, build tomorrow.</span>
        <svg
          className="cal-quote-underline-svg"
          viewBox="0 0 120 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 12C35 3 85 2 117 10M55 14C75 9 95 8 115 13"
            stroke="#22C55E"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <svg
        className="cal-header-art-svg"
        viewBox="0 0 175 74"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="notes-hill-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="25%" stopColor="#E6F7ED" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#D1FAE5" stopOpacity="1" />
          </linearGradient>
          <filter id="notepad-card-shadow" x="-10%" y="-10%" width="125%" height="125%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0F172A" floodOpacity="0.06" />
          </filter>
        </defs>

        {/* Soft Background Hills */}
        <path
          d="M0 74 C30 54 75 48 118 58 C145 64 165 56 175 52 L175 74 L0 74 Z"
          fill="url(#notes-hill-grad)"
        />

        {/* Sun */}
        <circle cx="106" cy="20" r="10.5" fill="#FDE047" opacity="0.95" />

        {/* Soft Clouds */}
        <path
          d="M80 26 C80 23 83 21 86 21 C88 21 90 22 91 23 C93 22 96 23 97 25 C98 27 97 29 95 29 L82 29 C80 29 80 27 80 26 Z"
          fill="#F1F5F9"
          opacity="0.85"
        />
        <path
          d="M142 26 C142 24 144 22 147 22 C149 22 150 23 151 24 C152 23 155 24 156 25 C157 27 156 29 154 29 L144 29 C142 29 142 27 142 26 Z"
          fill="#F1F5F9"
          opacity="0.8"
        />

        {/* Green Plant / Leaves at Left of Notepad */}
        <path
          d="M50 68 C44 58 48 48 56 50 C54 58 52 64 50 68 Z"
          fill="#10B981"
        />
        <path
          d="M48 68 C42 64 42 54 48 55 C48 60 48 64 48 68 Z"
          fill="#059669"
        />

        {/* Spiral Notepad Card */}
        <g filter="url(#notepad-card-shadow)">
          <rect
            x="58"
            y="21"
            width="50"
            height="46"
            rx="5"
            fill="#FFFFFF"
            stroke="#E2E8F0"
            strokeWidth="1.2"
          />
        </g>

        {/* Spiral Binder Rings at Top */}
        <circle cx="66" cy="21" r="1.8" fill="#475569" />
        <circle cx="75" cy="21" r="1.8" fill="#475569" />
        <circle cx="84" cy="21" r="1.8" fill="#475569" />
        <circle cx="93" cy="21" r="1.8" fill="#475569" />
        <circle cx="100" cy="21" r="1.8" fill="#475569" />

        {/* Notepad Lines */}
        <line x1="64" y1="30" x2="102" y2="30" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="64" y1="37" x2="100" y2="37" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="64" y1="44" x2="96" y2="44" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="64" y1="51" x2="90" y2="51" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="64" y1="58" x2="86" y2="58" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />

        {/* Green bullet check on first line */}
        <circle cx="68" cy="30" r="1.8" fill="#10B981" />

        {/* Diagonal Yellow Pencil */}
        <g transform="rotate(-38 105 46)">
          {/* Pencil Body */}
          <rect x="86" y="44" width="28" height="6.5" rx="1.5" fill="#FBBF24" stroke="#F59E0B" strokeWidth="0.6" />
          <line x1="88" y1="47.25" x2="112" y2="47.25" stroke="#F59E0B" strokeWidth="0.8" />
          {/* Metal Band */}
          <rect x="114" y="44" width="3.5" height="6.5" fill="#CBD5E1" />
          {/* Pink Eraser */}
          <rect x="117.5" y="44" width="4.5" height="6.5" rx="1.5" fill="#F472B6" />
          {/* Sharpened Wood Cone */}
          <polygon points="86,44 86,50.5 78,47.25" fill="#FED7AA" />
          {/* Graphite Lead Tip */}
          <polygon points="80,46.3 80,48.2 78,47.25" fill="#1E293B" />
        </g>

        {/* Right background hill & Pine tree */}
        <path d="M125 74 C138 52 156 43 175 50 L175 74 Z" fill="#A7F3D0" opacity="0.6" />
        <rect x="153" y="53" width="3.5" height="17" rx="1" fill="#78350F" />
        <path
          d="M154.75 22 C148 22 145 36 146 54 C147 58 154.75 58 154.75 58 Z"
          fill="#10B981"
        />
        <path
          d="M154.75 22 C161.5 22 164.5 36 163.5 54 C162.5 58 154.75 58 154.75 58 Z"
          fill="#059669"
        />
        <path
          d="M151 34 L154.75 32 L158 34 M150 44 L154.75 41 L159 44"
          stroke="#34D399"
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
      </svg>
    </div>
  );
};

export const NotificationsHeaderAtmosphere: React.FC = () => {
  return (
    <div className="cal-header-art-container" aria-hidden="true">
      <div className="cal-quote-text-group">
        <span className="cal-quote-text">Nothing important gets missed.</span>
        <svg
          className="cal-quote-underline-svg"
          viewBox="0 0 120 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 12C35 3 85 2 117 10M55 14C75 9 95 8 115 13"
            stroke="#22C55E"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <svg
        className="cal-header-art-svg"
        viewBox="0 0 175 74"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="notif-hill-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="30%" stopColor="#EFF6FF" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#DBEAFE" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="notif-bell-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#EAB308" />
          </linearGradient>
          <linearGradient id="notif-plane-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <filter id="notif-bell-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#B45309" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Soft Background Hill */}
        <path
          d="M0 74 C35 55 80 50 125 58 C148 62 165 55 175 50 L175 74 L0 74 Z"
          fill="url(#notif-hill-grad)"
        />

        {/* Soft Fluffy Clouds */}
        <path
          d="M10 38 C10 34 14 31 18 31 C21 31 23 33 25 35 C27 33 31 34 33 37 C34 40 33 43 30 43 L13 43 C10 43 10 41 10 38 Z"
          fill="#F1F5F9"
          opacity="0.85"
        />
        <path
          d="M68 22 C68 18 72 15 77 15 C80 15 83 17 85 20 C88 18 93 19 95 23 C97 26 95 30 91 30 L73 30 C69 30 68 26 68 22 Z"
          fill="#EFF6FF"
          opacity="0.9"
        />
        <path
          d="M138 25 C138 22 141 19 145 19 C147 19 149 20 150 22 C152 21 155 22 157 24 C158 27 157 29 154 29 L141 29 C138 29 138 27 138 25 Z"
          fill="#F8FAFC"
          opacity="0.85"
        />

        {/* Bell Sparkle Radiance Lines */}
        <line x1="88" y1="12" x2="88" y2="7" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        <line x1="77" y1="17" x2="73" y2="13" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        <line x1="99" y1="17" x2="103" y2="13" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        <circle cx="72" cy="24" r="1.2" fill="#FBBF24" opacity="0.7" />
        <circle cx="104" cy="24" r="1.2" fill="#FBBF24" opacity="0.7" />

        {/* Golden Notification Bell */}
        <g filter="url(#notif-bell-shadow)">
          {/* Bell Top Handle Loop */}
          <path
            d="M84 22 C84 19 92 19 92 22"
            stroke="#D97706"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />

          {/* Bell Body */}
          <path
            d="M88 21 C82 21 78 28 77 39 C76 45 72 48 71 50 C71 52 73 53 76 53 L100 53 C103 53 105 52 105 50 C104 48 100 45 99 39 C98 28 94 21 88 21 Z"
            fill="url(#notif-bell-grad)"
            stroke="#D97706"
            strokeWidth="1.2"
          />

          {/* Bell Highlight Curve */}
          <path
            d="M81 33 C81 26 84 23 88 23"
            stroke="#FEF9C3"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.85"
          />

          {/* Bell Clapper */}
          <circle cx="88" cy="56" r="3.2" fill="#1E293B" />
          <path d="M86 53 L90 53 L89 55 L87 55 Z" fill="#475569" />
        </g>

        {/* Origami Paper Airplane Flying Right */}
        <g transform="translate(132, 14) rotate(-8)">
          {/* Motion Dash Trail */}
          <path
            d="M-14 24 C-8 23 -2 20 6 15"
            stroke="#93C5FD"
            strokeWidth="1.2"
            strokeDasharray="2 2"
            strokeLinecap="round"
            opacity="0.7"
          />

          {/* Airplane Body & Wings */}
          {/* Main Wing Left / Top */}
          <polygon
            points="28,2 4,14 14,16"
            fill="url(#notif-plane-grad)"
          />
          {/* Main Wing Right / Bottom */}
          <polygon
            points="28,2 14,16 20,24"
            fill="#2563EB"
          />
          {/* Underfold Center Crease */}
          <polygon
            points="28,2 14,16 11,20"
            fill="#1D4ED8"
          />
          {/* Top Wing Highlight */}
          <polygon
            points="28,2 10,10 14,16"
            fill="#93C5FD"
            opacity="0.6"
          />
        </g>
      </svg>
    </div>
  );
};

export const InvitationsHeaderAtmosphere: React.FC = () => {
  return (
    <div className="cal-header-art-container" aria-hidden="true">
      <div className="cal-quote-text-group">
        <span className="cal-quote-text">Build together, go further.</span>
        <svg
          className="cal-quote-underline-svg"
          viewBox="0 0 120 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 12C35 3 85 2 117 10M55 14C75 9 95 8 115 13"
            stroke="#22C55E"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <svg
        className="cal-header-art-svg"
        viewBox="0 0 175 74"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="inv-hill-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="30%" stopColor="#F0FDF4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#DCFCE7" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="inv-envelope-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#EAB308" />
          </linearGradient>
          <linearGradient id="inv-plane-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <filter id="inv-card-shadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0F172A" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* Soft Background Hill */}
        <path
          d="M0 74 C35 55 80 50 125 58 C148 62 165 55 175 50 L175 74 L0 74 Z"
          fill="url(#inv-hill-grad)"
        />

        {/* Clouds */}
        <path
          d="M12 36 C12 32 16 29 20 29 C23 29 25 31 27 33 C29 31 33 32 35 35 C36 38 35 41 32 41 L15 41 C12 41 12 39 12 36 Z"
          fill="#F1F5F9"
          opacity="0.85"
        />
        <path
          d="M136 24 C136 21 139 18 143 18 C145 18 147 19 148 21 C150 20 153 21 155 23 C156 26 155 28 152 28 L139 28 C136 28 136 26 136 24 Z"
          fill="#F8FAFC"
          opacity="0.85"
        />

        {/* Green Bushes & Plants */}
        <path
          d="M52 74 C50 62 55 52 64 52 C70 52 73 57 74 62 C76 58 81 58 84 62 C86 66 84 74 84 74 Z"
          fill="#A7F3D0"
          opacity="0.75"
        />
        <path
          d="M110 74 C110 65 115 58 122 58 C127 58 130 62 131 66 C134 63 138 65 140 70 C141 72 140 74 140 74 Z"
          fill="#86EFAC"
          opacity="0.65"
        />

        {/* Sparkle Sun Rays around Envelope */}
        <line x1="88" y1="12" x2="88" y2="7" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
        <line x1="75" y1="17" x2="71" y2="13" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
        <line x1="101" y1="17" x2="105" y2="13" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
        <circle cx="70" cy="24" r="1.2" fill="#10B981" opacity="0.7" />
        <circle cx="106" cy="24" r="1.2" fill="#10B981" opacity="0.7" />

        {/* Opened Invitation Envelope with Letter */}
        <g filter="url(#inv-card-shadow)">
          {/* Back Flap / Interior of Envelope */}
          <polygon
            points="62,40 88,24 114,40 114,64 62,64"
            fill="#FEF08A"
          />

          {/* Letter Card sliding out */}
          <g transform="translate(0, -6)">
            <rect
              x="68"
              y="22"
              width="40"
              height="36"
              rx="4"
              fill="#FFFFFF"
              stroke="#E2E8F0"
              strokeWidth="1"
            />
            {/* Green Header stripe on card */}
            <rect x="74" y="27" width="28" height="2.5" rx="1.25" fill="#10B981" />
            {/* Green Text Lines on card */}
            <line x1="74" y1="34" x2="102" y2="34" stroke="#10B981" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="74" y1="39" x2="98" y2="39" stroke="#34D399" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="74" y1="44" x2="90" y2="44" stroke="#CBD5E1" strokeWidth="1.4" strokeLinecap="round" />
          </g>

          {/* Front Envelope Pocket & Flaps */}
          {/* Left / Right folds */}
          <polygon
            points="62,40 88,54 62,64"
            fill="#FDE047"
          />
          <polygon
            points="114,40 88,54 114,64"
            fill="#FACC15"
          />
          {/* Bottom Front Fold */}
          <polygon
            points="62,64 88,48 114,64"
            fill="url(#inv-envelope-grad)"
            stroke="#EAB308"
            strokeWidth="0.8"
          />
        </g>

        {/* Origami Paper Airplane Flying Right */}
        <g transform="translate(132, 14) rotate(-8)">
          {/* Motion Dash Trail */}
          <path
            d="M-14 24 C-8 23 -2 20 6 15"
            stroke="#93C5FD"
            strokeWidth="1.2"
            strokeDasharray="2 2"
            strokeLinecap="round"
            opacity="0.7"
          />

          {/* Airplane Body & Wings */}
          <polygon
            points="28,2 4,14 14,16"
            fill="url(#inv-plane-grad)"
          />
          <polygon
            points="28,2 14,16 20,24"
            fill="#2563EB"
          />
          <polygon
            points="28,2 14,16 11,20"
            fill="#1D4ED8"
          />
          <polygon
            points="28,2 10,10 14,16"
            fill="#93C5FD"
            opacity="0.6"
          />
        </g>
      </svg>
    </div>
  );
};

export const CreateProjectHeaderAtmosphere: React.FC = () => {
  return (
    <div className="mywork-header-art-wrap cp-header-art-wrap" aria-hidden="true">
      <div className="cp-header-quote-group">
        <span className="cp-header-quote-text">Better teams</span>
        <span className="cp-header-quote-text italic">build great products.</span>
      </div>
      <div className="cp-header-atmosphere-illustration">
        <svg viewBox="0 0 170 54" fill="none" xmlns="http://www.w3.org/2000/svg" className="header-team-landscape-svg">
          <defs>
            <linearGradient id="cp-team-hill" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="30%" stopColor="#F0FDF4" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#DCFCE7" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="cp-paper-plane-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
          </defs>

          {/* Soft Hill Wave */}
          <path d="M0 54 C35 44 80 40 130 46 C148 48 160 44 170 42 L170 54 L0 54 Z" fill="url(#cp-team-hill)" />

          {/* Flying Blue Origami Paper Airplane with Dash Trail */}
          <path d="M12 28 C35 15 65 14 95 18" stroke="#93C5FD" strokeWidth="1.4" strokeDasharray="3 3" strokeLinecap="round" opacity="0.85" />

          <g transform="translate(90, 8) rotate(-6)">
            <polygon points="26,2 4,14 13,16" fill="url(#cp-paper-plane-grad)" />
            <polygon points="26,2 13,16 19,23" fill="#1D4ED8" />
            <polygon points="26,2 13,16 10,19" fill="#1E40AF" />
            <polygon points="26,2 9,10 13,16" fill="#93C5FD" opacity="0.7" />
          </g>

          {/* Team Circle Badge on Right */}
          <circle cx="148" cy="28" r="15" fill="#15803D" />
          {/* 2-person user icon in white */}
          <g transform="translate(139, 19)" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M13 15v-1.5a3 3 0 0 0-3-3H4a3 3 0 0 0-3 3V15" />
            <circle cx="7" cy="4.5" r="3" />
            <path d="M17 15v-1.5a3 3 0 0 0-2.2-2.9" />
            <path d="M12.5 1.7a3 3 0 0 1 0 5.6" />
          </g>
        </svg>
      </div>
    </div>
  );
};

export const ProjectOverviewHeaderAtmosphere: React.FC = () => {
  return (
    <div className="project-header-atmosphere-wrap" aria-hidden="true">
      <div className="project-quote-text-group">
        <span className="project-quote-text">Big ideas start</span>
        <span className="project-quote-text italic">with a focused team.</span>
      </div>
      <div className="project-atmosphere-svg-wrap">
        <svg
          viewBox="0 0 220 70"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="project-landscape-svg"
        >
          <defs>
            <linearGradient id="proj-hill-bg" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#BAE6FD" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#7DD3FC" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="proj-hill-mid" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#99F6E4" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#5EEAD4" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="proj-hill-fg" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#DCFCE7" />
              <stop offset="100%" stopColor="#86EFAC" />
            </linearGradient>
          </defs>

          {/* Sun */}
          <circle cx="95" cy="18" r="7" fill="#FDE047" opacity="0.9" />

          {/* Distant Mountains */}
          <path
            d="M50 70 C70 42 105 32 140 48 C165 58 190 40 220 52 L220 70 L50 70 Z"
            fill="url(#proj-hill-bg)"
          />

          {/* Middle Mountain Peak with Snowcap */}
          <path
            d="M100 70 L135 28 L170 70 Z"
            fill="#E0F2FE"
            opacity="0.6"
          />
          <path
            d="M125 40 L135 28 L145 40 L140 38 L135 42 L130 38 Z"
            fill="#FFFFFF"
            opacity="0.9"
          />

          {/* Soft Clouds */}
          <path
            d="M75 22 C75 19 78 17 81 17 C83 17 85 18 86 20 C87 19 90 20 91 22 C92 24 91 26 89 26 L77 26 C75 26 75 24 75 22 Z"
            fill="#FFFFFF"
            opacity="0.85"
          />
          <path
            d="M150 16 C150 14 152 12 155 12 C157 12 158 13 159 15 C160 14 163 15 164 17 C165 19 164 21 162 21 L152 21 C150 21 150 18 150 16 Z"
            fill="#FFFFFF"
            opacity="0.85"
          />

          {/* Midground Hill */}
          <path
            d="M80 70 C100 50 135 48 165 56 C190 62 205 54 220 58 L220 70 L80 70 Z"
            fill="url(#proj-hill-mid)"
          />

          {/* Foreground Rolling Green Hill */}
          <path
            d="M110 70 C130 58 165 52 200 60 C210 62 215 60 220 62 L220 70 L110 70 Z"
            fill="url(#proj-hill-fg)"
          />

          {/* Pine Trees / Round Foliage */}
          {/* Tree 1 */}
          <rect x="160" y="52" width="2.5" height="14" rx="0.5" fill="#78350F" />
          <circle cx="161.25" cy="48" r="6.5" fill="#16A34A" />
          <circle cx="161.25" cy="46" r="4.5" fill="#22C55E" opacity="0.6" />

          {/* Tree 2 (Taller) */}
          <rect x="175" y="46" width="3" height="20" rx="0.5" fill="#78350F" />
          <circle cx="176.5" cy="42" r="8" fill="#15803D" />
          <circle cx="176.5" cy="40" r="5.5" fill="#4ADE80" opacity="0.6" />

          {/* Tree 3 */}
          <rect x="194" y="55" width="2.5" height="12" rx="0.5" fill="#78350F" />
          <circle cx="195.25" cy="51" r="6" fill="#16A34A" />

          {/* Distant small tree */}
          <rect x="142" y="58" width="1.5" height="8" rx="0.5" fill="#78350F" />
          <circle cx="142.75" cy="55" r="4" fill="#10B981" opacity="0.8" />
        </svg>
      </div>
    </div>
  );
};

export const TeamMembersHeaderAtmosphere: React.FC = () => {
  return (
    <div className="team-atmosphere-art-container" aria-hidden="true">
      <div className="team-atmosphere-quote-group">
        <span className="team-atmosphere-quote-text">Together, we build progress.</span>
        <svg
          className="team-atmosphere-swoosh-svg"
          viewBox="0 0 130 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 11C40 2 90 2 127 8M60 13C80 8 102 7 122 11"
            stroke="#16A34A"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="team-atmosphere-avatars-cluster">
        <svg
          className="team-atmosphere-cluster-svg"
          viewBox="0 0 110 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="team-aura-purple" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#C4B5FD" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#EDE9FE" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="team-aura-green" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ECFDF5" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Soft background aura glows */}
          <circle cx="45" cy="30" r="28" fill="url(#team-aura-purple)" />
          <circle cx="78" cy="35" r="24" fill="url(#team-aura-green)" />

          {/* Connection Arc */}
          <path
            d="M48 28 C60 18 68 20 74 30"
            stroke="#10B981"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity="0.6"
          />

          {/* Left Avatar (Purple/Violet) */}
          <g>
            <circle cx="42" cy="28" r="17" fill="#8B5CF6" />
            {/* Silhouette head */}
            <circle cx="42" cy="23" r="5.5" fill="#EDE9FE" />
            {/* Silhouette shoulders */}
            <path
              d="M31 39 C32 33 36 31 42 31 C48 31 52 33 53 39 Z"
              fill="#EDE9FE"
            />
          </g>

          {/* Right Avatar (Emerald/Teal) */}
          <g>
            <circle cx="75" cy="35" r="14" fill="#059669" />
            {/* Silhouette head */}
            <circle cx="75" cy="31" r="4.5" fill="#D1FAE5" />
            {/* Silhouette shoulders */}
            <path
              d="M66 45 C67 40 70 38 75 38 C80 38 83 40 84 45 Z"
              fill="#D1FAE5"
            />
          </g>

          {/* Small floating sparkles/dots */}
          <circle cx="20" cy="22" r="2" fill="#8B5CF6" opacity="0.4" />
          <circle cx="98" cy="25" r="2.5" fill="#10B981" opacity="0.5" />
          <circle cx="65" cy="14" r="1.5" fill="#3B82F6" opacity="0.4" />
        </svg>
      </div>
    </div>
  );
};

export const AccountSettingsHeaderAtmosphere: React.FC = () => {
  return (
    <div className="as-atmosphere-group" aria-hidden="true">
      <div className="as-atmosphere-quote-wrap">
        <span className="as-atmosphere-quote-line">Your account.</span>
        <span className="as-atmosphere-quote-line">Your workspace.</span>
        <span className="as-atmosphere-quote-line">Your control.</span>
        <svg
          className="as-quote-underline-svg"
          viewBox="0 0 85 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 6.5C24 2 52 2.5 76 5.5M16 10C36 7.5 58 6.5 74 8.5"
            stroke="#22C55E"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <svg
        className="as-atmosphere-art-svg"
        viewBox="0 0 165 85"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="as-card-shadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0F172A" floodOpacity="0.05" />
          </filter>
        </defs>

        {/* Soft pastel green rolling ground */}
        <path
          d="M0 85 C30 68 75 62 165 68 L165 85 L0 85 Z"
          fill="#DCFCE7"
          opacity="0.85"
        />

        {/* Soft background clouds */}
        <path
          d="M10 50 C10 46 13 43 17 43 C19 43 21 44 22 46 C24 45 27 46 28 48 C29 50 28 52 26 52 L12 52 C10 52 10 50 10 50 Z"
          fill="#F1F5F9"
          opacity="0.9"
        />
        <path
          d="M130 45 C130 41 133 38 137 38 C139 38 141 39 142 41 C144 40 147 41 148 43 C149 45 148 47 146 47 L132 47 C130 47 130 45 130 45 Z"
          fill="#F1F5F9"
          opacity="0.9"
        />

        {/* Yellow Sunburst Rays at top right of the cards */}
        <line x1="94" y1="12" x2="94" y2="4" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="102" y1="16" x2="111" y2="10" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="106" y1="25" x2="116" y2="23" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />

        {/* Back Card (Layered depth effect) */}
        <rect
          x="46"
          y="15"
          width="54"
          height="48"
          rx="8"
          fill="#F8FAFC"
          stroke="#E2E8F0"
          strokeWidth="1.2"
        />

        {/* Front White Identity Card */}
        <rect
          x="34"
          y="18"
          width="56"
          height="50"
          rx="8"
          fill="#FFFFFF"
          stroke="#E2E8F0"
          strokeWidth="1.5"
          filter="url(#as-card-shadow)"
        />

        {/* Purple circle badge with user silhouette on front card */}
        <circle cx="62" cy="22" r="12" fill="#6366F1" />
        {/* User head */}
        <circle cx="62" cy="18.5" r="3.75" fill="#FFFFFF" />
        {/* User shoulders */}
        <path d="M54.5 28.5 C54.5 24 58 22.5 62 22.5 C66 22.5 69.5 24 69.5 28.5 Z" fill="#FFFFFF" />

        {/* Horizontal text placeholder pill bars on front card */}
        <rect x="44" y="39" width="36" height="4.5" rx="2.25" fill="#C7D2FE" />
        <rect x="44" y="47" width="18" height="3.5" rx="1.75" fill="#E2E8F0" />

        {/* Green Security Shield with Checkmark */}
        <g transform="translate(80, 40)">
          {/* Shield Body */}
          <path
            d="M15 2 C8.5 2 2 5.5 2 5.5 C2 15 8 22 15 25 C22 22 28 15 28 5.5 C28 5.5 21.5 2 15 2 Z"
            fill="#22C55E"
          />
          {/* White Checkmark */}
          <path
            d="M9.5 13.5 L13.5 17.5 L20.5 10"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
};

export const CredentialsHeaderAtmosphere: React.FC = () => {
  return (
    <div className="as-cred-art-container" aria-hidden="true">
      <svg
        className="as-cred-art-svg"
        viewBox="0 0 170 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="cred-shield-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <filter id="cred-shield-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#2563EB" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Soft hill / aura background */}
        <circle cx="108" cy="48" r="32" fill="#EFF6FF" />

        {/* Floating Clouds */}
        <path
          d="M50 55 C50 50 54 47 59 47 C61 44 66 43 70 45 C73 41 80 41 83 45 C86 44 90 46 91 50 C94 51 95 54 94 57 C94 59 92 61 90 61 L55 61 C52.2 61 50 58.3 50 55 Z"
          fill="#F1F5F9"
          opacity="0.9"
        />
        <path
          d="M125 54 C125 50 128 47 132 47 C134 44 138 43 141 45 C144 42 149 42 152 45 C154 44 157 46 158 49 C160 50 161 53 160 56 C160 58 158 59 156 59 L129 59 C126.8 59 125 56.8 125 54 Z"
          fill="#F1F5F9"
          opacity="0.85"
        />

        {/* Celebration Sparks Upper Right */}
        <line x1="126" y1="21" x2="132" y2="16" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="131" y1="28" x2="138" y2="26" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />

        {/* Blue Security Shield */}
        <path
          d="M108 20 C121 20 130 24 130 24 C130 44 121 57 108 65 C95 57 86 44 86 24 C86 24 95 20 108 20 Z"
          fill="url(#cred-shield-grad)"
          filter="url(#cred-shield-glow)"
        />

        {/* White Keyhole Lock inside Shield */}
        {/* Shackle */}
        <path
          d="M101 40 V34 C101 30.1 104.1 27 108 27 C111.9 27 115 30.1 115 34 V40"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        {/* Lock Body */}
        <rect x="99" y="39" width="18" height="15" rx="3.5" fill="#FFFFFF" />
        {/* Keyhole dot & slot */}
        <circle cx="108" cy="45" r="1.6" fill="#2563EB" />
        <line x1="108" y1="45" x2="108" y2="50" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
};

export const KeepAccountSafeIllustration: React.FC = () => {
  return (
    <svg
      className="as-keep-safe-art-svg"
      viewBox="0 0 120 85"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <filter id="safe-padlock-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#2563EB" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* Soft circular aura background */}
      <circle cx="60" cy="50" r="30" fill="#EFF6FF" />

      {/* Floating Cloud Left */}
      <path
        d="M22 52 C22 47 26 44 31 44 C33 41 38 40 42 42 C45 38 52 38 55 42 C58 41 62 43 63 47 C66 48 67 51 66 54 C66 56 64 58 62 58 L27 58 C24.2 58 22 55.3 22 52 Z"
        fill="#F1F5F9"
        opacity="0.9"
      />

      {/* Floating Cloud Right */}
      <path
        d="M74 54 C74 50 78 47 82 47 C84 44 88 43 91 45 C94 42 99 42 102 45 C104 44 107 46 108 49 C110 50 111 53 110 56 C110 58 108 59 106 59 L79 59 C76.8 59 74 56.8 74 54 Z"
        fill="#F1F5F9"
        opacity="0.85"
      />

      {/* Sunburst Sparks Upper Right */}
      <line x1="82" y1="21" x2="88" y2="16" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="87" y1="28" x2="94" y2="26" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />

      {/* Solid Blue Padlock Matching User Reference Design */}
      <g filter="url(#safe-padlock-glow)">
        {/* Shackle */}
        <path
          d="M50 44 V34 C50 28.5 54.5 24 60 24 C65.5 24 70 28.5 70 34 V44"
          stroke="#2563EB"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        {/* Padlock Body */}
        <rect x="44" y="42" width="32" height="26" rx="6" fill="#2563EB" />
        {/* White Keyhole in Center */}
        <circle cx="60" cy="52" r="2.5" fill="#FFFFFF" />
        <path
          d="M59 52.5 L58 59.5 H62 L61 52.5 Z"
          fill="#FFFFFF"
        />
      </g>
    </svg>
  );
};

export const EmailNotificationsIllustration: React.FC<{ className?: string }> = ({ className = 'as-email-notif-art' }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 210 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <filter id="notif-card-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.08" />
        </filter>
        <linearGradient id="plane-wing-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>

      {/* Soft rolling green hills at bottom */}
      <path
        d="M0 92 C30 82 60 76 95 82 C135 88 170 78 210 75 L210 92 L0 92 Z"
        fill="#E6F9F0"
      />
      <path
        d="M35 92 C65 79 105 76 135 84 C165 91 185 81 210 77 L210 92 Z"
        fill="#C6F3DE"
        opacity="0.8"
      />
      <path
        d="M110 92 C140 76 175 75 210 82 L210 92 Z"
        fill="#A7F3D0"
        opacity="0.6"
      />

      {/* Sparks / Sunburst Rays above Envelope */}
      <line x1="92" y1="20" x2="92" y2="12" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="108" y1="23" x2="114" y2="17" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="76" y1="23" x2="70" y2="17" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="119" cy="27" r="1.5" fill="#FBBF24" />
      <circle cx="65" cy="27" r="1.5" fill="#FBBF24" />

      {/* Dotted Flight Path */}
      <path
        d="M115 54 C132 50 148 40 170 26"
        stroke="#93C5FD"
        strokeWidth="1.75"
        strokeDasharray="3 3.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Envelope Back Flap (Open) */}
      <path
        d="M60 48 L92 28 L124 48 Z"
        fill="#FDE68A"
      />

      {/* White Letter emerging from envelope with lines */}
      <g filter="url(#notif-card-shadow)">
        <rect
          x="66"
          y="31"
          width="52"
          height="38"
          rx="5"
          fill="#FFFFFF"
          stroke="#E2E8F0"
          strokeWidth="1"
        />
        {/* Mint text lines */}
        <rect x="74" y="38" width="36" height="2.5" rx="1.25" fill="#34D399" />
        <rect x="74" y="44" width="36" height="2.5" rx="1.25" fill="#34D399" />
        <rect x="74" y="50" width="22" height="2.5" rx="1.25" fill="#34D399" />
      </g>

      {/* Envelope Body */}
      {/* Front Side Pocket */}
      <path
        d="M58 48 L92 70 L126 48 L126 77 C126 79.2 124.2 81 122 81 L62 81 C59.8 81 58 79.2 58 77 Z"
        fill="#F59E0B"
      />
      {/* Front Flap Folding Downward */}
      <path
        d="M58 48 L92 68 L126 48 L92 72 Z"
        fill="#D97706"
        opacity="0.25"
      />
      <path
        d="M58 48 L92 71 L60 79 Z"
        fill="#FBBF24"
      />
      <path
        d="M126 48 L92 71 L124 79 Z"
        fill="#FBBF24"
      />
      <path
        d="M58 80 L92 56 L126 80 Z"
        fill="#FDE68A"
        opacity="0.3"
      />

      {/* Blue Origami Paper Airplane in Flight */}
      <g transform="translate(170, 14) rotate(-12)">
        {/* Bottom Fold / Under-Wing */}
        <polygon points="0,18 26,0 12,24" fill="#1D4ED8" />
        {/* Main Left Wing */}
        <polygon points="0,18 26,0 8,15" fill="#2563EB" />
        {/* Main Right Wing */}
        <polygon points="8,15 26,0 22,20" fill="url(#plane-wing-grad)" />
        {/* Fold Highlight */}
        <polygon points="8,15 26,0 18,12" fill="#60A5FA" />
      </g>
    </svg>
  );
};

/* ==========================================================================
   WORKSPACE DATA ARTWORK (MATCHING USER REFERENCE DESIGN)
   ========================================================================== */

export const ExportPersonalDataArt: React.FC = () => {
  return (
    <svg
      className="as-ws-art-svg"
      viewBox="0 0 280 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="exp-hill-grad1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#EFF6FF" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#DBEAFE" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#BFDBFE" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="exp-hill-grad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="100%" stopColor="#BFDBFE" />
        </linearGradient>
        <filter id="exp-doc-shadow" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#1E293B" floodOpacity="0.07" />
        </filter>
        <filter id="exp-btn-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#1D4ED8" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Rolling Hills Background */}
      <path
        d="M-10 180 C40 145 95 130 155 140 C210 150 245 135 290 130 L290 180 L-10 180 Z"
        fill="url(#exp-hill-grad1)"
      />
      <path
        d="M70 180 C120 135 180 130 230 142 C260 148 275 140 290 136 L290 180 Z"
        fill="url(#exp-hill-grad2)"
        opacity="0.65"
      />

      {/* Clouds */}
      <g opacity="0.85">
        <path
          d="M20 120 C20 114 25 110 31 110 C34 110 37 111 39 113 C42 110 47 110 50 113 C53 115 54 118 53 120 L20 120 Z"
          fill="#FFFFFF"
        />
        <path
          d="M220 105 C220 99 225 95 231 95 C234 95 237 96 239 98 C242 95 247 95 250 98 C253 100 254 103 253 105 L220 105 Z"
          fill="#FFFFFF"
        />
      </g>

      {/* Celebration burst rays above document */}
      <line x1="178" y1="36" x2="182" y2="28" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="192" y1="42" x2="200" y2="38" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="168" y1="44" x2="162" y2="40" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />

      {/* White Document Card with folded corner */}
      <g filter="url(#exp-doc-shadow)">
        {/* Main Document Body */}
        <path
          d="M124 45 C124 41 127 38 131 38 L175 38 L196 59 L196 142 C196 146 193 149 189 149 L131 149 C127 149 124 146 124 142 Z"
          fill="#FFFFFF"
          stroke="#E2E8F0"
          strokeWidth="1.2"
        />
        {/* Dog-ear fold */}
        <path
          d="M175 38 L175 56 C175 58 177 60 179 60 L196 60 Z"
          fill="#F1F5F9"
          stroke="#CBD5E1"
          strokeWidth="1.2"
        />
      </g>

      {/* Document Text Lines */}
      <rect x="136" y="55" width="30" height="3" rx="1.5" fill="#E2E8F0" />
      <rect x="136" y="65" width="46" height="3" rx="1.5" fill="#E2E8F0" />
      <rect x="136" y="75" width="38" height="3" rx="1.5" fill="#E2E8F0" />

      {/* Center .json Badge */}
      <rect x="134" y="90" width="52" height="26" rx="6" fill="#2563EB" />
      <text
        x="160"
        y="107"
        fill="#FFFFFF"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="12.5"
        fontWeight="700"
        textAnchor="middle"
        letterSpacing="0.02em"
      >
        .json
      </text>

      {/* Bottom text preview lines */}
      <rect x="136" y="126" width="36" height="3" rx="1.5" fill="#E2E8F0" />
      <rect x="136" y="134" width="22" height="3" rx="1.5" fill="#E2E8F0" />

      {/* Circular Blue Download Button Overlay */}
      <g filter="url(#exp-btn-shadow)">
        <circle cx="196" cy="136" r="18" fill="#2563EB" />
        <path
          d="M196 127 V141 M196 141 L191 136 M196 141 L201 136 M189 145 H203"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};

export const DeleteAccountArt: React.FC = () => {
  return (
    <svg
      className="as-ws-art-svg"
      viewBox="0 0 280 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="del-hill-grad1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFF1F2" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#FFE4E6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#FECDD3" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="del-hill-grad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEE2E2" />
          <stop offset="100%" stopColor="#FECACA" />
        </linearGradient>
        <filter id="del-aura-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#F43F5E" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Rolling Hills Background in soft Rose */}
      <path
        d="M-10 180 C40 145 95 130 155 140 C210 150 245 135 290 130 L290 180 L-10 180 Z"
        fill="url(#del-hill-grad1)"
      />
      <path
        d="M70 180 C120 135 180 130 230 142 C260 148 275 140 290 136 L290 180 Z"
        fill="url(#del-hill-grad2)"
        opacity="0.6"
      />

      {/* Clouds */}
      <g opacity="0.85">
        <path
          d="M25 125 C25 120 29 116 35 116 C38 116 41 117 43 119 C46 116 50 116 53 119 C56 121 57 124 56 125 L25 125 Z"
          fill="#FFFFFF"
        />
        <path
          d="M225 115 C225 110 229 106 235 106 C238 106 241 107 243 109 C246 106 250 106 253 109 C256 111 257 114 256 115 L225 115 Z"
          fill="#FFFFFF"
        />
      </g>

      {/* Glowing Radiant Aura Circle */}
      <g filter="url(#del-aura-shadow)">
        <circle cx="180" cy="98" r="38" fill="#FFE4E6" />
      </g>

      {/* Burst / Sparkle rays above aura */}
      <line x1="180" y1="46" x2="180" y2="38" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="196" y1="52" x2="204" y2="46" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="164" y1="52" x2="156" y2="46" stroke="#F87171" strokeWidth="2.5" strokeLinecap="round" />

      {/* Trash Can Illustration */}
      <g transform="translate(163, 76)">
        {/* Handle on lid */}
        <path
          d="M13 3 C13 1.5 14.5 0.5 17 0.5 C19.5 0.5 21 1.5 21 3"
          stroke="#F87171"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Lid Bar */}
        <rect x="2" y="3" width="30" height="4" rx="2" fill="#F87171" />
        {/* Trash Bin Body */}
        <path
          d="M5 9 L8 38 C8.2 40 10 41.5 12 41.5 L22 41.5 C24 41.5 25.8 40 26 38 L29 9 Z"
          fill="#FFFFFF"
          stroke="#F87171"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* 3 Vertical Flutes */}
        <line x1="12" y1="15" x2="13" y2="34" stroke="#FCA5A5" strokeWidth="2" strokeLinecap="round" />
        <line x1="17" y1="15" x2="17" y2="34" stroke="#FCA5A5" strokeWidth="2" strokeLinecap="round" />
        <line x1="22" y1="15" x2="21" y2="34" stroke="#FCA5A5" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
};

export const WelcomeModalVisualArt: React.FC = () => {
  return (
    <div className="wm-visual-art-wrapper" aria-hidden="true">
      <svg
        className="wm-visual-art-svg"
        viewBox="0 0 350 185"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="wm-soft-shadow" x="-15%" y="-15%" width="130%" height="135%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#3B82F6" floodOpacity="0.08" />
          </filter>
          <filter id="wm-popover-shadow" x="-20%" y="-20%" width="145%" height="150%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#0F172A" floodOpacity="0.12" />
          </filter>
          <linearGradient id="wm-bg-halo" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EFF6FF" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#F5F3FF" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Soft Background Cloud Aura */}
        <circle cx="210" cy="90" r="85" fill="url(#wm-bg-halo)" />

        {/* Paper Plane Dotted Flight Arc */}
        <path
          d="M 36 150 C 18 136 28 114 48 104"
          stroke="#93C5FD"
          strokeWidth="1.75"
          strokeDasharray="3 3.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Origami Paper Airplane */}
        <g transform="translate(6, -4)">
          <path d="M 44 106 L 68 93 L 56 114 Z" fill="#3B82F6" />
          <path d="M 56 114 L 68 93 L 51 118 Z" fill="#2563EB" />
          <path d="M 51 118 L 56 114 L 44 106 Z" fill="#60A5FA" />
        </g>

        {/* Main Application Window Card */}
        <g filter="url(#wm-soft-shadow)">
          <rect
            x="58"
            y="22"
            width="220"
            height="140"
            rx="14"
            fill="#FFFFFF"
            stroke="#E2E8F0"
            strokeWidth="1.2"
          />

          {/* Window Top Titlebar */}
          <rect x="72" y="32" width="16" height="12" rx="3.5" fill="#BFDBFE" />
          <rect x="94" y="34" width="46" height="4" rx="2" fill="#E2E8F0" />
          <rect x="94" y="41" width="28" height="3" rx="1.5" fill="#F1F5F9" />

          {/* Top-Right Window Controls */}
          <circle cx="258" cy="38" r="2.5" fill="#CBD5E1" />
          <circle cx="250" cy="38" r="2.5" fill="#CBD5E1" />
          <circle cx="242" cy="38" r="2.5" fill="#CBD5E1" />

          {/* Divider Line */}
          <line x1="58" y1="50" x2="278" y2="50" stroke="#F1F5F9" strokeWidth="1" />

          {/* Left Mini Sidebar */}
          <line x1="102" y1="50" x2="102" y2="162" stroke="#F1F5F9" strokeWidth="1" />
          <rect x="70" y="58" width="22" height="12" rx="4" fill="#3B82F6" />
          <circle cx="76" cy="80" r="3" fill="#CBD5E1" />
          <rect x="83" y="78.5" width="12" height="3" rx="1.5" fill="#E2E8F0" />
          <circle cx="76" cy="96" r="3" fill="#CBD5E1" />
          <rect x="83" y="94.5" width="12" height="3" rx="1.5" fill="#E2E8F0" />
          <circle cx="76" cy="112" r="3" fill="#CBD5E1" />
          <rect x="83" y="110.5" width="12" height="3" rx="1.5" fill="#E2E8F0" />

          {/* Main Content Area - 4 Rows with Colorful Squircles */}
          {/* Row 1: Blue */}
          <rect x="114" y="58" width="14" height="14" rx="4" fill="#3B82F6" />
          <rect x="135" y="61" width="56" height="4" rx="2" fill="#E2E8F0" />
          <rect x="135" y="68" width="34" height="3" rx="1.5" fill="#F1F5F9" />

          {/* Row 2: Amber */}
          <rect x="114" y="78" width="14" height="14" rx="4" fill="#F59E0B" />
          <rect x="135" y="81" width="62" height="4" rx="2" fill="#E2E8F0" />
          <rect x="135" y="88" width="40" height="3" rx="1.5" fill="#F1F5F9" />

          {/* Row 3: Purple */}
          <rect x="114" y="98" width="14" height="14" rx="4" fill="#8B5CF6" />
          <rect x="135" y="101" width="52" height="4" rx="2" fill="#E2E8F0" />
          <rect x="135" y="108" width="30" height="3" rx="1.5" fill="#F1F5F9" />

          {/* Row 4: Green */}
          <rect x="114" y="118" width="14" height="14" rx="4" fill="#10B981" />
          <rect x="135" y="121" width="58" height="4" rx="2" fill="#E2E8F0" />
          <rect x="135" y="128" width="38" height="3" rx="1.5" fill="#F1F5F9" />
        </g>

        {/* Elevated Floating Popover Card on Right */}
        <g filter="url(#wm-popover-shadow)">
          <rect
            x="222"
            y="44"
            width="100"
            height="98"
            rx="12"
            fill="#FFFFFF"
            stroke="#F1F5F9"
            strokeWidth="1"
          />
          <text x="238" y="65" fill="#334155" fontSize="11" fontWeight="500" fontFamily="system-ui, sans-serif">Ideas</text>
          <text x="238" y="84" fill="#334155" fontSize="11" fontWeight="500" fontFamily="system-ui, sans-serif">Tasks</text>
          <text x="238" y="103" fill="#334155" fontSize="11" fontWeight="500" fontFamily="system-ui, sans-serif">Progress</text>
          <text x="238" y="122" fill="#334155" fontSize="11" fontWeight="500" fontFamily="system-ui, sans-serif">Together</text>
        </g>

        {/* Golden Celebration Sparkle Stars */}
        <path
          d="M 326 28 Q 326 34 332 34 Q 326 34 326 40 Q 326 34 320 34 Q 326 34 326 28 Z"
          fill="#F59E0B"
        />
        <line x1="328" y1="21" x2="333" y2="18" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="335" y1="26" x2="339" y2="29" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="324" y1="46" x2="328" y2="50" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div className="wm-handwritten-caption">
        <span>Small steps</span>
        <span>make big progress.</span>
      </div>
    </div>
  );
};








