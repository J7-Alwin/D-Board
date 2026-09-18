import React from 'react';

interface CategoryIconProps {
  category?: string | null;
  size?: number;
  className?: string;
}

export const ApplicationCategoryIcon: React.FC<CategoryIconProps> = ({
  category = '',
  size = 14,
  className = '',
}) => {
  const cat = (category || '').toLowerCase().trim();

  // Android / Mobile App / Kotlin / Flutter
  if (cat.includes('android') || cat.includes('mobile') || cat.includes('flutter') || cat.includes('kotlin')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
        <path d="M12 18h.01" />
      </svg>
    );
  }

  // iOS / Apple / Swift
  if (cat.includes('ios') || cat.includes('apple') || cat.includes('swift')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M12 20.94c1.5 0 2.75-.78 3.75-.78s2.16.78 3.75.78c2.4 0 4.5-2.28 4.5-5.32 0-2.48-1.5-4.32-3.66-4.32-1.74 0-2.82.96-3.84.96-1.02 0-2.16-.96-3.75-.96-2.58 0-4.75 2.16-4.75 5.28 0 3.06 2.07 5.36 4 5.36z" />
        <path d="M15.5 2c0 1.93-1.57 3.5-3.5 3.5-.12 0-.25-.01-.37-.02.04-1.89 1.63-3.48 3.5-3.48.12 0 .25.01.37.02z" />
      </svg>
    );
  }

  // Desktop / Windows / macOS
  if (cat.includes('desktop') || cat.includes('electron') || cat.includes('windows') || cat.includes('macos')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <rect width="20" height="14" x="2" y="3" rx="2" />
        <line x1="8" x2="16" y1="21" y2="21" />
        <line x1="12" x2="12" y1="17" y2="21" />
      </svg>
    );
  }

  // Backend / Server / API / Database
  if (cat.includes('backend') || cat.includes('api') || cat.includes('server') || cat.includes('database') || cat.includes('cloud')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <rect width="20" height="8" x="2" y="2" rx="2" />
        <rect width="20" height="8" x="2" y="14" rx="2" />
        <line x1="6" x2="6.01" y1="6" y2="6" />
        <line x1="6" x2="6.01" y1="18" y2="18" />
      </svg>
    );
  }

  // Design / UI/UX
  if (cat.includes('design') || cat.includes('ui') || cat.includes('ux') || cat.includes('figma')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2z" />
      </svg>
    );
  }

  // AI / ML
  if (cat.includes('ai') || cat.includes('ml') || cat.includes('intelligence') || cat.includes('data')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M12 2a8 8 0 0 0-8 8c0 3.37 2.1 6.25 5.09 7.42A2 2 0 0 0 10.4 19l.6.6v2.4h2v-2.4l.6-.6a2 2 0 0 0 1.31-1.58C17.9 16.25 20 13.37 20 10a8 8 0 0 0-8-8z" />
      </svg>
    );
  }

  // DevOps / Infrastructure / Cloud / Terminal
  if (cat.includes('devops') || cat.includes('infra') || cat.includes('terminal') || cat.includes('docker') || cat.includes('kubernetes')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" x2="20" y1="19" y2="19" />
      </svg>
    );
  }

  // Open Source Library / Package / Component
  if (cat.includes('library') || cat.includes('package') || cat.includes('open source') || cat.includes('module')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" x2="12" y1="22.08" y2="12" />
      </svg>
    );
  }

  // Other / Generic Project
  if (cat.includes('other') || cat.includes('misc')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    );
  }

  // Default: Web Application / Web Development / Browser
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="M10 4v4" />
      <path d="M2 8h20" />
      <path d="M6 4v4" />
    </svg>
  );
};
