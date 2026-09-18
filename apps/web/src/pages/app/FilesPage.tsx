import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from '../../router/Router';
import { useAuth } from '../../context/AuthContext';
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
import { MoveFileModal } from '../../components/files/MoveFileModal';
import { DeleteFileModal } from '../../components/files/DeleteFileModal';
import {
  CreateFolderModal,
  type FolderItem,
} from '../../components/files/CreateFolderModal';
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
  UsersIcon,
  ImageIcon,
  ChevronRightIcon,
  InfoIcon,
  LinkIcon,
  LightbulbIcon,
  FolderPlusIcon,
  CircleDotIcon,
  CheckIcon,
  AlertCircleIcon,
  ArrowLeftIcon,
} from '../../components/ui/Icons';
import { CustomSelect } from '../../components/ui/CustomSelect';

const DEFAULT_INITIAL_FOLDERS: FolderItem[] = [
  {
    id: 'folder-documents',
    name: 'Documents & Specs',
    projectId: 'all',
    projectName: 'All Projects',
    parentId: null,
    color: '#3B82F6',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'folder-design-assets',
    name: 'Design Assets',
    projectId: 'all',
    projectName: 'All Projects',
    parentId: null,
    color: '#8B5CF6',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'folder-reports',
    name: 'Sprint Reports',
    projectId: 'all',
    projectName: 'All Projects',
    parentId: null,
    color: '#10B981',
    createdAt: new Date().toISOString(),
  },
];

interface FilesPageProps {
  project?: Project | null;
  hideHeader?: boolean;
}

