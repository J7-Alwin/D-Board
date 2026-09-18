import React, { useState, useEffect, useMemo } from 'react';
import {
  filesApi,
  type AttachmentDTO,
  type StorageStatsDTO,
} from '../../api/files.api';
import {
  CloseIcon,
  DatabaseIcon,
  TrashIcon,
  SearchIcon,
  FileTextIcon,
  ImageIcon,
  TableIcon,
  LayersIcon,
  CodeIcon,
  DownloadIcon,
  CheckIcon,
  GridIcon,
  ListIcon,
} from '../ui/Icons';
import { CustomSelect } from '../ui/CustomSelect';

interface StorageBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesChanged?: () => void;
  onOpenUpload?: () => void;
}

export const StorageBreakdownModal: React.FC<StorageBreakdownModalProps> = ({
  isOpen,
  onClose,
  onFilesChanged,
}) => {
  const [stats, setStats] = useState<StorageStatsDTO | null>(null);
  const [allFiles, setAllFiles] = useState<AttachmentDTO[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, filesRes] = await Promise.all([
        filesApi.getStorageStats(),
        filesApi.getGlobalFiles({ limit: 100, sortBy: 'sizeBytes', sortOrder: 'desc' }),
      ]);
      if (statsRes.success) {
        setStats(statsRes.data);
      }
      if (filesRes.success) {
        const sorted = [...filesRes.data.files].sort((a, b) => b.sizeBytes - a.sizeBytes);
        setAllFiles(sorted);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load storage data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      setSelectedFileIds(new Set());
      loadData();
    }
  }, [isOpen]);

  const formatBytes = (bytes: number) => {
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

  const filteredFiles = useMemo(() => {
    return allFiles.filter((f) => {
      if (typeFilter !== 'ALL' && f.category !== typeFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        f.originalName.toLowerCase().includes(q) ||
        (f.project?.name && f.project.name.toLowerCase().includes(q)) ||
        f.category.toLowerCase().includes(q)
      );
    });
  }, [allFiles, searchQuery, typeFilter]);

  const toggleSelectAll = () => {
    if (selectedFileIds.size === filteredFiles.length && filteredFiles.length > 0) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  const toggleSelectFile = (id: string) => {
    const next = new Set(selectedFileIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedFileIds(next);
  };

  const handleClearSelection = () => {
    setSelectedFileIds(new Set());
  };

  const handleDeleteSingleFile = async (file: AttachmentDTO) => {
    if (!window.confirm(`Delete "${file.originalName}" to free storage space?`)) return;
    try {
      const res = await filesApi.deleteFile(file.projectId, file.id);
      if (res.success) {
        setFeedback({ type: 'success', message: `Deleted "${file.originalName}"` });
        setSelectedFileIds((prev) => {
          const next = new Set(prev);
          next.delete(file.id);
          return next;
        });
        loadData();
        if (onFilesChanged) onFilesChanged();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete file' });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFileIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedFileIds.size} selected file(s)?`)) return;

    setIsDeletingBulk(true);
    setFeedback(null);
    let deletedCount = 0;

    for (const fileId of Array.from(selectedFileIds)) {
      const file = allFiles.find((f) => f.id === fileId);
      if (file) {
        try {
          await filesApi.deleteFile(file.projectId, file.id);
          deletedCount++;
        } catch {}
      }
    }

    setIsDeletingBulk(false);
    setSelectedFileIds(new Set());
    setFeedback({ type: 'success', message: `Successfully deleted ${deletedCount} file(s) to free storage space.` });
    loadData();
    if (onFilesChanged) onFilesChanged();
  };

  const getTypeTheme = (cat: string) => {
    switch (cat) {
      case 'IMAGE':
        return { label: 'Image', color: '#DB2777', bg: '#FCE7F3', iconBg: '#FCE7F3', iconColor: '#DB2777' };
      case 'CODE':
        return { label: 'Code', color: '#9333EA', bg: '#F3E8FF', iconBg: '#F3E8FF', iconColor: '#9333EA' };
      case 'DOCUMENT':
      case 'TEXT':
        return { label: 'Document', color: '#2563EB', bg: '#EFF6FF', iconBg: '#EFF6FF', iconColor: '#2563EB' };
      case 'SPREADSHEET':
        return { label: 'Spreadsheet', color: '#16A34A', bg: '#DCFCE7', iconBg: '#DCFCE7', iconColor: '#16A34A' };
      case 'PRESENTATION':
        return { label: 'Presentation', color: '#D97706', bg: '#FEF3C7', iconBg: '#FEF3C7', iconColor: '#D97706' };
      case 'PDF':
        return { label: 'PDF', color: '#E11D48', bg: '#FFE4E6', iconBg: '#FFE4E6', iconColor: '#E11D48' };
      default:
        return { label: 'Other', color: '#4B5563', bg: '#F3F4F6', iconBg: '#F3F4F6', iconColor: '#4B5563' };
    }
  };

  const getFileCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'IMAGE':
        return <ImageIcon size={15} />;
      case 'CODE':
        return <CodeIcon size={15} />;
      case 'SPREADSHEET':
        return <TableIcon size={15} />;
      case 'PRESENTATION':
        return <LayersIcon size={15} />;
      default:
        return <FileTextIcon size={15} />;
    }
  };

  if (!isOpen) return null;

  const usedBytes = stats?.usedBytes || 0;
  const limitBytes = stats?.limitBytes || 200 * 1024 * 1024;
  const usedPercentage = Math.min(100, Math.max(0, (usedBytes / limitBytes) * 100));
  const formattedUsed = formatBytes(usedBytes);

  const selectedBytes = allFiles
    .filter((f) => selectedFileIds.has(f.id))
    .reduce((acc, f) => acc + f.sizeBytes, 0);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container storage-modal-luxury-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching screenshot */}
        <div className="sbm-header">
          <div className="sbm-header-left">
            <div className="sbm-logo-box">
              <DatabaseIcon size={24} />
            </div>
            <div className="sbm-header-titles">
              <h2 className="sbm-title">Storage Breakdown & Management</h2>
              <p className="sbm-subtitle">
                Manage your project files and storage usage. You have {formatBytes(limitBytes)} of storage per user.
              </p>
            </div>
          </div>

          {/* Right Header Atmosphere 3D Illustration */}
          <div className="sbm-header-art">
            {/* Floating Image Icon */}
            <div className="sbm-art-pill art-green">
              <ImageIcon size={14} />
            </div>
            {/* 3D Stack of Disks */}
            <div className="sbm-art-disk-stack">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <ellipse cx="24" cy="12" rx="16" ry="6" fill="#EDE9FE" stroke="#C4B5FD" strokeWidth="1.5" />
                <path d="M8 12v8c0 3.3 7.2 6 16 6s16-2.7 16-6v-8" fill="#F5F3FF" stroke="#C4B5FD" strokeWidth="1.5" />
                <path d="M8 20v8c0 3.3 7.2 6 16 6s16-2.7 16-6v-8" fill="#EDE9FE" stroke="#C4B5FD" strokeWidth="1.5" />
                <path d="M8 28v8c0 3.3 7.2 6 16 6s16-2.7 16-6v-8" fill="#DDD6FE" stroke="#C4B5FD" strokeWidth="1.5" />
              </svg>
            </div>
            {/* Floating Code Icon */}
            <div className="sbm-art-pill art-purple">
              <CodeIcon size={14} />
            </div>
            {/* Floating Doc Icon */}
            <div className="sbm-art-pill art-blue">
              <FileTextIcon size={14} />
            </div>
          </div>

          <button
            type="button"
            className="sbm-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`sbm-alert-banner ${feedback.type === 'success' ? 'is-success' : 'is-error'}`}>
            <CheckIcon size={16} />
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="sbm-body">
          {/* Top Storage Metric Card matching screenshot */}
          <div className="sbm-storage-metric-card">
            {/* Left: Storage Used progress */}
            <div className="sbm-metric-left">
              <span className="sbm-metric-label">Storage Used</span>
              <div className="sbm-metric-value-row">
                <span className="sbm-metric-main-val">
                  <strong>{formattedUsed}</strong> of {formatBytes(limitBytes)}
                </span>
                <span className="sbm-used-badge">
                  {usedPercentage.toFixed(1)}% Used
                </span>
              </div>
              <div className="sbm-progress-bar-track">
                <div
                  className="sbm-progress-bar-fill"
                  style={{ width: `${Math.max(2, usedPercentage)}%` }}
                >
                  <span className="sbm-progress-dot" />
                </div>
              </div>
            </div>

            {/* Right: Total Quota & Total Files */}
            <div className="sbm-metric-right">
              <div className="sbm-stat-item">
                <div className="sbm-stat-icon-wrap">
                  <DatabaseIcon size={20} />
                </div>
                <div className="sbm-stat-text">
                  <span className="sbm-stat-val">{formatBytes(limitBytes)}</span>
                  <span className="sbm-stat-sub">Total Quota</span>
                </div>
              </div>

              <div className="sbm-stat-divider" />

              <div className="sbm-stat-item">
                <div className="sbm-stat-icon-wrap">
                  <FileTextIcon size={20} />
                </div>
                <div className="sbm-stat-text">
                  <span className="sbm-stat-val">{stats?.totalFiles ?? allFiles.length}</span>
                  <span className="sbm-stat-sub">Total Files</span>
                </div>
              </div>
            </div>
          </div>

          {/* Toolbar Row matching screenshot */}
          <div className="sbm-toolbar-row">
            <div className="sbm-toolbar-left">
              <span className="sbm-all-files-title">
                All Files ({filteredFiles.length})
              </span>
              <span className="sbm-sort-subtitle">
                · Sorted by largest first ⇅
              </span>
            </div>

            <div className="sbm-toolbar-right">
              {/* Search Box */}
              <div className="sbm-search-wrap">
                <SearchIcon size={14} className="sbm-search-icon" />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="sbm-search-input"
                />
              </div>

              {/* Type Filter Select */}
              <div style={{ width: '8.5rem' }}>
                <CustomSelect
                  value={typeFilter}
                  onChange={(val) => setTypeFilter(val)}
                  compact
                  options={[
                    { value: 'ALL', label: 'All Types' },
                    { value: 'IMAGE', label: 'Images' },
                    { value: 'DOCUMENT', label: 'Documents' },
                    { value: 'SPREADSHEET', label: 'Spreadsheets' },
                    { value: 'CODE', label: 'Code' },
                    { value: 'PDF', label: 'PDFs' },
                  ]}
                />
              </div>

              {/* View Mode cluster */}
              <div className="sbm-view-switchers">
                <button
                  type="button"
                  className={`sbm-view-btn ${viewMode === 'list' ? 'is-active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List View"
                >
                  <ListIcon size={15} />
                </button>
                <button
                  type="button"
                  className={`sbm-view-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                >
                  <GridIcon size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Multi-Select Action Banner matching screenshot */}
          {selectedFileIds.size > 0 && (
            <div className="sbm-bulk-bar">
              <div className="sbm-bulk-left">
                <div
                  className="sbm-checkbox is-checked"
                  onClick={toggleSelectAll}
                >
                  <CheckIcon size={12} />
                </div>
                <span className="sbm-selected-label">
                  {selectedFileIds.size} selected
                </span>
                <button
                  type="button"
                  className="sbm-bulk-delete-btn"
                  onClick={handleDeleteSelected}
                  disabled={isDeletingBulk}
                >
                  <TrashIcon size={14} />
                  <span>Delete Selected ({selectedFileIds.size})</span>
                </button>
              </div>

              <div className="sbm-bulk-right">
                <span className="sbm-bulk-size-text">
                  {selectedFileIds.size} files selected · {formatBytes(selectedBytes)}
                </span>
                <button
                  type="button"
                  className="sbm-btn-clear-selection"
                  onClick={handleClearSelection}
                >
                  <CloseIcon size={12} />
                  <span>Clear Selection</span>
                </button>
              </div>
            </div>
          )}

          {/* Files List Table matching screenshot */}
          {loading ? (
            <div className="sbm-loading-box">
              <div className="sbm-spinner" />
              <span>Loading files...</span>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="sbm-empty-box">
              <FileTextIcon size={32} />
              <p>No files found matching your search or filters.</p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="sbm-table-container">
              <table className="sbm-table">
                <thead>
                  <tr>
                    <th style={{ width: '2.5rem' }}>
                      <div
                        className={`sbm-checkbox ${
                          selectedFileIds.size === filteredFiles.length && filteredFiles.length > 0
                            ? 'is-checked'
                            : ''
                        }`}
                        onClick={toggleSelectAll}
                      >
                        {selectedFileIds.size === filteredFiles.length && filteredFiles.length > 0 && (
                          <CheckIcon size={12} />
                        )}
                      </div>
                    </th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Size ˇ</th>
                    <th>Project</th>
                    <th>Uploaded On</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((file) => {
                    const isSelected = selectedFileIds.has(file.id);
                    const theme = getTypeTheme(file.category);

                    return (
                      <tr
                        key={file.id}
                        className={`sbm-row ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => toggleSelectFile(file.id)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <div
                            className={`sbm-checkbox ${isSelected ? 'is-checked' : ''}`}
                            onClick={() => toggleSelectFile(file.id)}
                          >
                            {isSelected && <CheckIcon size={12} />}
                          </div>
                        </td>
                        <td className="sbm-cell-name">
                          <div className="sbm-name-wrapper">
                            <span
                              className="sbm-file-type-icon-box"
                              style={{ backgroundColor: theme.iconBg, color: theme.iconColor }}
                            >
                              {getFileCategoryIcon(file.category)}
                            </span>
                            <span className="sbm-file-title" title={file.originalName}>
                              {file.originalName}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className="sbm-type-pill"
                            style={{ backgroundColor: theme.bg, color: theme.color }}
                          >
                            {theme.label}
                          </span>
                        </td>
                        <td className="sbm-cell-size">
                          <strong>{formatBytes(file.sizeBytes)}</strong>
                        </td>
                        <td className="sbm-cell-project">
                          {file.project?.name || 'test'}
                        </td>
                        <td className="sbm-cell-date">
                          {new Date(file.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="sbm-cell-actions" onClick={(e) => e.stopPropagation()}>
                          <div className="sbm-actions-cluster">
                            <a
                              href={filesApi.getFileDownloadUrl(file.projectId, file.id)}
                              download={file.originalName}
                              className="sbm-action-btn"
                              title="Download"
                              target="_blank"
                              rel="noreferrer"
                            >
                              <DownloadIcon size={15} />
                            </a>
                            <button
                              type="button"
                              className="sbm-action-btn btn-delete"
                              title="Delete file"
                              onClick={() => handleDeleteSingleFile(file)}
                            >
                              <TrashIcon size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Grid View */
            <div className="sbm-grid-container">
              {filteredFiles.map((file) => {
                const isSelected = selectedFileIds.has(file.id);
                const theme = getTypeTheme(file.category);

                return (
                  <div
                    key={file.id}
                    className={`sbm-grid-item ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => toggleSelectFile(file.id)}
                  >
                    <div className="sbm-grid-top">
                      <div
                        className={`sbm-checkbox ${isSelected ? 'is-checked' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectFile(file.id);
                        }}
                      >
                        {isSelected && <CheckIcon size={12} />}
                      </div>
                      <span
                        className="sbm-type-pill"
                        style={{ backgroundColor: theme.bg, color: theme.color }}
                      >
                        {theme.label}
                      </span>
                    </div>

                    <div
                      className="sbm-grid-icon-box"
                      style={{ backgroundColor: theme.iconBg, color: theme.iconColor }}
                    >
                      {getFileCategoryIcon(file.category)}
                    </div>

                    <h4 className="sbm-grid-name" title={file.originalName}>
                      {file.originalName}
                    </h4>
                    <span className="sbm-grid-size">{formatBytes(file.sizeBytes)}</span>

                    <div className="sbm-grid-actions" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={filesApi.getFileDownloadUrl(file.projectId, file.id)}
                        download={file.originalName}
                        className="sbm-action-btn"
                        title="Download"
                      >
                        <DownloadIcon size={14} />
                      </a>
                      <button
                        type="button"
                        className="sbm-action-btn btn-delete"
                        onClick={() => handleDeleteSingleFile(file)}
                        title="Delete"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer matching screenshot */}
        <div className="sbm-footer">
          <div className="sbm-footer-left">
            <div className="sbm-shield-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <span className="sbm-shield-text">Your files are stored securely</span>
          </div>

          <div className="sbm-footer-right">
            <button type="button" className="sbm-btn-close-pill" onClick={onClose}>
              Close
            </button>
            {selectedFileIds.size > 0 && (
              <button
                type="button"
                className="sbm-btn-delete-bulk-pill"
                onClick={handleDeleteSelected}
                disabled={isDeletingBulk}
              >
                <TrashIcon size={15} />
                <span>Delete Selected ({selectedFileIds.size})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
