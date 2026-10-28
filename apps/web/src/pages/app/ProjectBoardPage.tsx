import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from '../../router/Router';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { projectsApi, type Project } from '../../api/projects.api';
import { useProjectSocket } from '../../context/SocketContext';
import {
  workApi,
  type WorkItem,
  type WorkItemStatus,
  type WorkItemPriority,
  type WorkItemType,
  type UserSummary,
} from '../../api/work.api';
import { ProjectWorkspaceHeader } from '../../components/workspace/ProjectWorkspaceHeader';
import { CreateWorkItemModal } from '../../components/workspace/CreateWorkItemModal';
import { WorkItemDetailsModal } from '../../components/workspace/WorkItemDetailsModal';
import {
  SearchIcon,
  PlusIcon,
  CalendarIcon,
  AlertCircleIcon,
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
  ClockIcon,
  CheckCircleIcon,
  CircleDotIcon,
  DragHandleDotsIcon,
  CheckIcon,
  MaximizeIcon,
  MinimizeIcon,
  CheckSquareIcon,
  UsersIcon,
} from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { ProjectAvatar } from '../../components/ui/ProjectAvatar';

interface ColumnDef {
  id: WorkItemStatus;
  title: string;
  dotColor: string;
  emptyIcon: React.ReactNode;
  emptySubtitle: string;
  themeClass: string;
  isCompleted?: boolean;
}