export const FilesPage: React.FC<FilesPageProps> = ({
  project: propProject,
  hideHeader = false,
}) => {
  const { path } = useRouter();
  const isProjectScope = path.startsWith('/app/projects/');
  const projectId = isProjectScope ? path.split('/')[3] : undefined;
  const { user } = useAuth();

  // Project state (if in project context)
  const [project, setProject] = useState<Project | null>(propProject || null);
  const [accessibleProjects, setAccessibleProjects] = useState<Project[]>([]);
  const [selectedGlobalProjectId, setSelectedGlobalProjectId] = useState<string>('all');

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

  // Folder System state
  const foldersStorageKey = `dboard_folders_${user?.id || 'guest'}`;
  const fileFoldersMapKey = `dboard_file_folder_map_${user?.id || 'guest'}`;

  const [folders, setFolders] = useState<FolderItem[]>(() => {
    try {
      const saved = localStorage.getItem(foldersStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_INITIAL_FOLDERS;
  });

  const [fileFolderMap, setFileFolderMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(fileFoldersMapKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [movingFile, setMovingFile] = useState<AttachmentDTO | null>(null);
  const [fileToDelete, setFileToDelete] = useState<AttachmentDTO | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);

  // Save folders to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(foldersStorageKey, JSON.stringify(folders));
    } catch {}
  }, [folders, foldersStorageKey]);

  // Save fileFolderMap to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(fileFoldersMapKey, JSON.stringify(fileFolderMap));
    } catch {}
  }, [fileFolderMap, fileFoldersMapKey]);

  // Modals state
  const [selectedFileForViewer, setSelectedFileForViewer] = useState<AttachmentDTO | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isConnectDriveModalOpen, setIsConnectDriveModalOpen] = useState(false);
  const [isCreateWorkModalOpen, setIsCreateWorkModalOpen] = useState(false);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [selectedWorkItemProject, setSelectedWorkItemProject] = useState<Project | null>(null);

  // Action menu dropdown state
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);
  const [activeMenuFolderId, setActiveMenuFolderId] = useState<string | null>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveMenuFileId(null);
      setActiveMenuFolderId(null);
    };
    if (activeMenuFileId || activeMenuFolderId) {
      document.addEventListener('click', handleGlobalClick);
      return () => document.removeEventListener('click', handleGlobalClick);
    }
  }, [activeMenuFileId, activeMenuFolderId]);

  // Drag-and-drop state
  const [isDraggingOverPage, setIsDraggingOverPage] = useState(false);

  const activeProjectId = projectId || (selectedGlobalProjectId !== 'all' ? selectedGlobalProjectId : undefined);

  // Load project if in workspace context
  useEffect(() => {
    if (projectId) {
      projectsApi
        .getProjectById(projectId)
        .then((res) => {
          if (res.success && res.data.project) {
            setProject(res.data.project);
          }
        })
        .catch(() => {});
    } else {
      projectsApi
        .getUserProjects()
        .then((res) => {
          if (res.success && res.data?.all) {
            setAccessibleProjects(res.data.all);
          }
        })
        .catch(() => {});
    }
  }, [projectId]);

  // Load storage stats
  const loadStorageStats = useCallback(async () => {
    try {
      const res = await filesApi.getStorageStats();
      if (res.success) {
        setStats(res.data);
      }
    } catch {}
  }, []);

  // Load files
  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (projectId) {
        const res = await filesApi.getProjectFiles(projectId, {
          category: categoryFilter,
          search: searchQuery.trim() || undefined,
          sortBy,
          sortOrder,
          limit: 100,
        });
        if (res.success) {
          setFiles(res.data.files);
        }
      } else {
        const res = await filesApi.getGlobalFiles({
          projectId: selectedGlobalProjectId !== 'all' ? selectedGlobalProjectId : undefined,
          category: categoryFilter,
          search: searchQuery.trim() || undefined,
          sortBy,
          sortOrder,
          limit: 100,
        });
        if (res.success) {
          setFiles(res.data.files);
        }
      }
      loadStorageStats();
    } catch (err: any) {
      setError(err.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedGlobalProjectId, categoryFilter, searchQuery, sortBy, sortOrder, loadStorageStats]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Active current folder item or active project folder
  const currentFolder = useMemo(() => {
    if (!currentFolderId) return null;
    if (currentFolderId.startsWith('proj-')) {
      const pId = currentFolderId.replace('proj-', '');
      const foundProj = accessibleProjects.find((p) => p.id === pId) || (project?.id === pId ? project : null);
      if (foundProj) {
        return {
          id: currentFolderId,
          name: foundProj.name,
          projectId: foundProj.id,
          projectName: foundProj.name,
          parentId: null,
          color: '#16A34A',
          isProjectFolder: true,
          project: foundProj,
        };
      }
    }
    return folders.find((f) => f.id === currentFolderId) || null;
  }, [folders, currentFolderId, accessibleProjects, project]);

  // Breadcrumbs path
  const folderBreadcrumbs = useMemo(() => {
    if (!currentFolder) return [];
    if ((currentFolder as any).isProjectFolder) {
      return [currentFolder as any];
    }
    const crumbs: FolderItem[] = [];
    let curr: any = currentFolder;
    while (curr) {
      crumbs.unshift(curr);
      curr = curr.parentId ? folders.find((f) => f.id === curr!.parentId) || null : null;
    }
    return crumbs;
  }, [currentFolder, folders]);

  // Combined Visible Folders (Project Folders + Personal Folders)
  const visibleFolders = useMemo(() => {
    if (currentFolderId) {
      // Inside a project folder or personal subfolder
      return folders.filter((f) => f.parentId === currentFolderId);
    }

    // At Root:
    const projectFolderItems = (!projectId ? accessibleProjects : project ? [project] : []).map((p) => ({
      id: `proj-${p.id}`,
      name: p.name,
      projectId: p.id,
      projectName: p.name,
      parentId: null,
      color: '#16A34A',
      isProjectFolder: true,
      project: p,
      createdAt: p.createdAt || new Date().toISOString(),
    }));

    const personalFolderItems = folders.filter((f) => {
      if (projectId && f.projectId !== projectId && f.projectId !== 'all') return false;
      if (selectedGlobalProjectId !== 'all' && f.projectId !== selectedGlobalProjectId && f.projectId !== 'all') {
        return false;
      }
      return !f.parentId;
    });

    return [...projectFolderItems, ...personalFolderItems];
  }, [folders, currentFolderId, projectId, selectedGlobalProjectId, accessibleProjects, project]);

  // Filtered files in current folder view
  const visibleFiles = useMemo(() => {
    return files.filter((file) => {
      if (currentFolderId) {
        if (currentFolderId.startsWith('proj-')) {
          const pId = currentFolderId.replace('proj-', '');
          return file.projectId === pId;
        }
        return fileFolderMap[file.id] === currentFolderId;
      }
      // If at root and searching or filtered, show all; otherwise show unfiled & all root files
      return true;
    });
  }, [files, currentFolderId, fileFolderMap]);

  // Handle Folder Creation
  const handleCreateFolder = (newFolderData: Omit<FolderItem, 'id' | 'createdAt'>) => {
    const newFolder: FolderItem = {
      ...newFolderData,
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    setFolders((prev) => [newFolder, ...prev]);
    setFeedback({ type: 'success', message: `Folder "${newFolder.name}" created successfully!` });
  };

  // Handle Folder Deletion
  const handleDeleteFolder = (folderId: string, folderName: string) => {
    if (folderId.startsWith('proj-')) {
      alert('Project folders are managed via Project Settings.');
      return;
    }
    if (!window.confirm(`Delete personal folder "${folderName}"? Files inside will be moved to Root.`)) return;
    setFolders((prev) => prev.filter((f) => f.id !== folderId && f.parentId !== folderId));
    setFileFolderMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((fId) => {
        if (next[fId] === folderId) delete next[fId];
      });
      return next;
    });
    if (currentFolderId === folderId) setCurrentFolderId(null);
    setFeedback({ type: 'success', message: `Folder "${folderName}" deleted.` });
  };

  // Move file into a folder
  const handleMoveFileToFolder = (fileId: string, targetFolderId: string | null) => {
    setFileFolderMap((prev) => {
      const next = { ...prev };
      if (!targetFolderId) {
        delete next[fileId];
      } else {
        next[fileId] = targetFolderId;
      }
      return next;
    });
    setMovingFile(null);
    setFeedback({ type: 'success', message: 'File moved successfully!' });
  };

  // Handle Drag and Drop anywhere on the page
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverPage(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOverPage(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverPage(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const targetProjId = activeProjectId || accessibleProjects[0]?.id;
      if (!targetProjId) {
        setFeedback({ type: 'error', message: 'Please select a project before uploading files.' });
        return;
      }
      try {
        const droppedFiles = Array.from(e.dataTransfer.files);
        const res = await filesApi.uploadFiles(targetProjId, droppedFiles);
        if (res.success) {
          // Associate newly uploaded files with current active folder if open
          if (currentFolderId && res.data.files) {
            setFileFolderMap((prev) => {
              const next = { ...prev };
              res.data.files.forEach((f) => {
                next[f.id] = currentFolderId;
              });
              return next;
            });
          }

          setFeedback({
            type: 'success',
            message: `${droppedFiles.length} file(s) uploaded successfully${
              currentFolder ? ` into "${currentFolder.name}"` : ''
            }!`,
          });
          loadFiles();
        }
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'Failed to upload dropped files' });
      }
    }
  };

  const getCategoryIcon = (category: FileCategory) => {
    switch (category) {
      case 'SPREADSHEET':
        return <TableIcon size={18} />;
      case 'DOCUMENT':
      case 'TEXT':
        return <FileTextIcon size={18} />;
      case 'PRESENTATION':
        return <LayersIcon size={18} />;
      case 'CODE':
        return <CodeIcon size={18} />;
      case 'DATA':
        return <DatabaseIcon size={18} />;
      case 'ARCHIVE':
        return <FolderIcon size={18} />;
      case 'IMAGE':
        return <ImageIcon size={18} />;
      case 'PDF':
        return <FileTextIcon size={18} />;
      default:
        return <FileTextIcon size={18} />;
    }
  };

  const getCategoryTheme = (category: FileCategory) => {
    switch (category) {
      case 'SPREADSHEET':
        return { bg: '#DCFCE7', color: '#16A34A', label: 'Spreadsheet' };
      case 'DOCUMENT':
      case 'TEXT':
        return { bg: '#EFF6FF', color: '#2563EB', label: 'Document' };
      case 'PRESENTATION':
        return { bg: '#FEF3C7', color: '#D97706', label: 'Presentation' };
      case 'CODE':
        return { bg: '#F3E8FF', color: '#9333EA', label: 'Code' };
      case 'DATA':
        return { bg: '#E0E7FF', color: '#4F46E5', label: 'Data' };
      case 'ARCHIVE':
        return { bg: '#FEE2E2', color: '#DC2626', label: 'Archive' };
      case 'IMAGE':
        return { bg: '#FCE7F3', color: '#DB2777', label: 'Image' };
      case 'PDF':
        return { bg: '#FFE4E6', color: '#E11D48', label: 'PDF' };
      default:
        return { bg: '#F3F4F6', color: '#4B5563', label: 'Other' };
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
      const kb = bytes / 1024;
      return `${Number.isInteger(kb) ? kb : kb.toFixed(1)} KB`;
    }
    if (bytes < 1024 * 1024 * 1024) {
      const mb = bytes / (1024 * 1024);
      return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
    }
    const gb = bytes / (1024 * 1024 * 1024);
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  };

  const handleOpenWorkItem = async (workItemId: string) => {
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
        } catch {}
      }
    }
  };

  // Categories list matching reference design
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

      {/* Main Top Header matching screenshot */}
      <div className="cal-page-header files-page-top-header">
        <div className="cal-header-left">
          <div className="cal-title-row">
            <span className="cal-header-icon-box files-icon-box">
              <FolderIcon size={24} />
            </span>
            <h1 className="cal-header-title">
              {project ? `${project.name} Files` : 'Files & Storage'}
            </h1>
          </div>
          <p className="cal-header-subtitle">
            Manage team documents, project attachments, and files.
          </p>
        </div>

        {/* Atmosphere Quote & Illustration */}
        <FilesHeaderAtmosphere />

        {/* Right Header Action Buttons */}
        <div className="cal-header-right" style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="cal-btn-new-event files-btn-create-folder"
            onClick={() => setIsCreateFolderModalOpen(true)}
            style={{
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              border: '1px solid #E2E8F0',
              borderRadius: '9999px',
              padding: '0.48rem 0.95rem',
              fontWeight: 600,
              fontSize: '0.8125rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
            }}
          >
            <FolderPlusIcon size={15} />
            <span>New Folder</span>
          </button>

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

      {/* Drag & Drop Highlight Banner */}
      {isDraggingOverPage && (
        <div className="files-drag-overlay-banner">
          <UploadCloudIcon size={28} />
          <span>
            Drop files here to upload{currentFolder ? ` into "${currentFolder.name}"` : ' to D-Board'}
          </span>
        </div>
      )}

      {/* 2-Column Main Grid Layout */}
      <div className="cal-main-grid files-main-grid-layout">
        {/* LEFT COLUMN: Main Files & Folders Card */}
        <div className="cal-card-primary files-card-primary">
          {/* Controls Row 1: Search, Project Filter, Sort, View Mode Switches */}
          <div className="files-controls-toolbar">
            {/* Search Box */}
            <div className="files-search-input-wrap">
              <SearchIcon size={15} />
              <input
                type="text"
                placeholder="Search files by name, content, or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="files-search-input-field"
              />
            </div>

            <div className="files-filter-dropdowns-group">
              {/* Project Filter */}
              {!projectId && (
                <CustomSelect
                  value={selectedGlobalProjectId}
                  onChange={(val) => setSelectedGlobalProjectId(val)}
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

              {/* Sort Dropdown */}
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

              {/* View Switchers */}
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
            </div>
          </div>

          {/* Controls Row 2: Category Filter Horizontal Pills */}
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

          {/* Breadcrumb Folder Navigation Bar */}
          <div className="files-folder-breadcrumbs-bar">
            <div className="folder-breadcrumbs-left">
              <button
                type="button"
                className={`folder-breadcrumb-node ${!currentFolderId ? 'active' : ''}`}
                onClick={() => setCurrentFolderId(null)}
              >
                <FolderIcon size={15} />
                <span>All Files</span>
              </button>

              {folderBreadcrumbs.map((crumb, idx) => {
                const isLast = idx === folderBreadcrumbs.length - 1;
                return (
                  <React.Fragment key={crumb.id}>
                    <ChevronRightIcon size={14} className="folder-crumb-arrow" />
                    <button
                      type="button"
                      className={`folder-breadcrumb-node ${isLast ? 'active' : ''}`}
                      onClick={() => setCurrentFolderId(crumb.id)}
                    >
                      <span className="crumb-color-dot" style={{ backgroundColor: crumb.color }} />
                      <span>{crumb.name}</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            <div className="folder-breadcrumbs-right">
              {currentFolderId && (
                <button
                  type="button"
                  className="folder-btn-up"
                  onClick={() => setCurrentFolderId(currentFolder?.parentId || null)}
                  title="Go up one folder"
                >
                  <ArrowLeftIcon size={14} />
                  <span>Up</span>
                </button>
              )}

              <button
                type="button"
                className="folder-btn-new-sub"
                onClick={() => setIsCreateFolderModalOpen(true)}
              >
                <FolderPlusIcon size={13} />
                <span>{currentFolderId ? 'New Subfolder' : 'New Folder'}</span>
              </button>
            </div>
          </div>

          {/* FOLDERS GRID SECTION */}
          {visibleFolders.length > 0 && !searchQuery && (
            <div className="files-folders-shelf-section">
              <div className="folders-shelf-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {currentFolderId ? 'Subfolders' : 'All Folders'} ({visibleFolders.length})
                </span>
                {!currentFolderId && (
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    Select a folder below to view files
                  </span>
                )}
              </div>
              <div className="folders-shelf-grid">
                {visibleFolders.map((fld: any) => {
                  const isProj = Boolean(fld.isProjectFolder);
                  const itemsInside = isProj
                    ? files.filter((f) => f.projectId === fld.projectId).length
                    : files.filter((f) => fileFolderMap[f.id] === fld.id).length;

                  return (
                    <div
                      key={fld.id}
                      className={`folder-shelf-tile ${activeMenuFolderId === fld.id ? 'is-menu-open' : ''}`}
                      onClick={() => setCurrentFolderId(fld.id)}
                    >
                      <div className="folder-tile-left">
                        {isProj && fld.project?.avatarUrl ? (
                          <img
                            src={fld.project.avatarUrl}
                            alt={fld.name}
                            className="folder-tile-avatar"
                            style={{ width: '2.25rem', height: '2.25rem', borderRadius: '8px', objectFit: 'cover' }}
                          />
                        ) : (
                          <span
                            className="folder-tile-icon-box"
                            style={{
                              backgroundColor: isProj ? '#EBF5EC' : `${fld.color}18`,
                              color: isProj ? '#16A34A' : fld.color,
                            }}
                          >
                            <FolderIcon size={20} />
                          </span>
                        )}
                        <div className="folder-tile-info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <h4 className="folder-tile-name" title={fld.name}>
                              {fld.name}
                            </h4>
                            {isProj && <span className="folder-badge-project">Project</span>}
                          </div>
                          <span className="folder-tile-count">
                            {itemsInside} file{itemsInside !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="folder-tile-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="folder-tile-menu-btn"
                          onClick={() => setActiveMenuFolderId(activeMenuFolderId === fld.id ? null : fld.id)}
                          aria-label="Folder actions"
                        >
                          <MoreVerticalIcon size={15} />
                        </button>

                        {activeMenuFolderId === fld.id && (
                          <div className="file-action-dropdown">
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => {
                                setActiveMenuFolderId(null);
                                setCurrentFolderId(fld.id);
                              }}
                            >
                              <FolderIcon size={14} /> Open Folder
                            </button>
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => {
                                setActiveMenuFolderId(null);
                                setCurrentFolderId(fld.id);
                                setIsUploadModalOpen(true);
                              }}
                            >
                              <UploadCloudIcon size={14} /> Upload Here
                            </button>
                            {!isProj && (
                              <button
                                type="button"
                                className="dropdown-item text-danger"
                                onClick={() => {
                                  setActiveMenuFolderId(null);
                                  handleDeleteFolder(fld.id, fld.name);
                                }}
                              >
                                <TrashIcon size={14} /> Delete Folder
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MAIN FILES CONTENT AREA (Only shown when inside a folder, or searching, or filtering) */}
          {(currentFolderId || searchQuery || categoryFilter !== 'ALL') && (
            <div className="files-content-body-area">
              {loading ? (
                <div className="files-loading-state">
                  <div className="files-loading-spinner" />
                  <p>Loading files...</p>
                </div>
              ) : error ? (
                <div className="files-error-state">
                  <p>{error}</p>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadFiles()}>
                    Retry
                  </button>
                </div>
              ) : visibleFiles.length === 0 ? (
                /* EMPTY STATE INSIDE SELECTED FOLDER */
                <div className="files-empty-state-box">
                  <div className="files-empty-illustration">
                    <div className="files-empty-circle">
                      <svg width="68" height="68" viewBox="0 0 96 96" fill="none">
                        {/* Cloud background */}
                        <path
                          d="M28 54C22 54 18 49 18 43C18 37.5 22.5 33 28 33C29 33 30 33.2 31 33.6C33.5 26.8 40.2 22 48 22C57.5 22 65.4 28.8 67 38C72 39 76 43.5 76 49C76 55 71 60 65 60L28 60C25.8 60 28 54 28 54Z"
                          fill="#F1F5F9"
                        />
                        {/* Document sheet */}
                        <rect x="42" y="24" width="26" height="34" rx="4" fill="#E2E8F0" />
                        <line x1="48" y1="32" x2="62" y2="32" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
                        <line x1="48" y1="38" x2="58" y2="38" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
                        <line x1="48" y1="44" x2="54" y2="44" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
                        {/* Main Folder outline */}
                        <path
                          d="M20 38H34L40 45H68C70.2 45 72 46.8 72 49V64C72 66.2 70.2 68 68 68H20C17.8 68 16 66.2 16 64V42C16 39.8 17.8 38 20 38Z"
                          stroke="#0F172A"
                          strokeWidth="3.5"
                          strokeLinejoin="round"
                        />
                        {/* Little sparkle */}
                        <path d="M66 18V24M63 21H69" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>

                  <h3 className="files-empty-title">
                    {currentFolder ? `"${currentFolder.name}" is empty` : 'No files found'}
                  </h3>
                  <p className="files-empty-subtitle">
                    {searchQuery || categoryFilter !== 'ALL'
                      ? 'No files matched your search or category filter.'
                      : currentFolder
                      ? `Upload documents, spreadsheets, or code directly into "${currentFolder.name}".`
                      : 'Upload documents, spreadsheets, code, or images to get started.'}
                  </p>

                  <button
                    type="button"
                    className="files-btn-upload-empty"
                    onClick={() => setIsUploadModalOpen(true)}
                  >
                    <UploadCloudIcon size={16} />
                    <span>Upload Files Here</span>
                  </button>
                </div>
              ) : viewMode === 'grid' ? (
              /* GRID VIEW */
              <div className="files-grid-container">
                {visibleFiles.map((file) => {
                  const theme = getCategoryTheme(file.category);
                  const assignedFolder = folders.find((f) => f.id === fileFolderMap[file.id]);

                  return (
                    <div
                      key={file.id}
                      className={`file-grid-card ${activeMenuFileId === file.id ? 'is-menu-open' : ''}`}
                      onClick={() => setSelectedFileForViewer(file)}
                    >
                      <div className="file-grid-preview-box">
                        {file.category === 'IMAGE' ? (
                          <img
                            src={filesApi.getFileContentUrl(file.projectId, file.id)}
                            alt={file.originalName}
                            className="file-grid-img-thumb"
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className="file-grid-icon-placeholder"
                            style={{ backgroundColor: theme.bg, color: theme.color }}
                          >
                            {getCategoryIcon(file.category)}
                            <span className="file-grid-ext-badge">{file.extension.toUpperCase()}</span>
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
                            aria-label="Actions"
                          >
                            <MoreVerticalIcon size={16} />
                          </button>

                          {/* Dropdown Action Menu */}
                          {activeMenuFileId === file.id && (
                            <div
                              className="file-action-dropdown"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => {
                                  setActiveMenuFileId(null);
                                  setSelectedFileForViewer(file);
                                }}
                              >
                                <FileTextIcon size={14} /> Open in Viewer
                              </button>
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => {
                                  setActiveMenuFileId(null);
                                  setMovingFile(file);
                                }}
                              >
                                <FolderIcon size={14} /> Move to Folder
                              </button>
                              <a
                                href={filesApi.getFileDownloadUrl(file.projectId, file.id)}
                                download={file.originalName}
                                className="dropdown-item"
                                onClick={() => setActiveMenuFileId(null)}
                              >
                                <DownloadIcon size={14} /> Download
                              </a>
                              {(file.uploadedById === user?.id || project?.userRole === 'PROJECT_ADMIN') && (
                                <button
                                  type="button"
                                  className="dropdown-item text-danger"
                                  onClick={() => {
                                    setActiveMenuFileId(null);
                                    setFileToDelete(file);
                                  }}
                                >
                                  <TrashIcon size={14} /> Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="file-grid-meta-row">
                          <span className="file-grid-size">{formatFileSize(file.sizeBytes)}</span>
                          <span className="file-dot-sep">·</span>
                          <span className="file-grid-project">{file.project?.name || 'D-Board'}</span>
                          {assignedFolder && (
                            <>
                              <span className="file-dot-sep">·</span>
                              <span className="file-grid-folder-tag" style={{ color: assignedFolder.color }}>
                                📁 {assignedFolder.name}
                              </span>
                            </>
                          )}
                        </div>

                        {/* File Origin Tag */}
                        <div className="file-card-origin-section">
                          {file.note ? (
                            <div className="file-card-origin-tag origin-team-note">
                              <UsersIcon size={12} />
                              <span className="origin-name">Note: {file.note.title}</span>
                            </div>
                          ) : file.workItem ? (
                            <div
                              className="file-card-origin-tag origin-workitem"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenWorkItem(file.workItem!.id);
                              }}
                            >
                              <CheckSquareIcon size={12} />
                              <span className="origin-name">Work: {file.workItem.title}</span>
                            </div>
                          ) : (
                            <div className="file-card-origin-tag origin-direct">
                              <UploadCloudIcon size={12} />
                              <span className="origin-type-label">Direct Upload</span>
                            </div>
                          )}
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
                      <th>Name</th>
                      <th>Project / Folder</th>
                      <th>Category</th>
                      <th>Size</th>
                      <th>Uploaded Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFiles.map((file) => {
                      const theme = getCategoryTheme(file.category);
                      const assignedFolder = folders.find((f) => f.id === fileFolderMap[file.id]);

                      return (
                        <tr
                          key={file.id}
                          className="files-list-row"
                          onClick={() => setSelectedFileForViewer(file)}
                        >
                          <td className="files-list-cell-name">
                            <div className="files-list-name-box">
                              <span
                                className="files-list-icon-pill"
                                style={{ backgroundColor: theme.bg, color: theme.color }}
                              >
                                {getCategoryIcon(file.category)}
                              </span>
                              <span className="files-list-file-name" title={file.originalName}>
                                {file.originalName}
                              </span>
                            </div>
                          </td>
                          <td className="files-list-cell-project">
                            <span>{file.project?.name || 'D-Board'}</span>
                            {assignedFolder && (
                              <span className="files-list-folder-badge" style={{ color: assignedFolder.color }}>
                                · 📁 {assignedFolder.name}
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className="files-list-category-badge"
                              style={{ backgroundColor: theme.bg, color: theme.color }}
                            >
                              {theme.label}
                            </span>
                          </td>
                          <td className="files-list-cell-size">{formatFileSize(file.sizeBytes)}</td>
                          <td className="files-list-cell-date">
                            {new Date(file.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="files-list-cell-actions" onClick={(e) => e.stopPropagation()}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '0.35rem',
                              }}
                            >
                              <a
                                href={filesApi.getFileDownloadUrl(file.projectId, file.id)}
                                download={file.originalName}
                                className="files-list-btn-action"
                                title="Download"
                                target="_blank"
                                rel="noreferrer"
                              >
                                <DownloadIcon size={14} />
                              </a>
                              <button
                                type="button"
                                className="files-list-btn-action"
                                title="Move to folder"
                                onClick={() => setMovingFile(file)}
                              >
                                <FolderIcon size={14} />
                              </button>
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

        {/* RIGHT COLUMN: 3 Stacked Cards matching screenshot */}
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
                className={`files-storage-progress-fill ${
                  usedPercentage > 90 ? 'danger' : usedPercentage > 75 ? 'warning' : 'normal'
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
                onClick={() => setIsCreateFolderModalOpen(true)}
              >
                <div className="action-row-left">
                  <FolderPlusIcon size={16} className="action-row-icon" />
                  <span>Create Folder</span>
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

          {/* CARD 3: Tip Card matching screenshot */}
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

      {/* MODAL 1: Storage Breakdown & File Management Modal (Matching Screenshot) */}
      {isStorageModalOpen && (
        <StorageBreakdownModal
          isOpen={isStorageModalOpen}
          onClose={() => setIsStorageModalOpen(false)}
          onFilesChanged={() => {
            loadFiles();
            loadStorageStats();
          }}
          onOpenUpload={() => setIsUploadModalOpen(true)}
        />
      )}

      {/* MODAL 2: Create Folder Modal */}
      {isCreateFolderModalOpen && (
        <CreateFolderModal
          isOpen={isCreateFolderModalOpen}
          onClose={() => setIsCreateFolderModalOpen(false)}
          onCreateFolder={handleCreateFolder}
          projects={accessibleProjects}
          activeProjectId={activeProjectId}
          currentFolderId={currentFolderId}
          existingFolders={folders}
        />
      )}

      {/* MODAL 3: Connect Google Drive Modal */}
      {isConnectDriveModalOpen && (
        <ConnectDriveModal
          isOpen={isConnectDriveModalOpen}
          onClose={() => setIsConnectDriveModalOpen(false)}
          files={files}
          folders={folders}
          projects={accessibleProjects}
        />
      )}

      {/* MODAL 4: Move File to Folder Dialog */}
      {movingFile && (
        <MoveFileModal
          isOpen={!!movingFile}
          file={movingFile}
          onClose={() => setMovingFile(null)}
          onMove={(fileId, destFolderId) => handleMoveFileToFolder(fileId, destFolderId)}
          folders={folders}
          projects={accessibleProjects}
          currentFolderId={currentFolderId}
        />
      )}

      {/* MODAL: Delete File Confirmation Dialog */}
      {fileToDelete && (
        <DeleteFileModal
          isOpen={!!fileToDelete}
          file={fileToDelete}
          onClose={() => setFileToDelete(null)}
          isDeleting={isDeletingFile}
          onConfirmDelete={async (fileId) => {
            if (!fileToDelete) return;
            try {
              setIsDeletingFile(true);
              await filesApi.deleteFile(fileToDelete.projectId, fileId);
              setFeedback({ type: 'success', message: `Deleted "${fileToDelete.originalName}"` });
              setFileToDelete(null);
              loadFiles();
              loadStorageStats();
            } catch (err: any) {
              setFeedback({ type: 'error', message: err.message || 'Failed to delete file' });
            } finally {
              setIsDeletingFile(false);
            }
          }}
        />
      )}

      {/* MODAL 5: In-Platform File Viewer */}
      {selectedFileForViewer && (
        <FileViewerModal
          file={selectedFileForViewer}
          onClose={() => setSelectedFileForViewer(null)}
          onFileDeleted={() => {
            setSelectedFileForViewer(null);
            loadFiles();
          }}
          onFileUpdated={() => loadFiles()}
          canDelete={selectedFileForViewer.uploadedById === user?.id || project?.userRole === 'PROJECT_ADMIN'}
          onOpenWorkItem={(id) => handleOpenWorkItem(id)}
        />
      )}

      {/* MODAL 6: File Upload Modal */}
      {isUploadModalOpen && (
        <FileUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUploadSuccess={(createdFiles, destFolderId) => {
            setIsUploadModalOpen(false);
            if (destFolderId && createdFiles && createdFiles.length > 0) {
              setFileFolderMap((prev) => {
                const next = { ...prev };
                createdFiles.forEach((f: any) => {
                  if (f.id) next[f.id] = destFolderId;
                });
                return next;
              });
            }
            setFeedback({ type: 'success', message: 'Files uploaded successfully!' });
            loadFiles();
          }}
          projects={accessibleProjects}
          activeProjectId={activeProjectId}
          folders={folders}
          currentFolderId={currentFolderId}
        />
      )}

      {/* MODAL 7: Create Work Item */}
      {isCreateWorkModalOpen && project && (
        <CreateWorkItemModal
          isOpen={isCreateWorkModalOpen}
          onClose={() => setIsCreateWorkModalOpen(false)}
          onCreated={() => {
            setIsCreateWorkModalOpen(false);
            loadFiles();
          }}
          project={project}
        />
      )}

      {/* MODAL 8: Work Item Details */}
      {selectedWorkItemId && selectedWorkItemProject && (
        <WorkItemDetailsModal
          project={selectedWorkItemProject}
          workItemId={selectedWorkItemId}
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
