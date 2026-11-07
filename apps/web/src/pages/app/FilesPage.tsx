import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from '../../router/Router';
import { useWorkspace } from '../../context/WorkspaceContext';
import { projectsApi, type Project } from '../../api/projects.api';
import {
  filesApi,
  type AttachmentDTO,
  type FileCategory,
  type StorageStatsDTO,
} from '../../api/files.api';
import { ProjectWorkspaceHeader } from '../../components/workspace/ProjectWorkspaceHeader';
import { CreateWorkItemModal } from '../../components/workspace/CreateWorkItemModal';
import { WorkItemDetailsModal } from '../../components/workspace/WorkItemDetailsModal';
import { FileViewerModal } from '../../components/files/FileViewerModal';
import { FileUploadModal } from '../../components/files/FileUploadModal';
import { StorageBreakdownModal } from '../../components/files/StorageBreakdownModal';
import { ConnectDriveModal } from '../../components/files/ConnectDriveModal';
import { DeleteFileModal } from '../../components/files/DeleteFileModal';
import { FilesHeaderAtmosphere } from '../../components/common/HeaderAtmosphereArt';
import {
  FolderIcon,
  SearchIcon,
  UploadCloudIcon,
  GridIcon,
  ListIcon,
  FileTextIcon,
  LayersIcon,
  TableIcon,
  CodeIcon,
  DatabaseIcon,
  DownloadIcon,
  TrashIcon,
  MoreVerticalIcon,
  CheckSquareIcon,
  ShieldCheckIcon,
  ImageIcon,
  ChevronRightIcon,
  InfoIcon,
  CircleDotIcon,
  CheckIcon,
  AlertCircleIcon,
  ArrowLeftIcon,
  LockIcon,
  GlobeIcon,
  LinkIcon,
  LightbulbIcon,
} from '../../components/ui/Icons';
import { CustomSelect } from '../../components/ui/CustomSelect';

interface FilesPageProps {
  project?: Project | null;
  hideHeader?: boolean;
}

type SubfolderKey = 'tasks' | 'notes' | 'direct-public' | 'direct-private';

interface FixedSubfolderDef {
  key: SubfolderKey;
  name: string;
  subtitle: string;
  boldDesc: string;
  detailDesc: string;
  emptySubtitle: string;
  description: string;
  color: string;
  bgColor: string;
  icon: (size?: number) => React.ReactNode;
  bannerIcon: (size?: number) => React.ReactNode;
}

const FIXED_SUBFOLDERS: FixedSubfolderDef[] = [
  {
    key: 'tasks',
    name: 'Tasks',
    subtitle: 'Files attached to tasks & work items',
    boldDesc: 'Files attached to tasks and work items.',
    detailDesc: 'Visible to Workspace Owner, Workspace Admins, Project Admins, Task Assignees, and Creators.',
    emptySubtitle: 'Files attached to tasks and work items. Upload or attach files to see them here.',
    description: 'Files attached to tasks and work items. Visible to Workspace Owner, Workspace Admins, Project Admins, Task Assignees, and Creators.',
    color: '#2563EB',
    bgColor: '#EFF6FF',
    icon: (size = 18) => <CheckSquareIcon size={size} />,
    bannerIcon: (size = 16) => <ShieldCheckIcon size={size} />,
  },
  {
    key: 'notes',
    name: 'Notes',
    subtitle: 'Files attached to project notes',
    boldDesc: 'Files attached to project notes.',
    detailDesc: 'Team notes are visible to all project members; private notes are restricted to creators and tagged users.',
    emptySubtitle: 'Files attached to project notes. Upload or attach files to see them here.',
    description: 'Files attached to notes. Team notes are visible to all project members; private notes are restricted to creators and tagged users.',
    color: '#D97706',
    bgColor: '#FEF3C7',
    icon: (size = 18) => <FileTextIcon size={size} />,
    bannerIcon: (size = 16) => <FileTextIcon size={size} />,
  },
  {
    key: 'direct-public',
    name: 'Direct Uploads (Public)',
    subtitle: 'Files uploaded for the team',
    boldDesc: 'Files directly uploaded to the project with public visibility.',
    detailDesc: 'Accessible to all project members.',
    emptySubtitle: 'Files uploaded for the team. Upload files to see them here.',
    description: 'Files directly uploaded to the project with public visibility, accessible to all project members.',
    color: '#16A34A',
    bgColor: '#DCFCE7',
    icon: (size = 18) => <GlobeIcon size={size} />,
    bannerIcon: (size = 16) => <GlobeIcon size={size} />,
  },
  {
    key: 'direct-private',
    name: 'Direct Uploads (Private)',
    subtitle: 'Files uploaded for your eyes only',
    boldDesc: 'Files uploaded directly in private mode.',
    detailDesc: 'Strictly restricted to your eyes only (no admin backdoor).',
    emptySubtitle: 'Files uploaded for your eyes only. Upload files to see them here.',
    description: 'Files uploaded directly in private mode. Strictly restricted to your eyes only (no admin backdoor).',
    color: '#7C3AED',
    bgColor: '#F5F3FF',
    icon: (size = 18) => <LockIcon size={size} />,
    bannerIcon: (size = 16) => <LockIcon size={size} />,
  },
];

