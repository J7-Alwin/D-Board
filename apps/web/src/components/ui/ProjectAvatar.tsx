import React, { useState, useEffect } from 'react';

export interface ProjectAvatarProps {
  project?: {
    name?: string;
    avatarUrl?: string | null;
    key?: string | null;
  } | null;
  name?: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  style?: React.CSSProperties;
}

export const isLikelyImageUrl = (val: string): boolean => {
  if (!val) return false;
  const trimmed = val.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./')
  ) {
    return true;
  }
  if (/\.(png|jpe?g|gif|svg|webp|avif|ico)(\?.*)?$/i.test(trimmed)) {
    return true;
  }
  return false;
};

export const ProjectAvatar: React.FC<ProjectAvatarProps> = ({
  project,
  name: propName,
  avatarUrl: propAvatarUrl,
  size = 'md',
  className = '',
  style,
}) => {
  const name = project?.name || propName || 'Project';
  const rawAvatarUrl = project?.avatarUrl !== undefined ? project.avatarUrl : propAvatarUrl;
  const avatar = (rawAvatarUrl || '').trim();
  const monogram = (name.trim()[0] || 'P').toUpperCase();

  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [avatar]);

  const isImg = !hasError && isLikelyImageUrl(avatar);
  const isEmoji = !hasError && !isImg && avatar.length > 0 && avatar.length <= 8;

  return (
    <div
      className={`project-avatar-badge size-${size} ${className}`}
      style={style}
      title={name}
    >
      {isImg ? (
        <img
          src={avatar}
          alt={name}
          className="project-avatar-img"
          onError={() => setHasError(true)}
          loading="lazy"
        />
      ) : isEmoji ? (
        <span className="project-avatar-emoji" role="img" aria-label={name}>
          {avatar}
        </span>
      ) : (
        <span className="project-avatar-monogram">{monogram}</span>
      )}
    </div>
  );
};
