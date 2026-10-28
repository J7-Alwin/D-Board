import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { myWorkApi, type MyWorkResponse } from '../../api/myWork.api';
import { projectsApi, type Project } from '../../api/projects.api';
import {
  workApi,
  type WorkItem,
  type WorkItemStatus,
  type WorkItemPriority,
  type WorkItemType,
  type UserSummary,
} from '../../api/work.api';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { CreateWorkItemModal } from '../../components/workspace/CreateWorkItemModal';
import { WorkItemDetailsModal } from '../../components/workspace/WorkItemDetailsModal';
import {
  ClockIcon,
  CalendarIcon,
  AlertCircleIcon,
  SearchIcon,
  PlusIcon,
  LayersIcon,
  ListIcon,
  BugIcon,
  CodeIcon,
  TrendingUpIcon,
  FileTextIcon,
  MoreHorizontalIcon,
  ArrowDownIcon,
  BarChartIcon,
  DoubleArrowUpIcon,
  PlayIcon,
  CheckCircleIcon,
  FolderIcon,
  CircleDotIcon,
  ActivityIcon,
  CheckIcon,
  RefreshCwIcon,
  DragHandleDotsIcon,
  MessageSquareIcon,
  PaperclipIcon,
  MaximizeIcon,
  MinimizeIcon,
  CheckSquareIcon,
  UsersIcon,
} from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { ProjectAvatar } from '../../components/ui/ProjectAvatar';

// High-Fidelity SVG Components matching Reference Design
const MyWorkSquircleIcon: React.FC = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="5" stroke="#1E293B" strokeWidth="2" fill="none" />
    <path d="M7.5 12L10.5 15L16.5 9" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MyWorkHeaderIllustration: React.FC = () => (
  <svg
    className="mywork-header-landscape-svg"
    viewBox="0 0 240 85"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="leaf-dark-grad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#047857" />
        <stop offset="60%" stopColor="#059669" />
        <stop offset="100%" stopColor="#10B981" />
      </linearGradient>
      <linearGradient id="leaf-light-grad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#059669" />
        <stop offset="50%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#34D399" />
      </linearGradient>
      <filter id="mw-card-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0F172A" floodOpacity="0.09" />
      </filter>
    </defs>

    {/* Soft Circular Aura on Left behind Botanical Sprig */}
    <circle cx="48" cy="46" r="38" fill="#EFF6FF" opacity="0.9" />

    {/* Soft cloud behind plant/card */}
    <path
      d="M 62 26 C 62 22 66 18 72 18 C 76 18 79 21 81 24 C 84 23 88 24 90 27 C 92 30 91 34 87 34 L 66 34 C 62 34 62 30 62 26 Z"
      fill="#F8FAFC"
      opacity="0.8"
    />

    {/* Distant Mountains on Right matching Pic 4 */}
    <polygon points="145,85 188,34 232,85" fill="#EEF2F6" opacity="0.8" />
    <polygon points="130,85 168,40 206,85" fill="#D1FAE5" opacity="0.85" />
    <polygon points="160,85 195,44 230,85" fill="#A7F3D0" opacity="0.8" />

    {/* Golden Sun matching Pic 4 */}
    <circle cx="178" cy="28" r="16" fill="#FDE047" opacity="0.95" />

    {/* Soft cloud to right of sun */}
    <path
      d="M 198 32 C 198 28 202 25 207 25 C 210 25 213 27 215 29 C 217 28 221 29 223 32 C 225 35 224 38 220 38 L 202 38 C 198 38 198 35 198 32 Z"
      fill="#EEF2F6"
      opacity="0.85"
    />

    {/* Botanical Sprig matching Pic 4: slender dark stem, 3D split pointed almond leaves with veins */}
    <g>
      {/* Dark Slender Stem */}
      <path
        d="M 54 85 C 52 64, 46 45, 38 28"
        stroke="#1E293B"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Leaf 1: Top (pointing ~11:30 o'clock) */}
      <path
        d="M 38 28 C 30 22, 28 12, 32 4 C 34 12, 36 20, 38 28 Z"
        fill="url(#leaf-dark-grad)"
      />
      <path
        d="M 38 28 C 42 20, 44 12, 32 4 C 36 12, 37 20, 38 28 Z"
        fill="url(#leaf-light-grad)"
      />
      <path d="M 38 28 L 32 4" stroke="#1E293B" strokeWidth="1.1" strokeLinecap="round" />

      {/* Leaf 2: Upper-Left (pointing ~9:30 o'clock) */}
      <path
        d="M 43 40 C 35 32, 24 30, 16 32 C 26 36, 34 39, 43 40 Z"
        fill="url(#leaf-dark-grad)"
      />
      <path
        d="M 43 40 C 34 43, 25 42, 16 32 C 26 36, 35 39, 43 40 Z"
        fill="url(#leaf-light-grad)"
      />
      <path d="M 43 40 L 16 32" stroke="#1E293B" strokeWidth="1.1" strokeLinecap="round" />

      {/* Leaf 3: Bottom-Left (pointing ~8 o'clock) */}
      <path
        d="M 48 58 C 40 54, 30 55, 24 62 C 32 64, 40 62, 48 58 Z"
        fill="url(#leaf-light-grad)"
      />
      <path
        d="M 48 58 C 40 65, 30 68, 24 62 C 32 64, 41 62, 48 58 Z"
        fill="url(#leaf-dark-grad)"
      />
      <path d="M 48 58 L 24 62" stroke="#1E293B" strokeWidth="1.1" strokeLinecap="round" />

      {/* Leaf 4: Mid-Right (pointing ~4 o'clock) */}
      <path
        d="M 45 48 C 53 43, 62 45, 68 52 C 60 51, 52 50, 45 48 Z"
        fill="url(#leaf-dark-grad)"
      />
      <path
        d="M 45 48 C 53 56, 62 57, 68 52 C 60 51, 52 50, 45 48 Z"
        fill="url(#leaf-light-grad)"
      />
      <path d="M 45 48 L 68 52" stroke="#1E293B" strokeWidth="1.1" strokeLinecap="round" />
    </g>

    {/* Center White Floating Task Card matching Pic 4 */}
    <g filter="url(#mw-card-shadow)">
      <rect
        x="84"
        y="10"
        width="84"
        height="68"
        rx="10"
        fill="#FFFFFF"
        stroke="#EAECEF"
        strokeWidth="1.2"
      />
    </g>

    {/* Card Logo: [D] Dark Squircle with green accents matching Pic 4 */}
    <rect x="98" y="17" width="18" height="18" rx="4.5" fill="#0B0F19" />
    <path
      d="M 103 21 H 106.5 C 108.2 21, 109.5 22.3, 109.5 24.5 C 109.5 26.7, 108.2 28, 106.5 28 H 103 V 21 Z"
      fill="#FFFFFF"
    />
    <rect x="103.5" y="26" width="3.2" height="2" rx="0.5" fill="#10B981" />
    <polygon points="107,21 109.5,21 108.5,23.2" fill="#10B981" />

    {/* Top Right Green Checkmark Badge matching Pic 4 */}
    <circle cx="154" cy="24" r="8.5" fill="#10B981" />
    <path
      d="M 151 24 L 153.2 26.2 L 157.5 21.8"
      stroke="#FFFFFF"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* 3 Checklist Items on Task Card: Green ring + gray-blue bar */}
    <circle cx="100" cy="43" r="3.2" stroke="#10B981" strokeWidth="1.6" fill="#FFFFFF" />
    <rect x="108" y="41" width="46" height="4.5" rx="2.25" fill="#EEF2F6" />

    <circle cx="100" cy="53" r="3.2" stroke="#10B981" strokeWidth="1.6" fill="#FFFFFF" />
    <rect x="108" y="51" width="54" height="4.5" rx="2.25" fill="#EEF2F6" />

    <circle cx="100" cy="63" r="3.2" stroke="#10B981" strokeWidth="1.6" fill="#FFFFFF" />
    <rect x="108" y="61" width="40" height="4.5" rx="2.25" fill="#EEF2F6" />
  </svg>
);

const AssignedCardDecor: React.FC = () => (
  <svg className="mywork-stat-decor-svg" viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="assigned-aura-bg" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.75" />
        <stop offset="65%" stopColor="#EFF6FF" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#EFF6FF" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="assigned-aura-fg" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#BFDBFE" stopOpacity="0.65" />
        <stop offset="60%" stopColor="#DBEAFE" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#EFF6FF" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path
      d="M 140 34 C 124 34, 96 46, 80 62 C 64 78, 36 94, 0 100 L 140 100 Z"
      fill="url(#assigned-aura-bg)"
    />
    <path
      d="M 140 60 C 124 60, 104 70, 90 82 C 76 92, 54 97, 28 100 L 140 100 Z"
      fill="url(#assigned-aura-fg)"
    />
    <g transform="translate(101, 38)" stroke="#3B82F6" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx="8" cy="6" r="3.2" />
      <path d="M2 17c0-2.8 2.7-4.5 6-4.5s6 1.7 6 4.5" />
      <path d="M13.5 3.2a2.8 2.8 0 010 5" />
      <path d="M15.5 12c1.8.5 2.5 1.8 2.5 3.5" />
    </g>
  </svg>
);

const CreatedCardDecor: React.FC = () => (
  <svg className="mywork-stat-decor-svg" viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="created-aura-bg" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#EDE9FE" stopOpacity="0.75" />
        <stop offset="65%" stopColor="#F5F3FF" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#FAF5FF" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="created-aura-fg" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#DDD6FE" stopOpacity="0.65" />
        <stop offset="60%" stopColor="#EDE9FE" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#FAF5FF" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path
      d="M 140 34 C 124 34, 96 46, 80 62 C 64 78, 36 94, 0 100 L 140 100 Z"
      fill="url(#created-aura-bg)"
    />
    <path
      d="M 140 60 C 124 60, 104 70, 90 82 C 76 92, 54 97, 28 100 L 140 100 Z"
      fill="url(#created-aura-fg)"
    />
    <g transform="translate(103, 37)" stroke="#8B5CF6" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M3.5 2.5h7l4.5 4.5v10a1.8 1.8 0 01-1.8 1.8H3.5a1.8 1.8 0 01-1.8-1.8v-12.7a1.8 1.8 0 011.8-1.8z" />
      <path d="M10.5 2.5v4.5h4.5" />
      <line x1="5.5" y1="11" x2="11.5" y2="11" strokeWidth="1.6" />
      <line x1="5.5" y1="14" x2="10" y2="14" strokeWidth="1.6" />
    </g>
  </svg>
);

