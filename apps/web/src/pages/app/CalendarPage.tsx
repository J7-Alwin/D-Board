import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from '../../router/Router';
import { useAuth } from '../../context/AuthContext';
import { calendarApi, type CalendarItem } from '../../api/calendar.api';
import { projectsApi, type Project } from '../../api/projects.api';
import { ProjectWorkspaceHeader } from '../../components/workspace/ProjectWorkspaceHeader';
import { WorkItemDetailsModal } from '../../components/workspace/WorkItemDetailsModal';
import { CalendarEventModal } from '../../components/calendar/CalendarEventModal';
import { GoogleCalendarSyncModal } from '../../components/calendar/GoogleCalendarSyncModal';
import { CalendarHeaderAtmosphere } from '../../components/common/HeaderAtmosphereArt';
import {
  CalendarIcon,
  GoogleIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  PlusIcon,
  AlertCircleIcon,
  CheckIcon,
  SearchIcon,
  ArrowRightIcon,
  FolderIcon,
  TagIcon,
  CircleDotIcon,
  FlagIcon,
  SettingsIcon,
  ChevronDownIcon,
  ClockIcon,
  PlayIcon,
  CheckCircleIcon,
  ListIcon,
} from '../../components/ui/Icons';
import { CustomSelect } from '../../components/ui/CustomSelect';

export interface CalendarPageProps {
  projectId?: string;
  project?: Project | null;
  hideHeader?: boolean;
}

