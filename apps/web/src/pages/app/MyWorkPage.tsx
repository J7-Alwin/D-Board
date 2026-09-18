import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { myWorkApi, type MyWorkResponse } from '../../api/myWork.api';
import { projectsApi, type Project } from '../../api/projects.api';
import type { WorkItem } from '../../api/work.api';
import { workApi } from '../../api/work.api';
import { useAuth } from '../../context/AuthContext';
import { WorkItemDetailsModal } from '../../components/workspace/WorkItemDetailsModal';
import { CreateWorkItemModal } from '../../components/workspace/CreateWorkItemModal';
import { DeleteWorkItemModal } from '../../components/workspace/DeleteWorkItemModal';
import { useRouter } from '../../router/Router';
import {
  CheckSquareIcon,
  ClockIcon,
  CalendarIcon,
  AlertCircleIcon,
  SearchIcon,
  PlusIcon,
  MessageSquareIcon,
  LayersIcon,
  ListIcon,
  BugIcon,
  CodeIcon,
  TrendingUpIcon,
  FileTextIcon,
  MoreHorizontalIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  BarChartIcon,
  DoubleArrowUpIcon,
  PlayIcon,
  CheckCircleIcon,
  FolderIcon,
  CircleDotIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ActivityIcon,
  SproutIcon,
  CloseIcon,
  ArrowRightIcon,
  TrashIcon,
} from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { ProjectAvatar } from '../../components/ui/ProjectAvatar';
import { CustomSelect } from '../../components/ui/CustomSelect';


