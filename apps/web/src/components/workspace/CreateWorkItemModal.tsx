import React, { useState, useRef, useEffect, useCallback } from 'react';
import { projectsApi, type Project } from '../../api/projects.api';
import {
  workApi,
  type WorkItem,
  type WorkItemType,
  type WorkItemStatus,
  type WorkItemPriority,
} from '../../api/work.api';
import {
  CloseIcon,
  ListIcon,
  BarChartIcon,
  UserIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  BugIcon,
  CodeIcon,
  TrendingUpIcon,
  MoreHorizontalIcon,
  ArrowDownIcon,
  DoubleArrowUpIcon,
  PlayIcon,
  ClockIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  CircleDotIcon,
  TrashIcon,
} from '../ui/Icons';
import { Checkbox } from '../ui/Checkbox';

interface CreateWorkItemModalProps {
  project?: Project | null;
  projects?: Project[];
  isOpen: boolean;
  defaultStatus?: WorkItemStatus;
  onClose: () => void;
  onCreated: (workItem: WorkItem) => void;
}

const TYPE_OPTIONS: {
  value: WorkItemType;
  label: string;
  icon: React.ReactNode;
  bg: string;
  color: string;
}[] = [
  { value: 'TASK', label: 'Task', icon: <ListIcon size={16} />, bg: '#E6F4EA', color: '#137333' },
  { value: 'BUG', label: 'Bug', icon: <BugIcon size={16} />, bg: '#FEE2E2', color: '#DC2626' },
  { value: 'FEATURE', label: 'Feature', icon: <CodeIcon size={16} />, bg: '#DBEAFE', color: '#2563EB' },
  { value: 'IMPROVEMENT', label: 'Improvement', icon: <TrendingUpIcon size={16} />, bg: '#F3E8FF', color: '#9333EA' },
  { value: 'RESEARCH', label: 'Research', icon: <ListIcon size={16} />, bg: '#FEF3C7', color: '#D97706' },
  { value: 'DOCUMENTATION', label: 'Documentation', icon: <ListIcon size={16} />, bg: '#F3F4F6', color: '#4B5563' },
  { value: 'OTHER', label: 'Other', icon: <MoreHorizontalIcon size={16} />, bg: '#F3F4F6', color: '#6B7280' },
];

const PRIORITY_OPTIONS: {
  value: WorkItemPriority;
  label: string;
  icon: React.ReactNode;
  bg: string;
  color: string;
}[] = [
  { value: 'LOW', label: 'Low', icon: <ArrowDownIcon size={16} />, bg: '#DCFCE7', color: '#16A34A' },
  { value: 'MEDIUM', label: 'Medium', icon: <BarChartIcon size={16} />, bg: '#FEF3C7', color: '#D97706' },
  { value: 'HIGH', label: 'High', icon: <DoubleArrowUpIcon size={16} />, bg: '#FEE2E2', color: '#DC2626' },
  { value: 'URGENT', label: 'Urgent', icon: <AlertCircleIcon size={16} />, bg: '#FEE2E2', color: '#DC2626' },
];

const STATUS_OPTIONS: {
  value: WorkItemStatus;
  label: string;
  icon: React.ReactNode;
  bg: string;
  color: string;
}[] = [
  {
    value: 'TODO',
    label: 'To Do',
    icon: <CircleDotIcon size={14} />,
    bg: '#F3F4F6',
    color: '#374151',
  },
  {
    value: 'IN_PROGRESS',
    label: 'In Progress',
    icon: <PlayIcon size={14} />,
    bg: '#DBEAFE',
    color: '#2563EB',
  },
  {
    value: 'BLOCKED',
    label: 'Blocked',
    icon: <AlertCircleIcon size={14} />,
    bg: '#FEE2E2',
    color: '#DC2626',
  },
  {
    value: 'IN_REVIEW',
    label: 'In Review',
    icon: <ClockIcon size={14} />,
    bg: '#FEF3C7',
    color: '#D97706',
  },
  {
    value: 'COMPLETED',
    label: 'Completed',
    icon: <CheckCircleIcon size={15} />,
    bg: '#DCFCE7',
    color: '#16A34A',
  },
];

interface AssignableUser {
  id: string;
  name: string;
  username: string;
  role: 'Owner' | 'Admin' | 'Member';
  avatarUrl?: string | null;
}

