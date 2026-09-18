import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from '../../router/Router';
import { projectsApi, type Project } from '../../api/projects.api';
import { useProjectSocket } from '../../context/SocketContext';
import {
  workApi,
  type WorkItem,
  type WorkItemStatus,
} from '../../api/work.api';
import { ProjectWorkspaceHeader } from '../../components/workspace/ProjectWorkspaceHeader';
import { CreateWorkItemModal } from '../../components/workspace/CreateWorkItemModal';
import { WorkItemDetailsModal } from '../../components/workspace/WorkItemDetailsModal';
import {
  SearchIcon,
  PlusIcon,
  MessageSquareIcon,
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
  UserIcon,
  PlayIcon,
  ClockIcon,
  CheckCircleIcon,
  CircleDotIcon,
  PaperclipIcon,
  RefreshCwIcon,
  KanbanIcon,
  ArrowUpDownIcon,
  DragHandleDotsIcon,
  CheckIcon,
} from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { CustomSelect } from '../../components/ui/CustomSelect';

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
    emptyIcon: <RefreshCwIcon size={22} />,
    emptySubtitle: 'Tasks in progress will appear here.',
    themeClass: 'col-theme-progress',
  },
  {
    id: 'BLOCKED',
    title: 'Blocked',
    dotColor: '#EF4444',
    emptyIcon: <AlertCircleIcon size={22} />,
    emptySubtitle: 'Blocked items will appear here.',
    themeClass: 'col-theme-blocked',
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
];

interface ProjectBoardPageProps {
  project?: Project | null;
  hideHeader?: boolean;
}