export const MyWorkPage: React.FC = () => {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<MyWorkResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<WorkItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [activeTab, setActiveTab] = useState<'my-work' | 'created-work' | 'overdue' | 'due-soon' | 'completed' | 'all'>('my-work');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedSort, setSelectedSort] = useState<'recentlyCreated' | 'recentlyUpdated' | 'dueDate' | 'priority'>('recentlyCreated');
  const [currentPage, setCurrentPage] = useState(1);

  // Calendar widget month navigation
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [showMotivationBanner, setShowMotivationBanner] = useState(true);

  // Modals
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [selectedWorkItemProject, setSelectedWorkItemProject] = useState<Project | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createTargetProject, setCreateTargetProject] = useState<Project | null>(null);

  // Load accessible projects for filter dropdown
  useEffect(() => {
    projectsApi.getUserProjects().then((res) => {
      if (res.success && res.data) {
        setProjects(res.data.all);
      }
    });
  }, []);

  const loadWork = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await myWorkApi.getMyWork({
        tab: activeTab,
        search: searchQuery.trim() || undefined,
        projectId: selectedProjectId || undefined,
        status: selectedStatus || undefined,
        priority: selectedPriority || undefined,
        type: selectedType || undefined,
        sort: selectedSort,
        page: currentPage,
        limit: 10,
      });

      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load work items');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, selectedProjectId, selectedStatus, selectedPriority, selectedType, selectedSort, currentPage]);

  useEffect(() => {
    loadWork();
  }, [loadWork]);

  const handleOpenItem = (item: WorkItem) => {
    const proj = projects.find((p) => p.id === item.projectId) || ({
      id: item.projectId,
      name: item.project?.name || 'Project',
      key: item.project?.key || null,
      createdById: '',
    } as any);

    setSelectedWorkItemProject(proj);
    setSelectedWorkItemId(item.id);
  };

  const handleOpenCreateModal = () => {
    if (projects.length === 0) {
      alert('You need at least one project to create a work item.');
      return;
    }
    setCreateTargetProject(projects[0]);
    setCreateModalOpen(true);
  };

  const handleDeleteItemClick = (item: WorkItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToDelete(item);
  };

  const handleConfirmDelete = async (item: WorkItem) => {
    setIsDeleting(true);
    try {
      await workApi.deleteWorkItem(item.projectId, item.id);
      setItemToDelete(null);
      await loadWork();
    } catch (err: any) {
      alert(err.message || 'Failed to delete work item');
    } finally {
      setIsDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedProjectId('');
    setSelectedStatus('');
    setSelectedPriority('');
    setSelectedType('');
    setSelectedSort('recentlyCreated');
    setCurrentPage(1);
  };

  const isFilteringActive =
    searchQuery !== '' ||
    selectedProjectId !== '' ||
    selectedStatus !== '' ||
    selectedPriority !== '' ||
    selectedType !== '' ||
    selectedSort !== 'recentlyCreated';

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Calendar calculations
  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const calendarMonthName = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const daysInMonth = useMemo(() => {
    return new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();
  }, [calendarYear, calendarMonthIndex]);

  const firstDayOffset = useMemo(() => {
    return new Date(calendarYear, calendarMonthIndex, 1).getDay(); // 0 = Sun
  }, [calendarYear, calendarMonthIndex]);

  // Find which dates in the current displayed month have deadlines
  const deadlineDatesSet = useMemo(() => {
    const set = new Set<number>();
    if (!data?.workItems) return set;
    data.workItems.forEach((item) => {
      if (item.dueDate) {
        const d = new Date(item.dueDate);
        if (d.getFullYear() === calendarYear && d.getMonth() === calendarMonthIndex) {
          set.add(d.getDate());
        }
      }
    });
    return set;
  }, [data?.workItems, calendarYear, calendarMonthIndex]);

  const today = new Date();
  const isCurrentMonthThisMonth = today.getFullYear() === calendarYear && today.getMonth() === calendarMonthIndex;
  const currentDayNum = today.getDate();

  const handlePrevMonth = () => {
    setCalendarMonth(new Date(calendarYear, calendarMonthIndex - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(calendarYear, calendarMonthIndex + 1, 1));
  };

  // Upcoming items for the widget
  const upcomingItems = useMemo(() => {
    if (!data?.workItems) return [];
    return data.workItems
      .filter((i) => {
        if (!i.dueDate || i.status === 'COMPLETED') return false;
        return true;
      })
      .slice(0, 4);
  }, [data?.workItems]);

  const renderWorkItemTypeBadge = (type: string) => {
    const t = (type || 'TASK').toUpperCase();
    switch (t) {
      case 'BUG':
        return <span className="po-type-badge bug">BUG</span>;
      case 'IMPROVEMENT':
        return <span className="po-type-badge improvement">IMPROVEMENT</span>;
      case 'FEATURE':
        return <span className="po-type-badge feature">FEATURE</span>;
      default:
        return <span className="po-type-badge task">TASK</span>;
    }
  };

  const renderWorkItemStatusBadge = (status: string) => {
    const s = (status || 'TODO').toUpperCase();
    switch (s) {
      case 'BLOCKED':
        return (
          <span className="mywork-status-pill status-blocked">
            <span className="mywork-status-dot dot-blocked" />
            <span>Blocked</span>
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="mywork-status-pill status-in-progress">
            <span className="mywork-status-dot dot-in-progress" />
            <span>In Progress</span>
          </span>
        );
      case 'COMPLETED':
      case 'DONE':
        return (
          <span className="mywork-status-pill status-completed">
            <span className="mywork-status-dot dot-completed" />
            <span>Completed</span>
          </span>
        );
      default:
        return (
          <span className="mywork-status-pill status-todo">
            <span className="mywork-status-dot dot-todo" />
            <span>To Do</span>
          </span>
        );
    }
  };

  const renderPriorityBadge = (priority?: string) => {
    const p = (priority || '').toUpperCase();
    switch (p) {
      case 'URGENT':
        return (
          <span className="mywork-priority-badge urgent" title="Priority: Urgent">
            <DoubleArrowUpIcon size={12} />
            <span>Urgent</span>
          </span>
        );
      case 'HIGH':
        return (
          <span className="mywork-priority-badge high" title="Priority: High">
            <ArrowUpIcon size={12} />
            <span>High</span>
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="mywork-priority-badge medium" title="Priority: Medium">
            <span className="mywork-prio-equal">=</span>
            <span>Medium</span>
          </span>
        );
      case 'LOW':
        return (
          <span className="mywork-priority-badge low" title="Priority: Low">
            <ArrowDownIcon size={12} />
            <span>Low</span>
          </span>
        );
      default:
        return <span className="text-muted-dash">—</span>;
    }
  };

  return (
    <div className="mywork-page-container">
      {/* Header with Landscape Atmosphere Artwork */}
      <div className="mywork-header">
        <div className="mywork-header-left">
          <div className="mywork-title-row">
            <span className="mywork-title-icon-box">
              <CheckSquareIcon size={22} />
            </span>
            <h1>My Work</h1>
            <span className="mywork-date-badge">{todayFormatted}</span>
          </div>
          <p className="mywork-subtitle">
            {activeTab === 'created-work'
              ? 'All tasks, bugs, features, and work items created by you across your projects.'
              : activeTab === 'all'
              ? 'All tasks, bugs, and features across projects you have access to.'
              : 'All tasks, bugs, features, and deadlines assigned to you across your projects.'}
          </p>
        </div>

        {/* Center/Atmosphere artwork */}
        <div className="mywork-header-art-wrap">
          <span className="mywork-quote-text">Smaller steps bigger progress.</span>
          <div className="mywork-header-illustration">
            <svg viewBox="0 0 160 55" fill="none" xmlns="http://www.w3.org/2000/svg" className="header-landscape-svg">
              <circle cx="120" cy="18" r="8" fill="#FDE047" opacity="0.9" />
              <path d="M135 14 C135 11 140 11 143 13 C145 11 150 12 150 15 C153 15 155 18 153 20 C151 22 135 22 135 20 Z" fill="#E2E8F0" opacity="0.8" />
              {/* Back mountain */}
              <polygon points="100,55 130,22 160,55" fill="#CBD5E1" opacity="0.6" />
              {/* Mid mountain */}
              <polygon points="65,55 105,14 145,55" fill="#94A3B8" opacity="0.5" />
              {/* Left front mountain */}
              <polygon points="40,55 75,25 110,55" fill="#A7F3D0" opacity="0.75" />
              {/* Pine trees */}
              <polygon points="126,55 130,42 134,55" fill="#10B981" />
              <polygon points="132,55 136,38 140,55" fill="#059669" />
              <polygon points="62,55 65,45 68,55" fill="#34D399" />
            </svg>
          </div>
        </div>

        <div className="mywork-header-right">
          <button
            type="button"
            className="mywork-create-btn"
            onClick={handleOpenCreateModal}
          >
            <PlusIcon size={16} />
            <span>Create Work Item</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="form-error-banner" style={{ marginBottom: '1rem' }}>
          <AlertCircleIcon size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="mywork-summary-grid">
        {/* Total Assigned */}
        <div className="mywork-summary-card card-total">
          <div className="summary-card-top">
            <div className="summary-icon-pill icon-total">
              <LayersIcon size={16} />
            </div>
            <span className="summary-label">Assigned to You</span>
          </div>
          <div className="summary-card-bottom">
            <div className="summary-value">{data?.summary.total || 0}</div>
            <div className="summary-sub">Across all projects</div>
          </div>
        </div>

        {/* Created by You */}
        <div className="mywork-summary-card card-created">
          <div className="summary-card-top">
            <div className="summary-icon-pill icon-created">
              <FileTextIcon size={16} />
            </div>
            <span className="summary-label">Created by You</span>
          </div>
          <div className="summary-card-bottom">
            <div className="summary-value text-purple">{data?.summary.createdTotal || 0}</div>
            <div className="summary-sub">Authored items</div>
          </div>
        </div>

        {/* In Progress */}
        <div className="mywork-summary-card card-in-progress">
          <div className="summary-card-top">
            <div className="summary-icon-pill icon-in-progress">
              <ActivityIcon size={16} />
            </div>
            <span className="summary-label">In Progress</span>
          </div>
          <div className="summary-card-bottom">
            <div className="summary-value text-accent">{data?.summary.inProgress || 0}</div>
            <div className="summary-sub">Active work items</div>
          </div>
        </div>

        {/* Due Soon */}
        <div className="mywork-summary-card card-due-soon">
          <div className="summary-card-top">
            <div className="summary-icon-pill icon-due-soon">
              <CalendarIcon size={16} />
            </div>
            <span className="summary-label">Due Soon</span>
          </div>
          <div className="summary-card-bottom">
            <div className="summary-value text-amber">{data?.summary.dueSoon || 0}</div>
            <div className="summary-sub">Due in next 7 days</div>
          </div>
        </div>

        {/* Overdue */}
        <div className="mywork-summary-card card-overdue">
          <div className="summary-card-top">
            <div className="summary-icon-pill icon-overdue">
              <AlertCircleIcon size={16} />
            </div>
            <span className="summary-label">Overdue</span>
          </div>
          <div className="summary-card-bottom">
            <div className={`summary-value ${data && data.summary.overdue > 0 ? 'text-danger' : 'text-danger-neutral'}`}>
              {data?.summary.overdue || 0}
            </div>
            <div className="summary-sub">Requires attention</div>
          </div>
        </div>

        {/* Completed */}
        <div className="mywork-summary-card card-completed">
          <div className="summary-card-top">
            <div className="summary-icon-pill icon-completed">
              <CheckCircleIcon size={16} />
            </div>
            <span className="summary-label">Completed</span>
          </div>
          <div className="summary-card-bottom">
            <div className="summary-value text-success">{data?.summary.completed || 0}</div>
            <div className="summary-sub">Finished items</div>
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="mywork-tabs-bar">
        <button
          type="button"
          className={`mywork-tab ${activeTab === 'my-work' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('my-work');
            setCurrentPage(1);
          }}
        >
          My Work ({data?.summary.total || 0})
        </button>
        <button
          type="button"
          className={`mywork-tab ${activeTab === 'created-work' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('created-work');
            setCurrentPage(1);
          }}
        >
          Created Work ({data?.summary.createdTotal || 0})
        </button>
        <button
          type="button"
          className={`mywork-tab ${activeTab === 'overdue' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('overdue');
            setCurrentPage(1);
          }}
        >
          Overdue ({data?.summary.overdue || 0})
        </button>
        <button
          type="button"
          className={`mywork-tab ${activeTab === 'due-soon' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('due-soon');
            setCurrentPage(1);
          }}
        >
          Due Soon ({data?.summary.dueSoon || 0})
        </button>
        <button
          type="button"
          className={`mywork-tab ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('completed');
            setCurrentPage(1);
          }}
        >
          Completed ({data?.summary.completed || 0})
        </button>
        <button
          type="button"
          className={`mywork-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('all');
            setCurrentPage(1);
          }}
        >
          All Workspace Items
        </button>
      </div>


      {/* 2-Column Layout */}
      <div className="mywork-main-grid">
        {/* Left Pane: Filter Toolbar & Work Items Table */}
        <div className="mywork-left-pane">
          {/* Filters Toolbar */}
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
                    value: 'BLOCKED',
                    label: 'Blocked',
                    icon: <AlertCircleIcon size={14} />,
                    iconBg: '#FEE2E2',
                    iconColor: '#DC2626',
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
                fullWidth={false}
                options={[
                  { value: 'recentlyCreated', label: 'Newest First' },
                  { value: 'recentlyUpdated', label: 'Recently Updated' },
                  { value: 'dueDate', label: 'Due Date' },
                  { value: 'priority', label: 'Priority' },
                ]}
              />

              {isFilteringActive && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          {/* Work Items Table */}
          {loading ? (
            <div className="workspace-loading-state">
              <div className="btn-spinner" />
              <p>Loading work items...</p>
            </div>
          ) : !data || data.workItems.length === 0 ? (
            <div className="mywork-empty-state">
              <CheckSquareIcon size={36} />
              <h3>No work items found</h3>
              <p>
                {activeTab === 'created-work'
                  ? "You haven't created any work items yet."
                  : activeTab === 'overdue'
                  ? 'Great job! You have no overdue tasks.'
                  : activeTab === 'due-soon'
                  ? 'No tasks due in the next 7 days.'
                  : activeTab === 'completed'
                  ? 'No completed tasks found.'
                  : 'No work items match your current filters.'}
              </p>
              {isFilteringActive && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="mywork-table-wrap">
              <table className="mywork-table">
                <thead>
                  <tr>
                    <th>Work Item</th>
                    <th>Project</th>
                    <th>Assignee</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Due Date</th>
                    <th>Comments</th>
                    <th style={{ width: '44px', textAlign: 'right' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {data.workItems.map((item) => {
                    const isOverdue =
                      item.dueDate &&
                      item.status !== 'COMPLETED' &&
                      new Date(item.dueDate) < new Date();

                    return (
                      <tr
                        key={item.id}
                        className="mywork-table-row"
                        onClick={() => handleOpenItem(item)}
                      >
                        {/* Title & Type */}
                        <td>
                          <div className="mywork-title-cell">
                            {renderWorkItemTypeBadge(item.type)}
                            <span className="mywork-item-title" title={item.title}>
                              {item.title}
                            </span>
                          </div>
                        </td>

                        {/* Project Pill */}
                        <td>
                          <div className="mywork-project-cell">
                            <ProjectAvatar project={item.project} size="xs" />
                            <span className="mywork-project-name">
                              {item.project?.name || 'Project'}
                            </span>
                          </div>
                        </td>

                        {/* Assignee */}
                        <td>
                          <div className="mywork-assignee-cell">
                            {item.assignedTo ? (
                              <div className="mywork-user-pill" title={`Assigned to ${item.assignedTo.fullName || item.assignedTo.username}`}>
                                {item.assignedTo.avatarUrl ? (
                                  <img src={item.assignedTo.avatarUrl} alt="" className="mywork-user-avatar" />
                                ) : (
                                  <span className="mywork-user-avatar-initials">
                                    {(item.assignedTo.fullName || item.assignedTo.username || 'U')[0].toUpperCase()}
                                  </span>
                                )}
                                <span className="mywork-user-name">
                                  {item.assignedTo.fullName || item.assignedTo.username}
                                </span>
                              </div>
                            ) : (
                              <span className="mywork-unassigned-tag">Unassigned</span>
                            )}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td>
                          {renderWorkItemStatusBadge(item.status)}
                        </td>

                        {/* Priority */}
                        <td>
                          {renderPriorityBadge(item.priority)}
                        </td>

                        {/* Due Date */}
                        <td>
                          {item.dueDate ? (
                            <span className={`mywork-due-tag ${isOverdue ? 'overdue' : 'normal'}`}>
                              <CalendarIcon size={12} />
                              <span>
                                {new Date(item.dueDate).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-dash">—</span>
                          )}
                        </td>

                        {/* Comments */}
                        <td>
                          <span className={`mywork-comment-count ${(item._count?.comments || 0) > 0 ? 'has-comments' : ''}`}>
                            <MessageSquareIcon size={13} />
                            <span>{item._count?.comments || 0}</span>
                          </span>
                        </td>

                        {/* Row Action Button */}
                        <td>
                          <div className="mywork-row-action">
                            {(activeTab === 'created-work' || item.createdById === user?.id) && (
                              <button
                                type="button"
                                className="mywork-row-delete-btn"
                                onClick={(e) => handleDeleteItemClick(item, e)}
                                title="Delete work item"
                              >
                                <TrashIcon size={14} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="mywork-row-more-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenItem(item);
                              }}
                              title="View details"
                            >
                              <MoreHorizontalIcon size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Server Pagination */}
              {data.pagination.totalPages > 1 && (
                <div className="mywork-pagination-bar">
                  <span className="pagination-info">
                    Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} items)
                  </span>
                  <div className="pagination-buttons">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= data.pagination.totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Motivation Banner (Keep Going) */}
          {showMotivationBanner && (
            <div className="mywork-motivation-banner">
              <div className="motivation-left">
                <div className="motivation-sprout-badge">
                  <SproutIcon size={20} />
                </div>
                <div className="motivation-text-col">
                  <h4>Keep going!</h4>
                  <p>Stay focused and make progress, one task at a time.</p>
                </div>
              </div>

              <div className="motivation-art-col">
                <svg viewBox="0 0 200 65" fill="none" xmlns="http://www.w3.org/2000/svg" className="motivation-landscape-svg">
                  <circle cx="165" cy="22" r="10" fill="#FED7AA" opacity="0.9" />
                  <path d="M125 15 C125 12 130 11 133 13 C136 10 142 11 143 14 C146 14 148 17 146 19 C144 21 125 21 125 19 Z" fill="#DBEAFE" opacity="0.8" />
                  <path d="M175 26 C175 23 180 23 183 25 C185 23 190 24 191 27 C193 27 195 29 193 31 C191 33 175 33 175 31 Z" fill="#DBEAFE" opacity="0.75" />
                  {/* Back mountains */}
                  <polygon points="140,65 170,28 200,65" fill="#BFDBFE" opacity="0.65" />
                  <polygon points="105,65 145,18 185,65" fill="#93C5FD" opacity="0.6" />
                  {/* Front mountain */}
                  <polygon points="65,65 110,24 155,65" fill="#A7F3D0" opacity="0.7" />
                  {/* Trees */}
                  <polygon points="98,65 102,52 106,65" fill="#10B981" />
                  <polygon points="105,65 109,46 113,65" fill="#059669" />
                  <polygon points="45,65 48,54 51,65" fill="#34D399" />
                  <polygon points="50,65 54,48 58,65" fill="#059669" />
                </svg>

                <button
                  type="button"
                  className="motivation-dismiss-btn"
                  onClick={() => setShowMotivationBanner(false)}
                  aria-label="Dismiss banner"
                >
                  <CloseIcon size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Pane: Deadlines Overview Mini-Calendar Widget */}
        <div className="mywork-right-pane">
          <div className="deadline-overview-widget">
            {/* Header */}
            <div className="deadline-widget-header">
              <div className="deadline-widget-title-group">
                <span className="deadline-header-icon-box">
                  <CalendarIcon size={18} />
                </span>
                <h3>Deadlines Overview</h3>
              </div>
              <button
                type="button"
                className="deadline-view-calendar-btn"
                onClick={() => navigate('/app/calendar')}
              >
                <span>View Calendar</span>
                <ArrowRightIcon size={14} />
              </button>
            </div>

            {/* Interactive Mini Calendar */}
            <div className="mini-calendar-box">
              {/* Month Header Navigation */}
              <div className="mini-calendar-month-row">
                <button
                  type="button"
                  className="mini-calendar-nav-btn"
                  onClick={handlePrevMonth}
                  aria-label="Previous Month"
                >
                  <ChevronLeftIcon size={14} />
                </button>
                <span className="mini-calendar-month-label">{calendarMonthName}</span>
                <button
                  type="button"
                  className="mini-calendar-nav-btn"
                  onClick={handleNextMonth}
                  aria-label="Next Month"
                >
                  <ChevronRightIcon size={14} />
                </button>
              </div>

              {/* Weekday Names */}
              <div className="mini-calendar-weekdays">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              {/* Days Matrix */}
              <div className="mini-calendar-days-grid">
                {Array.from({ length: firstDayOffset }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="mini-day-cell empty" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const isToday = isCurrentMonthThisMonth && dayNum === currentDayNum;
                  const hasDeadline = deadlineDatesSet.has(dayNum);

                  return (
                    <div
                      key={`day-${dayNum}`}
                      className={`mini-day-cell ${isToday ? 'is-today' : ''} ${hasDeadline ? 'has-deadline' : ''}`}
                    >
                      <span className="mini-day-num">{dayNum}</span>
                      {hasDeadline && <span className="mini-day-dot" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upcoming This Week List */}
            <div className="deadline-upcoming-section">
              <div className="deadline-upcoming-header">
                <ClockIcon size={14} />
                <span>Upcoming This Week ({upcomingItems.length})</span>
              </div>

              <div className="deadline-upcoming-list">
                {upcomingItems.length === 0 ? (
                  <div className="deadline-upcoming-empty">No upcoming deadlines this week</div>
                ) : (
                  upcomingItems.map((item) => (
                    <div
                      key={item.id}
                      className="deadline-upcoming-row"
                      onClick={() => handleOpenItem(item)}
                    >
                      <div className="upcoming-row-left">
                        <span className="upcoming-dot" />
                        <span className="upcoming-title">{item.title}</span>
                      </div>
                      <span className="upcoming-date">
                        {item.dueDate
                          ? new Date(item.dueDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="deadline-view-all-row">
                <button
                  type="button"
                  className="deadline-view-all-btn"
                  onClick={() => {
                    setActiveTab('due-soon');
                    setCurrentPage(1);
                  }}
                >
                  <span>View all</span>
                  <ArrowRightIcon size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedWorkItemProject && (
        <WorkItemDetailsModal
          project={selectedWorkItemProject}
          workItemId={selectedWorkItemId}
          onClose={() => {
            setSelectedWorkItemId(null);
            setSelectedWorkItemProject(null);
          }}
          onUpdated={() => loadWork()}
          onDeleted={() => {
            setSelectedWorkItemId(null);
            setSelectedWorkItemProject(null);
            loadWork();
          }}
        />
      )}

      {createModalOpen && (
        <CreateWorkItemModal
          project={createTargetProject}
          projects={projects}
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreated={() => loadWork()}
        />
      )}

      {itemToDelete && (
        <DeleteWorkItemModal
          isOpen={!!itemToDelete}
          workItem={itemToDelete}
          onClose={() => setItemToDelete(null)}
          onConfirmDelete={handleConfirmDelete}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};