export const CreateWorkItemModal: React.FC<CreateWorkItemModalProps> = ({
  project: initialProject,
  projects: initialProjectsList,
  isOpen,
  defaultStatus = 'TODO',
  onClose,
  onCreated,
}) => {
  const [allProjects, setAllProjects] = useState<Project[]>(initialProjectsList || []);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProject?.id || (initialProjectsList && initialProjectsList.length > 0 ? initialProjectsList[0].id : '')
  );
  const [selectedProjectDetails, setSelectedProjectDetails] = useState<Project | null>(initialProject || null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<WorkItemType>('TASK');
  const [status, setStatus] = useState<WorkItemStatus>(defaultStatus);
  const [priority, setPriority] = useState<WorkItemPriority>('MEDIUM');
  const [assignedToId, setAssignedToId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [createAnother, setCreateAnother] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dropdown open states
  const [openDropdown, setOpenDropdown] = useState<'type' | 'priority' | 'project' | 'status' | 'assignee' | null>(null);

  const dropdownContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load user projects if not provided or empty
  useEffect(() => {
    if (!isOpen) return;

    if (initialProject) {
      setSelectedProjectDetails(initialProject);
      setSelectedProjectId(initialProject.id);
    }

    if (initialProjectsList && initialProjectsList.length > 0) {
      setAllProjects(initialProjectsList);
      if (!selectedProjectId) {
        setSelectedProjectId(initialProjectsList[0].id);
        setSelectedProjectDetails(initialProjectsList[0]);
      }
    } else {
      projectsApi.getUserProjects().then((res) => {
        if (res.success && res.data && res.data.all) {
          setAllProjects(res.data.all);
          if (!selectedProjectId && res.data.all.length > 0) {
            const firstProj = res.data.all[0];
            setSelectedProjectId(firstProj.id);
            setSelectedProjectDetails(firstProj);
          }
        }
      }).catch(() => {});
    }
  }, [isOpen, initialProject, initialProjectsList]);

  // Load project details (members) when selectedProjectId changes
  const loadProjectDetails = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      const res = await projectsApi.getProjectById(projId);
      if (res.success && res.data?.project) {
        setSelectedProjectDetails(res.data.project);
      }
    } catch {
      const basic = allProjects.find((p) => p.id === projId) || null;
      if (basic) setSelectedProjectDetails(basic);
    }
  }, [allProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      if (selectedProjectDetails?.id === selectedProjectId && selectedProjectDetails.members) {
        return;
      }
      loadProjectDetails(selectedProjectId);
    }
  }, [selectedProjectId, selectedProjectDetails, loadProjectDetails]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(e.target as Node)
      ) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // Build list of assignable members for the active project
  const assignableUsers: AssignableUser[] = [];
  if (selectedProjectDetails) {
    if (selectedProjectDetails.createdBy) {
      assignableUsers.push({
        id: selectedProjectDetails.createdById,
        name: selectedProjectDetails.createdBy.fullName || selectedProjectDetails.createdBy.username,
        username: selectedProjectDetails.createdBy.username,
        role: 'Owner',
        avatarUrl: selectedProjectDetails.createdBy.avatarUrl,
      });
    }
    if (selectedProjectDetails.members) {
      selectedProjectDetails.members.forEach((m) => {
        if (m.userId !== selectedProjectDetails.createdById) {
          assignableUsers.push({
            id: m.userId,
            name: m.user.fullName || m.user.username,
            username: m.user.username,
            role: m.role === 'PROJECT_ADMIN' ? 'Admin' : 'Member',
            avatarUrl: m.user.avatarUrl,
          });
        }
      });
    }
  }

  const currentType = TYPE_OPTIONS.find((t) => t.value === type) || TYPE_OPTIONS[0];
  const currentPriority = PRIORITY_OPTIONS.find((p) => p.value === priority) || PRIORITY_OPTIONS[1];
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
  const currentAssignee = assignableUsers.find((u) => u.id === assignedToId);
  const activeProject = allProjects.find((p) => p.id === selectedProjectId) || selectedProjectDetails;

  const handleProjectSelect = (p: Project) => {
    setSelectedProjectId(p.id);
    setSelectedProjectDetails(p);
    setOpenDropdown(null);
    setAssignedToId('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const insertFormat = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('cwm-desc') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = description.substring(start, end);
    const replacement = prefix + (selectedText || '') + suffix;
    const newText = description.substring(0, start) + replacement + description.substring(end);
    if (newText.length <= 1000) {
      setDescription(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + prefix.length,
          start + prefix.length + (selectedText ? selectedText.length : 0)
        );
      }, 0);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setType('TASK');
    setStatus(defaultStatus);
    setPriority('MEDIUM');
    setAssignedToId('');
    setDueDate('');
    setSelectedFiles([]);
    setError(null);
    setOpenDropdown(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!selectedProjectId) {
      setError('Please select a project');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await workApi.createWorkItem(selectedProjectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        status,
        priority,
        assignedToId: assignedToId ? assignedToId : null,
        dueDate: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
      });

      if (res.success && res.data.workItem) {
        onCreated(res.data.workItem);

        if (createAnother) {
          resetForm();
        } else {
          resetForm();
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create work item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const projectMonogram = activeProject?.name
    ? activeProject.name.trim()[0].toUpperCase()
    : 'T';

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container cwm-modal-noscroll"
        onClick={(e) => e.stopPropagation()}
        ref={dropdownContainerRef}
      >
        {/* Header matching reference screenshot with 3D elements */}
        <div className="cwm-header-banner">
          <div className="cwm-header-left">
            <div className="cwm-header-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
            </div>
            <div className="cwm-header-titles">
              <h2 className="cwm-title">Create Work Item</h2>
              <p className="cwm-subtitle">
                Add a new task, bug, or other work to keep your project moving forward.
              </p>
            </div>
          </div>

          {/* Right 3D Illustration & Close Button */}
          <div className="cwm-header-art">
            {/* 3D Clipboard Card Artwork */}
            <div className="cwm-art-sheet">
              <div className="cwm-sheet-check">✓</div>
              <div className="cwm-sheet-line line-1" />
              <div className="cwm-sheet-line line-2" />
              <div className="cwm-sheet-line line-3" />
              <div className="cwm-sheet-dot dot-1" />
              <div className="cwm-sheet-dot dot-2" />
              <div className="cwm-sheet-dot dot-3" />
            </div>

            {/* Floating Badges */}
            <div className="cwm-floating-badge badge-green">
              <span>✓</span>
            </div>
            <div className="cwm-floating-badge badge-yellow">
              <span>💬</span>
            </div>
            <div className="cwm-floating-badge badge-pink">
              <span>📅</span>
            </div>

            {/* Sparkle */}
            <div className="cwm-sparkle">✦</div>
          </div>

          <button
            type="button"
            className="cwm-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {error && <div className="cwm-error-banner">{error}</div>}

        {/* Compact Form Body (Zero scrolling) */}
        <form onSubmit={handleSubmit} className="cwm-form-noscroll">
          <div className="cwm-form-fields">
            {/* Title Field */}
            <div className="cwm-row-group">
              <label htmlFor="cwm-title" className="cwm-field-label">
                Title <span className="cwm-star">*</span>
              </label>
              <div className="cwm-input-container">
                <span className="cwm-leading-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </span>
                <input
                  id="cwm-title"
                  type="text"
                  className="cwm-text-input"
                  placeholder="e.g. Implement OAuth token refresh flow"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Row 1: Type & Priority */}
            <div className="cwm-grid-cols-2">
              {/* Type Dropdown */}
              <div className="cwm-row-group">
                <label className="cwm-field-label">
                  Type <span className="cwm-star">*</span>
                </label>
                <div className="cwm-dropdown-wrapper">
                  <button
                    type="button"
                    className={`cwm-dropdown-button ${openDropdown === 'type' ? 'active' : ''}`}
                    onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
                  >
                    <div className="cwm-btn-left">
                      <span className="cwm-type-lead-icon" style={{ color: currentType.color }}>
                        {currentType.icon}
                      </span>
                      <span className="cwm-btn-text">{currentType.label}</span>
                    </div>
                    <ChevronDownIcon size={15} className={`cwm-chevron ${openDropdown === 'type' ? 'open' : ''}`} />
                  </button>

                  {openDropdown === 'type' && (
                    <div className="cwm-options-menu">
                      {TYPE_OPTIONS.map((opt) => {
                        const isSelected = opt.value === type;
                        return (
                          <div
                            key={opt.value}
                            className={`cwm-option-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              setType(opt.value);
                              setOpenDropdown(null);
                            }}
                          >
                            <div className="cwm-option-left">
                              <span
                                className="cwm-option-badge"
                                style={{ backgroundColor: opt.bg, color: opt.color }}
                              >
                                {opt.icon}
                              </span>
                              <span className="cwm-option-label">{opt.label}</span>
                            </div>
                            {isSelected && (
                              <span className="cwm-option-check">
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

              {/* Priority Dropdown */}
              <div className="cwm-row-group">
                <label className="cwm-field-label">
                  Priority <span className="cwm-star">*</span>
                </label>
                <div className="cwm-dropdown-wrapper">
                  <button
                    type="button"
                    className={`cwm-dropdown-button ${openDropdown === 'priority' ? 'active' : ''}`}
                    onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
                  >
                    <div className="cwm-btn-left">
                      <span className="cwm-priority-lead-icon" style={{ color: currentPriority.color }}>
                        {currentPriority.icon}
                      </span>
                      <span className="cwm-btn-text">{currentPriority.label}</span>
                    </div>
                    <ChevronDownIcon size={15} className={`cwm-chevron ${openDropdown === 'priority' ? 'open' : ''}`} />
                  </button>

                  {openDropdown === 'priority' && (
                    <div className="cwm-options-menu">
                      {PRIORITY_OPTIONS.map((opt) => {
                        const isSelected = opt.value === priority;
                        return (
                          <div
                            key={opt.value}
                            className={`cwm-option-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              setPriority(opt.value);
                              setOpenDropdown(null);
                            }}
                          >
                            <div className="cwm-option-left">
                              <span
                                className="cwm-option-badge"
                                style={{ backgroundColor: opt.bg, color: opt.color }}
                              >
                                {opt.icon}
                              </span>
                              <span className="cwm-option-label">{opt.label}</span>
                            </div>
                            {isSelected && (
                              <span className="cwm-option-check">
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
            </div>

            {/* Row 2: Project & Assignee */}
            <div className="cwm-grid-cols-2">
              {/* Project Dropdown */}
              <div className="cwm-row-group">
                <label className="cwm-field-label">
                  Project <span className="cwm-star">*</span>
                </label>
                <div className="cwm-dropdown-wrapper">
                  <button
                    type="button"
                    className={`cwm-dropdown-button ${openDropdown === 'project' ? 'active' : ''}`}
                    onClick={() => setOpenDropdown(openDropdown === 'project' ? null : 'project')}
                  >
                    <div className="cwm-btn-left">
                      {activeProject?.avatarUrl ? (
                        <img src={activeProject.avatarUrl} alt="" className="cwm-avatar-circle" />
                      ) : (
                        <span className="cwm-monogram-circle" style={{ backgroundColor: '#2563EB' }}>
                          {projectMonogram}
                        </span>
                      )}
                      <span className="cwm-btn-text">
                        {activeProject ? activeProject.name : 'Select Project...'}
                      </span>
                    </div>
                    <ChevronDownIcon size={15} className={`cwm-chevron ${openDropdown === 'project' ? 'open' : ''}`} />
                  </button>

                  {openDropdown === 'project' && (
                    <div className="cwm-options-menu">
                      {allProjects.length === 0 ? (
                        <div className="c-select-empty">No projects found</div>
                      ) : (
                        allProjects.map((p) => {
                          const isSelected = p.id === selectedProjectId;
                          const pMonogram = p.name ? p.name.trim()[0].toUpperCase() : 'P';
                          return (
                            <div
                              key={p.id}
                              className={`cwm-option-item ${isSelected ? 'selected' : ''}`}
                              onClick={() => handleProjectSelect(p)}
                            >
                              <div className="cwm-option-left">
                                {p.avatarUrl ? (
                                  <img src={p.avatarUrl} alt="" className="cwm-option-avatar" />
                                ) : (
                                  <span className="cwm-monogram-circle" style={{ backgroundColor: '#2563EB' }}>
                                    {pMonogram}
                                  </span>
                                )}
                                <span className="cwm-option-label">{p.name}</span>
                              </div>
                              {isSelected && (
                                <span className="cwm-option-check">
                                  <CheckIcon size={14} />
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Assignee Dropdown */}
              <div className="cwm-row-group">
                <label className="cwm-field-label">Assignee</label>
                <div className="cwm-dropdown-wrapper">
                  <button
                    type="button"
                    className={`cwm-dropdown-button ${openDropdown === 'assignee' ? 'active' : ''}`}
                    onClick={() => {
                      if (!selectedProjectId) {
                        setOpenDropdown('project');
                      } else {
                        setOpenDropdown(openDropdown === 'assignee' ? null : 'assignee');
                      }
                    }}
                  >
                    <div className="cwm-btn-left">
                      {currentAssignee ? (
                        currentAssignee.avatarUrl ? (
                          <img
                            src={currentAssignee.avatarUrl}
                            alt=""
                            className="cwm-avatar-circle"
                          />
                        ) : (
                          <span className="cwm-monogram-circle" style={{ backgroundColor: '#475569' }}>
                            {currentAssignee.name.charAt(0).toUpperCase()}
                          </span>
                        )
                      ) : (
                        <span className="cwm-user-icon-box">
                          <UserIcon size={15} />
                        </span>
                      )}
                      <span className="cwm-btn-text">
                        {currentAssignee ? currentAssignee.name : 'Unassigned'}
                      </span>
                    </div>
                    <ChevronDownIcon size={15} className={`cwm-chevron ${openDropdown === 'assignee' ? 'open' : ''}`} />
                  </button>

                  {openDropdown === 'assignee' && (
                    <div className="cwm-options-menu">
                      <div
                        className={`cwm-option-item ${!assignedToId ? 'selected' : ''}`}
                        onClick={() => {
                          setAssignedToId('');
                          setOpenDropdown(null);
                        }}
                      >
                        <div className="cwm-option-left">
                          <span className="cwm-user-icon-box">
                            <UserIcon size={15} />
                          </span>
                          <span className="cwm-option-label">Unassigned</span>
                        </div>
                        {!assignedToId && (
                          <span className="cwm-option-check">
                            <CheckIcon size={14} />
                          </span>
                        )}
                      </div>

                      {assignableUsers.map((u) => {
                        const isSelected = assignedToId === u.id;
                        return (
                          <div
                            key={u.id}
                            className={`cwm-option-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              setAssignedToId(u.id);
                              setOpenDropdown(null);
                            }}
                          >
                            <div className="cwm-option-left">
                              {u.avatarUrl ? (
                                <img src={u.avatarUrl} alt="" className="cwm-option-avatar" />
                              ) : (
                                <span className="cwm-monogram-circle" style={{ backgroundColor: '#475569' }}>
                                  {u.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                              <span className="cwm-option-label">{u.name}</span>
                            </div>
                            <div className="cwm-option-right">
                              <span className={`cwm-role-tag role-${u.role.toLowerCase()}`}>
                                {u.role}
                              </span>
                              {isSelected && (
                                <span className="cwm-option-check">
                                  <CheckIcon size={14} />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 3: Initial Status & Due Date */}
            <div className="cwm-grid-cols-2">
              {/* Initial Status */}
              <div className="cwm-row-group">
                <label className="cwm-field-label">
                  Initial Status <span className="cwm-star">*</span>
                </label>
                <div className="cwm-dropdown-wrapper">
                  <button
                    type="button"
                    className={`cwm-dropdown-button ${openDropdown === 'status' ? 'active' : ''}`}
                    onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                  >
                    <div className="cwm-btn-left">
                      <span className="cwm-status-lead-icon" style={{ color: currentStatus.color }}>
                        {currentStatus.icon}
                      </span>
                      <span className="cwm-btn-text">{currentStatus.label}</span>
                    </div>
                    <ChevronDownIcon size={15} className={`cwm-chevron ${openDropdown === 'status' ? 'open' : ''}`} />
                  </button>

                  {openDropdown === 'status' && (
                    <div className="cwm-options-menu">
                      {STATUS_OPTIONS.map((opt) => {
                        const isSelected = opt.value === status;
                        return (
                          <div
                            key={opt.value}
                            className={`cwm-option-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              setStatus(opt.value);
                              setOpenDropdown(null);
                            }}
                          >
                            <div className="cwm-option-left">
                              <span
                                className="cwm-option-badge"
                                style={{ backgroundColor: opt.bg, color: opt.color }}
                              >
                                {opt.icon}
                              </span>
                              <span className="cwm-option-label">{opt.label}</span>
                            </div>
                            {isSelected && (
                              <span className="cwm-option-check">
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

              {/* Due Date (Optional) */}
              <div className="cwm-row-group">
                <label htmlFor="cwm-duedate" className="cwm-field-label">
                  Due Date (Optional)
                </label>
                <div className="cwm-input-container">
                  <span className="cwm-leading-icon">
                    <CalendarIcon size={15} />
                  </span>
                  <input
                    id="cwm-duedate"
                    type="date"
                    className="cwm-text-input cwm-date-input"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    placeholder="dd-mm-yyyy"
                  />
                </div>
              </div>
            </div>

            {/* Description (Optional) with Markdown Formatting Toolbar */}
            <div className="cwm-row-group">
              <label htmlFor="cwm-desc" className="cwm-field-label">
                Description (Optional)
              </label>
              <div className="cwm-editor-box">
                {/* Top Formatting Action Bar matching screenshot */}
                <div className="cwm-editor-toolbar">
                  <button
                    type="button"
                    className="cwm-tool-btn"
                    onClick={() => insertFormat('**', '**')}
                    title="Bold"
                  >
                    <strong>B</strong>
                  </button>
                  <button
                    type="button"
                    className="cwm-tool-btn"
                    onClick={() => insertFormat('*', '*')}
                    title="Italic"
                  >
                    <em>I</em>
                  </button>
                  <button
                    type="button"
                    className="cwm-tool-btn"
                    onClick={() => insertFormat('[', '](https://)')}
                    title="Link"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="cwm-tool-btn"
                    onClick={() => insertFormat('- ')}
                    title="Bulleted list"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6"></line>
                      <line x1="8" y1="12" x2="21" y2="12"></line>
                      <line x1="8" y1="18" x2="21" y2="18"></line>
                      <line x1="3" y1="6" x2="3.01" y2="6"></line>
                      <line x1="3" y1="12" x2="3.01" y2="12"></line>
                      <line x1="3" y1="18" x2="3.01" y2="18"></line>
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="cwm-tool-btn"
                    onClick={() => insertFormat('1. ')}
                    title="Numbered list"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="10" y1="6" x2="21" y2="6"></line>
                      <line x1="10" y1="12" x2="21" y2="12"></line>
                      <line x1="10" y1="18" x2="21" y2="18"></line>
                      <path d="M4 6h1v4"></path>
                      <path d="M4 10h2"></path>
                      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="cwm-tool-btn"
                    onClick={() => insertFormat('> ')}
                    title="Quote"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path>
                      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path>
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="cwm-tool-btn"
                    onClick={() => insertFormat('`', '`')}
                    title="Code"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6"></polyline>
                      <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                  </button>
                </div>

                {/* Textarea */}
                <textarea
                  id="cwm-desc"
                  className="cwm-editor-textarea"
                  rows={2}
                  maxLength={1000}
                  placeholder="Provide context, acceptance criteria, or reproduction steps..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="cwm-char-limit-count">{description.length}/1000</div>
            </div>

            {/* Attachments Card matching reference screenshot */}
            <div className="cwm-attach-card">
              <div className="cwm-attach-card-left">
                <div className="cwm-attach-icon-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                  </svg>
                </div>
                <div className="cwm-attach-text-group">
                  <span className="cwm-attach-heading">Attachments (Optional)</span>
                  <span className="cwm-attach-caption">
                    Add screenshots, documents, or other files (max 10 MB each)
                  </span>
                </div>
              </div>

              <div className="cwm-attach-card-right">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  multiple
                />
                <button
                  type="button"
                  className="cwm-browse-pill-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span>Browse</span>
                </button>
              </div>
            </div>

            {/* Attached files preview chips in dedicated scrollable tray */}
            {selectedFiles.length > 0 && (
              <div className="cwm-attached-chips-scroll-tray">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="cwm-file-pill-chip">
                    <span className="cwm-chip-name" title={file.name}>{file.name}</span>
                    <span className="cwm-chip-size">
                      {file.size < 1024 * 1024
                        ? `${(file.size / 1024).toFixed(0)} KB`
                        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                    </span>
                    <button
                      type="button"
                      className="cwm-chip-remove"
                      onClick={() => handleRemoveFile(idx)}
                      title="Remove file"
                    >
                      <TrashIcon size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer Bar */}
          <div className="cwm-footer-action-bar">
            <div className="cwm-footer-left-col">
              <Checkbox
                id="cwm-create-another"
                checked={createAnother}
                onChange={(e) => setCreateAnother(e.target.checked)}
                label="Create another after saving"
              />
            </div>

            <div className="cwm-footer-right-col">
              <button
                type="button"
                className="cwm-btn-cancel-pill"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="cwm-btn-create-pill"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="cwm-spinner-circle" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <span className="cwm-plus-icon">+</span>
                    <span>Create Work Item</span>
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
