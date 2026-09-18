import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Primitives';
import { CheckSquareIcon, CalendarIcon, FileTextIcon, FolderIcon } from '../ui/Icons';

export const ProductPreviewModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'board' | 'calendar' | 'notes' | 'files'>('board');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="D-Board Interactive Product Tour" maxWidth="lg">
      <div className="preview-modal-content">
        {/* Navigation tabs */}
        <div className="preview-tabs">
          <button
            type="button"
            className={`preview-tab-btn ${activeTab === 'board' ? 'active' : ''}`}
            onClick={() => setActiveTab('board')}
          >
            <CheckSquareIcon size={16} />
            <span>Project Board</span>
          </button>
          <button
            type="button"
            className={`preview-tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            <CalendarIcon size={16} />
            <span>Deadlines & Calendar</span>
          </button>
          <button
            type="button"
            className={`preview-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            <FileTextIcon size={16} />
            <span>Shared Notes</span>
          </button>
          <button
            type="button"
            className={`preview-tab-btn ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            <FolderIcon size={16} />
            <span>Project Files</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="preview-body">
          {activeTab === 'board' && (
            <div className="preview-pane-board">
              <div className="board-col">
                <div className="board-col-header">
                  <span className="col-title">TO DO (4)</span>
                </div>
                <div className="preview-task-card">
                  <Badge variant="blue" size="sm">FEATURE</Badge>
                  <p className="task-title">Design PostgreSQL migration strategy</p>
                  <div className="task-meta">
                    <span className="meta-user">Alwin</span>
                    <span className="meta-date">Due Sep 12</span>
                  </div>
                </div>
                <div className="preview-task-card">
                  <Badge variant="amber" size="sm">IMPROVEMENT</Badge>
                  <p className="task-title">Setup centralized error middleware</p>
                </div>
              </div>

              <div className="board-col">
                <div className="board-col-header">
                  <span className="col-title">IN PROGRESS (3)</span>
                </div>
                <div className="preview-task-card active-card">
                  <Badge variant="green" size="sm">FEATURE</Badge>
                  <p className="task-title">Implement Google OAuth & Session auth</p>
                  <div className="task-meta">
                    <span className="meta-user">Dev Team</span>
                    <span className="meta-progress">75% done</span>
                  </div>
                </div>
              </div>

              <div className="board-col">
                <div className="board-col-header">
                  <span className="col-title">COMPLETED (18)</span>
                </div>
                <div className="preview-task-card completed-card">
                  <Badge variant="default" size="sm">TASK</Badge>
                  <p className="task-title">Prisma 7 Client configuration</p>
                  <div className="task-meta">
                    <span className="meta-done">✓ Done</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="preview-pane-calendar">
              <div className="calendar-header-mock">
                <h4>September 2026</h4>
                <Badge variant="dark" size="sm">Sprint 14</Badge>
              </div>
              <div className="calendar-grid-mock">
                <div className="cal-day past">1</div>
                <div className="cal-day past">2</div>
                <div className="cal-day past">3</div>
                <div className="cal-day today">
                  4
                  <div className="cal-event">D-Board Beta Milestone</div>
                </div>
                <div className="cal-day">5</div>
                <div className="cal-day event-day">
                  6
                  <div className="cal-event blue">API Lab Auth Review</div>
                </div>
                <div className="cal-day">7</div>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="preview-pane-notes">
              <div className="note-preview-item">
                <h5>Architecture Decision Record — Modular Monolith</h5>
                <p>Keeping apps/web and apps/api in a single unified repository preserves type safety and reduces deployment friction while scaling.</p>
                <div className="note-footer">Updated 2 hours ago • By Alwin</div>
              </div>
              <div className="note-preview-item">
                <h5>PostgreSQL & Prisma 7 Best Practices</h5>
                <p>Ensure all migrations are checked into version control and client extensions match NodeNext ESM rules.</p>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="preview-pane-files">
              <div className="file-row">
                <FolderIcon size={18} className="file-icon" />
                <span className="file-name">design-tokens-v2.json</span>
                <span className="file-size">14 KB</span>
                <span className="file-updated">Yesterday</span>
              </div>
              <div className="file-row">
                <FileTextIcon size={18} className="file-icon" />
                <span className="file-name">database-schema-spec.md</span>
                <span className="file-size">32 KB</span>
                <span className="file-updated">3 days ago</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
