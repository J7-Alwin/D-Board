import React, { useState, useEffect, useRef } from 'react';
import type { CalendarItem, CalendarEventType } from '../../api/calendar.api';
import { calendarApi } from '../../api/calendar.api';
import { workApi, type WorkItem } from '../../api/work.api';
import type { Project } from '../../api/projects.api';
import { projectsApi } from '../../api/projects.api';
import {
  CalendarIcon,
  CloseIcon,
  TrashIcon,
  AlertCircleIcon,
  UsersIcon,
  TrendingUpIcon,
  MoreHorizontalIcon,
  CheckSquareIcon,
  CheckIcon,
  ChevronDownIcon,
  LinkIcon,
} from '../ui/Icons';
import { Checkbox } from '../ui/Checkbox';

interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialDate?: Date | null;
  eventToEdit?: CalendarItem | null;
  projects: Project[];
  activeProjectId?: string | null;
  canDelete?: boolean;
}

interface AssignableUser {
  id: string;
  name: string;
  username: string;
  role: string;
  avatarUrl?: string | null;
}

const toLocalDateString = (d: Date | string | number): string => {
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const CATEGORY_OPTIONS: {
  value: CalendarEventType;
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}[] = [
  {
    value: 'MEETING',
    label: 'Meeting',
    icon: <UsersIcon size={15} />,
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    value: 'RELEASE',
    label: 'Release',
    icon: <TrendingUpIcon size={15} />,
    color: '#16A34A',
    bg: '#F0FDF4',
  },
  {
    value: 'MILESTONE',
    label: 'Milestone',
    icon: <CheckSquareIcon size={15} />,
    color: '#D97706',
    bg: '#FEF3C7',
  },
  {
    value: 'DEADLINE',
    label: 'Deadline',
    icon: <AlertCircleIcon size={15} />,
    color: '#DC2626',
    bg: '#FEF2F2',
  },
  {
    value: 'OTHER',
    label: 'Other',
    icon: <MoreHorizontalIcon size={15} />,
    color: '#64748B',
    bg: '#F8FAFC',
  },
];

const TIME_SLOTS: string[] = [];
for (let h = 0; h < 24; h++) {
  const hh = String(h).padStart(2, '0');
  TIME_SLOTS.push(`${hh}:00`);
  TIME_SLOTS.push(`${hh}:15`);
  TIME_SLOTS.push(`${hh}:30`);
  TIME_SLOTS.push(`${hh}:45`);
}

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialDate,
  eventToEdit,
  projects,
  activeProjectId,
  canDelete = false,
}) => {
  const isEditing = !!eventToEdit && eventToEdit.kind === 'EVENT';

  const [projectId, setProjectId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CalendarEventType>('MEETING');
  const [startDateStr, setStartDateStr] = useState('');
  const [startTimeStr, setStartTimeStr] = useState('10:00');
  const [endDateStr, setEndDateStr] = useState('');
  const [endTimeStr, setEndTimeStr] = useState('11:00');
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [relatedWorkItemId, setRelatedWorkItemId] = useState<string>('');
  const [projectWorkItems, setProjectWorkItems] = useState<WorkItem[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);
  const [createAnother, setCreateAnother] = useState(false);

  // Dropdown menus control
  const [openDropdown, setOpenDropdown] = useState<
    'project' | 'category' | 'startTime' | 'endTime' | 'workItem' | 'attendees' | null
  >(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form state
  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    const defaultProjId =
      eventToEdit?.projectId || activeProjectId || (projects.length > 0 ? projects[0].id : '');
    setProjectId(defaultProjId);

    if (isEditing && eventToEdit) {
      setTitle(eventToEdit.title);
      setDescription(eventToEdit.description || '');
      setType(eventToEdit.type || 'MEETING');
      setAllDay(eventToEdit.allDay || false);
      setLocation(eventToEdit.location || '');
      setRelatedWorkItemId(eventToEdit.relatedWorkItemId || '');
      setSelectedAttendeeIds(eventToEdit.attendees ? eventToEdit.attendees.map((a) => a.id) : []);

      const start = new Date(eventToEdit.startAt);
      const end = new Date(eventToEdit.endAt);

      setStartDateStr(toLocalDateString(start));
      setStartTimeStr(
        `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
      );
      setEndDateStr(toLocalDateString(end));
      setEndTimeStr(
        `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
      );
    } else {
      // New Event
      const baseDate = initialDate || new Date();
      const dateStr = toLocalDateString(baseDate);
      setTitle('');
      setDescription('');
      setType('MEETING');
      setStartDateStr(dateStr);
      setStartTimeStr('10:00');
      setEndDateStr(dateStr);
      setEndTimeStr('11:00');
      setAllDay(false);
      setLocation('');
      setRelatedWorkItemId('');
      setSelectedAttendeeIds([]);
    }
  }, [isOpen, eventToEdit, initialDate, activeProjectId, projects, isEditing]);

  // Fetch project work items & project members for the selected project
  useEffect(() => {
    if (projectId) {
      workApi
        .getProjectWorkItems(projectId)
        .then((res) => {
          if (res.success && res.data) {
            setProjectWorkItems(res.data.workItems || []);
          }
        })
        .catch(() => {});

      projectsApi
        .getProjectById(projectId)
        .then((res) => {
          if (res.success && res.data?.project) {
            const proj = res.data.project;
            const list: AssignableUser[] = [];
            if (proj.createdBy) {
              list.push({
                id: proj.createdById,
                name: proj.createdBy.fullName || proj.createdBy.username,
                username: proj.createdBy.username,
                role: 'Owner',
                avatarUrl: proj.createdBy.avatarUrl,
              });
            }
            if (proj.members) {
              proj.members.forEach((m: any) => {
                if (m.userId !== proj.createdById) {
                  list.push({
                    id: m.userId,
                    name: m.user.fullName || m.user.username,
                    username: m.user.username,
                    role: m.role === 'PROJECT_ADMIN' ? 'Admin' : 'Member',
                    avatarUrl: m.user.avatarUrl,
                  });
                }
              });
            }
            setAssignableUsers(list);
          }
        })
        .catch(() => {});
    }
  }, [projectId]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const currentProject = projects.find((p) => p.id === projectId) || (projects.length > 0 ? projects[0] : null);
  const currentCategory = CATEGORY_OPTIONS.find((c) => c.value === type) || CATEGORY_OPTIONS[0];
  const currentWorkItem = projectWorkItems.find((w) => w.id === relatedWorkItemId);

  const toggleAttendee = (userId: string) => {
    setSelectedAttendeeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const removeAttendee = (userId: string) => {
    setSelectedAttendeeIds((prev) => prev.filter((id) => id !== userId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Event title is required');
      return;
    }
    if (!projectId) {
      setError('Project selection is required');
      return;
    }

    let startIso: string;
    let endIso: string;

    if (allDay) {
      startIso = new Date(`${startDateStr}T00:00:00`).toISOString();
      endIso = new Date(`${endDateStr || startDateStr}T23:59:59`).toISOString();
    } else {
      startIso = new Date(`${startDateStr}T${startTimeStr || '00:00'}:00`).toISOString();
      endIso = new Date(`${endDateStr || startDateStr}T${endTimeStr || '00:00'}:00`).toISOString();
    }

    if (new Date(endIso).getTime() < new Date(startIso).getTime()) {
      setError('End date/time cannot be before start date/time');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && eventToEdit) {
        await calendarApi.updateCalendarEvent(eventToEdit.projectId, eventToEdit.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          startAt: startIso,
          endAt: endIso,
          allDay,
          location: location.trim() || undefined,
          relatedWorkItemId: relatedWorkItemId || undefined,
          attendeeIds: selectedAttendeeIds,
        });
      } else {
        await calendarApi.createCalendarEvent(projectId, {
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          startAt: startIso,
          endAt: endIso,
          allDay,
          location: location.trim() || undefined,
          relatedWorkItemId: relatedWorkItemId || undefined,
          attendeeIds: selectedAttendeeIds,
        });
      }

      onSaved();

      if (createAnother && !isEditing) {
        // Reset form for another event creation
        setTitle('');
        setDescription('');
        setLocation('');
        setRelatedWorkItemId('');
        setSelectedAttendeeIds([]);
        setError(null);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!eventToEdit || !isEditing) return;
    if (!window.confirm(`Are you sure you want to delete event "${eventToEdit.title}"?`)) return;

    setIsDeleting(true);
    setError(null);
    try {
      await calendarApi.deleteCalendarEvent(eventToEdit.projectId, eventToEdit.id);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete event');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container cem-modal-window"
        onClick={(e) => e.stopPropagation()}
        ref={dropdownRef}
      >
        {/* Top Header with 3D Calendar & Notification Art */}
        <div className="cem-header-container">
          <div className="cem-header-left">
            <div className="cem-header-icon-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <div className="cem-header-titles">
              <h2 className="cem-title">{isEditing ? 'Edit Calendar Event' : 'Create Calendar Event'}</h2>
              <p className="cem-subtitle">
                Schedule meetings, sessions, and important events for your project.
              </p>
            </div>
          </div>

          {/* Right 3D Illustration: Wall Calendar + Floating Bell + Time Widget */}
          <div className="cem-header-art-wrapper">
            <div className="cem-art-backdrop">
              {/* Sparkle Rays */}
              <div className="cem-sparkle-ray cem-ray-1">✦</div>
              <div className="cem-sparkle-ray cem-ray-2">✦</div>

              {/* 3D Wall Calendar */}
              <div className="cem-art-calendar-card">
                {/* Spiral binder rings */}
                <div className="cem-art-rings">
                  <span className="cem-ring" />
                  <span className="cem-ring" />
                  <span className="cem-ring" />
                  <span className="cem-ring" />
                </div>
                {/* Blue calendar header bar */}
                <div className="cem-art-cal-head" />
                {/* Grid dots with active date square */}
                <div className="cem-art-cal-body">
                  <div className="cem-cal-dot" />
                  <div className="cem-cal-dot" />
                  <div className="cem-cal-dot active" />
                  <div className="cem-cal-dot" />
                  <div className="cem-cal-dot" />
                  <div className="cem-cal-dot" />
                </div>
              </div>

              {/* Floating 3D Golden Bell with sound rays */}
              <div className="cem-art-bell">
                <span className="cem-bell-sound-ray ray-left" />
                <span className="cem-bell-sound-ray ray-top" />
                <span className="cem-bell-sound-ray ray-right" />
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#FBBF24">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                </svg>
              </div>

              {/* Floating 3D Clock / Time Schedule Card */}
              <div className="cem-art-clock-card">
                <div className="cem-clock-circle">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="cem-clock-lines">
                  <span className="cem-line line-lg" />
                  <span className="cem-line line-sm" />
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              className="cem-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        {error && (
          <div className="cem-error-banner">
            <AlertCircleIcon size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="cem-form-container">
          <div className="cem-form-fields">
            {/* Project Selection */}
            <div className="cem-field-group">
              <label className="cem-field-label">
                Project <span className="cem-required-star">*</span>
              </label>
              <div className="cem-dropdown-wrapper">
                <button
                  type="button"
                  className={`cem-dropdown-btn ${openDropdown === 'project' ? 'active' : ''}`}
                  onClick={() => setOpenDropdown(openDropdown === 'project' ? null : 'project')}
                  disabled={isEditing}
                >
                  <div className="cem-dropdown-btn-left">
                    {currentProject?.avatarUrl ? (
                      <img src={currentProject.avatarUrl} alt="" className="cem-avatar-circle" />
                    ) : (
                      <span className="cem-monogram-badge">
                        {currentProject?.key || currentProject?.name.trim().slice(0, 3).toUpperCase() || 'TES'}
                      </span>
                    )}
                    <span className="cem-dropdown-text">{currentProject?.name || 'Select Project'}</span>
                  </div>
                  <ChevronDownIcon size={15} className={`cem-chevron ${openDropdown === 'project' ? 'open' : ''}`} />
                </button>

                {openDropdown === 'project' && projects.length > 0 && (
                  <div className="cem-dropdown-menu">
                    {projects.map((p) => {
                      const isSelected = p.id === projectId;
                      return (
                        <div
                          key={p.id}
                          className={`cem-dropdown-option ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setProjectId(p.id);
                            setOpenDropdown(null);
                          }}
                        >
                          <div className="cem-option-left">
                            {p.avatarUrl ? (
                              <img src={p.avatarUrl} alt="" className="cem-avatar-circle" />
                            ) : (
                              <span className="cem-monogram-badge">
                                {p.key || p.name.trim().slice(0, 3).toUpperCase()}
                              </span>
                            )}
                            <span className="cem-option-label">{p.name}</span>
                          </div>
                          {isSelected && (
                            <span className="cem-option-check">
                              <CheckIcon size={14} />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Event Title */}
            <div className="cem-field-group">
              <label htmlFor="cem-event-title" className="cem-field-label">
                Event Title <span className="cem-required-star">*</span>
              </label>
              <div className="cem-input-with-icon">
                <span className="cem-input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </span>
                <input
                  id="cem-event-title"
                  type="text"
                  className="cem-text-input"
                  placeholder="e.g. Sprint Planning, Release v1.0, Architecture Review..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Event Category & All-Day Checkbox Row */}
            <div className="cem-grid-category-row">
              {/* Event Category Selector */}
              <div className="cem-field-group cem-category-col">
                <label className="cem-field-label">Event Category</label>
                <div className="cem-dropdown-wrapper">
                  <button
                    type="button"
                    className={`cem-dropdown-btn ${openDropdown === 'category' ? 'active' : ''}`}
                    onClick={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')}
                  >
                    <div className="cem-dropdown-btn-left">
                      <span className="cem-category-icon" style={{ color: currentCategory.color }}>
                        {currentCategory.icon}
                      </span>
                      <span className="cem-dropdown-text">{currentCategory.label}</span>
                    </div>
                    <ChevronDownIcon size={15} className={`cem-chevron ${openDropdown === 'category' ? 'open' : ''}`} />
                  </button>

                  {openDropdown === 'category' && (
                    <div className="cem-dropdown-menu">
                      {CATEGORY_OPTIONS.map((cat) => {
                        const isSelected = cat.value === type;
                        return (
                          <div
                            key={cat.value}
                            className={`cem-dropdown-option ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              setType(cat.value);
                              setOpenDropdown(null);
                            }}
                          >
                            <div className="cem-option-left">
                              <span
                                className="cem-cat-badge"
                                style={{ backgroundColor: cat.bg, color: cat.color }}
                              >
                                {cat.icon}
                              </span>
                              <span className="cem-option-label">{cat.label}</span>
                            </div>
                            {isSelected && (
                              <span className="cem-option-check">
                                <CheckIcon size={14} />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* All-Day Event Checkbox */}
              <div className="cem-allday-col">
                <label className="cem-checkbox-wrapper">
                  <input
                    type="checkbox"
                    className="cem-real-checkbox"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                  />
                  <span className="cem-custom-check-box">
                    {allDay && <CheckIcon size={12} />}
                  </span>
                  <span className="cem-allday-label-text">All-Day Event</span>
                  <span
                    className="cem-help-icon"
                    title="All-day events span the entire day without specific hour slots"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                  </span>
                </label>
              </div>
            </div>

            {/* Team Members / Attendees Selector */}
            <div className="cem-field-group">
              <label className="cem-field-label">
                Invite Team Members (Optional)
              </label>
              <div className="cem-dropdown-wrapper">
                <button
                  type="button"
                  className={`cem-dropdown-btn ${openDropdown === 'attendees' ? 'active' : ''}`}
                  onClick={() => setOpenDropdown(openDropdown === 'attendees' ? null : 'attendees')}
                >
                  <div className="cem-dropdown-btn-left">
                    <span className="cem-category-icon" style={{ color: '#2563EB' }}>
                      <UsersIcon size={15} />
                    </span>
                    <span className="cem-dropdown-text">
                      {selectedAttendeeIds.length === 0
                        ? 'Select team members to invite...'
                        : `${selectedAttendeeIds.length} member${selectedAttendeeIds.length > 1 ? 's' : ''} selected`}
                    </span>
                  </div>
                  <ChevronDownIcon size={15} className={`cem-chevron ${openDropdown === 'attendees' ? 'open' : ''}`} />
                </button>

                {openDropdown === 'attendees' && (
                  <div className="cem-dropdown-menu">
                    {assignableUsers.length === 0 ? (
                      <div style={{ padding: '0.6rem 0.8rem', fontSize: '0.8rem', color: '#94A3B8' }}>
                        No other team members found in this project.
                      </div>
                    ) : (
                      assignableUsers.map((u) => {
                        const isSelected = selectedAttendeeIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            className={`cem-dropdown-option ${isSelected ? 'selected' : ''}`}
                            onClick={() => toggleAttendee(u.id)}
                          >
                            <div className="cem-option-left">
                              {u.avatarUrl ? (
                                <img src={u.avatarUrl} alt="" className="cem-avatar-circle" />
                              ) : (
                                <span className="cem-monogram-circle-sm">
                                  {u.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                              <span className="cem-option-label">{u.name}</span>
                              <span className={`cem-member-role-badge role-${u.role.toLowerCase()}`}>
                                {u.role}
                              </span>
                            </div>
                            <div className="cem-option-right">
                              <span className={`cem-multi-check-indicator ${isSelected ? 'checked' : ''}`}>
                                {isSelected && <CheckIcon size={12} />}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Selected Attendee Chips */}
              {selectedAttendeeIds.length > 0 && (
                <div className="cem-attendee-chips-tray">
                  {selectedAttendeeIds.map((userId) => {
                    const u = assignableUsers.find((user) => user.id === userId);
                    if (!u) return null;
                    return (
                      <div key={userId} className="cem-attendee-pill">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" className="cem-pill-avatar" />
                        ) : (
                          <span className="cem-pill-monogram">
                            {u.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="cem-pill-name">{u.name}</span>
                        <button
                          type="button"
                          className="cem-pill-remove-btn"
                          onClick={() => removeAttendee(userId)}
                          title="Remove attendee"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Start Date & Start Time */}
            <div className="cem-grid-2col">
              <div className="cem-field-group">
                <label htmlFor="cem-start-date" className="cem-field-label">
                  Start Date <span className="cem-required-star">*</span>
                </label>
                <div className="cem-input-with-icon">
                  <span className="cem-input-icon">
                    <CalendarIcon size={15} />
                  </span>
                  <input
                    id="cem-start-date"
                    type="date"
                    className="cem-text-input cem-date-input"
                    value={startDateStr}
                    onChange={(e) => setStartDateStr(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="cem-field-group">
                <label className="cem-field-label">
                  Start Time <span className="cem-required-star">*</span>
                </label>
                <div className="cem-dropdown-wrapper">
                  <button
                    type="button"
                    className={`cem-dropdown-btn ${openDropdown === 'startTime' ? 'active' : ''} ${allDay ? 'disabled' : ''}`}
                    onClick={() => !allDay && setOpenDropdown(openDropdown === 'startTime' ? null : 'startTime')}
                    disabled={allDay}
                  >
                    <div className="cem-dropdown-btn-left">
                      <span className="cem-input-icon-static">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                      </span>
                      <span className="cem-dropdown-text">{allDay ? 'All Day' : startTimeStr}</span>
                    </div>
                    {!allDay && (
                      <ChevronDownIcon size={15} className={`cem-chevron ${openDropdown === 'startTime' ? 'open' : ''}`} />
                    )}
                  </button>

                  {openDropdown === 'startTime' && !allDay && (
                    <div className="cem-dropdown-menu cem-time-menu">
                      {TIME_SLOTS.map((t) => (
                        <div
                          key={t}
                          className={`cem-dropdown-option ${t === startTimeStr ? 'selected' : ''}`}
                          onClick={() => {
                            setStartTimeStr(t);
                            setOpenDropdown(null);
                          }}
                        >
                          <span className="cem-option-label">{t}</span>
                          {t === startTimeStr && (
                            <span className="cem-option-check">
                              <CheckIcon size={14} />
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* End Date & End Time */}
            <div className="cem-grid-2col">
              <div className="cem-field-group">
                <label htmlFor="cem-end-date" className="cem-field-label">
                  End Date <span className="cem-required-star">*</span>
                </label>
                <div className="cem-input-with-icon">
                  <span className="cem-input-icon">
                    <CalendarIcon size={15} />
                  </span>
                  <input
                    id="cem-end-date"
                    type="date"
                    className="cem-text-input cem-date-input"
                    value={endDateStr}
                    onChange={(e) => setEndDateStr(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="cem-field-group">
                <label className="cem-field-label">
                  End Time <span className="cem-required-star">*</span>
                </label>
                <div className="cem-dropdown-wrapper">
                  <button
                    type="button"
                    className={`cem-dropdown-btn ${openDropdown === 'endTime' ? 'active' : ''} ${allDay ? 'disabled' : ''}`}
                    onClick={() => !allDay && setOpenDropdown(openDropdown === 'endTime' ? null : 'endTime')}
                    disabled={allDay}
                  >
                    <div className="cem-dropdown-btn-left">
                      <span className="cem-input-icon-static">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                      </span>
                      <span className="cem-dropdown-text">{allDay ? 'All Day' : endTimeStr}</span>
                    </div>
                    {!allDay && (
                      <ChevronDownIcon size={15} className={`cem-chevron ${openDropdown === 'endTime' ? 'open' : ''}`} />
                    )}
                  </button>

                  {openDropdown === 'endTime' && !allDay && (
                    <div className="cem-dropdown-menu cem-time-menu">
                      {TIME_SLOTS.map((t) => (
                        <div
                          key={t}
                          className={`cem-dropdown-option ${t === endTimeStr ? 'selected' : ''}`}
                          onClick={() => {
                            setEndTimeStr(t);
                            setOpenDropdown(null);
                          }}
                        >
                          <span className="cem-option-label">{t}</span>
                          {t === endTimeStr && (
                            <span className="cem-option-check">
                              <CheckIcon size={14} />
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Location or Video URL */}
            <div className="cem-field-group">
              <label htmlFor="cem-location" className="cem-field-label">
                Location or Video URL (Optional)
              </label>
              <div className="cem-input-with-icon">
                <span className="cem-input-icon">
                  <LinkIcon size={15} />
                </span>
                <input
                  id="cem-location"
                  type="text"
                  className="cem-text-input"
                  placeholder="e.g. Room 402, Zoom link, Google Meet..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            {/* Related Work Item */}
            <div className="cem-field-group">
              <label className="cem-field-label">Related Work Item (Optional)</label>
              <div className="cem-dropdown-wrapper">
                <button
                  type="button"
                  className={`cem-dropdown-btn ${openDropdown === 'workItem' ? 'active' : ''}`}
                  onClick={() => setOpenDropdown(openDropdown === 'workItem' ? null : 'workItem')}
                >
                  <div className="cem-dropdown-btn-left">
                    <span className="cem-workitem-lead-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                      </svg>
                    </span>
                    <span className="cem-dropdown-text">
                      {currentWorkItem
                        ? `[${currentWorkItem.type}] ${currentWorkItem.title}`
                        : 'None (Standalone Event)'}
                    </span>
                  </div>
                  <ChevronDownIcon size={15} className={`cem-chevron ${openDropdown === 'workItem' ? 'open' : ''}`} />
                </button>

                {openDropdown === 'workItem' && (
                  <div className="cem-dropdown-menu">
                    <div
                      className={`cem-dropdown-option ${!relatedWorkItemId ? 'selected' : ''}`}
                      onClick={() => {
                        setRelatedWorkItemId('');
                        setOpenDropdown(null);
                      }}
                    >
                      <div className="cem-option-left">
                        <span className="cem-workitem-lead-icon">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="8" y1="6" x2="21" y2="6"></line>
                            <line x1="8" y1="12" x2="21" y2="12"></line>
                            <line x1="8" y1="18" x2="21" y2="18"></line>
                            <line x1="3" y1="6" x2="3.01" y2="6"></line>
                            <line x1="3" y1="12" x2="3.01" y2="12"></line>
                            <line x1="3" y1="18" x2="3.01" y2="18"></line>
                          </svg>
                        </span>
                        <span className="cem-option-label">None (Standalone Event)</span>
                      </div>
                      {!relatedWorkItemId && (
                        <span className="cem-option-check">
                          <CheckIcon size={14} />
                        </span>
                      )}
                    </div>

                    {projectWorkItems.map((w) => {
                      const isSelected = relatedWorkItemId === w.id;
                      return (
                        <div
                          key={w.id}
                          className={`cem-dropdown-option ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setRelatedWorkItemId(w.id);
                            setOpenDropdown(null);
                          }}
                        >
                          <div className="cem-option-left">
                            <span className="cem-workitem-lead-icon">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="8" y1="6" x2="21" y2="6"></line>
                                <line x1="8" y1="12" x2="21" y2="12"></line>
                                <line x1="8" y1="18" x2="21" y2="18"></line>
                                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                                <line x1="3" y1="18" x2="3.01" y2="18"></line>
                              </svg>
                            </span>
                            <span className="cem-option-label">
                              <span className={`cem-workitem-badge type-${w.type.toLowerCase()}`}>{w.type}</span> {w.title}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="cem-option-check">
                              <CheckIcon size={14} />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="cem-field-group">
              <label htmlFor="cem-desc" className="cem-field-label">
                Description (Optional)
              </label>
              <div className="cem-textarea-wrapper">
                <span className="cem-textarea-lead-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="21" y1="10" x2="7" y2="10"></line>
                    <line x1="21" y1="6" x2="3" y2="6"></line>
                    <line x1="21" y1="14" x2="3" y2="14"></line>
                    <line x1="21" y1="18" x2="7" y2="18"></line>
                  </svg>
                </span>
                <textarea
                  id="cem-desc"
                  className="cem-textarea-input"
                  rows={2}
                  maxLength={1000}
                  placeholder="Add agenda, meeting notes, or release details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <div className="cem-char-counter">{description.length}/1000</div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="cem-footer-bar">
            <div className="cem-footer-left">
              {!isEditing && (
                <Checkbox
                  id="cem-create-another"
                  checked={createAnother}
                  onChange={(e) => setCreateAnother(e.target.checked)}
                  label="Create another after saving"
                />
              )}
              {isEditing && canDelete && (
                <button
                  type="button"
                  className="cem-btn-delete-pill"
                  onClick={handleDelete}
                  disabled={isSubmitting || isDeleting}
                >
                  <TrashIcon size={14} />
                  <span>{isDeleting ? 'Deleting...' : 'Delete Event'}</span>
                </button>
              )}
            </div>

            <div className="cem-footer-right">
              <button
                type="button"
                className="cem-btn-cancel-pill"
                onClick={onClose}
                disabled={isSubmitting || isDeleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="cem-btn-create-pill"
                disabled={isSubmitting || isDeleting}
              >
                {isSubmitting ? (
                  <>
                    <span className="cem-spinner-circle" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                      <line x1="12" y1="14" x2="12" y2="18"></line>
                      <line x1="10" y1="16" x2="14" y2="16"></line>
                    </svg>
                    <span>{isEditing ? 'Save Changes' : 'Create Event'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
