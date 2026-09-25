import React from 'react';
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
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container cdm-modal-window"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching design */}
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

          {/* Right Header Illustration */}
          <div className="cdm-header-art-wrapper">
            <div className="cdm-art-cloud-container">
              <div className="cdm-art-floating-card card-doc">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#2563EB">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
              </div>
              <div className="cdm-art-floating-card card-sheet">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#16A34A">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H5v-2h4v2zm0-4H5v-2h4v2zm0-4H5V7h4v2zm10 8h-8v-2h8v2zm0-4h-8v-2h8v2zm0-4h-8V7h8v2z"/>
                </svg>
              </div>
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

        {/* Modal Main Content */}
        <div className="cdm-modal-body">
          <div className="cdm-connect-cta-box" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div className="cdm-connect-cta-icon-circle" style={{ margin: '0 auto 16px' }}>
              <svg width="36" height="36" viewBox="0 0 87.3 78" fill="none">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066DA" />
                <path d="M43.65 25 29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.5c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z" fill="#00AC47" />
                <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 10.15 7.9 13.65z" fill="#EA4335" />
                <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.4-4.5 1.2L43.65 25z" fill="#00832D" />
                <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.4 4.5-1.2L59.8 53z" fill="#2684FC" />
                <path d="M73.4 26.5 60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.5c0-1.55-.4-3.1-1.2-4.5l-12.7-22z" fill="#FFBA00" />
              </svg>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', background: '#FEF3C7', color: '#92400E', borderRadius: '12px', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>
              <span>COMING SOON</span>
            </div>
            <h3 className="cdm-connect-cta-title" style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
              Google Drive Cloud Sync
            </h3>
            <p className="cdm-connect-cta-desc" style={{ maxWidth: '460px', margin: '0 auto 24px', lineHeight: 1.6, color: '#64748B', fontSize: '14px' }}>
              Automatic cloud synchronization and folder exports to Google Drive are currently in active development. In this version of D-Board, please use direct file downloads or workspace data exports in Account Settings.
            </p>
            <button
              type="button"
              className="cdm-connect-google-btn"
              disabled
              style={{ opacity: 0.65, cursor: 'not-allowed', margin: '0 auto' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Connect Google Drive (Coming Soon)</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="cdm-footer-bar">
          <div className="cdm-footer-security-note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <polyline points="9 12 11 14 15 10"></polyline>
            </svg>
            <span>All file storage is encrypted and access-controlled</span>
          </div>

          <div className="cdm-footer-buttons-wrap">
            <button type="button" className="cdm-btn-close-white" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