export const FilesPage: React.FC<FilesPageProps> = ({
  project: propProject,
  hideHeader = false,
}) => {
  const { path } = useRouter();
  const isProjectScope = path.startsWith('/app/projects/');
  const routeProjectId = isProjectScope ? path.split('/')[3] : undefined;
  const { activeWorkspace } = useWorkspace();
  const activeWsId = activeWorkspace?.id;

  // Project state
  const [project, setProject] = useState<Project | null>(propProject || null);
  const [accessibleProjects, setAccessibleProjects] = useState<Project[]>([]);
  const [selectedGlobalProjectId, setSelectedGlobalProjectId] = useState<string>('all');

  // Multi-level navigation state:
  // 1. Root: activeNavProjectId is null
  // 2. Project: activeNavProjectId is set, activeSubfolderKey is null
  // 3. Subfolder: activeNavProjectId is set, activeSubfolderKey is set
  const [activeNavProjectId, setActiveNavProjectId] = useState<string | null>(null);
  const [activeSubfolderKey, setActiveSubfolderKey] = useState<SubfolderKey | null>(null);

  // Files & filtering state
  const [files, setFiles] = useState<AttachmentDTO[]>([]);
  const [stats, setStats] = useState<StorageStatsDTO | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'originalName' | 'sizeBytes'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [selectedFileForViewer, setSelectedFileForViewer] = useState<AttachmentDTO | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isConnectDriveModalOpen, setIsConnectDriveModalOpen] = useState(false);
  const [isCreateWorkModalOpen, setIsCreateWorkModalOpen] = useState(false);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [selectedWorkItemProject, setSelectedWorkItemProject] = useState<Project | null>(null);
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<AttachmentDTO | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [isDraggingOverPage, setIsDraggingOverPage] = useState(false);

  // Effective project ID (either from route or navigation state)
  const effectiveProjectId = routeProjectId || project?.id || activeNavProjectId;

  const effectiveProject = useMemo(() => {
    if (!effectiveProjectId) return null;
    return accessibleProjects.find((p) => p.id === effectiveProjectId) || (project?.id === effectiveProjectId ? project : null);
  }, [effectiveProjectId, accessibleProjects, project]);

  // Load project metadata if in project scope
  useEffect(() => {
    if (routeProjectId && (!project || project.id !== routeProjectId)) {
      projectsApi.getProjectById(routeProjectId).then((res) => {
        if (res.success && res.data?.project) {
          setProject(res.data.project);
        }
      }).catch(() => { });
    }
  }, [routeProjectId, project]);

  // Load accessible projects for global project picker & folders
  useEffect(() => {
    projectsApi.getUserProjects(activeWsId).then((res) => {
      if (res.success && res.data) {
        setAccessibleProjects(res.data.all || []);
      }
    }).catch(() => { });
  }, [activeWsId]);

  // Load all files
  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const targetProjId = routeProjectId || (effectiveProjectId ? effectiveProjectId : undefined);
      if (targetProjId) {
        const res = await filesApi.getProjectFiles(targetProjId, {
          category: categoryFilter !== 'ALL' ? (categoryFilter as FileCategory) : undefined,
          search: searchQuery.trim() || undefined,
          sortBy,
          sortOrder,
          limit: 100,
        });
        if (res.success) {
          setFiles(res.data.files);
        } else {
          setError('Failed to load project files');
        }
      } else {
        const res = await filesApi.getGlobalFiles({
          projectId: selectedGlobalProjectId !== 'all' ? selectedGlobalProjectId : undefined,
          category: categoryFilter !== 'ALL' ? (categoryFilter as FileCategory) : undefined,
          search: searchQuery.trim() || undefined,
          sortBy,
          sortOrder,
          limit: 100,
        });
        if (res.success) {
          setFiles(res.data.files);
        } else {
          setError('Failed to load files');
        }
      }
    } catch (err: any) {
      let msg = err?.message || 'Error loading files';
      try {
        const parsed = JSON.parse(msg);
        if (Array.isArray(parsed) && parsed[0]?.message) {
          msg = parsed[0].message;
        }
      } catch { }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [routeProjectId, effectiveProjectId, selectedGlobalProjectId, categoryFilter, searchQuery, sortBy, sortOrder]);

  const loadStorageStats = useCallback(async () => {
    try {
      const res = await filesApi.getStorageStats();
      if (res.success) {
        setStats(res.data);
      }
    } catch { }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    loadStorageStats();
  }, [loadStorageStats]);

  // Close menus on outside click
  useEffect(() => {
    const handleWindowClick = () => {
      setActiveMenuFileId(null);
    };
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  // Format helper functions
  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getCategoryTheme = (category: string) => {
    switch (category) {
      case 'IMAGE':
        return { color: '#DB2777', bgColor: '#FCE7F3', label: 'Image', icon: <ImageIcon size={14} /> };
      case 'SPREADSHEET':
        return { color: '#16A34A', bgColor: '#DCFCE7', label: 'Spreadsheet', icon: <TableIcon size={14} /> };
      case 'PRESENTATION':
        return { color: '#D97706', bgColor: '#FEF3C7', label: 'Presentation', icon: <LayersIcon size={14} /> };
      case 'CODE':
        return { color: '#9333EA', bgColor: '#F3E8FF', label: 'Code', icon: <CodeIcon size={14} /> };
      case 'PDF':
        return { color: '#E11D48', bgColor: '#FFE4E6', label: 'PDF', icon: <FileTextIcon size={14} /> };
      default:
        return { color: '#2563EB', bgColor: '#EFF6FF', label: 'Document', icon: <FileTextIcon size={14} /> };
    }
  };

  // Toggle file privacy
  const handleToggleFilePrivacy = async (file: AttachmentDTO) => {
    try {
      const res = await filesApi.updateFileVisibility(file.projectId, file.id, !file.isPrivate);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `File is now ${res.data.file.isPrivate ? 'Private (only you)' : 'Public (project members)'}`,
        });
        loadFiles();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update visibility' });
    }
  };

  // Delete file
  const handleDeleteFile = async (fileId: string) => {
    if (!fileToDelete) return;
    setIsDeletingFile(true);
    try {
      const res = await filesApi.deleteFile(fileToDelete.projectId, fileId);
      if (res.success) {
        setFeedback({ type: 'success', message: `Deleted "${fileToDelete.originalName}"` });
        setFileToDelete(null);
        loadFiles();
        loadStorageStats();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete file' });
    } finally {
      setIsDeletingFile(false);
    }
  };

  // Open task details modal
  const handleOpenWorkItemDetails = async (workItemId: string) => {
    if (project) {
      setSelectedWorkItemId(workItemId);
      setSelectedWorkItemProject(project);
    } else {
      const file = files.find((f) => f.workItem?.id === workItemId);
      if (file && file.project) {
        try {
          const res = await projectsApi.getProjectById(file.projectId);
          if (res.success && res.data.project) {
            setSelectedWorkItemId(workItemId);
            setSelectedWorkItemProject(res.data.project);
          }
        } catch { }
      }
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverPage(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverPage(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverPage(false);
    setIsUploadModalOpen(true);
  };

  // Calculate file counts inside each subfolder for a given project
  const getSubfolderFileCount = (projId: string, subKey: SubfolderKey) => {
    const projFiles = files.filter((f) => f.projectId === projId);
    if (subKey === 'tasks') {
      return projFiles.filter((f) => f.workItemId != null).length;
    }
    if (subKey === 'notes') {
      return projFiles.filter((f) => f.noteId != null).length;
    }
    if (subKey === 'direct-public') {
      return projFiles.filter((f) => !f.workItemId && !f.noteId && !f.isPrivate).length;
    }
    if (subKey === 'direct-private') {
      return projFiles.filter((f) => !f.workItemId && !f.noteId && f.isPrivate).length;
    }
    return 0;
  };

  // Filtered files in subfolder view or search view
  const visibleFiles = useMemo(() => {
    return files.filter((file) => {
      // If a specific subfolder is selected
      if (activeSubfolderKey) {
        if (effectiveProjectId && file.projectId !== effectiveProjectId) return false;
        if (activeSubfolderKey === 'tasks') return file.workItemId != null;
        if (activeSubfolderKey === 'notes') return file.noteId != null;
        if (activeSubfolderKey === 'direct-public') return !file.workItemId && !file.noteId && !file.isPrivate;
        if (activeSubfolderKey === 'direct-private') return !file.workItemId && !file.noteId && file.isPrivate;
      }

      // If at project level (no subfolder selected)
      if (effectiveProjectId) {
        return file.projectId === effectiveProjectId;
      }

      // If at global level
      return true;
    });
  }, [files, activeSubfolderKey, effectiveProjectId]);

  // Current active subfolder metadata
  const currentSubfolder = useMemo(() => {
    if (!activeSubfolderKey) return null;
    return FIXED_SUBFOLDERS.find((f) => f.key === activeSubfolderKey) || null;
  }, [activeSubfolderKey]);

  // Breadcrumb Up navigation
  const handleGoUp = () => {
    if (activeSubfolderKey) {
      setActiveSubfolderKey(null);
    } else if (activeNavProjectId && !routeProjectId) {
      setActiveNavProjectId(null);
    }
  };

  // Render Origin badge on file cards / list rows
  const renderOriginBadge = (file: AttachmentDTO) => {
    if (file.workItem) {
      return (
        <span className="file-origin-pill-tag tag-task" title={`Attached to task: ${file.workItem.title}`}>
          <CheckSquareIcon size={11} /> Task
        </span>
      );
    }
    if (file.note) {
      const isPrivate = file.note.visibility === 'USERS';
      return isPrivate ? (
        <span className="file-origin-pill-tag tag-note-private" title={`Attached to private note: ${file.note.title}`}>
          <LockIcon size={11} /> Note (Private)
        </span>
      ) : (
        <span className="file-origin-pill-tag tag-note" title={`Attached to team note: ${file.note.title}`}>
          <FileTextIcon size={11} /> Note (Team)
        </span>
      );
    }
    if (file.isPrivate) {
      return (
        <span className="file-origin-pill-tag tag-direct-private" title="Direct upload - private to you">
          <LockIcon size={11} /> Direct (Private)
        </span>
      );
    }
    return (
      <span className="file-origin-pill-tag tag-direct-public" title="Direct upload - public to project members">
        <GlobeIcon size={11} /> Direct (Public)
      </span>
    );
  };

  // Render Jump button
  const renderJumpButton = (file: AttachmentDTO) => {
    if (file.workItem?.id) {
      return (
        <button
          type="button"
          className="file-link-jump jump-task"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenWorkItemDetails(file.workItem!.id);
          }}
          title="View Task"
        >
          View Task
        </button>
      );
    }
    return null;
  };

  // Categories list
  const categoryFiltersList: Array<{ id: string; label: string; icon?: React.ReactNode }> = [
    { id: 'ALL', label: 'All' },
    { id: 'DOCUMENT', label: 'Documents', icon: <FileTextIcon size={14} /> },
    { id: 'SPREADSHEET', label: 'Spreadsheets', icon: <TableIcon size={14} /> },
    { id: 'PRESENTATION', label: 'Presentations', icon: <LayersIcon size={14} /> },
    { id: 'IMAGE', label: 'Images', icon: <ImageIcon size={14} /> },
    { id: 'PDF', label: 'PDFs', icon: <FileTextIcon size={14} /> },
    { id: 'CODE', label: 'Code', icon: <CodeIcon size={14} /> },
    { id: 'DATA', label: 'Data', icon: <DatabaseIcon size={14} /> },
    { id: 'ARCHIVE', label: 'Archives', icon: <FolderIcon size={14} /> },
    { id: 'OTHER', label: 'Other', icon: <CircleDotIcon size={14} /> },
  ];

  const usedBytes = stats?.usedBytes || 0;
  const limitBytes = stats?.limitBytes || 200 * 1024 * 1024;
  const usedPercentage = stats ? Math.min(100, Math.max(0, (usedBytes / limitBytes) * 100)) : 0;
  const formattedUsed = formatFileSize(usedBytes);

  return (
    <div
      className="cal-experience-root files-page-experience"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Workspace Header if in project context */}
      {!hideHeader && project && (
        <ProjectWorkspaceHeader
          project={project}
          currentTab="files"
          onOpenCreateWorkModal={() => setIsCreateWorkModalOpen(true)}
        />
      )}

      {/* Main Top Header */}
      {!hideHeader && (
        <div className="cal-page-header files-page-top-header">
          <div className="cal-header-left">
            <div className="cal-header-icon-box files-icon-box">
              <FolderIcon size={26} />
            </div>
            <div className="cal-banner-titles">
              <div className="cal-title-row">
                <h1 className="cal-header-title">
                  {effectiveProject ? `${effectiveProject.name} Files` : 'Files & Storage'}
                </h1>
              </div>
              <p className="cal-header-subtitle">
                Manage team documents, project attachments, and files with structured role-based access.
              </p>
            </div>
          </div>

          <FilesHeaderAtmosphere />

          <div className="cal-header-right" style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="cal-btn-new-event files-btn-upload-primary"
              onClick={() => setIsUploadModalOpen(true)}
            >
              <UploadCloudIcon size={15} />
              <span>Upload Files</span>
            </button>
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`form-feedback-banner ${feedback.type === 'success' ? 'feedback-success' : 'feedback-error'}`}
          style={{ marginBottom: '1rem' }}
        >
          {feedback.type === 'success' ? <CheckIcon size={16} /> : <AlertCircleIcon size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Drag & Drop Highlight Banner */}
      {isDraggingOverPage && (
        <div className="files-drag-overlay-banner">
          <UploadCloudIcon size={28} />
          <span>
            Drop files here to upload{effectiveProject ? ` into "${effectiveProject.name}"` : ' to D-Board'}
          </span>
        </div>
      )}

      {/* 2-Column Main Grid Layout */}
      <div className="cal-main-grid files-main-grid-layout">
        {/* LEFT COLUMN: Main Files & Folders Card */}
        <div className="cal-card-primary files-card-primary">
          {/* Controls Toolbar */}
          <div className="files-controls-toolbar">
            <div className="files-search-input-wrap">
              <SearchIcon size={15} />
              <input
                type="text"
                placeholder="Search files by name or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="files-search-input-field"
              />
            </div>

            <div className="files-filter-dropdowns-group">
              {!routeProjectId && (
                <CustomSelect
                  value={selectedGlobalProjectId}
                  onChange={(val) => {
                    setSelectedGlobalProjectId(val);
                    if (val === 'all') {
                      setActiveNavProjectId(null);
                      setActiveSubfolderKey(null);
                    } else {
                      setActiveNavProjectId(val);
                      setActiveSubfolderKey(null);
                    }
                  }}
                  compact
                  fullWidth={false}
                  options={[
                    {
                      value: 'all',
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

              <CustomSelect
                value={`${sortBy}-${sortOrder}`}
                onChange={(val) => {
                  const [newSort, newOrder] = val.split('-');
                  setSortBy(newSort as any);
                  setSortOrder(newOrder as any);
                }}
                compact
                fullWidth={false}
                options={[
                  { value: 'createdAt-desc', label: 'Date Uploaded' },
                  { value: 'createdAt-asc', label: 'Oldest Uploaded' },
                  { value: 'originalName-asc', label: 'File Name (A-Z)' },
                  { value: 'originalName-desc', label: 'File Name (Z-A)' },
                  { value: 'sizeBytes-desc', label: 'Size (Largest first)' },
                  { value: 'sizeBytes-asc', label: 'Size (Smallest first)' },
                ]}
              />

              <div className="files-view-buttons-cluster">
                <button
                  type="button"
                  className={`files-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                  aria-label="Grid view"
                >
                  <GridIcon size={15} />
                </button>
                <button
                  type="button"
                  className={`files-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List View"
                  aria-label="List view"
                >
                  <ListIcon size={15} />
                </button>
                <button
                  type="button"
                  className={`files-view-btn ${isStorageModalOpen ? 'active' : ''}`}
                  onClick={() => setIsStorageModalOpen(true)}
                  title="Storage Breakdown & File Management"
                  aria-label="Storage info"
                >
                  <InfoIcon size={15} />
                </button>
              </div>

              {hideHeader && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginLeft: 'auto' }}>
                  <button
                    type="button"
                    className="cal-btn-new-event files-btn-upload-primary"
                    onClick={() => setIsUploadModalOpen(true)}
                    style={{
                      borderRadius: '8px',
                      padding: '0.38rem 0.75rem',
                      fontSize: '0.78125rem',
                    }}
                  >
                    <UploadCloudIcon size={14} />
                    <span>Upload Files</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="files-category-pills-row">
            {categoryFiltersList.map((cat) => {
              const isActive = categoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`files-category-pill-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setCategoryFilter(cat.id)}
                >
                  {cat.icon && <span className="cat-pill-icon">{cat.icon}</span>}
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Breadcrumb Navigation Bar */}
          <div className="files-folder-breadcrumbs-bar">
            <div className="folder-breadcrumbs-left">
              {!routeProjectId && (
                <button
                  type="button"
                  className={`folder-breadcrumb-node ${!effectiveProjectId ? 'active' : ''}`}
                  onClick={() => {
                    setActiveNavProjectId(null);
                    setActiveSubfolderKey(null);
                    setSelectedGlobalProjectId('all');
                  }}
                >
                  <FolderIcon size={15} />
                  <span>All Projects</span>
                </button>
              )}

              {effectiveProjectId && (
                <>
                  {!routeProjectId && <ChevronRightIcon size={14} className="folder-crumb-arrow" />}
                  <button
                    type="button"
                    className={`folder-breadcrumb-node ${!activeSubfolderKey ? 'active' : ''}`}
                    onClick={() => setActiveSubfolderKey(null)}
                  >
                    <span className="crumb-color-dot" style={{ backgroundColor: '#16A34A' }} />
                    <span>{effectiveProject?.name || 'Project'}</span>
                  </button>
                </>
              )}

              {activeSubfolderKey && currentSubfolder && (
                <>
                  <ChevronRightIcon size={14} className="folder-crumb-arrow" />
                  <button
                    type="button"
                    className="folder-breadcrumb-node active"
                    onClick={() => { }}
                  >
                    <span className="crumb-color-dot" style={{ backgroundColor: currentSubfolder.color }} />
                    <span>{currentSubfolder.name}</span>
                  </button>
                </>
              )}
            </div>

            <div className="folder-breadcrumbs-right">
              {(activeSubfolderKey || (activeNavProjectId && !routeProjectId)) && (
                <button
                  type="button"
                  className="folder-btn-up"
                  onClick={handleGoUp}
                  title="Go up one folder level"
                >
                  <ArrowLeftIcon size={14} />
                  <span>Up</span>
                </button>
              )}

              <button
                type="button"
                className="folder-btn-up"
                onClick={() => setIsUploadModalOpen(true)}
                title="Upload file"
              >
                <UploadCloudIcon size={14} />
                <span>Upload</span>
              </button>
            </div>
          </div>

          {/* LEVEL 1: ROOT VIEW (Global Scope, No Project Selected) */}
          {!effectiveProjectId && !searchQuery && categoryFilter === 'ALL' && (
            <div className="files-folders-shelf-section">
              <div className="folders-shelf-header">
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Project Folders ({accessibleProjects.length})
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Select a project folder to view categorized subfolders
                </span>
              </div>

              <div className="folders-shelf-grid">
                {accessibleProjects.map((p) => {
                  const projFileCount = files.filter((f) => f.projectId === p.id).length;
                  return (
                    <div
                      key={p.id}
                      className="folder-shelf-tile"
                      onClick={() => {
                        setActiveNavProjectId(p.id);
                        setActiveSubfolderKey(null);
                        setSelectedGlobalProjectId(p.id);
                      }}
                    >
                      <div className="folder-tile-left">
                        {p.avatarUrl ? (
                          <img
                            src={p.avatarUrl}
                            alt={p.name}
                            className="folder-tile-avatar"
                            style={{ width: '2.25rem', height: '2.25rem', borderRadius: '8px', objectFit: 'cover' }}
                          />
                        ) : (
                          <span
                            className="folder-tile-icon-box"
                            style={{ backgroundColor: '#EBF5EC', color: '#16A34A' }}
                          >
                            <FolderIcon size={20} />
                          </span>
                        )}
                        <div className="folder-tile-info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <h4 className="folder-tile-name" title={p.name}>
                              {p.name}
                            </h4>
                            <span className="folder-badge-project">Project</span>
                          </div>
                          <span className="folder-tile-count">
                            {projFileCount} file{projFileCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="folder-tile-actions">
                        <ChevronRightIcon size={16} style={{ color: '#94A3B8' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LEVEL 2: PROJECT VIEW (Project Selected, Showing 4 Fixed Subfolders) */}
          {effectiveProjectId && !activeSubfolderKey && !searchQuery && categoryFilter === 'ALL' && (
            <div className="files-folders-shelf-section">
              <div className="folders-shelf-header">
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Project Subfolders (4)
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Select a folder to view categorized files
                </span>
              </div>

              <div className="subfolders-shelf-grid-2col">
                {FIXED_SUBFOLDERS.map((fld) => {
                  const count = getSubfolderFileCount(effectiveProjectId, fld.key);
                  return (
                    <div
                      key={fld.key}
                      className="folder-shelf-tile"
                      onClick={() => setActiveSubfolderKey(fld.key)}
                    >
                      <div className="folder-tile-left">
                        <span
                          className="folder-tile-icon-box"
                          style={{ backgroundColor: fld.bgColor, color: fld.color }}
                        >
                          {fld.icon(20)}
                        </span>
                        <div className="folder-tile-info">
                          <h4 className="folder-tile-name" title={fld.name}>
                            {fld.name}
                          </h4>
                          <span className="folder-tile-count" style={{ color: '#64748B', fontSize: '0.75rem' }}>
                            {count} file{count !== 1 ? 's' : ''} · {fld.subtitle}
                          </span>
                        </div>
                      </div>

                      <div className="folder-tile-actions">
                        <ChevronRightIcon size={16} style={{ color: '#94A3B8' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LEVEL 3: SUBFOLDER VIEW OR SEARCH/FILTER ACTIVE */}
          {(activeSubfolderKey || searchQuery || categoryFilter !== 'ALL') && (
            <div className="files-content-body-wrap files-content-body-area">
              {/* Guidance Info Banner when inside a fixed subfolder */}
              {currentSubfolder && !searchQuery && categoryFilter === 'ALL' && (
                <div className="folder-category-info-banner">
                  <div className="folder-banner-left">
                    <span
                      className="folder-banner-icon-badge"
                      style={{
                        backgroundColor: currentSubfolder.key === 'tasks' ? '#DBEAFE' : currentSubfolder.bgColor,
                        color: currentSubfolder.key === 'tasks' ? '#2563EB' : currentSubfolder.color,
                      }}
                    >
                      {currentSubfolder.bannerIcon(16)}
                    </span>
                    <span className="folder-banner-text">
                      <strong>{currentSubfolder.boldDesc}</strong> {currentSubfolder.detailDesc}
                    </span>
                  </div>
                  <div className="folder-banner-right" title="Access policy">
                    <InfoIcon size={18} />
                  </div>
                </div>
              )}

              {loading ? (
                <div className="files-loading-state">
                  <div className="files-loading-spinner" />
                  <p>Loading files...</p>
                </div>
              ) : error ? (
                <div className="files-error-state">
                  <AlertCircleIcon size={32} />
                  <h3>Failed to load files</h3>
                  <p>{error}</p>
                  <button type="button" className="cal-btn-retry" onClick={() => loadFiles()}>
                    Retry
                  </button>
                </div>
              ) : visibleFiles.length === 0 ? (
                /* EMPTY STATE INSIDE SUBFOLDER */
                <div className="files-empty-state-card files-empty-state-box">
                  <div className="files-empty-illustration-wrap files-empty-illustration">
                    <div className="files-empty-folder-svg-box files-empty-circle">
                      <svg width="68" height="68" viewBox="0 0 68 68" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* D-Board Editorial Folder Outline */}
                        <path
                          d="M12 24C12 20.6863 14.6863 18 18 18H28L34 24H50C53.3137 24 56 26.6863 56 30V48C56 51.3137 53.3137 54 50 54H18C14.6863 54 12 51.3137 12 48V24Z"
                          stroke="#0F172A"
                          strokeWidth="3.2"
                          strokeLinejoin="round"
                          fill="#FFFFFF"
                        />
                        {/* Accent Plus Sign */}
                        <path d="M51 14V20M48 17H54" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" />
                        {/* Upload Arrow */}
                        <path d="M34 43V31M34 31L28 37M34 31L40 37" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        {/* Base underline */}
                        <path d="M27 45H41" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>

                  <h3 className="files-empty-title">
                    {currentSubfolder ? `“${currentSubfolder.name}” is empty` : 'No files found'}
                  </h3>
                  <p className="files-empty-subtitle">
                    {searchQuery || categoryFilter !== 'ALL'
                      ? 'No files matched your search or category filter.'
                      : currentSubfolder
                        ? currentSubfolder.emptySubtitle
                        : 'Upload documents, spreadsheets, code, or images to get started.'}
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                /* GRID VIEW */
                <div className="files-grid-container">
                  {visibleFiles.map((file) => {
                    const theme = getCategoryTheme(file.category);
                    const isImg = file.mimeType?.startsWith('image/');
                    const ext = file.originalName.split('.').pop()?.toUpperCase() || 'FILE';

                    return (
                      <div
                        key={file.id}
                        className={`file-grid-card ${activeMenuFileId === file.id ? 'is-menu-open' : ''}`}
                        onClick={() => setSelectedFileForViewer(file)}
                      >
                        <div className="file-grid-preview-box">
                          {isImg ? (
                            <img
                              src={filesApi.getFileContentUrl(file.projectId, file.id)}
                              alt={file.originalName}
                              className="file-grid-img-thumb"
                            />
                          ) : (
                            <div
                              className="file-grid-icon-placeholder"
                              style={{ backgroundColor: theme.bgColor, color: theme.color }}
                            >
                              {theme.icon}
                              <span className="file-grid-ext-badge">{ext}</span>
                            </div>
                          )}
                        </div>

                        <div className="file-grid-details">
                          <div className="file-grid-header-row">
                            <h4 className="file-grid-name" title={file.originalName}>
                              {file.originalName}
                            </h4>

                            <button
                              type="button"
                              className="file-card-menu-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuFileId(activeMenuFileId === file.id ? null : file.id);
                              }}
                              aria-label="File actions"
                            >
                              <MoreVerticalIcon size={15} />
                            </button>

                            {activeMenuFileId === file.id && (
                              <div className="file-action-dropdown" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="dropdown-item"
                                  onClick={() => {
                                    setActiveMenuFileId(null);
                                    setSelectedFileForViewer(file);
                                  }}
                                >
                                  <FileTextIcon size={14} /> View File
                                </button>
                                <a
                                  href={filesApi.getFileDownloadUrl(file.projectId, file.id)}
                                  download={file.originalName}
                                  className="dropdown-item"
                                  onClick={() => setActiveMenuFileId(null)}
                                >
                                  <DownloadIcon size={14} /> Download
                                </a>
                                {!file.workItem && !file.note && (
                                  <button
                                    type="button"
                                    className="dropdown-item"
                                    onClick={() => {
                                      setActiveMenuFileId(null);
                                      handleToggleFilePrivacy(file);
                                    }}
                                  >
                                    {file.isPrivate ? (
                                      <>
                                        <GlobeIcon size={14} /> Make Public
                                      </>
                                    ) : (
                                      <>
                                        <LockIcon size={14} /> Make Private
                                      </>
                                    )}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="dropdown-item text-danger"
                                  onClick={() => {
                                    setActiveMenuFileId(null);
                                    setFileToDelete(file);
                                  }}
                                >
                                  <TrashIcon size={14} /> Delete File
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Origin Badge & Jump Action */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginTop: '0.15rem' }}>
                            {renderOriginBadge(file)}
                            {renderJumpButton(file)}
                          </div>

                          <div className="file-grid-meta-row" style={{ marginTop: '0.25rem' }}>
                            <span className="file-grid-size">{formatFileSize(file.sizeBytes)}</span>
                            <span>•</span>
                            <span>{formatDate(file.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* LIST VIEW */
                <div className="files-list-table-container">
                  <table className="files-list-table">
                    <thead>
                      <tr>
                        <th>File Name</th>
                        <th>Origin</th>
                        <th>Project</th>
                        <th>Category</th>
                        <th>Size</th>
                        <th>Uploaded</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleFiles.map((file) => {
                        const theme = getCategoryTheme(file.category);
                        const projName = file.project?.name || accessibleProjects.find((p) => p.id === file.projectId)?.name || 'Project';

                        return (
                          <tr
                            key={file.id}
                            className="files-list-row"
                            onClick={() => setSelectedFileForViewer(file)}
                          >
                            <td>
                              <div className="files-list-name-cell">
                                <span
                                  className="files-list-icon-pill"
                                  style={{ backgroundColor: theme.bgColor, color: theme.color }}
                                >
                                  {theme.icon}
                                </span>
                                <span className="files-list-filename" title={file.originalName}>
                                  {file.originalName}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                {renderOriginBadge(file)}
                                {renderJumpButton(file)}
                              </div>
                            </td>
                            <td>
                              <span className="files-list-project-tag">{projName}</span>
                            </td>
                            <td>
                              <span
                                className="files-list-cat-pill"
                                style={{ backgroundColor: theme.bgColor, color: theme.color }}
                              >
                                {theme.label}
                              </span>
                            </td>
                            <td>
                              <span className="files-list-size">{formatFileSize(file.sizeBytes)}</span>
                            </td>
                            <td>{formatDate(file.createdAt)}</td>
                            <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                              <div className="files-list-row-actions">
                                <button
                                  type="button"
                                  className="files-list-btn-action"
                                  title="Preview"
                                  onClick={() => setSelectedFileForViewer(file)}
                                >
                                  <FileTextIcon size={14} />
                                </button>
                                <a
                                  href={filesApi.getFileDownloadUrl(file.projectId, file.id)}
                                  download={file.originalName}
                                  className="files-list-btn-action"
                                  title="Download"
                                >
                                  <DownloadIcon size={14} />
                                </a>
                                {!file.workItem && !file.note && (
                                  <button
                                    type="button"
                                    className="files-list-btn-action"
                                    title={file.isPrivate ? 'Make Public' : 'Make Private'}
                                    onClick={() => handleToggleFilePrivacy(file)}
                                  >
                                    {file.isPrivate ? <LockIcon size={14} /> : <GlobeIcon size={14} />}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="files-list-btn-action btn-action-delete"
                                  title="Delete"
                                  onClick={() => setFileToDelete(file)}
                                >
                                  <TrashIcon size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: 3 Stacked Cards (Restoring Original Pixel-Perfect Styles) */}
        <div className="cal-sidebar-column files-sidebar-column">
          {/* CARD 1: Storage Quota Card (Click opens Pop-up Storage Modal) */}
          <div
            className="cal-mini-calendar-card files-storage-widget-card"
            onClick={() => setIsStorageModalOpen(true)}
            title="Click to view full Storage Breakdown pop-up modal"
            style={{ cursor: 'pointer' }}
          >
            <div className="files-storage-card-header">
              <div className="files-storage-header-left">
                <span className="files-storage-icon-pill">
                  <DatabaseIcon size={18} />
                </span>
                <span className="files-storage-title">Storage</span>
              </div>
              <ChevronRightIcon size={16} className="files-storage-arrow" />
            </div>

            <div className="files-storage-usage-text">
              <strong>{formattedUsed}</strong> of {formatFileSize(limitBytes)} used
            </div>

            <div className="files-storage-progress-track">
              <div
                className={`files-storage-progress-fill ${usedPercentage > 90 ? 'danger' : usedPercentage > 75 ? 'warning' : 'normal'
                  }`}
                style={{ width: `${Math.max(1, usedPercentage)}%` }}
              />
            </div>
            <div className="files-storage-pct-label">{usedPercentage.toFixed(0)}%</div>
          </div>

          {/* CARD 2: Quick Actions Card */}
          <div className="cal-upcoming-card files-quick-actions-card">
            <h3 className="files-quick-actions-title">Quick Actions</h3>

            <div className="files-quick-actions-list">
              <button
                type="button"
                className="files-quick-action-row"
                onClick={() => setIsUploadModalOpen(true)}
              >
                <div className="action-row-left">
                  <UploadCloudIcon size={16} className="action-row-icon" />
                  <span>Upload Files</span>
                </div>
                <ChevronRightIcon size={14} className="action-row-arrow" />
              </button>

              <button
                type="button"
                className="files-quick-action-row"
                onClick={() => setIsConnectDriveModalOpen(true)}
              >
                <div className="action-row-left">
                  <LinkIcon size={16} className="action-row-icon" />
                  <span>Connect Drive</span>
                </div>
                <ChevronRightIcon size={14} className="action-row-arrow" />
              </button>
            </div>
          </div>

          {/* CARD 3: Tip Card */}
          <div className="files-tip-card">
            <div className="files-tip-header">
              <LightbulbIcon size={18} className="files-tip-bulb-icon" />
              <span className="files-tip-title">Tip</span>
            </div>
            <p className="files-tip-body">
              You can also drag and drop files anywhere on this page to upload.
            </p>
          </div>
        </div>
      </div>

      {/* MODAL 1: Connect Drive Modal */}
      {isConnectDriveModalOpen && (
        <ConnectDriveModal
          isOpen={isConnectDriveModalOpen}
          onClose={() => setIsConnectDriveModalOpen(false)}
          files={files}
          folders={[]}
          projects={accessibleProjects}
        />
      )}

      {/* MODAL 2: Storage Breakdown Modal */}
      {isStorageModalOpen && (
        <StorageBreakdownModal
          isOpen={isStorageModalOpen}
          onClose={() => setIsStorageModalOpen(false)}
          onFilesChanged={() => {
            loadFiles();
            loadStorageStats();
          }}
          onOpenUpload={() => {
            setIsStorageModalOpen(false);
            setIsUploadModalOpen(true);
          }}
        />
      )}

      {/* MODAL 3: File Upload Modal */}
      {isUploadModalOpen && (
        <FileUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUploadSuccess={() => {
            setIsUploadModalOpen(false);
            loadFiles();
            loadStorageStats();
          }}
          projects={accessibleProjects}
          project={effectiveProject}
          activeProjectId={effectiveProjectId || undefined}
          isProjectScope={Boolean(routeProjectId)}
          folders={[]}
          currentFolderId={null}
        />
      )}

      {/* MODAL 4: File Viewer Modal */}
      {selectedFileForViewer && (
        <FileViewerModal
          file={selectedFileForViewer}
          onClose={() => setSelectedFileForViewer(null)}
          onFileDeleted={() => {
            setSelectedFileForViewer(null);
            loadFiles();
            loadStorageStats();
          }}
          onFileUpdated={() => {
            loadFiles();
          }}
          canDelete={true}
          canEdit={true}
          onOpenWorkItem={(wId) => {
            setSelectedFileForViewer(null);
            handleOpenWorkItemDetails(wId);
          }}
        />
      )}

      {/* MODAL 5: Delete File Modal */}
      {fileToDelete && (
        <DeleteFileModal
          isOpen={Boolean(fileToDelete)}
          file={fileToDelete}
          onClose={() => setFileToDelete(null)}
          onConfirmDelete={handleDeleteFile}
          isDeleting={isDeletingFile}
        />
      )}

      {/* MODAL 6: Create Work Item Modal */}
      {isCreateWorkModalOpen && effectiveProject && (
        <CreateWorkItemModal
          isOpen={isCreateWorkModalOpen}
          onClose={() => setIsCreateWorkModalOpen(false)}
          project={effectiveProject}
          onCreated={() => loadFiles()}
        />
      )}

      {/* MODAL 7: Work Item Details Modal */}
      {selectedWorkItemId && selectedWorkItemProject && (
        <WorkItemDetailsModal
          workItemId={selectedWorkItemId}
          project={selectedWorkItemProject}
          onClose={() => {
            setSelectedWorkItemId(null);
            setSelectedWorkItemProject(null);
          }}
          onUpdated={() => loadFiles()}
          onDeleted={() => {
            setSelectedWorkItemId(null);
            setSelectedWorkItemProject(null);
            loadFiles();
          }}
        />
      )}
    </div>
  );
};