const KANBAN_COLUMNS: ColumnDef[] = [
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
    emptyIcon: <PlayIcon size={22} />,
    emptySubtitle: 'Tasks in progress will appear here.',
    themeClass: 'col-theme-progress',
  },
  {
    id: 'IN_REVIEW',
    title: 'In Review',
    dotColor: '#D97706',
    emptyIcon: <ClockIcon size={22} />,
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

const getCardStatusClass = (status: WorkItemStatus) => {
  switch (status) {
    case 'TODO':
      return 'card-status-todo';
    case 'IN_PROGRESS':
      return 'card-status-in-progress';
    case 'IN_REVIEW':
      return 'card-status-in-review';
    case 'COMPLETED':
      return 'card-status-completed';
    case 'BLOCKED':
      return 'card-status-canceled';
    default:
      return 'card-status-todo';
  }
};

interface ProjectBoardPageProps {
  project?: Project | null;
  hideHeader?: boolean;
}

export const ProjectBoardPage: React.FC<ProjectBoardPageProps> = ({
  project: propProject,
  hideHeader = false,
}) => {
  const { path, navigate } = useRouter();
  const { user } = useAuth();
  const { activeWorkspace, activeRole } = useWorkspace();

  // Extract projectId from path e.g. /app/projects/:projectId/board
  const projectId = path.split('/')[3];
  const { socket, isConnected } = useProjectSocket(projectId);

  const [project, setProject] = useState<Project | null>(propProject || null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Single-row filters matching MyWorkPage
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedSort, setSelectedSort] = useState<
    'recentlyCreated' | 'recentlyUpdated' | 'dueDate' | 'priority'
  >('recentlyCreated');

  // Full screen & UI state
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<WorkItemStatus | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [defaultCreateStatus, setDefaultCreateStatus] = useState<WorkItemStatus>('TODO');
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propProject) {
      setProject(propProject);
    }
  }, [propProject]);

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

  const loadBoardData = useCallback(
    async (forceProjectRefresh = false) => {
      if (!projectId) return;
      setLoading(true);
      setError(null);

      try {
        const needsProject = forceProjectRefresh || (!propProject && !project);
        const [projRes, workRes] = await Promise.all([
          needsProject ? projectsApi.getProjectById(projectId) : Promise.resolve(null),
          workApi.getProjectWorkItems(projectId),
        ]);

        if (projRes && projRes.success && projRes.data?.project) {
          setProject(projRes.data.project);
        }
        if (workRes.success && workRes.data) {
          setWorkItems(workRes.data.workItems);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load project board');
      } finally {
        setLoading(false);
      }
    },
    [projectId, propProject, project]
  );

  useEffect(() => {
    loadBoardData();
  }, [projectId]);

  // Real-time synchronization for Kanban board
  useEffect(() => {
    if (!socket || !isConnected || !projectId) return;

    const handleRealtimeWorkUpdate = () => {
      workApi.getProjectWorkItems(projectId).then((res) => {
        if (res.success && res.data) {
          setWorkItems(res.data.workItems);
        }
      });
    };

    socket.on('WORK_CREATED', handleRealtimeWorkUpdate);
    socket.on('WORK_STATUS_CHANGED', handleRealtimeWorkUpdate);
    socket.on('WORK_ASSIGNED', handleRealtimeWorkUpdate);
    socket.on('WORK_UPDATED', handleRealtimeWorkUpdate);
    socket.on('WORK_COMPLETED', handleRealtimeWorkUpdate);
    socket.on('WORK_DELETED', handleRealtimeWorkUpdate);

    return () => {
      socket.off('WORK_CREATED', handleRealtimeWorkUpdate);
      socket.off('WORK_STATUS_CHANGED', handleRealtimeWorkUpdate);
      socket.off('WORK_ASSIGNED', handleRealtimeWorkUpdate);
      socket.off('WORK_UPDATED', handleRealtimeWorkUpdate);
      socket.off('WORK_COMPLETED', handleRealtimeWorkUpdate);
      socket.off('WORK_DELETED', handleRealtimeWorkUpdate);
    };
  }, [socket, isConnected, projectId]);

  // Role permissions check:
  // Workspace Owner, Workspace Admin, and Project Admin see all tasks.
  // Project Member sees only tasks that they created or are assigned to.
  const isWsOwner = Boolean(
    activeRole === 'OWNER' ||
      (activeRole as string)?.toUpperCase() === 'OWNER' ||
      activeWorkspace?.isOwner ||
      (activeWorkspace?.ownerId && user?.id && activeWorkspace.ownerId === user.id)
  );
  const isWsAdmin = Boolean(
    activeRole === 'WORKSPACE_ADMIN' ||
      (activeRole as string)?.toUpperCase() === 'WORKSPACE_ADMIN' ||
      (activeRole as string)?.toUpperCase() === 'ADMIN' ||
      activeWorkspace?.userRole === 'WORKSPACE_ADMIN' ||
      (activeWorkspace?.userRole as string)?.toUpperCase() === 'WORKSPACE_ADMIN' ||
      (activeWorkspace as any)?.role === 'WORKSPACE_ADMIN'
  );
  const isProjectAdmin = Boolean(
    isWsOwner ||
      isWsAdmin ||
      project?.userRole === 'PROJECT_ADMIN' ||
      (project?.userRole as string) === 'ADMIN' ||
      (project?.createdById && user?.id && project.createdById === user.id)
  );
  const canSeeAllTasks = isWsOwner || isWsAdmin || isProjectAdmin;

  // Filtered and sorted work items
  const filteredItems = useMemo(() => {
    return workItems
      .filter((item) => {
        // 1. Role-based visibility check:
        // Owner, Workspace Admin, and Project Admin see all tasks.
        // Regular project members see only tasks that they created or are assigned to.
        if (!canSeeAllTasks) {
          const myId = user?.id;
          if (!myId) return false;
          const isCreatedByMe = item.createdById === myId;
          const isDirectAssignee = item.assignedToId === myId;
          const isListAssignee =
            Array.isArray(item.assignees) &&
            item.assignees.some((a) => a.userId === myId || a.user?.id === myId || (a as any).id === myId);
          if (!isCreatedByMe && !isDirectAssignee && !isListAssignee) {
            return false;
          }
        }

        // 2. Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchDesc = item.description?.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc) return false;
        }

        // 3. Status
        if (selectedStatus && item.status !== selectedStatus) {
          return false;
        }

        // 4. Priority
        if (selectedPriority && item.priority !== selectedPriority) {
          return false;
        }

        // 5. Type
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
  }, [
    workItems,
    canSeeAllTasks,
    user?.id,
    searchQuery,
    selectedStatus,
    selectedPriority,
    selectedType,
    selectedSort,
  ]);

  // Quick move status handler
  const handleQuickStatusMove = async (
    e: React.MouseEvent | null,
    workItemId: string,
    newStatus: WorkItemStatus
  ) => {
    if (e) e.stopPropagation();
    try {
      // Optimistic update
      setWorkItems((prev) =>
        prev.map((item) => (item.id === workItemId ? { ...item, status: newStatus } : item))
      );

      const res = await workApi.updateWorkItem(projectId, workItemId, { status: newStatus });
      if (res.success && res.data.workItem) {
        setWorkItems((prev) =>
          prev.map((item) => (item.id === workItemId ? res.data.workItem : item))
        );
      }
    } catch (err: any) {
      loadBoardData();
      setActionError(err.message || 'Failed to change status');
    }
  };

  const canUserDragItem = (item: WorkItem) => {
    return isProjectAdmin || Boolean(user?.id && item.createdById === user.id);
  };

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
    setCreateModalOpen(true);
  };

  const handleWorkItemCreated = (newItem: WorkItem) => {
    setWorkItems((prev) => [newItem, ...prev]);
    setCreateModalOpen(false);
  };

  const handleWorkItemUpdated = () => {
    loadBoardData();
  };

  const handleWorkItemDeleted = (deletedId: string) => {
    setWorkItems((prev) => prev.filter((i) => i.id !== deletedId));
    setSelectedWorkItemId(null);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedStatus('');
    setSelectedPriority('');
    setSelectedType('');
    setSelectedSort('recentlyCreated');
  };

  const isFilteringActive =
    searchQuery.trim() !== '' ||
    selectedStatus !== '' ||
    selectedPriority !== '' ||
    selectedType !== '' ||
    selectedSort !== 'recentlyCreated';

  const selectedWorkItem = useMemo(() => {
    if (!selectedWorkItemId) return null;
    return workItems.find((w) => w.id === selectedWorkItemId) || null;
  }, [selectedWorkItemId, workItems]);

  if (loading && !project) {
    return (
      <div className="workspace-loading-state">
        <div className="btn-spinner" />
        <p>Loading Kanban board...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="workspace-error-state">
        <AlertCircleIcon size={32} />
        <h2>Unable to load board</h2>
        <p>{error || 'Project not found'}</p>
        <Button variant="primary" onClick={() => navigate('/app/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`project-board-page-container ${isFullScreen ? 'is-fullscreen' : ''} ${
        hideHeader ? 'project-board-embedded' : 'project-workspace-page project-board-page-modern'
      }`}
    >
      {/* Scoped CSS matching My Tasks page */}
      <style>{`
        .project-board-page-container {
          display: flex;
          flex-direction: column;
          width: 100%;
          gap: 1rem;
          box-sizing: border-box;
        }

        /* Filter Toolbar Row (Single row matching My Tasks) */
        .project-board-page-container .mywork-filters-row {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 0.75rem !important;
          width: 100% !important;
          flex-wrap: wrap !important;
          margin-bottom: 0.5rem !important;
          overflow: visible !important;
          position: relative !important;
          z-index: 30 !important;
          box-sizing: border-box !important;
        }
        .project-board-page-container .mywork-search-box {
          display: flex !important;
          align-items: center !important;
          gap: 0.5rem !important;
          background-color: #FFFFFF !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 10px !important;
          padding: 0.45rem 0.75rem !important;
          flex: 1 1 240px !important;
          min-width: 200px !important;
          max-width: 380px !important;
          color: #64748B !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03) !important;
          transition: all 0.15s ease !important;
        }
        .project-board-page-container .mywork-search-box:focus-within {
          border-color: #0F172A !important;
          box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.08) !important;
          color: #0F172A !important;
        }
        .project-board-page-container .mywork-search-input {
          border: none !important;
          outline: none !important;
          background: transparent !important;
          font-size: 0.8125rem !important;
          color: #0F172A !important;
          width: 100% !important;
        }
        .project-board-page-container .mywork-filter-selects {
          display: flex !important;
          align-items: center !important;
          gap: 0.5rem !important;
          flex-wrap: wrap !important;
          flex: 1 1 auto !important;
        }
        .project-board-page-container .mywork-fullscreen-toggle-btn {
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
        .project-board-page-container .mywork-fullscreen-toggle-btn:hover {
          background: #0F172A !important;
          border-color: #0F172A !important;
          color: #FFFFFF !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12) !important;
        }

        /* Card Styles */
        .project-board-page-container .kb-work-card {
          position: relative !important;
          border-radius: 14px !important;
          padding: 0.85rem 0.95rem 0.85rem 1.1rem !important;
          cursor: pointer !important;
          transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important;
          display: flex !important;
          flex-direction: column !important;
          min-height: 110px !important;
          border: 1px solid #E2E8F0 !important;
          background-color: #FFFFFF !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
        }
        .project-board-page-container .kb-work-card:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08) !important;
          border-color: #CBD5E1 !important;
        }

        /* Status Line Stripe on Left */
        .project-board-page-container .kb-work-card::before {
          content: '' !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          bottom: 0 !important;
          width: 5px !important;
          border-top-left-radius: 14px !important;
          border-bottom-left-radius: 14px !important;
          pointer-events: none !important;
        }
        .project-board-page-container .kb-work-card.card-status-todo::before {
          background-color: #94A3B8 !important;
        }
        .project-board-page-container .kb-work-card.card-status-in-progress::before {
          background-color: #2563EB !important;
        }
        .project-board-page-container .kb-work-card.card-status-in-review::before {
          background-color: #D97706 !important;
        }
        .project-board-page-container .kb-work-card.card-status-completed::before {
          background-color: #10B981 !important;
        }
        .project-board-page-container .kb-work-card.card-status-canceled::before {
          background-color: #DC2626 !important;
        }

        /* User-Created Tasks (Dark black card) */
        .project-board-page-container .kb-work-card.card-created-by-me {
          background-color: #0B1120 !important;
          border-color: #1E293B !important;
          color: #FFFFFF !important;
          box-shadow: 0 4px 14px rgba(11, 17, 32, 0.28) !important;
        }
        .project-board-page-container .kb-work-card.card-created-by-me:hover {
          background-color: #0F172A !important;
          box-shadow: 0 8px 20px rgba(11, 17, 32, 0.35) !important;
          border-color: #334155 !important;
        }
        .project-board-page-container .kb-work-card.card-created-by-me .kb-card-title {
          color: #FFFFFF !important;
        }
        .project-board-page-container .kb-work-card.card-created-by-me .kb-drag-dots {
          color: #64748B !important;
        }
        .project-board-page-container .kb-work-card.card-created-by-me .kb-project-pill {
          background-color: #1E293B !important;
          border-color: #334155 !important;
          color: #E2E8F0 !important;
        }
        .project-board-page-container .kb-work-card.card-created-by-me .kb-due-date-pill {
          background-color: #1E293B !important;
          border-color: #334155 !important;
          color: #CBD5E1 !important;
        }
        .project-board-page-container .kb-work-card.card-created-by-me .kb-assignee-avatar {
          box-shadow: 0 0 0 1.5px #0F172A !important;
        }

        /* Project Pill inside Card */
        .project-board-page-container .kb-project-pill {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.3rem !important;
          font-size: 0.675rem !important;
          font-weight: 700 !important;
          color: #1E293B !important;
          background: #F1F5F9 !important;
          border: 1px solid #E2E8F0 !important;
          padding: 0.15rem 0.45rem !important;
          border-radius: 6px !important;
          white-space: nowrap !important;
          max-width: 140px !important;
        }
        .project-board-page-container .kb-project-logo-tiny {
          width: 13px !important;
          height: 13px !important;
          border-radius: 3px !important;
          object-fit: cover !important;
        }
        .project-board-page-container .kb-project-badge-tiny {
          width: 13px !important;
          height: 13px !important;
          border-radius: 3px !important;
          background: #2563EB !important;
          color: #FFFFFF !important;
          font-size: 0.55rem !important;
          font-weight: 800 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .project-board-page-container .kb-project-pill-name {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        /* Type Tag */
        .project-board-page-container .kb-type-pill {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.25rem !important;
          font-size: 0.65rem !important;
          font-weight: 700 !important;
          padding: 0.15rem 0.45rem !important;
          border-radius: 6px !important;
          letter-spacing: 0.02em !important;
          text-transform: uppercase !important;
        }
        .project-board-page-container .kb-type-pill.badge-task {
          background-color: #E0F2FE !important;
          color: #0369A1 !important;
          border: 1px solid #BAE6FD !important;
        }
        .project-board-page-container .kb-type-pill.badge-bug {
          background-color: #FEE2E2 !important;
          color: #DC2626 !important;
          border: 1px solid #FECACA !important;
        }
        .project-board-page-container .kb-type-pill.badge-feature {
          background-color: #DBEAFE !important;
          color: #2563EB !important;
          border: 1px solid #BFDBFE !important;
        }
        .project-board-page-container .kb-type-pill.badge-improvement {
          background-color: #F3E8FF !important;
          color: #9333EA !important;
          border: 1px solid #E9D5FF !important;
        }
        .project-board-page-container .kb-type-pill.badge-research {
          background-color: #FEF3C7 !important;
          color: #D97706 !important;
          border: 1px solid #FDE68A !important;
        }
        .project-board-page-container .kb-type-pill.badge-documentation,
        .project-board-page-container .kb-type-pill.badge-other {
          background-color: #F3F4F6 !important;
          color: #4B5563 !important;
          border: 1px solid #E5E7EB !important;
        }

        /* Dark Card Type Tag Overrides */
        .project-board-page-container .kb-work-card.card-created-by-me .kb-type-pill.badge-task {
          background-color: rgba(2, 132, 199, 0.22) !important;
          color: #7DD3FC !important;
          border-color: rgba(2, 132, 199, 0.35) !important;
        }
        .project-board-page-container .kb-work-card.card-created-by-me .kb-type-pill.badge-bug {
          background-color: rgba(220, 38, 38, 0.24) !important;
          color: #FCA5A5 !important;
          border-color: rgba(220, 38, 38, 0.35) !important;
        }
        .project-board-page-container .kb-work-card.card-created-by-me .kb-type-pill.badge-feature {
          background-color: rgba(37, 99, 235, 0.24) !important;
          color: #93C5FD !important;
          border-color: rgba(37, 99, 235, 0.35) !important;
        }
        .project-board-page-container .kb-work-card.card-created-by-me .kb-type-pill.badge-improvement {
          background-color: rgba(147, 51, 234, 0.24) !important;
          color: #D8B4FE !important;
          border-color: rgba(147, 51, 234, 0.35) !important;
        }
        .project-board-page-container .kb-work-card.card-created-by-me .kb-type-pill.badge-research {
          background-color: rgba(217, 119, 6, 0.24) !important;
          color: #FCD34D !important;
          border-color: rgba(217, 119, 6, 0.35) !important;
        }
        .project-board-page-container .kb-work-card.card-created-by-me .kb-type-pill.badge-documentation,
        .project-board-page-container .kb-work-card.card-created-by-me .kb-type-pill.badge-other {
          background-color: rgba(100, 116, 139, 0.24) !important;
          color: #CBD5E1 !important;
          border-color: rgba(100, 116, 139, 0.35) !important;
        }

        /* Priority Tag Circle */
        .project-board-page-container .kb-priority-symbol-circle {
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

        /* Card Title */
        .project-board-page-container .kb-card-title {
          margin: 0.45rem 0 0.5rem 0 !important;
          font-size: 0.875rem !important;
          font-weight: 700 !important;
          color: #0F172A !important;
          line-height: 1.35 !important;
          word-break: break-word !important;
        }

        /* Footer Row */
        .project-board-page-container .kb-card-footer-row {
          margin-top: auto !important;
          padding-top: 0.75rem !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 0.5rem !important;
        }
        .project-board-page-container .kb-due-date-pill {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.3rem !important;
          font-size: 0.7rem !important;
          font-weight: 600 !important;
          color: #64748B !important;
          background: #F8FAFC !important;
          border: 1px solid #E2E8F0 !important;
          padding: 0.2rem 0.45rem !important;
          border-radius: 6px !important;
        }
        .project-board-page-container .kb-due-date-pill.due-urgent {
          background-color: #FEF2F2 !important;
          color: #DC2626 !important;
          border-color: #FECACA !important;
          font-weight: 700 !important;
        }

        /* Fullscreen Layout Overrides */
        @keyframes projectBoardSlideDown {
          from {
            opacity: 0;
            transform: translateY(-12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .project-board-page-container.is-fullscreen {
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

        .project-board-page-container.is-fullscreen .mywork-fullscreen-header {
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
          animation: projectBoardSlideDown 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .project-board-page-container.is-fullscreen .mywork-fullscreen-header-left {
          display: flex !important;
          align-items: center !important;
          gap: 0.85rem !important;
          flex-shrink: 0 !important;
          position: relative !important;
          z-index: 1 !important;
        }
        .project-board-page-container.is-fullscreen .mywork-fullscreen-logo-squircle {
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
        .project-board-page-container.is-fullscreen .mywork-fullscreen-titles {
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
        }
        .project-board-page-container.is-fullscreen .mywork-fullscreen-title {
          margin: 0 !important;
          font-size: 1.25rem !important;
          font-weight: 700 !important;
          color: #0F172A !important;
          letter-spacing: -0.02em !important;
          line-height: 1.2 !important;
        }
        .project-board-page-container.is-fullscreen .mywork-fullscreen-subtitle {
          margin: 3px 0 0 0 !important;
          font-size: 0.8125rem !important;
          color: #64748B !important;
          font-weight: 400 !important;
          line-height: 1.35 !important;
        }
        .project-board-page-container.is-fullscreen .mywork-fullscreen-meta-row {
          display: flex !important;
          align-items: center !important;
          gap: 0.45rem !important;
          margin-top: 6px !important;
          font-size: 0.775rem !important;
          color: #64748B !important;
          font-weight: 500 !important;
        }
        .project-board-page-container.is-fullscreen .mywork-fullscreen-meta-item {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.35rem !important;
          color: #64748B !important;
        }
        .project-board-page-container.is-fullscreen .mywork-fullscreen-meta-dot {
          color: #CBD5E1 !important;
          font-size: 0.75rem !important;
        }
        .project-board-page-container.is-fullscreen .mywork-fullscreen-header-right {
          display: flex !important;
          align-items: center !important;
          gap: 0.65rem !important;
          flex-shrink: 0 !important;
          position: relative !important;
          z-index: 1 !important;
        }

        /* Create Task button: BLACK */
        .project-board-page-container.is-fullscreen .mywork-fullscreen-header-right .mywork-create-btn {
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
        .project-board-page-container.is-fullscreen .mywork-fullscreen-header-right .mywork-create-btn:hover {
          background: #1E293B !important;
          border-color: #1E293B !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 8px rgba(15, 23, 42, 0.22) !important;
        }

        /* Minimize button: WHITE */
        .project-board-page-container.is-fullscreen .mywork-fullscreen-minimize-btn {
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
        .project-board-page-container.is-fullscreen .mywork-fullscreen-minimize-btn:hover {
          background: #F8FAFC !important;
          border-color: #CBD5E1 !important;
          color: #0F172A !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08) !important;
        }

        /* Fullscreen Filters Toolbar */
        .project-board-page-container.is-fullscreen .mywork-filters-row {
          margin-bottom: 0 !important;
          padding: 0.45rem 0.85rem !important;
          background: #FFFFFF !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 12px !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03) !important;
          flex-shrink: 0 !important;
          animation: projectBoardSlideDown 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        /* Fullscreen Kanban Columns Grid */
        .project-board-page-container.is-fullscreen .mywork-content-area {
          flex: 1 1 0 !important;
          min-height: 0 !important;
          height: 100% !important;
          overflow: hidden !important;
          margin: 0 !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .project-board-page-container.is-fullscreen .kb-grid-columns {
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
        .project-board-page-container.is-fullscreen .kb-column {
          flex: 1 1 0 !important;
          min-width: 245px !important;
          max-width: none !important;
          height: 100% !important;
          min-height: 0 !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .project-board-page-container.is-fullscreen .kb-col-cards-container {
          flex: 1 1 0 !important;
          min-height: 0 !important;
          height: 100% !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          padding-right: 4px !important;
        }
      `}</style>

      {/* Top Project Atmosphere Header (only in normal view when hideHeader is false) */}
      {!hideHeader && !isFullScreen && project && (
        <ProjectWorkspaceHeader
          project={project}
          currentTab="board"
          onOpenCreateWorkModal={() => {
            setDefaultCreateStatus('TODO');
            setCreateModalOpen(true);
          }}
        />
      )}

      {/* Fullscreen Header */}
      {isFullScreen && (
        <div className="mywork-fullscreen-header">
          <div className="mywork-fullscreen-header-left">
            <ProjectAvatar
              project={project}
              name={project?.name}
              avatarUrl={project?.avatarUrl}
              size="lg"
              style={{
                width: '46px',
                height: '46px',
                minWidth: '46px',
                borderRadius: '12px',
                fontSize: '1.25rem',
                fontWeight: 800,
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            />
            <div className="mywork-fullscreen-titles">
              <h2 className="mywork-fullscreen-title">{project?.name || 'Project'} — Tasks Board</h2>
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
                    {(project as any)?.memberCount || (project as any)?.members?.length || 1}{' '}
                    {((project as any)?.memberCount || (project as any)?.members?.length || 1) === 1 ? 'member' : 'members'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="mywork-fullscreen-header-right">
            <button
              type="button"
              className="mywork-create-btn"
              onClick={() => {
                setDefaultCreateStatus('TODO');
                setCreateModalOpen(true);
              }}
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

      {actionError && (
        <div
          className="form-error-banner"
          style={{
            marginBottom: '0.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              lineHeight: 1,
              color: 'inherit',
            }}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Single-Row Filter Toolbar (matching My Tasks page) */}
      <div className="mywork-filters-row">
        <div className="mywork-search-box">
          <SearchIcon size={16} />
          <input
            type="text"
            placeholder="Search work by title or description..."
            className="mywork-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="mywork-filter-selects">
          {/* Status Filter */}
          <CustomSelect
            value={selectedStatus}
            onChange={(val) => setSelectedStatus(val)}
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
            onChange={(val) => setSelectedPriority(val)}
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
            onChange={(val) => setSelectedType(val)}
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
            onChange={(val) => setSelectedSort(val as any)}
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
        <div ref={gridContainerRef} className="kb-grid-columns compact-mode">
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
                        if (!item.dueDate || item.status === 'COMPLETED') return false;
                        const due = new Date(item.dueDate);
                        const now = new Date();
                        const dueDay = new Date(
                          due.getFullYear(),
                          due.getMonth(),
                          due.getDate()
                        ).getTime();
                        const todayDay = new Date(
                          now.getFullYear(),
                          now.getMonth(),
                          now.getDate()
                        ).getTime();
                        const daysUntilDue = Math.round((dueDay - todayDay) / (1000 * 60 * 60 * 24));
                        return daysUntilDue <= 3;
                      })();

                      const isCreatedByMe = Boolean(user?.id && item.createdById === user.id);
                      const statusClass = getCardStatusClass(item.status);
                      const typeInfo = getTypeBadgeInfo(item.type);
                      const priorityInfo = getPriorityBadgeInfo(item.priority);
                      const projectName = project?.name || '';
                      const projectLogoUrl = project?.avatarUrl;

                      const canDrag = canUserDragItem(item);

                      return (
                        <div
                          key={item.id}
                          className={`kb-work-card ${statusClass} ${
                            isCreatedByMe ? 'card-created-by-me' : ''
                          }`}
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
                          {/* Top row: drag handle, project name tag, type tag, priority tag */}
                          <div className="kb-card-top-row">
                            <div className="kb-card-top-left">
                              {canDrag && <DragHandleDotsIcon size={13} className="kb-drag-dots" />}

                              {/* Project Name Tag with Logo / Monogram */}
                              {projectName && (
                                <span className="kb-project-pill" title={`Project: ${projectName}`}>
                                  {projectLogoUrl ? (
                                    <img
                                      src={projectLogoUrl}
                                      alt=""
                                      className="kb-project-logo-tiny"
                                    />
                                  ) : (
                                    <span className="kb-project-badge-tiny">
                                      {projectName.trim()[0].toUpperCase()}
                                    </span>
                                  )}
                                  <span className="kb-project-pill-name">{projectName}</span>
                                </span>
                              )}

                              {/* Type Tag */}
                              <span className={`kb-type-pill badge-${item.type.toLowerCase()}`}>
                                <span className="kb-type-pill-icon">{typeInfo.icon}</span>
                                <span>{typeInfo.label.toUpperCase()}</span>
                              </span>

                              {/* Priority Tag Circle */}
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

                          {/* Meta Footer Row: Due Date (left) & Assignees (right) */}
                          <div className="kb-card-footer-row">
                            <div className="kb-card-footer-left">
                              {item.dueDate && (
                                <span
                                  className={`kb-due-date-pill ${
                                    isDueUrgent ? 'due-urgent overdue' : ''
                                  }`}
                                  title={
                                    isDueUrgent
                                      ? 'Urgent: Due in 3 days or less'
                                      : `Due ${new Date(item.dueDate).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                        })}`
                                  }
                                >
                                  {isDueUrgent ? (
                                    <ClockIcon size={12} />
                                  ) : (
                                    <CalendarIcon size={12} />
                                  )}
                                  <span>
                                    {new Date(item.dueDate).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                </span>
                              )}
                            </div>

                            {/* Multi-Assignee Avatars */}
                            <div className="kb-card-footer-right">
                              {(() => {
                                const assigneesList: UserSummary[] = [];
                                if (Array.isArray(item.assignees) && item.assignees.length > 0) {
                                  item.assignees.forEach((a) => {
                                    if (a.user && !assigneesList.some((u) => u.id === a.user.id)) {
                                      assigneesList.push(a.user);
                                    }
                                  });
                                } else if (item.assignedTo) {
                                  assigneesList.push(item.assignedTo);
                                }
                                if (assigneesList.length === 0) return null;
                                const visible = assigneesList.slice(0, 2);
                                const extra = assigneesList.length - visible.length;

                                return (
                                  <div
                                    className="kb-assignees-stack"
                                    style={{ display: 'flex', alignItems: 'center' }}
                                  >
                                    {visible.map((usr, idx) => (
                                      <div
                                        key={usr.id}
                                        className="kb-assignee-avatar"
                                        title={usr.fullName || usr.username}
                                        style={{
                                          width: '20px',
                                          height: '20px',
                                          borderRadius: '50%',
                                          overflow: 'hidden',
                                          backgroundColor: idx === 0 ? '#1E293B' : '#3B82F6',
                                          color: '#FFFFFF',
                                          fontSize: '0.65rem',
                                          fontWeight: 700,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          marginLeft: idx > 0 ? '-6px' : '0',
                                          boxShadow: '0 0 0 1.5px #FFFFFF',
                                        }}
                                      >
                                        {usr.avatarUrl ? (
                                          <img src={usr.avatarUrl} alt="" />
                                        ) : (
                                          <span>
                                            {(usr.fullName || usr.username)[0].toUpperCase()}
                                          </span>
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
      </div>

      {/* Modals with project locked so project cannot be changed */}
      {createModalOpen && project && (
        <CreateWorkItemModal
          project={project}
          isOpen={createModalOpen}
          defaultStatus={defaultCreateStatus}
          lockProject={true}
          onClose={() => setCreateModalOpen(false)}
          onCreated={handleWorkItemCreated}
        />
      )}

      {selectedWorkItemId && project && (
        <WorkItemDetailsModal
          project={project}
          workItemId={selectedWorkItemId}
          initialWorkItem={selectedWorkItem}
          onClose={() => setSelectedWorkItemId(null)}
          onUpdated={handleWorkItemUpdated}
          onDeleted={handleWorkItemDeleted}
        />
      )}
    </div>
  );
};

export default ProjectBoardPage;