export const ProjectBoardPage: React.FC<ProjectBoardPageProps> = ({
  project: propProject,
  hideHeader = false,
}) => {
  const { path, navigate } = useRouter();

  // Extract projectId from path e.g. /app/projects/:projectId/board
  const projectId = path.split('/')[3];
  const { socket, isConnected } = useProjectSocket(projectId);

  const [project, setProject] = useState<Project | null>(propProject || null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('ALL');
  const [sortByDueDate, setSortByDueDate] = useState<string>('DEFAULT');

  // UI state
  const [isCompact, setIsCompact] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<WorkItemStatus | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [defaultCreateStatus, setDefaultCreateStatus] = useState<WorkItemStatus>('TODO');
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);

  const gridContainerRef = useRef<HTMLDivElement>(null);

  const loadBoardData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      const [projRes, workRes] = await Promise.all([
        projectsApi.getProjectById(projectId),
        workApi.getProjectWorkItems(projectId),
      ]);

      if (projRes.success && projRes.data.project) {
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
  }, [projectId]);

  useEffect(() => {
    loadBoardData();
  }, [loadBoardData]);

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

  // Filtered and sorted work items
  const filteredItems = useMemo(() => {
    let result = workItems.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      // Type
      if (selectedType !== 'ALL' && item.type !== selectedType) {
        return false;
      }
      // Priority
      if (selectedPriority !== 'ALL' && item.priority !== selectedPriority) {
        return false;
      }
      // Assignee
      if (selectedAssignee !== 'ALL') {
        if (selectedAssignee === 'UNASSIGNED') {
          if (item.assignedToId) return false;
        } else if (item.assignedToId !== selectedAssignee) {
          return false;
        }
      }
      return true;
    });

    if (sortByDueDate === 'SOONEST') {
      result = [...result].sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    } else if (sortByDueDate === 'LATEST') {
      result = [...result].sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
      });
    }

    return result;
  }, [workItems, searchQuery, selectedType, selectedPriority, selectedAssignee, sortByDueDate]);

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
      alert(err.message || 'Failed to change status');
    }
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
  };

  const handleWorkItemUpdated = () => {
    loadBoardData();
  };

  const handleWorkItemDeleted = (deletedId: string) => {
    setWorkItems((prev) => prev.filter((i) => i.id !== deletedId));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedType('ALL');
    setSelectedPriority('ALL');
    setSelectedAssignee('ALL');
    setSortByDueDate('DEFAULT');
  };

  const isFilteringActive =
    searchQuery.trim() !== '' ||
    selectedType !== 'ALL' ||
    selectedPriority !== 'ALL' ||
    selectedAssignee !== 'ALL' ||
    sortByDueDate !== 'DEFAULT';

  if (loading) {
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
    <div className={hideHeader ? 'project-board-embedded' : 'project-workspace-page project-board-page-modern'}>
      {/* Top Project Atmosphere Header */}
      {!hideHeader && project && (
        <ProjectWorkspaceHeader
          project={project}
          currentTab="board"
          onOpenCreateWorkModal={() => {
            setDefaultCreateStatus('TODO');
            setCreateModalOpen(true);
          }}
        />
      )}

      <div className="kb-main-wrapper">
        {/* Modern 2-Row Filter & Action Toolbar inside Small White Top Section */}
        <div className="kb-toolbar-card">
          {/* Row 1: Search on left, Actions on right */}
          <div className="kb-toolbar-row-top">
            <div className="kb-search-box">
              <SearchIcon size={15} className="kb-search-icon" />
              <input
                type="text"
                placeholder="Filter work items..."
                className="kb-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="kb-toolbar-right">
              {/* Kanban View Active Pill */}
              <div className="kb-view-pill active">
                <KanbanIcon size={14} />
                <span>Kanban</span>
              </div>

              {/* Compact Toggle Button */}
              <button
                type="button"
                className={`kb-action-pill-btn ${isCompact ? 'active' : ''}`}
                onClick={() => setIsCompact((prev) => !prev)}
                title="Toggle compact card mode"
              >
                <ListIcon size={14} />
                <span>Compact</span>
              </button>

              {/* Refresh Button */}
              <button
                type="button"
                className="kb-more-square-btn"
                onClick={() => loadBoardData()}
                title="Refresh board"
              >
                <RefreshCwIcon size={16} />
              </button>
            </div>
          </div>

          {/* Row 2: Filter Dropdowns */}
          <div className="kb-toolbar-row-bottom">
            <div className="kb-filters-row">
              {/* Type Filter */}
              <CustomSelect
                value={selectedType}
                onChange={(val) => setSelectedType(val)}
                compact
                fullWidth={false}
                options={[
                  { value: 'ALL', label: 'All Types' },
                  {
                    value: 'TASK',
                    label: 'Task',
                    icon: <ListIcon size={15} />,
                    iconBg: '#F1F5F9',
                    iconColor: '#475569',
                  },
                  {
                    value: 'BUG',
                    label: 'Bug',
                    icon: <BugIcon size={15} />,
                    iconBg: '#FFE4E6',
                    iconColor: '#E11D48',
                  },
                  {
                    value: 'FEATURE',
                    label: 'Feature',
                    icon: <CodeIcon size={15} />,
                    iconBg: '#EDE9FE',
                    iconColor: '#7C3AED',
                  },
                  {
                    value: 'IMPROVEMENT',
                    label: 'Improvement',
                    icon: <TrendingUpIcon size={15} />,
                    iconBg: '#FEF3C7',
                    iconColor: '#D97706',
                  },
                  {
                    value: 'RESEARCH',
                    label: 'Research',
                    icon: <FileTextIcon size={15} />,
                    iconBg: '#FEF3C7',
                    iconColor: '#D97706',
                  },
                  {
                    value: 'DOCUMENTATION',
                    label: 'Documentation',
                    icon: <FileTextIcon size={15} />,
                    iconBg: '#F1F5F9',
                    iconColor: '#475569',
                  },
                  {
                    value: 'OTHER',
                    label: 'Other',
                    icon: <MoreHorizontalIcon size={15} />,
                    iconBg: '#F1F5F9',
                    iconColor: '#6B7280',
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
                  { value: 'ALL', label: 'All Priorities' },
                  {
                    value: 'LOW',
                    label: 'Low',
                    icon: <ArrowDownIcon size={15} />,
                    iconBg: '#DCFCE7',
                    iconColor: '#16A34A',
                  },
                  {
                    value: 'MEDIUM',
                    label: 'Medium',
                    icon: <BarChartIcon size={15} />,
                    iconBg: '#FEF3C7',
                    iconColor: '#D97706',
                  },
                  {
                    value: 'HIGH',
                    label: 'High',
                    icon: <DoubleArrowUpIcon size={15} />,
                    iconBg: '#FEE2E2',
                    iconColor: '#DC2626',
                  },
                  {
                    value: 'URGENT',
                    label: 'Urgent',
                    icon: <AlertCircleIcon size={15} />,
                    iconBg: '#FEE2E2',
                    iconColor: '#DC2626',
                  },
                ]}
              />

              {/* Assignee Filter */}
              <CustomSelect
                value={selectedAssignee}
                onChange={(val) => setSelectedAssignee(val)}
                compact
                fullWidth={false}
                options={[
                  { value: 'ALL', label: 'All Assignees' },
                  {
                    value: 'UNASSIGNED',
                    label: 'Unassigned',
                    icon: <UserIcon size={14} />,
                    iconBg: '#F1F5F9',
                    iconColor: '#475569',
                  },
                  ...(project.createdBy
                    ? [
                        {
                          value: project.createdById,
                          label: `${project.createdBy.fullName || project.createdBy.username} (Owner)`,
                          badge: 'Owner',
                          badgeType: 'owner' as const,
                          avatarUrl: project.createdBy.avatarUrl,
                          initials: (project.createdBy.fullName || project.createdBy.username)
                            .charAt(0)
                            .toUpperCase(),
                        },
                      ]
                    : []),
                  ...(project.members
                    ? project.members
                        .filter((m) => m.userId !== project.createdById)
                        .map((m) => ({
                          value: m.userId,
                          label: m.user.fullName || m.user.username,
                          badge: m.role === 'PROJECT_ADMIN' ? 'Admin' : 'Member',
                          badgeType: (m.role === 'PROJECT_ADMIN' ? 'admin' : 'member') as any,
                          avatarUrl: m.user.avatarUrl,
                          initials: (m.user.fullName || m.user.username).charAt(0).toUpperCase(),
                        }))
                    : []),
                ]}
              />

              {/* Due Date Sort */}
              <CustomSelect
                value={sortByDueDate}
                onChange={(val) => setSortByDueDate(val)}
                compact
                fullWidth={false}
                options={[
                  {
                    value: 'DEFAULT',
                    label: 'Due Date',
                    icon: <ArrowUpDownIcon size={14} />,
                    iconBg: '#F8FAFC',
                    iconColor: '#64748B',
                  },
                  {
                    value: 'SOONEST',
                    label: 'Due Soonest',
                    icon: <CalendarIcon size={14} />,
                    iconBg: '#EFF6FF',
                    iconColor: '#2563EB',
                  },
                  {
                    value: 'LATEST',
                    label: 'Due Latest',
                    icon: <CalendarIcon size={14} />,
                    iconBg: '#F1F5F9',
                    iconColor: '#475569',
                  },
                ]}
              />

              {isFilteringActive && (
                <button type="button" className="kb-clear-filters-btn" onClick={clearFilters}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 5-Column Kanban Board Grid */}
        <div
          ref={gridContainerRef}
          className={`kb-grid-columns ${isCompact ? 'compact-mode' : ''}`}
        >
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
                    <button
                      type="button"
                      className="kb-col-more-icon-btn"
                      title="Column options"
                    >
                      <MoreHorizontalIcon size={14} />
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
                      const isOverdue =
                        item.dueDate &&
                        item.status !== 'COMPLETED' &&
                        new Date(item.dueDate) < new Date();

                      return (
                        <div
                          key={item.id}
                          className="kb-work-card"
                          draggable
                          onDragStart={(e) => handleDragStart(e, item.id)}
                          onClick={() => setSelectedWorkItemId(item.id)}
                        >
                          {/* Top row: drag handle, type pill, priority dot */}
                          <div className="kb-card-top-row">
                            <div className="kb-card-top-left">
                              <DragHandleDotsIcon size={12} className="kb-drag-dots" />
                              <span className={`kb-type-pill badge-${item.type.toLowerCase()}`}>
                                {item.type}
                              </span>
                            </div>
                            <span
                              className={`kb-priority-dot dot-${item.priority.toLowerCase()}`}
                              title={`Priority: ${item.priority}`}
                            />
                          </div>

                          {/* Card Title */}
                          <h4 className="kb-card-title">{item.title}</h4>

                          {/* Description Snippet */}
                          {item.description && !isCompact && (
                            <p className="kb-card-desc-snippet">{item.description}</p>
                          )}

                          {/* Meta Footer Row */}
                          <div className="kb-card-footer-row">
                            <div className="kb-card-footer-left">
                              {item.dueDate && (
                                <span className={`kb-due-date-pill ${isOverdue ? 'overdue' : ''}`}>
                                  <CalendarIcon size={12} />
                                  <span>
                                    {new Date(item.dueDate).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                </span>
                              )}

                              <span className="kb-meta-count-pill">
                                <MessageSquareIcon size={11} />
                                <span>{item._count?.comments || item.comments?.length || 0}</span>
                              </span>

                              <span className="kb-meta-count-pill">
                                <PaperclipIcon size={11} />
                                <span>{(item as any).attachments?.length || 0}</span>
                              </span>
                            </div>

                            <div className="kb-card-footer-right">
                              {item.assignedTo ? (
                                <div
                                  className="kb-assignee-avatar"
                                  title={`Assigned to ${item.assignedTo.fullName || item.assignedTo.username}`}
                                >
                                  {item.assignedTo.avatarUrl ? (
                                    <img src={item.assignedTo.avatarUrl} alt="" />
                                  ) : (
                                    <span>
                                      {(
                                        item.assignedTo.fullName || item.assignedTo.username
                                      )[0].toLowerCase()}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="kb-assignee-avatar unassigned" title="Unassigned">
                                  <span>?</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Inline Status Dropdown Selector */}
                          <div
                            className="kb-card-inline-status"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <CustomSelect
                              size="sm"
                              compact
                              fullWidth={false}
                              align="left"
                              value={item.status}
                              onChange={(val) =>
                                handleQuickStatusMove(
                                  null,
                                  item.id,
                                  val as WorkItemStatus
                                )
                              }
                              options={[
                                {
                                  value: 'TODO',
                                  label: 'To Do',
                                  icon: <CircleDotIcon size={13} />,
                                  iconBg: '#F1F5F9',
                                  iconColor: '#475569',
                                },
                                {
                                  value: 'IN_PROGRESS',
                                  label: 'In Progress',
                                  icon: <PlayIcon size={13} />,
                                  iconBg: '#EFF6FF',
                                  iconColor: '#2563EB',
                                },
                                {
                                  value: 'BLOCKED',
                                  label: 'Blocked',
                                  icon: <AlertCircleIcon size={13} />,
                                  iconBg: '#FEF2F2',
                                  iconColor: '#EF4444',
                                },
                                {
                                  value: 'IN_REVIEW',
                                  label: 'In Review',
                                  icon: <ClockIcon size={13} />,
                                  iconBg: '#FAF5FF',
                                  iconColor: '#8B5CF6',
                                },
                                {
                                  value: 'COMPLETED',
                                  label: 'Completed',
                                  icon: <CheckCircleIcon size={13} />,
                                  iconBg: '#ECFDF5',
                                  iconColor: '#10B981',
                                },
                              ]}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bottom Add Item Button */}
                <button
                  type="button"
                  className="kb-col-bottom-add-btn"
                  onClick={() => handleOpenCreateForColumn(col.id)}
                >
                  <PlusIcon size={13} />
                  <span>Add item</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      <CreateWorkItemModal
        project={project}
        isOpen={createModalOpen}
        defaultStatus={defaultCreateStatus}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleWorkItemCreated}
      />

      <WorkItemDetailsModal
        project={project}
        workItemId={selectedWorkItemId}
        onClose={() => setSelectedWorkItemId(null)}
        onUpdated={handleWorkItemUpdated}
        onDeleted={handleWorkItemDeleted}
      />
    </div>
  );
};
