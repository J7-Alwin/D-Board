import React, { useMemo } from 'react';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface HeroAtmosphereProps {
  timeOfDay?: TimeOfDay;
  className?: string;
}

/**
 * Calculates current real-world Moon Phase (0 to 1) and generates geometric SVG path for true lunar cycle
 */
function getMoonPhaseData(date = new Date()) {
  const synodicMonth = 29.53058867;
  const refDate = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const diffDays = (date.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24);
  const phase = ((diffDays % synodicMonth) + synodicMonth) % synodicMonth;
  const normalized = phase / synodicMonth; // 0.0 = New Moon, 0.5 = Full Moon, 1.0 = New Moon

  const R = 30;
  const cx = 630;
  const cy = 75;

  // k from -1 (New) to +1 (Full)
  const k = -Math.cos(2 * Math.PI * normalized);
  const isWaxing = normalized <= 0.5;

  // Ellipse horizontal radius for terminator
  const rx = Math.max(0.75, Math.abs(k) * R);
  const sweep = (isWaxing && k >= 0) || (!isWaxing && k < 0) ? 1 : 0;

  // Outer semi-circle on illuminated side + inner terminator semi-ellipse
  let pathD = '';
  if (isWaxing) {
    // Waxing: right side illuminated
    pathD = `M ${cx} ${cy - R} A ${R} ${R} 0 0 1 ${cx} ${cy + R} A ${rx} ${R} 0 0 ${sweep} ${cx} ${cy - R} Z`;
  } else {
    // Waning: left side illuminated
    pathD = `M ${cx} ${cy - R} A ${R} ${R} 0 0 0 ${cx} ${cy + R} A ${rx} ${R} 0 0 ${sweep} ${cx} ${cy - R} Z`;
  }

  // Phase Name
  let phaseName = 'Full Moon';
  if (normalized < 0.03 || normalized > 0.97) phaseName = 'New Moon';
  else if (normalized < 0.22) phaseName = 'Waxing Crescent';
  else if (normalized < 0.28) phaseName = 'First Quarter';
  else if (normalized < 0.47) phaseName = 'Waxing Gibbous';
  else if (normalized < 0.53) phaseName = 'Full Moon';
  else if (normalized < 0.72) phaseName = 'Waning Gibbous';
  else if (normalized < 0.78) phaseName = 'Last Quarter';
  else phaseName = 'Waning Crescent';

  const illuminationPct = Math.round(((1 + k) / 2) * 100);

  return { normalized, illuminationPct, phaseName, pathD, isWaxing, k };
}