const InProgressCardDecor: React.FC = () => (
  <svg className="mywork-stat-decor-svg" viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="progress-aura-bg" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#D1FAE5" stopOpacity="0.75" />
        <stop offset="65%" stopColor="#ECFDF5" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#ECFDF5" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="progress-aura-fg" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.65" />
        <stop offset="60%" stopColor="#D1FAE5" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#ECFDF5" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path
      d="M 140 34 C 124 34, 96 46, 80 62 C 64 78, 36 94, 0 100 L 140 100 Z"
      fill="url(#progress-aura-bg)"
    />
    <path
      d="M 140 60 C 124 60, 104 70, 90 82 C 76 92, 54 97, 28 100 L 140 100 Z"
      fill="url(#progress-aura-fg)"
    />
    <g transform="translate(104, 38)" stroke="#10B981" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M2.5 17V10a1.8 1.8 0 013.6 0v7" />
      <path d="M7.8 17v-4.5a1.8 1.8 0 013.6 0V17" />
      <path d="M13.2 17V4a1.8 1.8 0 013.6 0v13" />
    </g>
  </svg>
);

const DueSoonCardDecor: React.FC = () => (
  <svg className="mywork-stat-decor-svg" viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="duesoon-aura-bg" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.75" />
        <stop offset="65%" stopColor="#FFFBEB" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#FFFBEB" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="duesoon-aura-fg" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.65" />
        <stop offset="60%" stopColor="#FEF3C7" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#FFFBEB" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path
      d="M 140 34 C 124 34, 96 46, 80 62 C 64 78, 36 94, 0 100 L 140 100 Z"
      fill="url(#duesoon-aura-bg)"
    />
    <path
      d="M 140 60 C 124 60, 104 70, 90 82 C 76 92, 54 97, 28 100 L 140 100 Z"
      fill="url(#duesoon-aura-fg)"
    />
    <g transform="translate(103, 38)" stroke="#F59E0B" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx="10" cy="10" r="8" />
      <path d="M10 5.5V10l3 2.5" />
    </g>
  </svg>
);

const OverdueCardDecor: React.FC = () => (
  <svg className="mywork-stat-decor-svg" viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="overdue-aura-bg" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#FEE2E2" stopOpacity="0.75" />
        <stop offset="65%" stopColor="#FEF2F2" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#FEF2F2" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="overdue-aura-fg" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#FECACA" stopOpacity="0.65" />
        <stop offset="60%" stopColor="#FEE2E2" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#FEF2F2" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path
      d="M 140 34 C 124 34, 96 46, 80 62 C 64 78, 36 94, 0 100 L 140 100 Z"
      fill="url(#overdue-aura-bg)"
    />
    <path
      d="M 140 60 C 124 60, 104 70, 90 82 C 76 92, 54 97, 28 100 L 140 100 Z"
      fill="url(#overdue-aura-fg)"
    />
    <g transform="translate(102, 38)" stroke="#EF4444" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M10 2.5L18.5 17.5a1.2 1.2 0 01-1 1.7H2.5a1.2 1.2 0 01-1-1.7L10 2.5z" />
      <line x1="10" y1="7.5" x2="10" y2="11.5" strokeWidth="1.8" />
      <circle cx="10" cy="14.8" r="0.8" fill="#EF4444" stroke="none" />
    </g>
  </svg>
);

const CompletedCardDecor: React.FC = () => (
  <svg className="mywork-stat-decor-svg" viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="completed-aura-bg" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#D1FAE5" stopOpacity="0.75" />
        <stop offset="65%" stopColor="#ECFDF5" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#ECFDF5" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="completed-aura-fg" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.65" />
        <stop offset="60%" stopColor="#D1FAE5" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#ECFDF5" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path
      d="M 140 34 C 124 34, 96 46, 80 62 C 64 78, 36 94, 0 100 L 140 100 Z"
      fill="url(#completed-aura-bg)"
    />
    <path
      d="M 140 60 C 124 60, 104 70, 90 82 C 76 92, 54 97, 28 100 L 140 100 Z"
      fill="url(#completed-aura-fg)"
    />
    <g transform="translate(103, 37)" stroke="#10B981" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M4.5 3.5h11v5a5.5 5.5 0 01-11 0v-5z" />
      <path d="M4.5 5.5H2a2.5 2.5 0 002.5 2.5" />
      <path d="M15.5 5.5H18a2.5 2.5 0 01-2.5 2.5" />
      <line x1="10" y1="13.5" x2="10" y2="16.5" />
      <line x1="6.5" y1="16.5" x2="13.5" y2="16.5" strokeWidth="2" />
    </g>
  </svg>
);

interface KanbanColumnDef {
  id: WorkItemStatus;
  title: string;
  dotColor: string;
  emptyIcon: React.ReactNode;
  emptySubtitle: string;
  themeClass: string;
  isCompleted?: boolean;
}

const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    id: 'TODO',
    title: 'To Do',
    dotColor: '#64748B',
    emptyIcon: <FileTextIcon size={22} />,
    emptySubtitle: 'Tasks to be done will appear here.',
    themeClass: 'col-theme-todo',
  },
  {
    id: 'IN_PROGRESS',
    title: 'In Progress',
    dotColor: '#2563EB',
    emptyIcon: <RefreshCwIcon size={22} />,
    emptySubtitle: 'Tasks in progress will appear here.',
    themeClass: 'col-theme-progress',
  },
  {
    id: 'IN_REVIEW',
    title: 'In Review',
    dotColor: '#8B5CF6',
    emptyIcon: <FileTextIcon size={22} />,
    emptySubtitle: 'Items under review will appear here.',
    themeClass: 'col-theme-review',
  },
  {
    id: 'COMPLETED',
    title: 'Completed',
    dotColor: '#10B981',
    emptyIcon: <CheckIcon size={22} />,
    emptySubtitle: 'Completed tasks will appear here.',
    themeClass: 'col-theme-completed',
    isCompleted: true,
  },
  {
    id: 'BLOCKED',
    title: 'Canceled',
    dotColor: '#EF4444',
    emptyIcon: <AlertCircleIcon size={22} />,
    emptySubtitle: 'Canceled items will appear here.',
    themeClass: 'col-theme-blocked',
  },
];

const getCardStatusClass = (st: WorkItemStatus) => {
  switch (st) {
    case 'TODO':
      return 'card-status-todo';
    case 'IN_PROGRESS':
      return 'card-status-in-progress';
    case 'IN_REVIEW':
      return 'card-status-in-review';
    case 'COMPLETED':
      return 'card-status-completed';
    case 'BLOCKED':
      return 'card-status-blocked';
    default:
      return 'card-status-todo';
  }
};

const getPriorityBadgeInfo = (p: WorkItemPriority) => {
  switch (p) {
    case 'LOW':
      return {
        label: 'Low',
        icon: <ArrowDownIcon size={11} />,
        bg: '#DCFCE7',
        color: '#16A34A',
        border: '#BBF7D0',
      };
    case 'MEDIUM':
      return {
        label: 'Medium',
        icon: <BarChartIcon size={11} />,
        bg: '#FEF3C7',
        color: '#D97706',
        border: '#FDE68A',
      };
    case 'HIGH':
      return {
        label: 'High',
        icon: <DoubleArrowUpIcon size={11} />,
        bg: '#FEE2E2',
        color: '#DC2626',
        border: '#FECACA',
      };
    case 'URGENT':
      return {
        label: 'Urgent',
        icon: <AlertCircleIcon size={11} />,
        bg: '#FEE2E2',
        color: '#DC2626',
        border: '#FECACA',
      };
    default:
      return {
        label: 'Medium',
        icon: <BarChartIcon size={11} />,
        bg: '#FEF3C7',
        color: '#D97706',
        border: '#FDE68A',
      };
  }
};

const getTypeBadgeInfo = (t: WorkItemType) => {
  switch (t) {
    case 'BUG':
      return { label: 'Bug', icon: <BugIcon size={10} /> };
    case 'FEATURE':
      return { label: 'Feature', icon: <CodeIcon size={10} /> };
    case 'IMPROVEMENT':
      return { label: 'Improvement', icon: <TrendingUpIcon size={10} /> };
    case 'RESEARCH':
      return { label: 'Research', icon: <FileTextIcon size={10} /> };
    case 'DOCUMENTATION':
      return { label: 'Docs', icon: <FileTextIcon size={10} /> };
    case 'OTHER':
      return { label: 'Other', icon: <MoreHorizontalIcon size={10} /> };
    case 'TASK':
    default:
      return { label: 'Task', icon: <ListIcon size={10} /> };
  }
};

