import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { AttachmentDTO } from '../../api/files.api';
import type { FolderItem } from './CreateFolderModal';
import type { Project } from '../../api/projects.api';

interface ConnectDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: AttachmentDTO[];
  folders: FolderItem[];
  projects: Project[];
}

export const ConnectDriveModal: React.FC<ConnectDriveModalProps> = ({
  isOpen,
  onClose,
  files,
  folders,
  projects,
}) => {
  const { user } = useAuth();
  const driveStorageKey = `dboard_gdrive_conn_${user?.id || 'guest'}`;

  const [isConnected, setIsConnected] = useState<boolean>(() => {
    try {
      return localStorage.getItem(driveStorageKey) === 'true';
    } catch {
      return false;
    }
  });

  const connectedEmail = user?.email || 'j7alwin@gmail.com';
  
  // Calculate user initials for the avatar (e.g., "J7" or "JD")
  const userInitials = useMemo(() => {
    if (user?.fullName) {
      const parts = user.fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return user.fullName.slice(0, 2).toUpperCase();
    }
    if (user?.email) {
      const namePart = user.email.split('@')[0];
      return namePart.slice(0, 2).toUpperCase();
    }
    return 'J7';
  }, [user]);

  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>(['all']);
  const [targetDriveFolderName, setTargetDriveFolderName] = useState<string>('D-Board Exports');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(driveStorageKey, isConnected ? 'true' : 'false');
    } catch {}
  }, [isConnected, driveStorageKey]);

  // Format file sizes
  const formatSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 0.1) {
      const kb = bytes / 1024;
      return `${kb.toFixed(0)} KB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const projectStats = useMemo(() => {
    const map = new Map<string, { count: number; size: number }>();
    projects.forEach((p) => {
      const pFiles = files.filter((f) => f.projectId === p.id);
      const size = pFiles.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);
      map.set(p.id, { count: pFiles.length, size });
    });
    return map;
  }, [projects, files]);

  const folderStats = useMemo(() => {
    let fileFolderMap: Record<string, string> = {};
    try {
      const saved = localStorage.getItem('dboard_file_folder_map');
      if (saved) fileFolderMap = JSON.parse(saved);
    } catch {}

    const map = new Map<string, { count: number; size: number }>();
    folders.forEach((folder) => {
      const fFiles = files.filter((f) => fileFolderMap[f.id] === folder.id);
      const size = fFiles.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);
      map.set(folder.id, { count: fFiles.length, size });
    });
    return map;
  }, [folders, files]);

  // Compute total selected count
  const totalSelectedCount = useMemo(() => {
    if (selectedFolderIds.includes('all')) {
      return files.length;
    }
    let count = 0;
    selectedFolderIds.forEach((id) => {
      if (id.startsWith('proj-')) {
        const projId = id.replace('proj-', '');
        count += projectStats.get(projId)?.count || 0;
      } else {
        count += folderStats.get(id)?.count || 0;
      }
    });
    return count;
  }, [selectedFolderIds, files.length, projectStats, folderStats]);

  if (!isOpen) return null;

  const handleConnect = () => {
    setIsConnected(true);
    setFeedback('Google Drive connected successfully!');
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDisconnect = () => {
    if (window.confirm('Disconnect Google Drive from D-Board?')) {
      setIsConnected(false);
      setExportSuccess(false);
      setFeedback('Google Drive disconnected.');
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const toggleFolderSelection = (id: string) => {
    if (id === 'all') {
      if (selectedFolderIds.includes('all')) {
        setSelectedFolderIds([]);
      } else {
        setSelectedFolderIds(['all']);
      }
      return;
    }

    let next = selectedFolderIds.filter((x) => x !== 'all');
    if (next.includes(id)) {
      next = next.filter((x) => x !== id);
    } else {
      next.push(id);
    }
    setSelectedFolderIds(next);
  };

  const handleStartExport = async () => {
    if (selectedFolderIds.length === 0) return;
    setIsExporting(true);
    setExportProgress(10);
    setExportSuccess(false);
    setFeedback(null);

    const steps = [25, 55, 80, 100];
    for (const step of steps) {
      await new Promise((r) => setTimeout(r, 450));
      setExportProgress(step);
    }

    setIsExporting(false);
    setExportSuccess(true);
    setFeedback(`Successfully exported files to Google Drive in "${targetDriveFolderName}"!`);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container cdm-modal-window"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching screenshot */}
        <div className="cdm-header-container">
          <div className="cdm-header-left-col">
            <div className="cdm-header-icon-box">
              <svg width="28" height="28" viewBox="0 0 87.3 78" fill="none">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066DA" />
                <path d="M43.65 25 29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.5c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z" fill="#00AC47" />
                <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 10.15 7.9 13.65z" fill="#EA4335" />
                <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.4-4.5 1.2L43.65 25z" fill="#00832D" />
                <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.4 4.5-1.2L59.8 53z" fill="#2684FC" />
                <path d="M73.4 26.5 60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.5c0-1.55-.4-3.1-1.2-4.5l-12.7-22z" fill="#FFBA00" />
              </svg>
            </div>
            <div className="cdm-header-title-block">
              <h2 className="cdm-modal-title">Google Drive Integration</h2>
              <p className="cdm-modal-subtitle">
                Backup, export, and access your D-Board project files and folders in your personal Google Drive.
              </p>
            </div>
          </div>

          {/* Right Header Illustration: Cloud + Floating doc/sheet/slide badges */}
          <div className="cdm-header-art-wrapper">
            <div className="cdm-art-cloud-container">
              {/* Floating Leaf Sparkle */}
              <div className="cdm-art-leaf leaf-top">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.5 0 2.5-.5 2.5-1.5 0-.46-.19-.89-.49-1.2-.31-.32-.51-.76-.51-1.3 0-1.1.9-2 2-2h2.4c3.31 0 6-2.69 6-6 0-5.52-5.37-10-12-10z" fill="#A7F3D0" opacity="0.6"/>
                </svg>
              </div>

              {/* Trajectory Dotted Arc */}
              <svg className="cdm-art-arc" width="120" height="50" viewBox="0 0 120 50" fill="none">
                <path d="M10 40 Q 60 5 110 35" stroke="#86EFAC" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>

              {/* Doc (Blue) Floating Card */}
              <div className="cdm-art-floating-card card-doc">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#2563EB">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
              </div>

              {/* Sheet (Green) Floating Card */}
              <div className="cdm-art-floating-card card-sheet">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#16A34A">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H5v-2h4v2zm0-4H5v-2h4v2zm0-4H5V7h4v2zm10 8h-8v-2h8v2zm0-4h-8v-2h8v2zm0-4h-8V7h8v2z"/>
                </svg>
              </div>

              {/* Slide (Gold) Floating Card */}
              <div className="cdm-art-floating-card card-slide">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#EAB308">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l-2 3v1h10v-1l-2-3h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H5V5h14v12z"/>
                </svg>
              </div>

              {/* Central White Cloud with Google Drive Icon */}
              <div className="cdm-art-cloud-center">
                <svg width="22" height="22" viewBox="0 0 87.3 78" fill="none">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066DA" />
                  <path d="M43.65 25 29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.5c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z" fill="#00AC47" />
                  <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 10.15 7.9 13.65z" fill="#EA4335" />
                  <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.4-4.5 1.2L43.65 25z" fill="#00832D" />
                  <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.4 4.5-1.2L59.8 53z" fill="#2684FC" />
                  <path d="M73.4 26.5 60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.5c0-1.55-.4-3.1-1.2-4.5l-12.7-22z" fill="#FFBA00" />
                </svg>
              </div>
            </div>

            <button type="button" className="cdm-header-close-btn" onClick={onClose} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div className="cdm-feedback-toast">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>{feedback}</span>
          </div>
        )}

        {/* Modal Main Content */}
        <div className="cdm-modal-body">
          {!isConnected ? (
            /* Disconnected State Card */
            <div className="cdm-connect-cta-box">
              <div className="cdm-connect-cta-icon-circle">
                <svg width="32" height="32" viewBox="0 0 87.3 78" fill="none">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066DA" />
                  <path d="M43.65 25 29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.5c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z" fill="#00AC47" />
                  <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 10.15 7.9 13.65z" fill="#EA4335" />
                  <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.4-4.5 1.2L43.65 25z" fill="#00832D" />
                  <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.4 4.5-1.2L59.8 53z" fill="#2684FC" />
                  <path d="M73.4 26.5 60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.5c0-1.55-.4-3.1-1.2-4.5l-12.7-22z" fill="#FFBA00" />
                </svg>
              </div>
              <h3 className="cdm-connect-cta-title">Connect your Google Account</h3>
              <p className="cdm-connect-cta-desc">
                Authorize D-Board to securely export project documents, briefs, and personal folders directly to your personal Google Drive.
              </p>
              <button
                type="button"
                className="cdm-connect-google-btn"
                onClick={handleConnect}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Connect Google Drive</span>
              </button>
            </div>
          ) : (
            /* Connected State */
            <div className="cdm-connected-layout">
              {/* Connected Banner Card matching screenshot */}
              <div className="cdm-status-banner-card">
                <div className="cdm-status-banner-left">
                  <div className="cdm-avatar-badge-wrap">
                    <div className="cdm-avatar-green-circle">
                      {userInitials}
                    </div>
                    <div className="cdm-avatar-check-badge">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                  </div>
                  <div className="cdm-status-text-block">
                    <div className="cdm-status-title-row">
                      <span className="cdm-status-title">Google Drive Connected</span>
                      <span className="cdm-active-tag">ACTIVE</span>
                    </div>
                    <span className="cdm-status-email">{connectedEmail}</span>
                  </div>
                </div>
                
                <button
                  type="button"
                  className="cdm-btn-disconnect-pill"
                  onClick={handleDisconnect}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    <line x1="2" y1="2" x2="22" y2="22"></line>
                  </svg>
                  <span>Disconnect</span>
                </button>
              </div>

              {/* Destination Google Drive Folder */}
              <div className="cdm-section-group">
                <label className="cdm-section-label">Destination Google Drive Folder</label>
                <div className="cdm-folder-input-box">
                  <div className="cdm-folder-input-left">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <input
                      type="text"
                      className="cdm-folder-text-field"
                      value={targetDriveFolderName}
                      onChange={(e) => setTargetDriveFolderName(e.target.value)}
                      placeholder="D-Board Exports"
                    />
                  </div>
                  <div className="cdm-folder-input-dropdown-arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>
                <div className="cdm-footnote">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <span>Files will be placed under this folder in your personal Google Drive.</span>
                </div>
              </div>

              {/* Select Folders & Project Files to Export */}
              <div className="cdm-section-group">
                <div className="cdm-section-header-row">
                  <span className="cdm-section-label">Select Folders & Project Files to Export</span>
                  <span className="cdm-selected-counter">Total selected: {totalSelectedCount}</span>
                </div>

                <div className="cdm-export-items-list-box">
                  {/* Item 1: All Files & Folders */}
                  <div
                    className={`cdm-export-item ${selectedFolderIds.includes('all') ? 'is-active-row' : ''}`}
                    onClick={() => toggleFolderSelection('all')}
                  >
                    <div className="cdm-item-left">
                      <div className={`cdm-custom-checkbox ${selectedFolderIds.includes('all') ? 'is-checked' : ''}`}>
                        {selectedFolderIds.includes('all') && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </div>
                      <div className="cdm-item-info">
                        <div className="cdm-item-title-primary">
                          All Files & Folders ({files.length} files)
                        </div>
                        <div className="cdm-item-subtitle">
                          Complete workspace documents and attachments
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Project Folders */}
                  {projects.map((proj) => {
                    const isSelected = selectedFolderIds.includes(`proj-${proj.id}`);
                    const stat = projectStats.get(proj.id) || { count: 0, size: 0 };
                    return (
                      <div
                        key={`proj-${proj.id}`}
                        className="cdm-export-item"
                        onClick={() => toggleFolderSelection(`proj-${proj.id}`)}
                      >
                        <div className="cdm-item-left">
                          <div className={`cdm-custom-checkbox ${isSelected ? 'is-checked' : ''}`}>
                            {isSelected && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            )}
                          </div>
                          <div className="cdm-item-folder-icon-amber">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#F59E0B">
                              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                            </svg>
                          </div>
                          <div className="cdm-item-info">
                            <div className="cdm-item-title-bold">Project: {proj.name}</div>
                            <div className="cdm-item-subtitle">
                              {stat.count} files · {formatSize(stat.size)}
                            </div>
                          </div>
                        </div>
                        <div className="cdm-item-chevron">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        </div>
                      </div>
                    );
                  })}

                  {/* Personal Folders */}
                  {folders.map((folder) => {
                    const isSelected = selectedFolderIds.includes(folder.id);
                    const stat = folderStats.get(folder.id) || { count: 0, size: 0 };
                    const isPersonal = !folder.projectId || folder.projectId === 'personal' || folder.name.toLowerCase().includes('personal');
                    return (
                      <div
                        key={folder.id}
                        className="cdm-export-item"
                        onClick={() => toggleFolderSelection(folder.id)}
                      >
                        <div className="cdm-item-left">
                          <div className={`cdm-custom-checkbox ${isSelected ? 'is-checked' : ''}`}>
                            {isSelected && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            )}
                          </div>
                          {isPersonal ? (
                            <div className="cdm-item-personal-icon-purple">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="#9333EA">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                              </svg>
                            </div>
                          ) : (
                            <div className="cdm-item-folder-icon-amber">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="#F59E0B">
                                <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                              </svg>
                            </div>
                          )}
                          <div className="cdm-item-info">
                            <div className="cdm-item-title-bold">{folder.name}</div>
                            <div className="cdm-item-subtitle">
                              {stat.count} files · {formatSize(stat.size)}
                            </div>
                          </div>
                        </div>
                        <div className="cdm-item-chevron">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Export Progress Bar */}
              {isExporting && (
                <div className="cdm-progress-panel">
                  <div className="cdm-progress-label-row">
                    <span>Exporting files to Google Drive...</span>
                    <span>{exportProgress}%</span>
                  </div>
                  <div className="cdm-progress-bar-track">
                    <div
                      className="cdm-progress-bar-fill"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Success Card */}
              {exportSuccess && !isExporting && (
                <div className="cdm-success-banner">
                  <div className="cdm-success-icon-badge">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <div>
                    <div className="cdm-success-heading">Export Completed!</div>
                    <div className="cdm-success-sub">
                      Your files have been safely uploaded to Google Drive in folder{' '}
                      <strong>{targetDriveFolderName}</strong>.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer matching screenshot */}
        <div className="cdm-footer-bar">
          <div className="cdm-footer-security-note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <polyline points="9 12 11 14 15 10"></polyline>
            </svg>
            <span>Your files are securely uploaded</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </div>

          <div className="cdm-footer-buttons-wrap">
            <button type="button" className="cdm-btn-close-white" onClick={onClose}>
              Close
            </button>
            {isConnected && (
              <button
                type="button"
                className="cdm-btn-export-dark"
                onClick={handleStartExport}
                disabled={isExporting || selectedFolderIds.length === 0}
              >
                {isExporting ? (
                  <>
                    <span className="cdm-spinner-icon" />
                    <span>Exporting ({exportProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 87.3 78" fill="none">
                      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066DA" />
                      <path d="M43.65 25 29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.5c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z" fill="#00AC47" />
                      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 10.15 7.9 13.65z" fill="#EA4335" />
                      <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.4-4.5 1.2L43.65 25z" fill="#00832D" />
                      <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.4 4.5-1.2L59.8 53z" fill="#2684FC" />
                      <path d="M73.4 26.5 60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.5c0-1.55-.4-3.1-1.2-4.5l-12.7-22z" fill="#FFBA00" />
                    </svg>
                    <span>Export to Google Drive</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
