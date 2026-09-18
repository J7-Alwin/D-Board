import React from 'react';
import type { NoteVisibility, NoteMentionUser } from '../../api/notes.api';
import { UsersIcon, LockIcon } from '../ui/Icons';

interface NoteVisibilityBadgeProps {
  visibility: NoteVisibility;
  mentions?: NoteMentionUser[];
  size?: 'sm' | 'md';
}

export const NoteVisibilityBadge: React.FC<NoteVisibilityBadgeProps> = ({
  visibility,
  mentions = [],
  size = 'md',
}) => {
  if (visibility === 'TEAM') {
    return (
      <span className={`note-visibility-badge badge-team size-${size}`}>
        <UsersIcon size={size === 'sm' ? 12 : 14} />
        <span>Team</span>
      </span>
    );
  }

  // Private / USERS visibility
  let label = 'Private';
  if (mentions.length === 1) {
    label = `Private · 1 person`;
  } else if (mentions.length > 1) {
    label = `Private · ${mentions.length} people`;
  } else {
    label = 'Private';
  }

  return (
    <span className={`note-visibility-badge badge-private size-${size}`} title={mentions.map((m) => `@${m.username}`).join(', ')}>
      <LockIcon size={size === 'sm' ? 12 : 14} />
      <span>{label}</span>
    </span>
  );
};