export const toLocalDateString = (d: Date | string | number): string => {
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const CalendarPage: React.FC<CalendarPageProps> = ({
  projectId: propProjectId,
  project: propProject,
  hideHeader = false,
}) => {
  const { path, navigate } = useRouter();
  const { user } = useAuth();

  const routeProjectIdMatch = path.match(/^\/app\/projects\/([^/]+)\/calendar/);
  const activeProjectId = propProjectId || (routeProjectIdMatch ? routeProjectIdMatch[1] : null);

  // Data States
  const [project, setProject] = useState<Project | null>(propProject || null);
  const [accessibleProjects, setAccessibleProjects] = useState<Project[]>([]);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Date States: default to current live date
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');

  // Month Picker Dropdown State
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const monthPickerRef = useRef<HTMLDivElement>(null);

  // Mini calendar month navigation state
  const [miniCalendarDate, setMiniCalendarDate] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  // Close month picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setMonthPickerOpen(false);
      }
    };
    if (monthPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [monthPickerOpen]);

  // Filter States
  const [selectedGlobalProject, setSelectedGlobalProject] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [selectedEventToEdit, setSelectedEventToEdit] = useState<CalendarItem | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<Date | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [selectedWorkItemProject, setSelectedWorkItemProject] = useState<Project | null>(null);

  // Load project or accessible projects
  useEffect(() => {
    if (activeProjectId) {
      projectsApi
        .getProjectById(activeProjectId)
        .then((res) => {
          if (res.success && res.data) {
            setProject(res.data.project);
          }
        })
        .catch(() => {});
    } else {
      projectsApi
        .getUserProjects()
        .then((res) => {
          if (res.success && res.data) {
            const all = [...(res.data.owned || []), ...(res.data.joined || [])];
            setAccessibleProjects(all);
          }
        })
        .catch(() => {});
    }
  }, [activeProjectId]);

  // Compute month window starting on SUNDAY (42 cells: 6 rows x 7 days)
  const dateRange = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const dayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon, ...
    const startPaddingDays = dayOfWeek; // 0 if Sunday, 1 if Monday, etc.
    const start = new Date(year, month, 1 - startPaddingDays, 0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 42);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, [currentDate]);

  // Load Calendar Items from API
  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const targetProj = activeProjectId || selectedGlobalProject || undefined;
      const res = await calendarApi.getCalendarItems({
        projectId: targetProj,
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        search: searchQuery.trim() || undefined,
      });

      if (res.success && res.data) {
        setItems(res.data.items);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load calendar events' });
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, selectedGlobalProject, dateRange, searchQuery]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  // Filter items based on client-side controls (Type, Status)
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedType && item.type !== selectedType) return false;
      if (selectedStatus && item.workItem?.status !== selectedStatus) return false;
      return true;
    });
  }, [items, selectedType, selectedStatus]);

  // Date Navigation Handlers
  const handlePrevMonth = () => {
    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setCurrentDate(nextDate);
    setMiniCalendarDate(nextDate);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(nextDate);
    setMiniCalendarDate(nextDate);
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
    setMiniCalendarDate(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  // Mini Calendar Navigation
  const handlePrevMiniMonth = () => {
    setMiniCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMiniMonth = () => {
    setMiniCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Open Event Modal
  const handleOpenCreateEvent = (date?: Date) => {
    setSelectedEventToEdit(null);
    setModalInitialDate(date || selectedDate || new Date());
    setEventModalOpen(true);
  };

  const handleOpenEditEvent = (item: CalendarItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (item.kind === 'WORK_ITEM') {
      setSelectedWorkItemId(item.workItem?.id || item.id.replace('work_', ''));
      if (item.project) {
        setSelectedWorkItemProject(item.project as any);
      } else if (project) {
        setSelectedWorkItemProject(project);
      }
    } else {
      setSelectedEventToEdit(item);
      setEventModalOpen(true);
    }
  };

  // Group filtered items by local date string (YYYY-MM-DD)
  const itemsByDateMap = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    filteredItems.forEach((item) => {
      const dateKey = toLocalDateString(item.startAt);
      const arr = map.get(dateKey) || [];
      arr.push(item);
      map.set(dateKey, arr);
    });
    return map;
  }, [filteredItems]);

  // Color Coding helper matching the reference image cards
  const getEventStyle = (item: CalendarItem) => {
    const titleLower = item.title.toLowerCase();
    const type = item.type;

    if (type === 'DEADLINE' || titleLower.includes('bug') || titleLower.includes('fix') || titleLower.includes('urgent') || titleLower.includes('uguikj')) {
      return {
        dotColor: '#EF4444', // Red
        className: 'event-theme-red',
      };
    }
    if (type === 'MEETING' || titleLower.includes('meeting') || titleLower.includes('standup') || titleLower.includes('team')) {
      return {
        dotColor: '#3B82F6', // Blue
        className: 'event-theme-blue',
      };
    }
    if (type === 'RELEASE' || titleLower.includes('review') || titleLower.includes('ui review') || titleLower.includes('deploy')) {
      return {
        dotColor: '#10B981', // Green
        className: 'event-theme-green',
      };
    }
    if (type === 'MILESTONE' || titleLower.includes('sprint') || titleLower.includes('planning') || titleLower.includes('roadmap')) {
      return {
        dotColor: '#8B5CF6', // Purple
        className: 'event-theme-purple',
      };
    }
    // Amber / orange fallback
    return {
      dotColor: '#F97316', // Orange
      className: 'event-theme-orange',
    };
  };

  // Generate 42 calendar grid cells (6 rows x 7 days) starting on SUNDAY
  const gridCells = useMemo(() => {
    const cells: Array<{
      date: Date;
      dateKey: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      items: CalendarItem[];
    }> = [];

    const todayKey = toLocalDateString(new Date());
    const selectedKey = selectedDate ? toLocalDateString(selectedDate) : '';
    const targetMonth = currentDate.getMonth();

    const curr = new Date(dateRange.start);
    for (let i = 0; i < 42; i++) {
      const dateKey = toLocalDateString(curr);
      cells.push({
        date: new Date(curr),
        dateKey,
        dayNumber: curr.getDate(),
        isCurrentMonth: curr.getMonth() === targetMonth,
        isToday: dateKey === todayKey,
        isSelected: dateKey === selectedKey,
        items: itemsByDateMap.get(dateKey) || [],
      });
      curr.setDate(curr.getDate() + 1);
    }

    return cells;
  }, [currentDate, dateRange, itemsByDateMap, selectedDate]);

  // Mini Calendar grid cells (starts on SUNDAY)
  const miniGridCells = useMemo(() => {
    const year = miniCalendarDate.getFullYear();
    const month = miniCalendarDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const dayOfWeek = firstDay.getDay(); // 0 = Sun
    const startPaddingDays = dayOfWeek;
    const start = new Date(year, month, 1 - startPaddingDays, 0, 0, 0, 0);

    const cells: Array<{
      date: Date;
      dateKey: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    const todayKey = toLocalDateString(new Date());
    const selectedKey = selectedDate ? toLocalDateString(selectedDate) : '';
    const curr = new Date(start);

    for (let i = 0; i < 35; i++) {
      const dateKey = toLocalDateString(curr);
      cells.push({
        date: new Date(curr),
        dateKey,
        dayNumber: curr.getDate(),
        isCurrentMonth: curr.getMonth() === month,
        isToday: dateKey === todayKey,
        isSelected: dateKey === selectedKey,
      });
      curr.setDate(curr.getDate() + 1);
    }

    return cells;
  }, [miniCalendarDate, selectedDate]);

  // Sorted upcoming events list for the right sidebar
  const upcomingEvents = useMemo(() => {
    const list = [...filteredItems].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
    return list.slice(0, 6);
  }, [filteredItems]);

  const monthYearLabel = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const miniMonthYearLabel = miniCalendarDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="cal-experience-root">
      {/* Workspace Header if inside specific Project context */}
      {!hideHeader && project && (
        <ProjectWorkspaceHeader
          project={project}
          currentTab="calendar"
          onOpenCreateWorkModal={() => navigate(`/app/projects/${project.id}/board`)}
        />
      )}

      {/* Main Top Header with Atmosphere Quote */}
      <div className="cal-page-header">
        <div className="cal-header-left">
          <div className="cal-title-row">
            <span className="cal-header-icon-box">
              <CalendarIcon size={24} />
            </span>
            <h1 className="cal-header-title">Calendar</h1>
          </div>
          <p className="cal-header-subtitle">
            Keep track of your project milestones, deadlines and events.
          </p>
        </div>

        {/* Atmosphere Quote & Illustration */}
        <CalendarHeaderAtmosphere />

        {/* Right Header Action Button */}
        <div className="cal-header-right">
          <button
            type="button"
            className="cal-btn-new-event"
            onClick={() => handleOpenCreateEvent()}
          >
            <PlusIcon size={16} />
            <span>New Event</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`form-feedback-banner ${
            feedback.type === 'success' ? 'feedback-success' : 'feedback-error'
          }`}
          style={{ marginBottom: '1rem' }}
        >
          {feedback.type === 'success' ? <CheckIcon size={16} /> : <AlertCircleIcon size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 2-Column Main Layout Grid */}
      <div className="cal-main-grid">
        {/* LEFT COLUMN: Main Calendar Card */}
        <div className="cal-card-primary">
          {/* Controls Row 1: Month Nav & Segmented View Mode Tabs */}
          <div className="cal-controls-top-row">
            <div className="cal-nav-left-group">
              <div className="cal-nav-arrows-pill">
                <button
                  type="button"
                  className="cal-nav-btn"
                  onClick={handlePrevMonth}
                  aria-label="Previous month"
                >
                  <ChevronLeftIcon size={16} />
                </button>
                <button
                  type="button"
                  className="cal-nav-btn"
                  onClick={handleNextMonth}
                  aria-label="Next month"
                >
                  <ChevronRightIcon size={16} />
                </button>
              </div>

              <button
                type="button"
                className="cal-btn-today"
                onClick={handleToday}
              >
                Today
              </button>

              <div className="cal-month-picker-wrapper" ref={monthPickerRef}>
                <button
                  type="button"
                  className="cal-month-title-btn"
                  onClick={() => setMonthPickerOpen((prev) => !prev)}
                  aria-expanded={monthPickerOpen}
                  aria-label="Select month and year"
                >
                  <h2>{monthYearLabel}</h2>
                  <ChevronDownIcon size={16} className={`cal-title-chevron ${monthPickerOpen ? 'open' : ''}`} />
                </button>

                {monthPickerOpen && (
                  <div className="cal-month-picker-dropdown">
                    <div className="month-picker-year-row">
                      <button
                        type="button"
                        onClick={() => {
                          const newD = new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1);
                          setCurrentDate(newD);
                          setMiniCalendarDate(newD);
                        }}
                        className="month-picker-year-btn"
                        aria-label="Previous year"
                      >
                        <ChevronLeftIcon size={14} />
                      </button>
                      <span className="month-picker-year-label">{currentDate.getFullYear()}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newD = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1);
                          setCurrentDate(newD);
                          setMiniCalendarDate(newD);
                        }}
                        className="month-picker-year-btn"
                        aria-label="Next year"
                      >
                        <ChevronRightIcon size={14} />
                      </button>
                    </div>
                    <div className="month-picker-grid">
                      {[
                        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
                      ].map((mName, mIdx) => {
                        const isSelectedMonth = currentDate.getMonth() === mIdx;
                        return (
                          <button
                            key={mName}
                            type="button"
                            className={`month-picker-cell ${isSelectedMonth ? 'active' : ''}`}
                            onClick={() => {
                              const newD = new Date(currentDate.getFullYear(), mIdx, 1);
                              setCurrentDate(newD);
                              setMiniCalendarDate(newD);
                              setMonthPickerOpen(false);
                            }}
                          >
                            {mName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="cal-view-segmented-tabs" role="tablist">
              <button
                type="button"
                className={`cal-segment-tab ${viewMode === 'month' ? 'active' : ''}`}
                onClick={() => setViewMode('month')}
                role="tab"
                aria-selected={viewMode === 'month'}
              >
                Month
              </button>
              <button
                type="button"
                className={`cal-segment-tab ${viewMode === 'week' ? 'active' : ''}`}
                onClick={() => setViewMode('week')}
                role="tab"
                aria-selected={viewMode === 'week'}
              >
                Week
              </button>
              <button
                type="button"
                className={`cal-segment-tab ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                role="tab"
                aria-selected={viewMode === 'list'}
              >
                List
              </button>
            </div>
          </div>

          {/* Controls Row 2: Filter Toolbar */}
          <div className="cal-filters-toolbar">
            <div className="cal-filter-selects-group">
              {/* Projects Filter */}
              {!project && (
                <CustomSelect
                  value={selectedGlobalProject}
                  onChange={(val) => setSelectedGlobalProject(val)}
                  compact
                  fullWidth={false}
                  options={[
                    {
                      value: '',
                      label: 'All Projects',
                      icon: <FolderIcon size={14} />,
                      iconBg: '#F3F4F6',
                      iconColor: '#374151',
                    },
                    ...accessibleProjects.map((p) => ({
                      value: p.id,
                      label: p.name,
                      avatarUrl: p.avatarUrl,
                      initials: !p.avatarUrl ? p.name.trim()[0].toUpperCase() : undefined,
                      icon: !p.avatarUrl ? <FolderIcon size={14} /> : undefined,
                      iconBg: '#F3F4F6',
                      iconColor: '#374151',
                    })),
                  ]}
                />
              )}

              {/* Types Filter */}
              <CustomSelect
                value={selectedType}
                onChange={(val) => setSelectedType(val)}
                compact
                fullWidth={false}
                options={[
                  { value: '', label: 'All Types', icon: <TagIcon size={14} />, iconBg: '#F3F4F6', iconColor: '#374151' },
                  { value: 'MEETING', label: 'Meeting', icon: <CalendarIcon size={14} />, iconBg: '#EFF6FF', iconColor: '#2563EB' },
                  { value: 'DEADLINE', label: 'Deadline', icon: <ClockIcon size={14} />, iconBg: '#FEE2E2', iconColor: '#DC2626' },
                  { value: 'MILESTONE', label: 'Milestone', icon: <FlagIcon size={14} />, iconBg: '#F3E8FF', iconColor: '#9333EA' },
                  { value: 'RELEASE', label: 'Release', icon: <CheckCircleIcon size={14} />, iconBg: '#DCFCE7', iconColor: '#16A34A' },
                  { value: 'TASK', label: 'Task', icon: <ListIcon size={14} />, iconBg: '#FEF3C7', iconColor: '#D97706' },
                  { value: 'OTHER', label: 'Other', icon: <CircleDotIcon size={14} />, iconBg: '#F3F4F6', iconColor: '#6B7280' },
                ]}
              />

              {/* Statuses Filter */}
              <CustomSelect
                value={selectedStatus}
                onChange={(val) => setSelectedStatus(val)}
                compact
                fullWidth={false}
                options={[
                  { value: '', label: 'All Statuses', icon: <CircleDotIcon size={14} />, iconBg: '#F3F4F6', iconColor: '#374151' },
                  { value: 'TODO', label: 'To Do', icon: <CircleDotIcon size={14} />, iconBg: '#F3F4F6', iconColor: '#374151' },
                  { value: 'IN_PROGRESS', label: 'In Progress', icon: <PlayIcon size={14} />, iconBg: '#DBEAFE', iconColor: '#2563EB' },
                  { value: 'BLOCKED', label: 'Blocked', icon: <AlertCircleIcon size={14} />, iconBg: '#FEE2E2', iconColor: '#DC2626' },
                  { value: 'IN_REVIEW', label: 'In Review', icon: <ClockIcon size={14} />, iconBg: '#FEF3C7', iconColor: '#D97706' },
                  { value: 'COMPLETED', label: 'Completed', icon: <CheckCircleIcon size={14} />, iconBg: '#DCFCE7', iconColor: '#16A34A' },
                ]}
              />
            </div>

            {/* Search events */}
            <div className="cal-search-box">
              <SearchIcon size={14} />
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="cal-search-input"
              />
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="workspace-loading-state" style={{ padding: '4rem 2rem' }}>
              <div className="btn-spinner" />
              <p style={{ marginTop: '0.75rem', color: '#64748B', fontSize: '0.875rem' }}>
                Loading calendar events...
              </p>
            </div>
          )}

          {/* VIEW 1: MONTH GRID (Starts on Sun) */}
          {!loading && viewMode === 'month' && (
            <div className="cal-month-table">
              {/* Day names header */}
              <div className="cal-days-header-row">
                <div className="cal-day-label">Sun</div>
                <div className="cal-day-label">Mon</div>
                <div className="cal-day-label">Tue</div>
                <div className="cal-day-label">Wed</div>
                <div className="cal-day-label">Thu</div>
                <div className="cal-day-label">Fri</div>
                <div className="cal-day-label">Sat</div>
              </div>

              {/* 7x6 Grid Cells */}
              <div className="cal-month-grid-body">
                {gridCells.map((cell) => {
                  const maxVisible = 2;
                  const visibleItems = cell.items.slice(0, maxVisible);
                  const overflowCount = cell.items.length - maxVisible;

                  return (
                    <div
                      key={cell.dateKey}
                      className={`cal-grid-cell ${
                        !cell.isCurrentMonth ? 'cell-muted' : ''
                      } ${cell.isSelected ? 'cell-selected' : ''}`}
                      onClick={() => {
                        setSelectedDate(cell.date);
                        handleOpenCreateEvent(cell.date);
                      }}
                    >
                      <div className="cal-cell-header">
                        <span
                          className={`cal-cell-day-num ${
                            !cell.isCurrentMonth ? 'cell-muted' : ''
                          } ${cell.isToday ? 'today-circle' : ''}`}
                        >
                          {cell.dayNumber}
                        </span>
                      </div>

                      <div className="cal-cell-events-list">
                        {visibleItems.map((item) => {
                          const theme = getEventStyle(item);
                          const startTimeStr = item.allDay
                            ? item.project?.name || 'All day'
                            : new Date(item.startAt).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              });

                          return (
                            <div
                              key={item.id}
                              className={`cal-event-card ${theme.className}`}
                              onClick={(e) => handleOpenEditEvent(item, e)}
                              title={`${item.title} (${item.project?.name || 'D-Board'})`}
                            >
                              <div className="event-top-line">
                                <span
                                  className="event-dot"
                                  style={{ backgroundColor: theme.dotColor }}
                                />
                                <span className="event-title">{item.title}</span>
                              </div>
                              <div className="event-subtext">
                                {item.allDay
                                  ? item.project?.name || 'All day'
                                  : startTimeStr}
                              </div>
                            </div>
                          );
                        })}

                        {overflowCount > 0 && (
                          <div
                            className="cal-chip-overflow"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(cell.date);
                              setViewMode('list');
                            }}
                          >
                            +{overflowCount} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 2: WEEK VIEW */}
          {!loading && viewMode === 'week' && (
            <div className="cal-week-view">
              <div className="cal-week-grid">
                {gridCells.slice(0, 7).map((_, idx) => {
                  const dayDate = new Date(selectedDate);
                  const currentDay = dayDate.getDay();
                  const distance = idx - currentDay;
                  dayDate.setDate(dayDate.getDate() + distance);
                  const dayKey = toLocalDateString(dayDate);
                  const dayItems = itemsByDateMap.get(dayKey) || [];

                  return (
                    <div key={idx} className="cal-week-day-col">
                      <div className="cal-week-day-head">
                        <span className="week-day-name">
                          {dayDate.toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                        <span className={`week-day-number ${dayKey === toLocalDateString(new Date()) ? 'today-circle' : ''}`}>
                          {dayDate.getDate()}
                        </span>
                      </div>
                      <div className="cal-week-events-stack">
                        {dayItems.length === 0 ? (
                          <div className="cal-week-empty-slot" onClick={() => handleOpenCreateEvent(dayDate)}>
                            +
                          </div>
                        ) : (
                          dayItems.map((item) => {
                            const theme = getEventStyle(item);
                            const startTime = item.allDay
                              ? 'All day'
                              : new Date(item.startAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                            return (
                              <div
                                key={item.id}
                                className={`cal-event-card ${theme.className}`}
                                onClick={(e) => handleOpenEditEvent(item, e)}
                              >
                                <div className="event-top-line">
                                  <span className="event-dot" style={{ backgroundColor: theme.dotColor }} />
                                  <span className="event-title">{item.title}</span>
                                </div>
                                <div className="event-subtext">
                                  {startTime}
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
          )}

          {/* VIEW 3: LIST / AGENDA VIEW */}
          {!loading && viewMode === 'list' && (
            <div className="cal-list-view">
              {filteredItems.length === 0 ? (
                <div className="cal-empty-state">
                  <CalendarIcon size={36} />
                  <h3>No upcoming events found</h3>
                  <p>Create project milestones, sprint reviews, or team deadlines to see them here.</p>
                  <button
                    type="button"
                    className="cal-btn-new-event"
                    onClick={() => handleOpenCreateEvent()}
                    style={{ marginTop: '0.5rem' }}
                  >
                    <PlusIcon size={15} />
                    <span>Create an Event</span>
                  </button>
                </div>
              ) : (
                <div className="cal-agenda-stack">
                  {filteredItems.map((item) => {
                    const theme = getEventStyle(item);
                    const itemDate = new Date(item.startAt);
                    const formattedDate = itemDate.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    });
                    const formattedTime = item.allDay
                      ? 'All Day'
                      : itemDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

                    return (
                      <div
                        key={item.id}
                        className="cal-agenda-row"
                        onClick={(e) => handleOpenEditEvent(item, e)}
                      >
                        <div className="cal-agenda-date-col">
                          <span className="cal-agenda-month">{itemDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span>
                          <span className="cal-agenda-day">{itemDate.getDate()}</span>
                        </div>

                        <div className="cal-agenda-body">
                          <div className="cal-agenda-title-line">
                            <span className="event-dot" style={{ backgroundColor: theme.dotColor }} />
                            <h4 className="cal-agenda-title">{item.title}</h4>
                          </div>
                          <div className="cal-agenda-meta">
                            <span className="cal-agenda-project">{item.project?.name || 'D-Board'}</span>
                            <span className="cal-agenda-time">{formattedTime} · {formattedDate}</span>
                          </div>
                        </div>

                        <ChevronRightIcon size={16} className="cal-agenda-arrow" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: 3 Stacked Cards Matching Screenshot */}
        <div className="cal-sidebar-column">
          {/* CARD 1: Mini Month Calendar */}
          <div className="cal-mini-calendar-card">
            <div className="cal-mini-header">
              <span className="cal-mini-title">{miniMonthYearLabel}</span>
              <div className="cal-mini-nav">
                <button
                  type="button"
                  className="cal-mini-nav-btn"
                  onClick={handlePrevMiniMonth}
                  aria-label="Previous month in mini calendar"
                >
                  <ChevronLeftIcon size={14} />
                </button>
                <button
                  type="button"
                  className="cal-mini-nav-btn"
                  onClick={handleNextMiniMonth}
                  aria-label="Next month in mini calendar"
                >
                  <ChevronRightIcon size={14} />
                </button>
              </div>
            </div>

            <div className="cal-mini-weekdays">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            <div className="cal-mini-dates-grid">
              {miniGridCells.map((cell, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`cal-mini-date-cell ${
                    !cell.isCurrentMonth ? 'mini-muted' : ''
                  } ${cell.isToday ? 'mini-today' : cell.isSelected ? 'mini-selected' : ''}`}
                  style={cell.isToday ? { backgroundColor: '#0F172A', color: '#FFFFFF', fontWeight: 800 } : undefined}
                  onClick={() => {
                    setSelectedDate(cell.date);
                    setCurrentDate(cell.date);
                  }}
                >
                  {cell.dayNumber}
                </button>
              ))}
            </div>
          </div>

          {/* CARD 2: Upcoming Events List */}
          <div className="cal-upcoming-card">
            <div className="cal-upcoming-header">
              <h3 className="cal-upcoming-title">Upcoming Events</h3>
              <button
                type="button"
                className="cal-view-all-btn"
                onClick={() => setViewMode('list')}
              >
                <span>View all</span>
                <ArrowRightIcon size={13} />
              </button>
            </div>

            <div className="cal-upcoming-list">
              {upcomingEvents.length === 0 ? (
                <div style={{ padding: '1.25rem 0', textAlign: 'center', color: '#94A3B8', fontSize: '0.8125rem' }}>
                  No upcoming deadlines scheduled
                </div>
              ) : (
                upcomingEvents.map((item) => {
                  const theme = getEventStyle(item);
                  const itemDate = new Date(item.startAt);
                  const monthShort = itemDate
                    .toLocaleDateString('en-US', { month: 'short' })
                    .toUpperCase();
                  const dayNum = itemDate.getDate();
                  const timeFormatted = item.allDay
                    ? `${item.project?.name || 'Project'} • All day`
                    : `${new Date(item.startAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })} - ${new Date(item.endAt || item.startAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}`;

                  return (
                    <div
                      key={item.id}
                      className="cal-upcoming-item"
                      onClick={(e) => handleOpenEditEvent(item, e)}
                    >
                      {/* Left Date Badge */}
                      <div className="cal-upcoming-badge">
                        <span className="upcoming-badge-month">{monthShort}</span>
                        <span className="upcoming-badge-day">{dayNum}</span>
                      </div>

                      {/* Info */}
                      <div className="cal-upcoming-info">
                        <div className="cal-upcoming-title-row">
                          <span
                            className="event-dot"
                            style={{ backgroundColor: theme.dotColor }}
                          />
                          <span className="cal-upcoming-item-name">{item.title}</span>
                        </div>
                        <div className="cal-upcoming-meta">
                          <span className="cal-upcoming-time-text">{timeFormatted}</span>
                        </div>
                      </div>

                      {/* Right Chevron */}
                      <ChevronRightIcon size={15} className="cal-upcoming-chevron" />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* CARD 3: Sync with your tools (Google Calendar) */}
          <div className="cal-sync-tools-card">
            <div className="cal-sync-header">
              <h3 className="cal-sync-title">Sync with your tools</h3>
              <button
                type="button"
                className="cal-sync-settings-btn"
                onClick={() => setSyncModalOpen(true)}
                aria-label="Calendar sync settings"
              >
                <SettingsIcon size={16} />
              </button>
            </div>
            <p className="cal-sync-desc">
              Connect your calendar to see all your events in one place.
            </p>
            <button
              type="button"
              className="cal-connect-google-btn"
              onClick={() => setSyncModalOpen(true)}
            >
              <GoogleIcon size={18} />
              <span>Connect Google Calendar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Event Create / Edit Modal */}
      <CalendarEventModal
        isOpen={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        onSaved={loadCalendar}
        initialDate={modalInitialDate}
        eventToEdit={selectedEventToEdit}
        projects={accessibleProjects.length > 0 ? accessibleProjects : project ? [project] : []}
        activeProjectId={activeProjectId}
        canDelete={
          selectedEventToEdit?.createdBy?.id === user?.id || project?.userRole === 'PROJECT_ADMIN'
        }
      />

      {/* WorkItem Details Modal */}
      {selectedWorkItemId && selectedWorkItemProject && (
        <WorkItemDetailsModal
          workItemId={selectedWorkItemId}
          project={selectedWorkItemProject}
          onClose={() => {
            setSelectedWorkItemId(null);
            setSelectedWorkItemProject(null);
          }}
          onUpdated={(_item) => loadCalendar()}
          onDeleted={(_id) => loadCalendar()}
        />
      )}

      {/* Google Calendar Sync Modal */}
      <GoogleCalendarSyncModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        items={items}
        projectName={project?.name || 'D-Board'}
        projectId={activeProjectId || undefined}
      />
    </div>
  );
};