export const MyWorkPage: React.FC = () => {
  const { user } = useAuth();
  const { activeWorkspace, activeRole, isLoading: wsLoading } = useWorkspace();
  const activeWsId = activeWorkspace?.id;

  const [data, setData] = useState<MyWorkResponse | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Kanban view state
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<WorkItemStatus | null>(null);
  const [defaultCreateStatus, setDefaultCreateStatus] = useState<WorkItemStatus>('TODO');
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'my-work' | 'created-work' | 'overdue' | 'due-soon' | 'completed' | 'blocked' | 'canceled' | 'all'>('my-work');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedSort, setSelectedSort] = useState<'recentlyCreated' | 'recentlyUpdated' | 'dueDate' | 'priority'>('recentlyCreated');
  const [, setCurrentPage] = useState(1);

  // Sync initial tab and filters from URL parameters for direct metric drilldowns
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['my-work', 'created-work', 'overdue', 'due-soon', 'completed', 'blocked', 'canceled', 'all'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
    const statusParam = params.get('status');
    if (statusParam) {
      setSelectedStatus(statusParam);
    }
    const projectParam = params.get('projectId');
    if (projectParam) {
      setSelectedProjectId(projectParam);
    }
  }, []);

  // Keyboard listener for Escape to exit full screen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  // Sync body class for live animated sidebar/navbar collapse and fullscreen transition
  useEffect(() => {
    if (isFullScreen) {
      document.body.classList.add('mywork-fullscreen-mode');
      window.scrollTo(0, 0);
      const mainEl = document.querySelector('.app-workspace-main');
      if (mainEl) mainEl.scrollTop = 0;
      const contentEl = document.querySelector('.workspace-content-body');
      if (contentEl) contentEl.scrollTop = 0;
    } else {
      document.body.classList.remove('mywork-fullscreen-mode');
    }
    return () => {
      document.body.classList.remove('mywork-fullscreen-mode');
    };
  }, [isFullScreen]);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createTargetProject, setCreateTargetProject] = useState<Project | null>(null);

  // Selected item and project for details modal
  const selectedWorkItem = useMemo(() => {
    if (!selectedWorkItemId) return null;
    return workItems.find((w) => w.id === selectedWorkItemId) || null;
  }, [selectedWorkItemId, workItems]);

  const selectedWorkItemProject = useMemo(() => {
    if (!selectedWorkItem) return null;
    const found = projects.find((p) => p.id === selectedWorkItem.projectId);
    if (found) return found;
    if (selectedWorkItem.project) {
      return {
        id: selectedWorkItem.project.id,
        name: selectedWorkItem.project.name,
        key: selectedWorkItem.project.key || '',
        avatarUrl: selectedWorkItem.project.avatarUrl || null,
      } as Project;
    }
    return projects[0] || null;
  }, [selectedWorkItem, projects]);

  // Load accessible projects for filter dropdown scoped to active workspace
  useEffect(() => {
    if (wsLoading) return;
    let isCancelled = false;
    setProjects([]);
    setSelectedProjectId('');
    projectsApi.getUserProjects(activeWsId).then((res) => {
      if (!isCancelled && res.success && res.data) {
        setProjects(res.data.all);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [activeWsId, wsLoading]);

  const loadWork = useCallback(async () => {
    if (wsLoading) return;
    setData(null);
    setLoading(true);
    setError(null);

    try {
      const res = await myWorkApi.getMyWork(
        {
          tab: activeTab,
          search: searchQuery.trim() || undefined,
          projectId: selectedProjectId || undefined,
          status: selectedStatus || undefined,
          priority: selectedPriority || undefined,
          type: selectedType || undefined,
          sort: selectedSort,
          limit: 500,
        },
        activeWsId
      );

      if (res.success && res.data) {
        setData(res.data);
        setWorkItems(res.data.workItems || []);
      }
    } catch (err: any) {
      setData(null);
      setWorkItems([]);
      setError(err?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [activeWsId, wsLoading, activeTab, searchQuery, selectedProjectId, selectedStatus, selectedPriority, selectedType, selectedSort]);

  useEffect(() => {
    loadWork();
  }, [loadWork]);

  // Quick move status handler (and drop handler target)
  const handleQuickStatusMove = async (
    e: React.MouseEvent | null,
    workItemId: string,
    newStatus: WorkItemStatus
  ) => {
    if (e) e.stopPropagation();
    const item = workItems.find((w) => w.id === workItemId);
    if (!item || item.status === newStatus) return;

    // Optimistic status update - immediately changes the card's position & color!
    setWorkItems((prev) =>
      prev.map((it) => (it.id === workItemId ? { ...it, status: newStatus } : it))
    );

    try {
      const res = await workApi.updateWorkItem(item.projectId, workItemId, { status: newStatus });
      if (res.success && res.data.workItem) {
        setWorkItems((prev) =>
          prev.map((it) => (it.id === workItemId ? { ...it, ...res.data.workItem } : it))
        );
      }
    } catch (err: any) {
      loadWork();
      setError(err.message || 'Failed to change status');
    }
  };

  const isWsOwner = Boolean(
    activeRole === 'OWNER' ||
      (activeRole as string)?.toUpperCase() === 'OWNER' ||
      activeWorkspace?.isOwner ||
      (activeWorkspace?.ownerId && user?.id && activeWorkspace.ownerId === user.id)
  );
  const isWsAdmin = Boolean(
    isWsOwner ||
      activeRole === 'WORKSPACE_ADMIN' ||
      (activeRole as string)?.toUpperCase() === 'WORKSPACE_ADMIN' ||
      (activeRole as string)?.toUpperCase() === 'ADMIN' ||
      activeWorkspace?.userRole === 'WORKSPACE_ADMIN'
  );

  const canUserDragItem = useCallback((item: WorkItem) => {
    if (isWsAdmin) return true;
    if (user?.id && item.createdById === user.id) return true;
    const projectObj = projects.find((p) => p.id === item.projectId);
    if (projectObj && (projectObj.createdById === user?.id || (projectObj as any).userRole === 'PROJECT_ADMIN')) {
      return true;
    }
    return false;
  }, [isWsAdmin, user?.id, projects]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedItemId(id);
  };

  const handleDragOver = (e: React.DragEvent, colId: WorkItemStatus) => {
    e.preventDefault();
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColId(null);
  };

  const handleDrop = (e: React.DragEvent, colId: WorkItemStatus) => {
    e.preventDefault();
    setDragOverColId(null);
    const itemId = e.dataTransfer.getData('text/plain') || draggedItemId;
    if (itemId) {
      const itemToMove = workItems.find((w) => w.id === itemId);
      if (itemToMove && !canUserDragItem(itemToMove)) {
        setDraggedItemId(null);
        return;
      }
      handleQuickStatusMove(null, itemId, colId);
    }
    setDraggedItemId(null);
  };

  const handleOpenCreateForColumn = (columnStatus: WorkItemStatus) => {
    setDefaultCreateStatus(columnStatus);
    if (projects.length === 0) {
      setError('You need at least one project to create a task.');
      return;
    }
    const target = selectedProjectId
      ? projects.find((p) => p.id === selectedProjectId) || projects[0]
      : projects[0];
    setCreateTargetProject(target);
    setCreateModalOpen(true);
  };

  const handleOpenCreateModal = () => {
    if (projects.length === 0) {
      setError('You need at least one project to create a task.');
      return;
    }
    const target = selectedProjectId
      ? projects.find((p) => p.id === selectedProjectId) || projects[0]
      : projects[0];
    setCreateTargetProject(target);
    setCreateModalOpen(true);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedProjectId('');
    setSelectedStatus('');
    setSelectedPriority('');
    setSelectedType('');
    setSelectedSort('recentlyCreated');
  };

  const isFilteringActive =
    searchQuery !== '' ||
    selectedProjectId !== '' ||
    selectedStatus !== '' ||
    selectedPriority !== '' ||
    selectedType !== '' ||
    selectedSort !== 'recentlyCreated';

  // Filtered & sorted work items
  const filteredItems = useMemo(() => {
    return workItems
      .filter((item) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title?.toLowerCase().includes(q);
          const matchDesc = item.description?.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc) return false;
        }
        if (selectedProjectId && item.projectId !== selectedProjectId) {
          return false;
        }
        if (selectedStatus && item.status !== selectedStatus) {
          return false;
        }
        if (selectedPriority && item.priority !== selectedPriority) {
          return false;
        }
        if (selectedType && item.type !== selectedType) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (selectedSort === 'dueDate') {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (selectedSort === 'priority') {
          const order: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return (order[b.priority] || 0) - (order[a.priority] || 0);
        }
        if (selectedSort === 'recentlyUpdated') {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [workItems, searchQuery, selectedProjectId, selectedStatus, selectedPriority, selectedType, selectedSort]);

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className={`mywork-page-container ${isFullScreen ? 'is-fullscreen' : ''}`}>
      {/* Scoped CSS for My Work Top Banner & 6-card Grid matching reference design */}
      <style>{`
        /* My Work Header Banner matching Pic 2 */
        .mywork-page-container .mywork-header {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: space-between !important;
          flex-wrap: nowrap !important;
          background: #FFFFFF !important;
          border: 1px solid #EAECEF !important;
          border-radius: 20px !important;
          padding: 1.1rem 1.85rem !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03) !important;
          position: relative !important;
          overflow: hidden !important;
          gap: 1rem !important;
          min-height: 88px !important;
          box-sizing: border-box !important;
          width: 100% !important;
        }
        @media (max-width: 1200px) {
          .mywork-page-container .mywork-header {
            padding: 1rem 1.25rem !important;
            gap: 0.75rem !important;
          }
        }
        .mywork-page-container .mywork-header-left {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 1.15rem !important;
          flex-shrink: 0 !important;
        }
        .mywork-page-container .mywork-banner-icon-squircle {
          width: 58px !important;
          height: 58px !important;
          min-width: 58px !important;
          border-radius: 16px !important;
          background: #EFF6FF !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: #1E293B !important;
          flex-shrink: 0 !important;
        }
        .mywork-page-container .mywork-banner-titles {
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          justify-content: center !important;
          gap: 0.2rem !important;
        }
        .mywork-page-container .mywork-title-row {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 0.75rem !important;
          flex-wrap: nowrap !important;
        }
        .mywork-page-container .mywork-header-title {
          font-size: 1.75rem !important;
          font-weight: 800 !important;
          letter-spacing: -0.03em !important;
          color: #0F172A !important;
          margin: 0 !important;
          line-height: 1.15 !important;
          text-align: left !important;
        }
        .mywork-page-container .mywork-date-badge {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.4rem !important;
          font-size: 0.78125rem !important;
          font-weight: 600 !important;
          background-color: #F1F5F9 !important;
          border: 1px solid #E2E8F0 !important;
          color: #475569 !important;
          padding: 0.25rem 0.65rem !important;
          border-radius: 9999px !important;
          line-height: 1 !important;
          white-space: nowrap !important;
        }
        .mywork-page-container .mywork-header-subtitle {
          font-size: 0.875rem !important;
          color: #64748B !important;
          margin: 0 !important;
          font-weight: 400 !important;
          line-height: 1.35 !important;
          text-align: left !important;
          white-space: nowrap !important;
        }
        .mywork-page-container .mywork-header-art-wrap {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 1.15rem !important;
          margin: 0 auto !important;
          flex-shrink: 1 !important;
          min-width: 0 !important;
        }
        @media (max-width: 1100px) {
          .mywork-page-container .mywork-header-art-wrap {
            display: none !important;
          }
        }
        .mywork-page-container .mywork-quote-block {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          text-align: center !important;
          font-family: Georgia, 'Playfair Display', serif !important;
          font-style: italic !important;
          font-size: 1.05rem !important;
          font-weight: 500 !important;
          color: #1E293B !important;
          line-height: 1.35 !important;
          white-space: nowrap !important;
          flex-shrink: 0 !important;
        }
        .mywork-page-container .quote-green-swoosh {
          width: 70px !important;
          height: 8px !important;
          margin-top: 2px !important;
        }
        .mywork-page-container .mywork-header-illustration-box {
          width: 235px !important;
          height: 75px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
        }
        .mywork-page-container .mywork-header-landscape-svg {
          width: 100% !important;
          height: 100% !important;
          overflow: visible !important;
        }
        .mywork-page-container .mywork-header-right {
          display: flex !important;
          align-items: center !important;
          flex-shrink: 0 !important;
        }
        .mywork-page-container .mywork-create-btn {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.45rem !important;
          background: #0B0F19 !important;
          color: #FFFFFF !important;
          border: none !important;
          border-radius: 9999px !important;
          padding: 0.65rem 1.25rem !important;
          font-size: 0.84rem !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12) !important;
          transition: all 0.15s ease !important;
          white-space: nowrap !important;
          flex-shrink: 0 !important;
        }
        .mywork-page-container .mywork-create-btn:hover {
          background: #1E293B !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18) !important;
        }

        /* 6 Summary Stat Cards Grid matching Pic 2 */
        .mywork-page-container .mywork-summary-grid {
          display: grid !important;
          grid-template-columns: repeat(6, 1fr) !important;
          gap: 1.15rem !important;
          margin-bottom: 1.5rem !important;
        }
        @media (max-width: 1400px) {
          .mywork-page-container .mywork-summary-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .mywork-page-container .mywork-summary-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .mywork-page-container .mywork-summary-grid {
            grid-template-columns: 1fr !important;
          }
        }

        .mywork-page-container .mywork-summary-card {
          background: #FFFFFF !important;
          border: 1px solid #EAECEF !important;
          border-radius: 16px !important;
          padding: 1.15rem 1.35rem 1.15rem 1.35rem !important;
          min-height: 124px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          position: relative !important;
          overflow: hidden !important;
          cursor: pointer !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03) !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
          box-sizing: border-box !important;
        }
        .mywork-page-container .mywork-summary-card:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06) !important;
        }
        .mywork-page-container .mywork-summary-card.active-metric-card {
          border-color: #CBD5E1 !important;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04) !important;
        }
        .mywork-page-container .summary-card-top {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 0.65rem !important;
          position: relative !important;
          z-index: 2 !important;
        }
        .mywork-page-container .summary-icon-pill {
          width: 38px !important;
          height: 38px !important;
          min-width: 38px !important;
          border-radius: 11px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: transform 0.15s ease !important;
          flex-shrink: 0 !important;
        }
        .mywork-page-container .mywork-summary-card:hover .summary-icon-pill {
          transform: scale(1.05) !important;
        }
        .mywork-page-container .summary-icon-pill.icon-blue {
          background: #EFF6FF !important;
          color: #3B82F6 !important;
        }
        .mywork-page-container .summary-icon-pill.icon-purple {
          background: #FAF5FF !important;
          color: #8B5CF6 !important;
        }
        .mywork-page-container .summary-icon-pill.icon-green {
          background: #ECFDF5 !important;
          color: #10B981 !important;
        }
        .mywork-page-container .summary-icon-pill.icon-amber {
          background: #FFFBEB !important;
          color: #F59E0B !important;
        }
        .mywork-page-container .summary-icon-pill.icon-rose {
          background: #FEF2F2 !important;
          color: #EF4444 !important;
        }
        .mywork-page-container .summary-label {
          font-size: 0.875rem !important;
          font-weight: 700 !important;
          color: #1E293B !important;
          letter-spacing: -0.01em !important;
          white-space: nowrap !important;
        }
        .mywork-page-container .summary-card-bottom {
          display: flex !important;
          flex-direction: row !important;
          align-items: flex-end !important;
          justify-content: flex-start !important;
          margin-top: 0.65rem !important;
          position: relative !important;
          z-index: 2 !important;
        }
        .mywork-page-container .stat-card-info {
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          text-align: left !important;
          max-width: 65% !important;
          z-index: 2 !important;
        }
        .mywork-page-container .summary-value {
          font-size: 1.95rem !important;
          font-weight: 800 !important;
          line-height: 1.1 !important;
          letter-spacing: -0.02em !important;
          color: #0F172A !important;
          text-align: left !important;
        }
        .mywork-page-container .summary-value.text-purple {
          color: #7C3AED !important;
        }
        .mywork-page-container .summary-value.text-accent {
          color: #0284C7 !important;
        }
        .mywork-page-container .summary-value.text-amber {
          color: #D97706 !important;
        }
        .mywork-page-container .summary-value.text-danger {
          color: #DC2626 !important;
        }
        .mywork-page-container .summary-value.text-green {
          color: #059669 !important;
        }
        .mywork-page-container .summary-sub {
          font-size: 0.78125rem !important;
          font-weight: 500 !important;
          color: #64748B !important;
          margin-top: 0.25rem !important;
          white-space: nowrap !important;
          text-align: left !important;
        }
        .mywork-page-container .mywork-stat-decor-svg {
          position: absolute !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 140px !important;
          height: 100px !important;
          pointer-events: none !important;
          z-index: 1 !important;
        }

        /* Single-row Filters Toolbar */
        .mywork-page-container .mywork-filters-row {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 0.75rem !important;
          width: 100% !important;
          flex-wrap: wrap !important;
          margin-bottom: 1.5rem !important;
          overflow: visible !important;
          position: relative !important;
          z-index: 30 !important;
          box-sizing: border-box !important;
        }
        .mywork-page-container .mywork-search-box {
          display: flex !important;
          align-items: center !important;
          gap: 0.5rem !important;
          background-color: #FFFFFF !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 10px !important;
          padding: 0.45rem 0.75rem !important;
          flex: 1 1 220px !important;
          max-width: 320px !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02) !important;
        }
        .mywork-page-container .mywork-search-input {
          border: none !important;
          outline: none !important;
          background: transparent !important;
          font-size: 0.8125rem !important;
          color: #0F172A !important;
          width: 100% !important;
        }
        .mywork-page-container .mywork-filter-selects {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 0.5rem !important;
          flex-wrap: wrap !important;
          overflow: visible !important;
          position: relative !important;
          z-index: 30 !important;
        }
        .mywork-page-container .c-select-wrapper {
          position: relative !important;
          overflow: visible !important;
        }
        .mywork-page-container .c-select-wrapper:focus-within {
          z-index: 50 !important;
        }

        /* Card Base Styles */
        .mywork-page-container .kb-work-card {
          position: relative !important;
          background-color: #FFFFFF !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 12px !important;
          padding: 0.85rem 1rem 0.95rem 1.15rem !important;
          overflow: hidden !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease !important;
          display: flex !important;
          flex-direction: column !important;
          min-height: 116px !important;
          box-sizing: border-box !important;
        }
        .mywork-page-container .kb-work-card:hover {
          transform: translateY(-2px) !important;
          border-color: #CBD5E1 !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08) !important;
        }

        /* Top Row & Aligned Tags */
        .mywork-page-container .kb-card-top-row {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 0.45rem !important;
          flex-wrap: wrap !important;
        }
        .mywork-page-container .kb-card-top-left {
          display: flex !important;
          align-items: center !important;
          gap: 0.4rem !important;
          flex-wrap: wrap !important;
          min-width: 0 !important;
        }

        /* Project Name Tag */
        .mywork-page-container .kb-project-pill {
          display: inline-flex !important;
          align-items: center !important;
          gap: 4.5px !important;
          font-size: 0.6875rem !important;
          font-weight: 600 !important;
          color: #475569 !important;
          background-color: #F1F5F9 !important;
          border: 1px solid #E2E8F0 !important;
          padding: 0.12rem 0.45rem !important;
          border-radius: 6px !important;
          max-width: 140px !important;
          overflow: hidden !important;
          line-height: 1.2 !important;
        }
        .mywork-page-container .kb-work-card.card-created-by-me .kb-project-pill {
          color: #CBD5E1 !important;
          background-color: rgba(255, 255, 255, 0.08) !important;
          border-color: rgba(255, 255, 255, 0.14) !important;
        }

        /* Project Logo inside Tag */
        .mywork-page-container .kb-project-pill .kb-project-tag-logo {
          width: 14px !important;
          height: 14px !important;
          min-width: 14px !important;
          min-height: 14px !important;
          border-radius: 3px !important;
          font-size: 0.525rem !important;
          font-weight: 800 !important;
          background-color: #2563EB !important;
          color: #FFFFFF !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
          line-height: 1 !important;
          overflow: hidden !important;
        }
        .mywork-page-container .kb-project-pill .kb-project-tag-logo .project-avatar-img {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          display: block !important;
          border-radius: 3px !important;
        }
        .mywork-page-container .kb-project-pill .kb-project-tag-logo .project-avatar-monogram {
          font-size: 0.525rem !important;
          font-weight: 800 !important;
          color: #FFFFFF !important;
          line-height: 1 !important;
        }
        .mywork-page-container .kb-project-pill .kb-project-tag-logo .project-avatar-emoji {
          font-size: 0.65rem !important;
          line-height: 1 !important;
        }
        .mywork-page-container .kb-project-pill .kb-project-name-text {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        /* Type Tag */
        .mywork-page-container .kb-type-pill {
          display: inline-flex !important;
          align-items: center !important;
          gap: 3.5px !important;
          font-size: 0.65rem !important;
          font-weight: 700 !important;
          letter-spacing: 0.02em !important;
          text-transform: uppercase !important;
          padding: 0.12rem 0.45rem !important;
          border-radius: 6px !important;
          white-space: nowrap !important;
          line-height: 1.2 !important;
        }
        .mywork-page-container .kb-type-pill.badge-task {
          background-color: #E0F2FE !important;
          color: #0284C7 !important;
          border: 1px solid #BAE6FD !important;
        }
        .mywork-page-container .kb-type-pill.badge-bug {
          background-color: #FEE2E2 !important;
          color: #DC2626 !important;
          border: 1px solid #FECACA !important;
        }
        .mywork-page-container .kb-type-pill.badge-feature {
          background-color: #DBEAFE !important;
          color: #2563EB !important;
          border: 1px solid #BFDBFE !important;
        }
        .mywork-page-container .kb-type-pill.badge-improvement {
          background-color: #F3E8FF !important;
          color: #9333EA !important;
          border: 1px solid #E9D5FF !important;
        }
        .mywork-page-container .kb-type-pill.badge-research {
          background-color: #FEF3C7 !important;
          color: #D97706 !important;
          border: 1px solid #FDE68A !important;
        }
        .mywork-page-container .kb-type-pill.badge-documentation,
        .mywork-page-container .kb-type-pill.badge-other {
          background-color: #F3F4F6 !important;
          color: #4B5563 !important;
          border: 1px solid #E5E7EB !important;
        }

        /* Dark Card Type Tag Overrides */
        .mywork-page-container .kb-work-card.card-created-by-me .kb-type-pill.badge-task {
          background-color: rgba(2, 132, 199, 0.22) !important;
          color: #7DD3FC !important;
          border-color: rgba(2, 132, 199, 0.35) !important;
        }
        .mywork-page-container .kb-work-card.card-created-by-me .kb-type-pill.badge-bug {
          background-color: rgba(220, 38, 38, 0.24) !important;
          color: #FCA5A5 !important;
          border-color: rgba(220, 38, 38, 0.35) !important;
        }
        .mywork-page-container .kb-work-card.card-created-by-me .kb-type-pill.badge-feature {
          background-color: rgba(37, 99, 235, 0.24) !important;
          color: #93C5FD !important;
          border-color: rgba(37, 99, 235, 0.35) !important;
        }
        .mywork-page-container .kb-work-card.card-created-by-me .kb-type-pill.badge-improvement {
          background-color: rgba(147, 51, 234, 0.24) !important;
          color: #D8B4FE !important;
          border-color: rgba(147, 51, 234, 0.35) !important;
        }
        .mywork-page-container .kb-work-card.card-created-by-me .kb-type-pill.badge-research {
          background-color: rgba(217, 119, 6, 0.24) !important;
          color: #FCD34D !important;
          border-color: rgba(217, 119, 6, 0.35) !important;
        }
        .mywork-page-container .kb-work-card.card-created-by-me .kb-type-pill.badge-documentation,
        .mywork-page-container .kb-work-card.card-created-by-me .kb-type-pill.badge-other {
          background-color: rgba(100, 116, 139, 0.24) !important;
          color: #CBD5E1 !important;
          border-color: rgba(100, 116, 139, 0.35) !important;
        }

        /* Priority Tag Circle */
        .mywork-page-container .kb-priority-symbol-circle {
          width: 20px !important;
          height: 20px !important;
          border-radius: 50% !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06) !important;
          transition: transform 0.15s ease !important;
        }
        .mywork-page-container .kb-priority-symbol-circle:hover {
          transform: scale(1.1) !important;
        }

        /* Status Line Stripe on Left (Pic 2: White card, color ONLY in left vertical line) */
        .mywork-page-container .kb-work-card::before {
          content: '' !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          bottom: 0 !important;
          width: 5px !important;
          border-top-left-radius: 12px !important;
          border-bottom-left-radius: 12px !important;
          pointer-events: none !important;
        }

        .mywork-page-container .kb-work-card.card-status-todo {
          background-color: #FFFFFF !important;
          border-color: #E2E8F0 !important;
        }
        .mywork-page-container .kb-work-card.card-status-todo::before {
          background-color: #94A3B8 !important;
        }

        .mywork-page-container .kb-work-card.card-status-in-progress {
          background-color: #FFFFFF !important;
          border-color: #E2E8F0 !important;
        }
        .mywork-page-container .kb-work-card.card-status-in-progress::before {
          background-color: #2563EB !important;
        }

        .mywork-page-container .kb-work-card.card-status-in-review {
          background-color: #FFFFFF !important;
          border-color: #E2E8F0 !important;
        }
        .mywork-page-container .kb-work-card.card-status-in-review::before {
          background-color: #8B5CF6 !important;
        }

        .mywork-page-container .kb-work-card.card-status-completed {
          background-color: #FFFFFF !important;
          border-color: #E2E8F0 !important;
        }
        .mywork-page-container .kb-work-card.card-status-completed::before {
          background-color: #10B981 !important;
        }

        .mywork-page-container .kb-work-card.card-status-blocked {
          background-color: #FFFFFF !important;
          border-color: #E2E8F0 !important;
        }
        .mywork-page-container .kb-work-card.card-status-blocked::before {
          background-color: #EF4444 !important;
        }

        /* User Created Card Rule (Pic 3: same card structure as Pic 2, but black card) */
        .mywork-page-container .kb-work-card.card-created-by-me {
          background-color: #0F172A !important;
          border: 1px solid #1E293B !important;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25) !important;
        }
        .mywork-page-container .kb-work-card.card-created-by-me:hover {
          border-color: #334155 !important;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35) !important;
        }
        .mywork-page-container .kb-work-card.card-created-by-me .kb-card-title {
          color: #F8FAFC !important;
        }
        .mywork-page-container .kb-work-card.card-created-by-me .kb-drag-dots {
          color: #64748B !important;
        }
        /* Due Date Pill Styling */
        .mywork-page-container .kb-due-date-pill {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.3rem !important;
          font-size: 0.75rem !important;
          font-weight: 500 !important;
          color: #64748B !important;
          background-color: transparent !important;
          padding: 0.1rem 0.35rem !important;
          border-radius: 5px !important;
          border: 1px solid transparent !important;
          transition: all 0.15s ease !important;
        }
        .mywork-page-container .kb-due-date-pill svg {
          color: #64748B !important;
          flex-shrink: 0 !important;
        }

        /* Due Date: Close to Due Date (from 3 days prior or overdue) -> Red */
        .mywork-page-container .kb-due-date-pill.due-urgent,
        .mywork-page-container .kb-due-date-pill.overdue {
          color: #DC2626 !important;
          background-color: #FEF2F2 !important;
          border-color: #FECACA !important;
          font-weight: 700 !important;
        }
        .mywork-page-container .kb-due-date-pill.due-urgent svg,
        .mywork-page-container .kb-due-date-pill.overdue svg {
          color: #DC2626 !important;
        }

        /* Dark Card Due Date Pill */
        .mywork-page-container .kb-work-card.card-created-by-me .kb-due-date-pill {
          color: #94A3B8 !important;
          background: rgba(255, 255, 255, 0.06) !important;
          border: 1px solid transparent !important;
          font-weight: 500 !important;
        }
        .mywork-page-container .kb-work-card.card-created-by-me .kb-due-date-pill svg {
          color: #94A3B8 !important;
        }

        .mywork-page-container .kb-work-card.card-created-by-me .kb-due-date-pill.due-urgent,
        .mywork-page-container .kb-work-card.card-created-by-me .kb-due-date-pill.overdue {
          color: #F87171 !important;
          background: rgba(239, 68, 68, 0.18) !important;
          border-color: rgba(239, 68, 68, 0.35) !important;
          font-weight: 700 !important;
        }
        .mywork-page-container .kb-work-card.card-created-by-me .kb-due-date-pill.due-urgent svg,
        .mywork-page-container .kb-work-card.card-created-by-me .kb-due-date-pill.overdue svg {
          color: #F87171 !important;
        }
        .mywork-page-container .kb-work-card.card-created-by-me .kb-meta-count-pill {
          color: #94A3B8 !important;
        }
        .mywork-page-container .kb-work-card.card-created-by-me .kb-assignee-avatar {
          box-shadow: 0 0 0 1.5px #0F172A !important;
        }

        /* Card Title */
        .mywork-page-container .kb-card-title {
          margin: 0.45rem 0 0.5rem 0 !important;
          font-size: 0.875rem !important;
          font-weight: 700 !important;
          color: #0F172A !important;
          line-height: 1.35 !important;
          word-break: break-word !important;
        }

        /* Meta Footer Row (Pic 3: Pushed down to the bottom of the card) */
        .mywork-page-container .kb-card-footer-row {
          margin-top: auto !important;
          padding-top: 0.75rem !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 0.5rem !important;
        }

        /* Full Page View Button on Toolbar */
        .mywork-page-container .mywork-fullscreen-toggle-btn {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.45rem !important;
          padding: 0.45rem 0.95rem !important;
          background: #FFFFFF !important;
          border: 1px solid #CBD5E1 !important;
          border-radius: 9999px !important;
          color: #1E293B !important;
          font-size: 0.785rem !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
          transition: all 0.15s ease !important;
        }
        .mywork-page-container .mywork-fullscreen-toggle-btn:hover {
          background: #0F172A !important;
          border-color: #0F172A !important;
          color: #FFFFFF !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12) !important;
        }

        /* Keyframe animations for silky-smooth modern entry */
        @keyframes myworkSlideDownFade {
          from {
            opacity: 0;
            transform: translateY(-12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Fullscreen Mode Layout (Responsive & Expanded) */
        .mywork-page-container.is-fullscreen {
          display: flex !important;
          flex-direction: column !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          gap: 0.75rem !important;
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
        }

        .mywork-page-container.is-fullscreen .mywork-fullscreen-header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          background: #FFFFFF !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 18px !important;
          padding: 0.85rem 1.5rem !important;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04) !important;
          flex-shrink: 0 !important;
          min-height: 72px !important;
          position: relative !important;
          overflow: hidden !important;
          animation: myworkSlideDownFade 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .mywork-page-container.is-fullscreen .mywork-fullscreen-header-left {
          display: flex !important;
          align-items: center !important;
          gap: 0.85rem !important;
          flex-shrink: 0 !important;
          position: relative !important;
          z-index: 1 !important;
        }

        .mywork-page-container.is-fullscreen .mywork-fullscreen-logo-squircle {
          width: 46px !important;
          height: 46px !important;
          min-width: 46px !important;
          border-radius: 12px !important;
          background: #EFF6FF !important;
          border: 1px solid #DBEAFE !important;
          color: #2563EB !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          overflow: hidden !important;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.08) !important;
        }

        .mywork-page-container.is-fullscreen .mywork-fullscreen-titles {
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
        }

        .mywork-page-container.is-fullscreen .mywork-fullscreen-title {
          margin: 0 !important;
          font-size: 1.25rem !important;
          font-weight: 700 !important;
          color: #0F172A !important;
          letter-spacing: -0.02em !important;
          line-height: 1.2 !important;
        }

        .mywork-page-container.is-fullscreen .mywork-fullscreen-subtitle {
          margin: 3px 0 0 0 !important;
          font-size: 0.8125rem !important;
          color: #64748B !important;
          font-weight: 400 !important;
          line-height: 1.35 !important;
        }

        .mywork-page-container.is-fullscreen .mywork-fullscreen-meta-row {
          display: flex !important;
          align-items: center !important;
          gap: 0.45rem !important;
          margin-top: 6px !important;
          font-size: 0.775rem !important;
          color: #64748B !important;
          font-weight: 500 !important;
        }

        .mywork-page-container.is-fullscreen .mywork-fullscreen-meta-item {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.35rem !important;
          color: #64748B !important;
        }

        .mywork-page-container.is-fullscreen .mywork-fullscreen-meta-dot {
          color: #CBD5E1 !important;
          font-size: 0.75rem !important;
        }

        .mywork-page-container.is-fullscreen .mywork-fullscreen-header-right {
          display: flex !important;
          align-items: center !important;
          gap: 0.65rem !important;
          flex-shrink: 0 !important;
          position: relative !important;
          z-index: 1 !important;
        }

        /* Create Task button: BLACK */
        .mywork-page-container.is-fullscreen .mywork-fullscreen-header-right .mywork-create-btn {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.4rem !important;
          padding: 0.55rem 1.25rem !important;
          background: #0F172A !important;
          border: 1px solid #0F172A !important;
          border-radius: 9999px !important;
          color: #FFFFFF !important;
          font-size: 0.8125rem !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          box-shadow: 0 2px 4px rgba(15, 23, 42, 0.15) !important;
          transition: all 0.15s ease !important;
        }

        .mywork-page-container.is-fullscreen .mywork-fullscreen-header-right .mywork-create-btn:hover {
          background: #1E293B !important;
          border-color: #1E293B !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 8px rgba(15, 23, 42, 0.22) !important;
        }

        /* Minimize button: WHITE */
        .mywork-page-container.is-fullscreen .mywork-fullscreen-minimize-btn {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.4rem !important;
          padding: 0.55rem 1.25rem !important;
          background: #FFFFFF !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 9999px !important;
          color: #0F172A !important;
          font-size: 0.8125rem !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
          transition: all 0.15s ease !important;
        }

        .mywork-page-container.is-fullscreen .mywork-fullscreen-minimize-btn:hover {
          background: #F8FAFC !important;
          border-color: #CBD5E1 !important;
          color: #0F172A !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08) !important;
        }


        /* Fullscreen Filters Row (Pic 5 + Filters toolbar) */
        .mywork-page-container.is-fullscreen .mywork-filters-row {
          margin-bottom: 0 !important;
          padding: 0.45rem 0.85rem !important;
          background: #FFFFFF !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 12px !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03) !important;
          flex-shrink: 0 !important;
          animation: myworkSlideDownFade 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        /* Fullscreen Content Area & Responsive Kanban Columns */
        .mywork-page-container.is-fullscreen .mywork-content-area {
          flex: 1 1 0 !important;
          min-height: 0 !important;
          height: 100% !important;
          overflow: hidden !important;
          margin: 0 !important;
          display: flex !important;
          flex-direction: column !important;
        }

        .mywork-page-container.is-fullscreen .kb-grid-columns {
          flex: 1 1 0 !important;
          height: 100% !important;
          min-height: 0 !important;
          display: flex !important;
          gap: 0.85rem !important;
          width: 100% !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          padding-bottom: 0.25rem !important;
        }

        .mywork-page-container.is-fullscreen .kb-column {
          flex: 1 1 0 !important;
          min-width: 245px !important;
          max-width: none !important;
          height: 100% !important;
          min-height: 0 !important;
          display: flex !important;
          flex-direction: column !important;
        }

        .mywork-page-container.is-fullscreen .kb-col-cards-container {
          flex: 1 1 0 !important;
          min-height: 0 !important;
          height: 100% !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          padding-right: 4px !important;
        }
      `}</style>

      {/* Fullscreen Header */}
      {isFullScreen && (
        <div className="mywork-fullscreen-header">
          <div className="mywork-fullscreen-header-left">
            <div className="mywork-fullscreen-logo-squircle">
              {activeWorkspace?.avatarUrl ? (
                <img
                  src={activeWorkspace.avatarUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', borderRadius: '11px', objectFit: 'cover' }}
                />
              ) : (
                <LayersIcon size={22} style={{ color: '#2563EB' }} />
              )}
            </div>
            <div className="mywork-fullscreen-titles">
              <h2 className="mywork-fullscreen-title">
                {activeWorkspace?.name || 'Workspace'} — Tasks Board
              </h2>
              <div className="mywork-fullscreen-meta-row">
                <span className="mywork-fullscreen-meta-item">
                  <CheckSquareIcon size={13} />
                  <span>
                    {filteredItems.length} {filteredItems.length === 1 ? 'task' : 'tasks'}
                  </span>
                </span>
                <span className="mywork-fullscreen-meta-dot">•</span>
                <span className="mywork-fullscreen-meta-item">
                  <UsersIcon size={13} />
                  <span>
                    {activeWorkspace?.memberCount || 1} {(activeWorkspace?.memberCount || 1) === 1 ? 'member' : 'members'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="mywork-fullscreen-header-right">
            <button
              type="button"
              className="mywork-create-btn"
              onClick={handleOpenCreateModal}
            >
              <PlusIcon size={15} />
              <span>Create Task</span>
            </button>
            <button
              type="button"
              className="mywork-fullscreen-minimize-btn"
              onClick={() => setIsFullScreen(false)}
              title="Minimize back to normal view (Esc)"
            >
              <MinimizeIcon size={14} />
              <span>Minimize</span>
            </button>
          </div>
        </div>
      )}

      {/* Normal View Top Content (Hidden when Full Page View is active) */}
      {!isFullScreen && (
        <>
          {/* Header with Landscape Atmosphere Artwork */}
          <div className="mywork-header">
            <div className="mywork-header-left">
              <div className="mywork-banner-icon-squircle">
                <MyWorkSquircleIcon />
              </div>
              <div className="mywork-banner-titles">
                <div className="mywork-title-row">
                  <h1 className="mywork-header-title">My Tasks</h1>
                  <span className="mywork-date-badge">
                    <CalendarIcon size={14} />
                    <span>{todayFormatted}</span>
                  </span>
                </div>
                <p className="mywork-header-subtitle">
                  {activeTab === 'created-work'
                    ? 'All tasks, bugs, and features created by you across your projects.'
                    : activeTab === 'all'
                      ? 'All tasks, bugs, and features across projects you have access to.'
                      : 'All tasks, bugs, features, and deadlines assigned to you across your projects.'}
                </p>
              </div>
            </div>

            {/* Center/Atmosphere artwork */}
            <div className="mywork-header-art-wrap">
              <div className="mywork-quote-block">
                <span className="mywork-quote-text">Smaller steps bigger progress.</span>
                <svg className="quote-green-swoosh" viewBox="0 0 76 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 6.5C18 2 54 2 74 5.5M28 7.5C44 4.5 60 4 72 6.5" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="mywork-header-illustration-box">
                <MyWorkHeaderIllustration />
              </div>
            </div>

            <div className="mywork-header-right">
              <button
                type="button"
                className="mywork-create-btn"
                onClick={handleOpenCreateModal}
              >
                <PlusIcon size={16} />
                <span>Create Task</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="form-error-banner" style={{ marginBottom: '1rem' }}>
              <AlertCircleIcon size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* 6 Summary Stat Cards */}
          <div className="mywork-summary-grid">
            {/* Total Assigned */}
            <div
              className={`mywork-summary-card card-total ${activeTab === 'my-work' ? 'active-metric-card' : ''}`}
              onClick={() => {
                setActiveTab('my-work');
                setCurrentPage(1);
              }}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => e.key === 'Enter' && (setActiveTab('my-work'), setCurrentPage(1))}
            >
              <div className="summary-card-top">
                <div className="summary-icon-pill icon-blue">
                  <LayersIcon size={20} />
                </div>
                <span className="summary-label">Assigned to You</span>
              </div>
              <div className="summary-card-bottom">
                <div className="stat-card-info">
                  <div className="summary-value">{data?.summary.total || 0}</div>
                  <div className="summary-sub">Across all projects</div>
                </div>
              </div>
              <AssignedCardDecor />
            </div>

            {/* Created by You */}
            <div
              className={`mywork-summary-card card-created ${activeTab === 'created-work' ? 'active-metric-card' : ''}`}
              onClick={() => {
                setActiveTab('created-work');
                setCurrentPage(1);
              }}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => e.key === 'Enter' && (setActiveTab('created-work'), setCurrentPage(1))}
            >
              <div className="summary-card-top">
                <div className="summary-icon-pill icon-purple">
                  <FileTextIcon size={20} />
                </div>
                <span className="summary-label">Created by You</span>
              </div>
              <div className="summary-card-bottom">
                <div className="stat-card-info">
                  <div className="summary-value text-purple">{data?.summary.createdTotal || 0}</div>
                  <div className="summary-sub">Authored items</div>
                </div>
              </div>
              <CreatedCardDecor />
            </div>

            {/* In Progress */}
            <div
              className="mywork-summary-card card-in-progress"
              onClick={() => {
                setActiveTab('my-work');
                setSelectedStatus('IN_PROGRESS');
                setCurrentPage(1);
              }}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => e.key === 'Enter' && (setActiveTab('my-work'), setSelectedStatus('IN_PROGRESS'), setCurrentPage(1))}
            >
              <div className="summary-card-top">
                <div className="summary-icon-pill icon-green">
                  <ActivityIcon size={20} />
                </div>
                <span className="summary-label">In Progress</span>
              </div>
              <div className="summary-card-bottom">
                <div className="stat-card-info">
                  <div className="summary-value text-accent">{data?.summary.inProgress || 0}</div>
                  <div className="summary-sub">Active tasks</div>
                </div>
              </div>
              <InProgressCardDecor />
            </div>

            {/* Due Soon */}
            <div
              className={`mywork-summary-card card-due-soon ${activeTab === 'due-soon' ? 'active-metric-card' : ''}`}
              onClick={() => {
                setActiveTab('due-soon');
                setCurrentPage(1);
              }}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => e.key === 'Enter' && (setActiveTab('due-soon'), setCurrentPage(1))}
            >
              <div className="summary-card-top">
                <div className="summary-icon-pill icon-amber">
                  <CalendarIcon size={20} />
                </div>
                <span className="summary-label">Due Soon</span>
              </div>
              <div className="summary-card-bottom">
                <div className="stat-card-info">
                  <div className="summary-value text-amber">{data?.summary.dueSoon || 0}</div>
                  <div className="summary-sub">Due in next 7 days</div>
                </div>
              </div>
              <DueSoonCardDecor />
            </div>

            {/* Overdue */}
            <div
              className={`mywork-summary-card card-overdue ${activeTab === 'overdue' ? 'active-metric-card' : ''}`}
              onClick={() => {
                setActiveTab('overdue');
                setCurrentPage(1);
              }}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => e.key === 'Enter' && (setActiveTab('overdue'), setCurrentPage(1))}
            >
              <div className="summary-card-top">
                <div className="summary-icon-pill icon-rose">
                  <AlertCircleIcon size={20} />
                </div>
                <span className="summary-label">Overdue</span>
              </div>
              <div className="summary-card-bottom">
                <div className="stat-card-info">
                  <div className={`summary-value ${data && data.summary.overdue > 0 ? 'text-danger' : 'text-danger'}`}>
                    {data?.summary.overdue || 0}
                  </div>
                  <div className="summary-sub">Requires attention</div>
                </div>
              </div>
              <OverdueCardDecor />
            </div>

            {/* Completed */}
            <div
              className={`mywork-summary-card card-completed ${activeTab === 'completed' ? 'active-metric-card' : ''}`}
              onClick={() => {
                setActiveTab('completed');
                setCurrentPage(1);
              }}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => e.key === 'Enter' && (setActiveTab('completed'), setCurrentPage(1))}
            >
              <div className="summary-card-top">
                <div className="summary-icon-pill icon-green">
                  <CheckCircleIcon size={20} />
                </div>
                <span className="summary-label">Completed</span>
              </div>
              <div className="summary-card-bottom">
                <div className="stat-card-info">
                  <div className="summary-value text-green">{data?.summary.completed || 0}</div>
                  <div className="summary-sub">Finished items</div>
                </div>
              </div>
              <CompletedCardDecor />
            </div>
          </div>
        </>
      )}

      {/* Filters Toolbar - Single Row (Available in both normal and full screen mode) */}
      <div className="mywork-filters-row">
            <div className="mywork-search-box">
              <SearchIcon size={16} />
              <input
                type="text"
                placeholder="Search work by title or description..."
                className="mywork-search-input"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="mywork-filter-selects">
              {/* Project Filter */}
              <CustomSelect
                value={selectedProjectId}
                onChange={(val) => {
                  setSelectedProjectId(val);
                  setCurrentPage(1);
                }}
                compact
                fullWidth={false}
                options={[
                  {
                    value: '',
                    label: 'All Projects',
                    icon: <FolderIcon size={15} />,
                    iconBg: '#F3F4F6',
                    iconColor: '#374151',
                  },
                  ...projects.map((p) => ({
                    value: p.id,
                    label: p.name,
                    avatarUrl: p.avatarUrl,
                    initials: !p.avatarUrl ? p.name.trim()[0].toUpperCase() : undefined,
                    icon: !p.avatarUrl ? <FolderIcon size={15} /> : undefined,
                    iconBg: '#1F1F1F',
                    iconColor: '#FFFFFF',
                  })),
                ]}
              />

              {/* Status Filter */}
              <CustomSelect
                value={selectedStatus}
                onChange={(val) => {
                  setSelectedStatus(val);
                  setCurrentPage(1);
                }}
                compact
                fullWidth={false}
                options={[
                  { value: '', label: 'All Statuses' },
                  {
                    value: 'TODO',
                    label: 'To Do',
                    icon: <CircleDotIcon size={14} />,
                    iconBg: '#F3F4F6',
                    iconColor: '#374151',
                  },
                  {
                    value: 'IN_PROGRESS',
                    label: 'In Progress',
                    icon: <PlayIcon size={14} />,
                    iconBg: '#DBEAFE',
                    iconColor: '#2563EB',
                  },
                  {
                    value: 'IN_REVIEW',
                    label: 'In Review',
                    icon: <ClockIcon size={14} />,
                    iconBg: '#FEF3C7',
                    iconColor: '#D97706',
                  },
                  {
                    value: 'COMPLETED',
                    label: 'Completed',
                    icon: <CheckCircleIcon size={15} />,
                    iconBg: '#DCFCE7',
                    iconColor: '#16A34A',
                  },
                  {
                    value: 'BLOCKED',
                    label: 'Canceled',
                    icon: <AlertCircleIcon size={14} />,
                    iconBg: '#FEE2E2',
                    iconColor: '#DC2626',
                  },
                ]}
              />

              {/* Priority Filter */}
              <CustomSelect
                value={selectedPriority}
                onChange={(val) => {
                  setSelectedPriority(val);
                  setCurrentPage(1);
                }}
                compact
                fullWidth={false}
                options={[
                  { value: '', label: 'All Priorities' },
                  {
                    value: 'LOW',
                    label: 'Low',
                    icon: <ArrowDownIcon size={16} />,
                    iconBg: '#DCFCE7',
                    iconColor: '#16A34A',
                  },
                  {
                    value: 'MEDIUM',
                    label: 'Medium',
                    icon: <BarChartIcon size={16} />,
                    iconBg: '#FEF3C7',
                    iconColor: '#D97706',
                  },
                  {
                    value: 'HIGH',
                    label: 'High',
                    icon: <DoubleArrowUpIcon size={16} />,
                    iconBg: '#FEE2E2',
                    iconColor: '#DC2626',
                  },
                  {
                    value: 'URGENT',
                    label: 'Urgent',
                    icon: <AlertCircleIcon size={16} />,
                    iconBg: '#FEE2E2',
                    iconColor: '#DC2626',
                  },
                ]}
              />

              {/* Type Filter */}
              <CustomSelect
                value={selectedType}
                onChange={(val) => {
                  setSelectedType(val);
                  setCurrentPage(1);
                }}
                compact
                fullWidth={false}
                options={[
                  { value: '', label: 'All Types' },
                  {
                    value: 'TASK',
                    label: 'Task',
                    icon: <ListIcon size={16} />,
                    iconBg: '#E6F4EA',
                    iconColor: '#137333',
                  },
                  {
                    value: 'BUG',
                    label: 'Bug',
                    icon: <BugIcon size={16} />,
                    iconBg: '#FEE2E2',
                    iconColor: '#DC2626',
                  },
                  {
                    value: 'FEATURE',
                    label: 'Feature',
                    icon: <CodeIcon size={16} />,
                    iconBg: '#DBEAFE',
                    iconColor: '#2563EB',
                  },
                  {
                    value: 'IMPROVEMENT',
                    label: 'Improvement',
                    icon: <TrendingUpIcon size={16} />,
                    iconBg: '#F3E8FF',
                    iconColor: '#9333EA',
                  },
                  {
                    value: 'RESEARCH',
                    label: 'Research',
                    icon: <FileTextIcon size={16} />,
                    iconBg: '#FEF3C7',
                    iconColor: '#D97706',
                  },
                  {
                    value: 'DOCUMENTATION',
                    label: 'Documentation',
                    icon: <FileTextIcon size={16} />,
                    iconBg: '#F3F4F6',
                    iconColor: '#4B5563',
                  },
                  {
                    value: 'OTHER',
                    label: 'Other',
                    icon: <MoreHorizontalIcon size={16} />,
                    iconBg: '#F3F4F6',
                    iconColor: '#6B7280',
                  },
                ]}
              />

              {/* Sort Selector */}
              <CustomSelect
                value={selectedSort}
                onChange={(val) => {
                  setSelectedSort(val as any);
                  setCurrentPage(1);
                }}
                compact
                align="right"
                fullWidth={false}
                options={[
                  { value: 'recentlyCreated', label: 'Newest First' },
                  { value: 'recentlyUpdated', label: 'Recently Updated' },
                  { value: 'dueDate', label: 'Due Date' },
                  { value: 'priority', label: 'Priority' },
                ]}
              />

              {/* Right side: Clear Filters & Full Page View button */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isFilteringActive && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}

                {!isFullScreen && (
                  <button
                    type="button"
                    className="mywork-fullscreen-toggle-btn"
                    onClick={() => setIsFullScreen(true)}
                    title="Expand to Full Page View"
                  >
                    <MaximizeIcon size={14} />
                    <span>Full Page View</span>
                  </button>
                )}
              </div>
            </div>
          </div>

      {/* 5-Column Kanban Board Grid */}
      <div className="mywork-content-area">
        {loading ? (
          <div className="workspace-loading-state" style={{ padding: '3.5rem 0' }}>
            <div className="btn-spinner" />
            <p>Loading tasks...</p>
          </div>
        ) : (
          <div className="kb-grid-columns compact-mode">
            {KANBAN_COLUMNS.map((col) => {
              const columnItems = filteredItems.filter((item) => item.status === col.id);
              const isDropActive = dragOverColId === col.id;

              return (
                <div
                  key={col.id}
                  className={`kb-column ${col.themeClass} ${isDropActive ? 'drag-over' : ''}`}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.id)}
                >
                  {/* Column Header */}
                  <div className="kb-col-header">
                    <div className="kb-col-header-left">
                      {col.isCompleted ? (
                        <span className="kb-col-check-icon">
                          <CheckIcon size={12} />
                        </span>
                      ) : (
                        <span
                          className="kb-col-status-dot"
                          style={{ backgroundColor: col.dotColor }}
                        />
                      )}
                      <h3 className="kb-col-title">{col.title}</h3>
                      <span className="kb-col-count-pill">{columnItems.length}</span>
                    </div>

                    <div className="kb-col-header-actions">
                      <button
                        type="button"
                        className="kb-col-add-icon-btn"
                        title={`Add task in ${col.title}`}
                        onClick={() => handleOpenCreateForColumn(col.id)}
                      >
                        <PlusIcon size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Cards List / Empty State */}
                  <div className="kb-col-cards-container">
                    {columnItems.length === 0 ? (
                      <div className="kb-empty-column-card">
                        <div className="kb-empty-icon-circle">{col.emptyIcon}</div>
                        <h4 className="kb-empty-title">No work items</h4>
                        <p className="kb-empty-subtitle">{col.emptySubtitle}</p>
                        <button
                          type="button"
                          className="kb-empty-add-btn"
                          onClick={() => handleOpenCreateForColumn(col.id)}
                        >
                          <PlusIcon size={12} />
                          <span>Add work item</span>
                        </button>
                      </div>
                    ) : (
                      columnItems.map((item) => {
                        const isDueUrgent = (() => {
                          if (!item.dueDate || item.status === 'COMPLETED') {
                            return false;
                          }
                          const due = new Date(item.dueDate);
                          const now = new Date();
                          const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
                          const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                          const daysUntilDue = Math.round((dueDay - todayDay) / (1000 * 60 * 60 * 24));
                          return daysUntilDue <= 3;
                        })();

                        const isCreatedByMe = Boolean(user?.id && item.createdById === user.id);
                        const statusClass = getCardStatusClass(item.status);
                        const projectObj = item.project || projects.find((p) => p.id === item.projectId);
                        const projectName = projectObj?.name || '';
                        const projectLogoUrl = projectObj?.avatarUrl;
                        const typeInfo = getTypeBadgeInfo(item.type);
                        const priorityInfo = getPriorityBadgeInfo(item.priority);

                        const canDrag = canUserDragItem(item);

                        return (
                          <div
                            key={item.id}
                            className={`kb-work-card ${statusClass} ${isCreatedByMe ? 'card-created-by-me' : ''}`}
                            draggable={canDrag}
                            onDragStart={(e) => {
                              if (!canDrag) {
                                e.preventDefault();
                                return;
                              }
                              handleDragStart(e, item.id);
                            }}
                            onClick={() => setSelectedWorkItemId(item.id)}
                            style={{ cursor: canDrag ? 'grab' : 'pointer' }}
                          >
                            {/* Top row: drag handle, project name tag, type tag, priority tag, created by you badge */}
                            <div className="kb-card-top-row">
                              <div className="kb-card-top-left">
                                {canDrag && <DragHandleDotsIcon size={13} className="kb-drag-dots" />}

                                {/* Project Name Tag */}
                                {projectName && (
                                  <span className="kb-project-pill" title={`Project: ${projectName}`}>
                                    <ProjectAvatar
                                      project={projectObj}
                                      name={projectName}
                                      avatarUrl={projectLogoUrl}
                                      size="xs"
                                      className="kb-project-tag-logo"
                                    />
                                    <span className="kb-project-name-text">{projectName}</span>
                                  </span>
                                )}

                                {/* Type Tag */}
                                <span
                                  className={`kb-type-pill badge-${item.type.toLowerCase()}`}
                                  title={`Type: ${typeInfo.label}`}
                                >
                                  {typeInfo.icon}
                                  <span>{typeInfo.label}</span>
                                </span>

                                {/* Priority Tag: small circle with priority symbol and same color as in dropdown */}
                                <span
                                  className="kb-priority-symbol-circle"
                                  title={`Priority: ${priorityInfo.label}`}
                                  style={{
                                    backgroundColor: priorityInfo.bg,
                                    color: priorityInfo.color,
                                    border: `1px solid ${priorityInfo.border}`,
                                  }}
                                >
                                  {priorityInfo.icon}
                                </span>
                              </div>
                            </div>

                            {/* Card Title */}
                            <h4 className="kb-card-title">{item.title}</h4>

                            {/* Meta Footer Row */}
                            <div className="kb-card-footer-row">
                              <div className="kb-card-footer-left">
                                {item.dueDate && (
                                  <span className={`kb-due-date-pill ${isDueUrgent ? 'due-urgent overdue' : ''}`}>
                                    <CalendarIcon size={12} />
                                    <span>
                                      {new Date(item.dueDate).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                      })}
                                    </span>
                                  </span>
                                )}

                                <span className="kb-meta-count-pill" title="Comments">
                                  <MessageSquareIcon size={11} />
                                  <span>{item._count?.comments || item.comments?.length || 0}</span>
                                </span>

                                <span className="kb-meta-count-pill" title="Attachments">
                                  <PaperclipIcon size={11} />
                                  <span>{(item as any).attachments?.length || 0}</span>
                                </span>
                              </div>

                              {/* Assignees Avatars: max 2 profile avatars */}
                              <div className="kb-card-footer-right">
                                {(() => {
                                  const list: UserSummary[] = [];
                                  if (item.assignees && item.assignees.length > 0) {
                                    item.assignees.forEach((a) => {
                                      if (a.user && !list.some((u) => u.id === a.user.id)) {
                                        list.push(a.user);
                                      }
                                    });
                                  } else if (item.assignedTo) {
                                    list.push(item.assignedTo);
                                  }

                                  if (list.length === 0) {
                                    return (
                                      <div className="kb-assignee-avatar unassigned" title="Unassigned">
                                        <span>?</span>
                                      </div>
                                    );
                                  }

                                  const visible = list.slice(0, 2);
                                  const extra = list.length - 2;

                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                      {visible.map((usr, idx) => (
                                        <div
                                          key={usr.id}
                                          className="kb-assignee-avatar"
                                          title={`Assigned to ${usr.fullName || usr.username}`}
                                          style={{
                                            marginLeft: idx > 0 ? '-6px' : '0',
                                            zIndex: 2 - idx,
                                            boxShadow: '0 0 0 1.5px #FFFFFF',
                                          }}
                                        >
                                          {usr.avatarUrl ? (
                                            <img src={usr.avatarUrl} alt="" />
                                          ) : (
                                            <span>{(usr.fullName || usr.username)[0].toUpperCase()}</span>
                                          )}
                                        </div>
                                      ))}
                                      {extra > 0 && (
                                        <span
                                          style={{
                                            marginLeft: '4px',
                                            fontSize: '0.675rem',
                                            fontWeight: 700,
                                            color: '#64748B',
                                          }}
                                        >
                                          +{extra}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Work Item Details Modal */}
      {selectedWorkItemId && selectedWorkItemProject && (
        <WorkItemDetailsModal
          project={selectedWorkItemProject}
          workItemId={selectedWorkItemId}
          initialWorkItem={selectedWorkItem}
          onClose={() => setSelectedWorkItemId(null)}
          onUpdated={(updatedItem) => {
            setWorkItems((prev) =>
              prev.map((it) => (it.id === updatedItem.id ? { ...it, ...updatedItem } : it))
            );
            loadWork();
          }}
          onDeleted={(deletedId) => {
            setWorkItems((prev) => prev.filter((it) => it.id !== deletedId));
            setSelectedWorkItemId(null);
            loadWork();
          }}
        />
      )}

      {/* Create Work Item Modal */}
      {createModalOpen && (
        <CreateWorkItemModal
          project={createTargetProject}
          projects={projects}
          isOpen={createModalOpen}
          defaultStatus={defaultCreateStatus}
          onClose={() => setCreateModalOpen(false)}
          onCreated={() => loadWork()}
        />
      )}
    </div>
  );
};
