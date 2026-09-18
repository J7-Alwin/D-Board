import React from 'react';

export interface LogoProps {
  variant?: 'dark' | 'light' | 'accent' | 'pure' | 'monochrome';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  withText?: boolean;
  withTagline?: boolean;
  className?: string;
  style?: React.CSSProperties;
  textColor?: string;
  showTm?: boolean;
}

const SIZE_MAP: Record<string, { iconSize: number; fontSize: number; subSize: number; gap: number }> = {
  xs: { iconSize: 22, fontSize: 13, subSize: 7, gap: 7 },
  sm: { iconSize: 30, fontSize: 17, subSize: 8, gap: 9 },
  md: { iconSize: 36, fontSize: 20, subSize: 9, gap: 10 },
  lg: { iconSize: 44, fontSize: 25, subSize: 10.5, gap: 12 },
  xl: { iconSize: 54, fontSize: 30, subSize: 12, gap: 15 },
};

/**
 * Official D-Board Vector Icon
 * Authentic geometric mark based on official brand specifications:
 * - Developer 'D' shape
 * - Progress Arrow/Play button (#D2F843)
 * - Transparent background (no white container box)
 */
export const LogoIcon: React.FC<{
  variant?: LogoProps['variant'];
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ variant = 'dark', size = 32, className = '', style }) => {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size]?.iconSize || 32;

  // Variant color mappings
  let bgColor: string | null = '#18181A';
  let dColor = '#FFFFFF';
  let arrowColor = '#D2F843';

  if (variant === 'light') {
    bgColor = '#F4F4EE';
    dColor = '#18181A';
    arrowColor = '#18181A';
  } else if (variant === 'accent') {
    bgColor = '#D2F843';
    dColor = '#18181A';
    arrowColor = '#18181A';
  } else if (variant === 'pure') {
    bgColor = null;
    dColor = 'currentColor';
    arrowColor = '#D2F843';
  } else if (variant === 'monochrome') {
    bgColor = '#18181A';
    dColor = '#FFFFFF';
    arrowColor = '#FFFFFF';
  }

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox={bgColor ? '0 0 100 100' : '20 20 63 60'}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`dboard-logo-icon-svg ${className}`}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {bgColor && <rect width="100" height="100" rx="25" fill={bgColor} />}
      {/* Neon Lime Play/Progress Arrow */}
      <polygon
        points="22.44,43.11 43.11,57.95 22.44,75.97"
        fill={arrowColor}
      />
      {/* Stylized Developer 'D' */}
      <path
        d="M 29.33 21.38 A 6.89 6.89 0 0 0 29.33 35.16 L 54.24 35.16 C 55.3 35.16 66.43 40.46 66.43 49.47 C 66.43 58.48 53.18 63.25 47.88 59.54 L 33.57 71.73 C 31.45 74.91 31.98 77.56 36.22 77.56 L 55.3 77.56 C 72.26 77.56 80.74 65.9 80.74 49.47 C 80.74 33.04 72.26 21.38 55.3 21.38 Z"
        fill={dColor}
      />
    </svg>
  );
};

/**
 * Official D-Board Brand Logo Lockup
 * Combines the authentic D-Board icon and typography with transparent background
 */
export const Logo: React.FC<LogoProps> = ({
  variant = 'dark',
  size = 'md',
  withText = true,
  withTagline = false,
  className = '',
  style,
  textColor,
  showTm = false,
}) => {
  const sizeConfig = typeof size === 'number'
    ? { iconSize: size, fontSize: Math.round(size * 0.65), subSize: Math.max(8, Math.round(size * 0.3)), gap: Math.round(size * 0.3) }
    : SIZE_MAP[size] || SIZE_MAP.md;

  const resolvedTextColor = textColor || (variant === 'light' ? '#18181A' : 'var(--text-primary, #18181A)');

  return (
    <div
      className={`dboard-brand-lockup ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${sizeConfig.gap}px`,
        lineHeight: 1,
        userSelect: 'none',
        ...style,
      }}
    >
      <LogoIcon variant={variant} size={sizeConfig.iconSize} />

      {withText && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
            <span
              style={{
                fontSize: `${sizeConfig.fontSize}px`,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: resolvedTextColor,
                fontFamily: 'inherit',
                lineHeight: 1.15,
              }}
            >
              D-Board
            </span>
            {showTm && (
              <span
                style={{
                  fontSize: `${Math.max(7, Math.round(sizeConfig.fontSize * 0.4))}px`,
                  fontWeight: 700,
                  color: 'var(--text-muted, #71717A)',
                  verticalAlign: 'super',
                }}
              >
                ™
              </span>
            )}
          </div>
          {withTagline && (
            <span
              style={{
                fontSize: `${sizeConfig.subSize}px`,
                fontWeight: 600,
                color: 'var(--text-muted, #71717A)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginTop: '2px',
                lineHeight: 1.2,
              }}
            >
              PLAN • BUILD • TRACK • TOGETHER
            </span>
          )}
        </div>
      )}
    </div>
  );
};