export const HeroAtmosphere: React.FC<HeroAtmosphereProps> = ({
  timeOfDay: propTimeOfDay,
  className = '',
}) => {
  const timeOfDay = useMemo<TimeOfDay>(() => {
    if (propTimeOfDay) return propTimeOfDay;
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }, [propTimeOfDay]);

  const moonData = useMemo(() => getMoonPhaseData(), []);

  return (
    <div className={`hero-atmosphere-container time-${timeOfDay} ${className}`} aria-hidden="true">
      <svg
        className="hero-atmosphere-svg"
        viewBox="0 0 800 240"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Time-of-day sky gradients */}
          <linearGradient id="skyGradMorning" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF9C3" stopOpacity="0.8" />
            <stop offset="40%" stopColor="#FDE68A" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ECFDF5" stopOpacity="0.1" />
          </linearGradient>

          <linearGradient id="skyGradAfternoon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.75" />
            <stop offset="50%" stopColor="#D1FAE5" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#F0FDF4" stopOpacity="0.05" />
          </linearGradient>

          <linearGradient id="skyGradEvening" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FECDD3" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#DDD6FE" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#F5F3FF" stopOpacity="0.1" />
          </linearGradient>

          {/* Reduced darkness for night sky: deep sapphire / midnight violet */}
          <linearGradient id="skyGradNight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E1B4B" stopOpacity="0.88" />
            <stop offset="35%" stopColor="#2E1065" stopOpacity="0.75" />
            <stop offset="70%" stopColor="#1E293B" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0.45" />
          </linearGradient>

          {/* Aurora Borealis Gradient for Night */}
          <linearGradient id="auroraGradNight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#064E3B" stopOpacity="0" />
            <stop offset="25%" stopColor="#10B981" stopOpacity="0.28" />
            <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.32" />
            <stop offset="75%" stopColor="#8B5CF6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>

          {/* Shooting Star Gradient */}
          <linearGradient id="meteorTailGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="30%" stopColor="#FDE047" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
          </linearGradient>

          {/* Lunar Illuminated Surface Radial Gradient */}
          <radialGradient id="lunarIlluminatedGrad" cx="45%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#FFFBEB" stopOpacity="1" />
            <stop offset="60%" stopColor="#FEF08A" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.9" />
          </radialGradient>

          {/* Sun / Moon Halo Gradients */}
          <radialGradient id="sunGlowMorning" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="sunGlowAfternoon" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FDE047" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#FBBF24" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="sunGlowEvening" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FB7185" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#F43F5E" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#E11D48" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="moonGlowNight" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.85" />
            <stop offset="40%" stopColor="#FDE047" stopOpacity="0.35" />
            <stop offset="75%" stopColor="#818CF8" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#312E81" stopOpacity="0" />
          </radialGradient>

          {/* Mountain Layer Gradients */}
          {/* Back Mountain */}
          <linearGradient id="mountBackMorning" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6EE7B7" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#A7F3D0" stopOpacity="0.2" />
          </linearGradient>

          <linearGradient id="mountBackAfternoon" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5EEAD4" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#99F6E4" stopOpacity="0.25" />
          </linearGradient>

          <linearGradient id="mountBackEvening" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#C4B5FD" stopOpacity="0.25" />
          </linearGradient>

          <linearGradient id="mountBackNight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#312E81" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#1E1B4B" stopOpacity="0.4" />
          </linearGradient>

          {/* Middle Mountain */}
          <linearGradient id="mountMidMorning" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.35" />
          </linearGradient>

          <linearGradient id="mountMidAfternoon" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0D9488" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0F766E" stopOpacity="0.35" />
          </linearGradient>

          <linearGradient id="mountMidEvening" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#6D28D9" stopOpacity="0.35" />
          </linearGradient>

          <linearGradient id="mountMidNight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0.5" />
          </linearGradient>

          {/* Front Hill */}
          <linearGradient id="mountFrontMorning" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0.7" />
          </linearGradient>

          <linearGradient id="mountFrontAfternoon" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0F766E" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#115E59" stopOpacity="0.7" />
          </linearGradient>

          <linearGradient id="mountFrontEvening" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5B21B6" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#4C1D95" stopOpacity="0.75" />
          </linearGradient>

          <linearGradient id="mountFrontNight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Ambient Sky Backdrop Fill */}
        <rect
          x="0"
          y="0"
          width="800"
          height="240"
          fill={`url(#skyGrad${capitalize(timeOfDay)})`}
        />

        {/* NIGHT SPECIAL: Aurora Borealis Cosmic Ribbon Wave */}
        {timeOfDay === 'night' && (
          <g className="aurora-group">
            <path
              d="M200,0 Q320,65 480,25 Q640,-15 760,40 Q800,55 800,0 Z"
              fill="url(#auroraGradNight)"
              className="aurora-wave aurora-wave-1"
            />
            <path
              d="M260,0 Q400,80 560,35 Q700,0 800,45 Q800,0 800,0 Z"
              fill="url(#auroraGradNight)"
              className="aurora-wave aurora-wave-2"
            />
          </g>
        )}

        {/* NIGHT SPECIAL: Shooting Stars / Meteors */}
        {timeOfDay === 'night' && (
          <g className="meteors-group">
            {/* Meteor 1 */}
            <g className="meteor meteor-1">
              <line x1="720" y1="20" x2="630" y2="70" stroke="url(#meteorTailGrad)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="630" cy="70" r="2.2" fill="#FFFFFF" />
            </g>
            {/* Meteor 2 */}
            <g className="meteor meteor-2">
              <line x1="560" y1="10" x2="480" y2="55" stroke="url(#meteorTailGrad)" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="480" cy="55" r="1.8" fill="#FFFFFF" />
            </g>
          </g>
        )}

        {/* Celestial Body: Sun or Moon with Pulse Effect */}
        <g className={`celestial-body-group ${timeOfDay === 'night' ? 'lunar-body-group' : ''}`}>
          {/* Outer Glow Halo */}
          <circle
            cx="630"
            cy="75"
            r={timeOfDay === 'night' ? '65' : '65'}
            fill={timeOfDay === 'night' ? 'url(#moonGlowNight)' : `url(#sunGlow${capitalize(timeOfDay)})`}
            className="celestial-halo"
          />

          {timeOfDay === 'night' ? (
            /* NIGHT: Realistic Moon rendered based on Real-Time Lunar Cycle */
            <g className="lunar-crescent-group">
              <title>{`Current Moon Phase: ${moonData.phaseName} (${moonData.illuminationPct}% illuminated)`}</title>
              {/* Faint Earthshine Base disc */}
              <circle cx="630" cy="75" r="30" fill="#312E81" opacity="0.4" />
              {/* Illuminated Real Lunar Phase Face */}
              <path
                d={moonData.pathD}
                fill="url(#lunarIlluminatedGrad)"
                className="moon-core"
              />
            </g>
          ) : (
            /* DAY / EVENING: Sun Core */
            <circle
              cx="630"
              cy="75"
              r="32"
              fill={
                timeOfDay === 'morning'
                  ? '#FBBF24'
                  : timeOfDay === 'afternoon'
                  ? '#FDE047'
                  : '#FB7185'
              }
              className="celestial-core"
            />
          )}

          {/* Starfield for Night */}
          {timeOfDay === 'night' && (
            <g className="night-starfield">
              {/* 4-point Diamond Sparkle Stars */}
              <g className="diamond-star dstar-1" transform="translate(490, 35)">
                <polygon points="0,-6 2,-1 7,0 2,1 0,6 -2,1 -7,0 -2,-1" fill="#FFFFFF" opacity="0.95" />
              </g>
              <g className="diamond-star dstar-2" transform="translate(710, 40)">
                <polygon points="0,-7 2,-1 8,0 2,1 0,7 -2,1 -8,0 -2,-1" fill="#FEF08A" opacity="0.9" />
              </g>
              <g className="diamond-star dstar-3" transform="translate(420, 65)">
                <polygon points="0,-5 1.5,-1 5,0 1.5,1 0,5 -1.5,1 -5,0 -1.5,-1" fill="#93C5FD" opacity="0.85" />
              </g>

              {/* Twinkling Circular Stars */}
              <circle cx="340" cy="30" r="1.4" fill="#FFFFFF" className="twinkle-star star-1" />
              <circle cx="390" cy="45" r="1.8" fill="#FDE047" className="twinkle-star star-2" />
              <circle cx="450" cy="20" r="1.2" fill="#93C5FD" className="twinkle-star star-3" />
              <circle cx="530" cy="55" r="2.2" fill="#FFFFFF" className="twinkle-star star-4" />
              <circle cx="560" cy="25" r="1.5" fill="#FEF08A" className="twinkle-star star-5" />
              <circle cx="585" cy="85" r="1.8" fill="#FFFFFF" className="twinkle-star star-6" />
              <circle cx="675" cy="30" r="2.0" fill="#93C5FD" className="twinkle-star star-1" />
              <circle cx="740" cy="70" r="1.6" fill="#FFFFFF" className="twinkle-star star-2" />
              <circle cx="770" cy="35" r="2.2" fill="#FEF08A" className="twinkle-star star-3" />
              <circle cx="785" cy="85" r="1.2" fill="#FFFFFF" className="twinkle-star star-4" />
            </g>
          )}
        </g>

        {/* Floating Clouds Layer */}
        <g className="floating-clouds-group">
          {/* Cloud 1 */}
          <path
            d="M520,60 Q535,45 555,50 Q575,38 595,52 Q615,48 625,60 Q630,72 620,78 Q600,82 540,82 Q515,80 520,60 Z"
            fill={timeOfDay === 'night' ? '#1E1B4B' : '#FFFFFF'}
            opacity={timeOfDay === 'night' ? '0.35' : '0.55'}
            className="cloud cloud-slow"
          />
          {/* Cloud 2 */}
          <path
            d="M680,85 Q695,72 712,78 Q728,68 745,80 Q760,78 768,88 Q772,98 760,102 Q740,105 695,105 Q675,102 680,85 Z"
            fill={timeOfDay === 'night' ? '#1E1B4B' : '#FFFFFF'}
            opacity={timeOfDay === 'night' ? '0.25' : '0.45'}
            className="cloud cloud-fast"
          />
        </g>

        {/* Mountain Silhouette Layers matching reference artwork */}
        {/* Layer 1: Back Distant Mountain Range */}
        <path
          d="M340,240 L340,195 Q420,130 500,165 Q570,115 650,150 Q720,110 800,140 L800,240 Z"
          fill={`url(#mountBack${capitalize(timeOfDay)})`}
          className="mount-layer mount-back"
        />

        {/* Layer 2: Mid-distance Layered Peaks */}
        <path
          d="M380,240 L380,205 Q460,145 530,175 Q600,135 680,180 Q750,140 800,165 L800,240 Z"
          fill={`url(#mountMid${capitalize(timeOfDay)})`}
          className="mount-layer mount-mid"
        />

        {/* Layer 3: Front Lush Rolling Hills with Organic Curve */}
        <path
          d="M440,240 L440,215 Q520,165 590,195 Q660,160 740,205 Q780,185 800,195 L800,240 Z"
          fill={`url(#mountFront${capitalize(timeOfDay)})`}
          className="mount-layer mount-front"
        />

        {/* NIGHT SPECIAL: Bioluminescent Glowing Fireflies hovering over the hills */}
        {timeOfDay === 'night' && (
          <g className="night-fireflies-group">
            <circle cx="480" cy="185" r="2.5" fill="#34D399" className="firefly firefly-1" />
            <circle cx="560" cy="170" r="2" fill="#A7F3D0" className="firefly firefly-2" />
            <circle cx="630" cy="195" r="2.8" fill="#FDE047" className="firefly firefly-3" />
            <circle cx="700" cy="180" r="2.2" fill="#6EE7B7" className="firefly firefly-4" />
            <circle cx="750" cy="205" r="2.5" fill="#FDE047" className="firefly firefly-5" />
          </g>
        )}

        {/* Subtle Atmospheric Mist at bottom */}
        <rect
          x="0"
          y="200"
          width="800"
          height="40"
          fill="url(#mistGradient)"
          opacity={timeOfDay === 'night' ? '0.08' : '0.35'}
        />
        <defs>
          <linearGradient id="mistGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.8" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
