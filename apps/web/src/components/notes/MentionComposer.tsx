import React, { useRef, useMemo } from 'react';
import type { ProjectMemberDetail } from '../../api/members.api';
import { AlertCircleIcon } from '../ui/Icons';
import { NoteVisibilityBadge } from './NoteVisibilityBadge';

export interface MentionComposerProps {
  value: string;
  onChange: (val: string) => void;
  members: ProjectMemberDetail[];
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export const MentionComposer: React.FC<MentionComposerProps> = ({
  value,
  onChange,
  members,
  placeholder = 'Write your note here... Use @ Mention button above to tag team members.',
  rows = 12,
  disabled = false,
  textareaRef: externalTextareaRef,
}) => {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalTextareaRef || internalRef;

  // Parse active members map
  const memberMap = useMemo(() => {
    const map = new Map<string, ProjectMemberDetail>();
    (members || []).forEach((m) => {
      if (m?.user?.username) {
        map.set(m.user.username.toLowerCase(), m);
      }
    });
    return map;
  }, [members]);

  // Compute live mention summary & invalid mentions
  const { derivedVisibility, mentionedUsers, invalidMentions } = useMemo(() => {
    const mentionRegex = /(?:^|[\s(>])@([a-zA-Z0-9_.-]+)/g;
    let match: RegExpExecArray | null;
    let hasTeam = false;
    const foundUsernames = new Set<string>();

    while ((match = mentionRegex.exec(value)) !== null) {
      const tag = match[1].replace(/[.,!?;:]+$/, '').toLowerCase();
      if (!tag) continue;
      if (tag === 'team') {
        hasTeam = true;
      } else {
        foundUsernames.add(tag);
      }
    }

    const invalid: string[] = [];
    const validUsers: Array<{ id: string; username: string; fullName: string | null; avatarUrl: string | null }> = [];

    foundUsernames.forEach((uname) => {
      const m = memberMap.get(uname);
      if (m) {
        validUsers.push({
          id: m.userId || m.id,
          username: m.user.username,
          fullName: m.user.fullName,
          avatarUrl: m.user.avatarUrl,
        });
      } else {
        invalid.push(uname);
      }
    });

    let visibility: 'TEAM' | 'USERS' = 'TEAM';
    if (hasTeam) {
      visibility = 'TEAM';
    } else if (validUsers.length > 0) {
      visibility = 'USERS';
    }

    return {
      derivedVisibility: visibility,
      mentionedUsers: validUsers,
      invalidMentions: invalid,
    };
  }, [value, memberMap]);

  return (
    <div className="mention-composer-wrapper">
      {/* Visibility preview bar */}
      <div className="mention-composer-toolbar">
        <div className="mention-visibility-indicator">
          <span className="toolbar-label">Scope:</span>
          <NoteVisibilityBadge
            visibility={derivedVisibility}
            mentions={mentionedUsers}
            size="sm"
          />
        </div>
        <span className="mention-help-tip">
          Use the <strong>@ Mention</strong> button in the toolbar to tag team members
        </span>
      </div>

      {/* Clean Textarea container */}
      <div className="mention-textarea-box">
        <textarea
          ref={textareaRef}
          className="form-textarea mention-textarea"
          rows={rows}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>

      {/* Invalid mentions warning banner */}
      {invalidMentions.length > 0 && (
        <div className="mention-warning-banner">
          <AlertCircleIcon size={16} />
          <span>
            {invalidMentions.length === 1
              ? `Teammate @${invalidMentions[0]} isn't part of this project. Remove or fix this mention before saving.`
              : `The following users are not members of this project: ${invalidMentions
                  .map((u) => `@${u}`)
                  .join(', ')}`}
          </span>
        </div>
      )}
    </div>
  );
};
