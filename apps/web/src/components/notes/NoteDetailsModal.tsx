import React, { useState, useEffect, useRef } from 'react';
import type { Note } from '../../api/notes.api';
import { notesApi } from '../../api/notes.api';
import { filesApi, type AttachmentDTO } from '../../api/files.api';
import type { Project } from '../../api/projects.api';
import { useAuth } from '../../context/AuthContext';
import {
  CloseIcon,
  PinIcon,
  EditIcon,
  TrashIcon,
  MoreVerticalIcon,
  FolderIcon,
  UsersIcon,
  LockIcon,
  PaperclipIcon,
  PlusIcon,
  EyeIcon,
  DownloadIcon,
  SendIcon,
  AtSignIcon,
  CalendarIcon,
  ClockIcon,
  TagIcon,
  ImageIcon,
  FileTextIcon,
  PlayIcon,
  CheckIcon,
  UserIcon,
} from '../ui/Icons';
import { FileViewerModal } from '../files/FileViewerModal';

interface NoteDetailsModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onUpdated: (updatedNote: Note) => void;
  project?: Project | null;
  accessibleProjects?: Project[];
}

export const NoteDetailsModal: React.FC<NoteDetailsModalProps> = ({
  note,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onTogglePin,
  onUpdated,
  project,
  accessibleProjects = [],
}) => {
  const { user } = useAuth();

  // Internal state
  const [currentNote, setCurrentNote] = useState<Note | null>(note);
  const [attachments, setAttachments] = useState<AttachmentDTO[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [selectedFileForViewer, setSelectedFileForViewer] = useState<AttachmentDTO | null>(null);

  // Options Menu & Active Dropdowns
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [activeFileMenuId, setActiveFileMenuId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Tag editing state
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [savingTag, setSavingTag] = useState(false);

  // Comment input state
  const [commentText, setCommentText] = useState('');
  const [localComments, setLocalComments] = useState<{ id: string; user: string; avatarUrl: string | null; text: string; time: string }[]>([]);

  // Hidden File input ref for "+ Add Attachment" and paperclip
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state when note prop changes
  useEffect(() => {
    setCurrentNote(note);
    if (note) {
      if (note.attachments) {
        setAttachments(note.attachments.filter((a) => a.noteId === note.id));
      } else {
        setAttachments([]);
      }
      loadNoteAttachments(note);
    } else {
      setAttachments([]);
    }
  }, [note]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutside = () => {
      setShowOptionsMenu(false);
      setActiveFileMenuId(null);
    };
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, []);

  const loadNoteAttachments = async (n: Note) => {
    setLoadingAttachments(true);
    try {
      const res = await filesApi.getProjectFiles(n.projectId, { noteId: n.id });
      if (res.success && res.data) {
        setAttachments(res.data.files);
      }
    } catch {
      // Keep existing attachments fallback
    } finally {
      setLoadingAttachments(false);
    }
  };

  if (!isOpen || !currentNote) return null;

  const currentProjectName =
    currentNote.project?.name ||
    project?.name ||
    accessibleProjects.find((p) => p.id === currentNote.projectId)?.name ||
    'test';

  const creatorName =
    currentNote.createdBy?.fullName ||
    currentNote.createdBy?.username ||
    'Alwin James';

  const creatorInitial = creatorName.charAt(0).toUpperCase();

  const userInitial = user?.fullName
    ? user.fullName.charAt(0).toUpperCase()
    : user?.username?.charAt(0).toUpperCase() || 'A';

  const createdDateStr = new Date(currentNote.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const createdTimeStr = new Date(currentNote.createdAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const updatedDateStr = currentNote.updatedAt
    ? `${new Date(currentNote.updatedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}, ${new Date(currentNote.updatedAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : `${createdDateStr}, ${createdTimeStr}`;

  const isOwnerOrAdmin =
    currentNote.createdBy?.id === user?.id ||
    project?.userRole === 'PROJECT_ADMIN' ||
    project?.createdById === user?.id;

  // Format File Size
  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  // Get File Extension badge & Icon
  const getFileCategoryInfo = (att: AttachmentDTO) => {
    const ext = (att.extension || att.originalName.split('.').pop() || 'FILE').toUpperCase().replace('.', '');
    const isImg = att.category === 'IMAGE' || ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(ext);
    const isDoc =
      att.category === 'DOCUMENT' ||
      att.category === 'PDF' ||
      att.category === 'TEXT' ||
      ['PDF', 'DOC', 'DOCX', 'TXT', 'RTF', 'CSV', 'XLSX'].includes(ext);
    const isVideo = ['MP4', 'MOV', 'AVI', 'MKV', 'WEBM'].includes(ext);

    if (isImg) {
      return {
        badgeClass: 'badge-image',
        icon: <ImageIcon size={18} />,
        extLabel: ext || 'PNG',
      };
    }
    if (isDoc) {
      return {
        badgeClass: 'badge-doc',
        icon: <FileTextIcon size={18} />,
        extLabel: ext || 'DOC',
      };
    }
    if (isVideo) {
      return {
        badgeClass: 'badge-video',
        icon: <PlayIcon size={16} />,
        extLabel: ext || 'VIDEO',
      };
    }
    return {
      badgeClass: 'badge-other',
      icon: <FolderIcon size={18} />,
      extLabel: ext || 'FILE',
    };
  };

  // Upload Files to Note
  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploadingAttachment(true);
    try {
      const fileArray = Array.from(files);
      const res = await filesApi.uploadFiles(currentNote.projectId, fileArray, { noteId: currentNote.id });
      if (res.success) {
        await loadNoteAttachments(currentNote);
      }
    } catch (err: any) {
      console.error('Failed to upload attachment:', err);
    } finally {
      setUploadingAttachment(false);
    }
  };

  // Delete Attachment
  const handleDeleteAttachment = async (fileId: string) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) return;
    try {
      await filesApi.deleteFile(currentNote.projectId, fileId);
      setAttachments((prev) => prev.filter((a) => a.id !== fileId));
    } catch (err: any) {
      console.error('Failed to delete attachment:', err);
    }
  };

  // Add Tag Handler
  const handleAddTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tag = newTagInput.trim().replace(/^#/, '');
    if (!tag) {
      setIsAddingTag(false);
      return;
    }

    const currentTags = currentNote.tags || [];
    if (currentTags.includes(tag)) {
      setIsAddingTag(false);
      setNewTagInput('');
      return;
    }

    const updatedTags = [...currentTags, tag];
    setSavingTag(true);
    try {
      const res = await notesApi.updateNote(currentNote.projectId, currentNote.id, {
        tags: updatedTags,
      });
      if (res.success && res.data?.note) {
        setCurrentNote(res.data.note);
        onUpdated(res.data.note);
      } else {
        const fallbackNote = { ...currentNote, tags: updatedTags };
        setCurrentNote(fallbackNote);
        onUpdated(fallbackNote);
      }
      setNewTagInput('');
      setIsAddingTag(false);
    } catch (err) {
      console.error('Failed to add tag:', err);
    } finally {
      setSavingTag(false);
    }
  };

  // Remove Tag Handler
  const handleRemoveTag = async (tagToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedTags = (currentNote.tags || []).filter((t) => t !== tagToRemove);
    try {
      const res = await notesApi.updateNote(currentNote.projectId, currentNote.id, {
        tags: updatedTags,
      });
      if (res.success && res.data?.note) {
        setCurrentNote(res.data.note);
        onUpdated(res.data.note);
      } else {
        const fallbackNote = { ...currentNote, tags: updatedTags };
        setCurrentNote(fallbackNote);
        onUpdated(fallbackNote);
      }
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  // Copy Link Handler
  const handleCopyNoteLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowOptionsMenu(false);
    try {
      const url = `${window.location.origin}/app/projects/${currentNote.projectId}/notes?noteId=${currentNote.id}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  // Post Comment Handler
  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const newComment = {
      id: `comm-${Date.now()}`,
      user: user?.fullName || user?.username || 'You',
      avatarUrl: user?.avatarUrl || null,
      text: commentText.trim(),
      time: 'Just now',
    };

    setLocalComments((prev) => [...prev, newComment]);
    setCommentText('');
  };

  // Clean and render note content with mention badges
  const renderNoteContent = (content: string) => {
    if (!content) return <p className="ndm-empty-content">No content provided for this note.</p>;

    // Split by paragraphs
    const paragraphs = content.split('\n');

    return (
      <div className="ndm-note-rendered-paragraphs">
        {paragraphs.map((para, idx) => {
          if (!para.trim()) return <br key={idx} />;

          // Process @mentions in line
          const mentionRegex = /(@[\w.-]+(?:\s+[\w.-]+)?)/g;
          const parts = para.split(mentionRegex);

          return (
            <p key={idx} className="ndm-paragraph-line">
              {parts.map((part, pIdx) => {
                if (part.startsWith('@')) {
                  return (
                    <span key={pIdx} className="ndm-inline-mention-pill">
                      {part}
                    </span>
                  );
                }
                return <span key={pIdx}>{part}</span>;
              })}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="modal-backdrop ndm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container note-details-modal-luxury"
        onClick={(e) => {
          e.stopPropagation();
          setShowOptionsMenu(false);
          setActiveFileMenuId(null);
        }}
      >
        {/* Hidden Global File Input */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) {
              handleUploadFiles(e.target.files);
            }
          }}
        />

        {/* =========================================================================
           TOP HEADER: Amber Squircle, Title, Subtitle with Project Chip, Visibility, Actions
           ========================================================================= */}
        <div className="ndm-modal-top-header">
          <div className="ndm-header-main-info">
            {/* Amber Squircle Icon */}
            <div className="ndm-squircle-icon-box">
              <FileTextIcon size={22} className="ndm-squircle-icon" />
            </div>

            <div className="ndm-header-text-block">
              <h1 className="ndm-title">{currentNote.title}</h1>
              <div className="ndm-subtitle-row">
                <span className="ndm-created-by-text">
                  Created by <strong>{creatorName}</strong>
                </span>
                <span className="ndm-meta-dot">·</span>
                <span className="ndm-date-text">{createdDateStr}</span>
                <span className="ndm-meta-dot">·</span>
                <span className="ndm-in-label">in</span>
                <span className="ndm-project-chip">
                  <FolderIcon size={13} className="ndm-folder-icon" />
                  <span>{currentProjectName}</span>
                </span>
              </div>

              {/* Visibility Tag Pill */}
              <div className="ndm-visibility-row">
                {currentNote.visibility === 'TEAM' ? (
                  <span className="ndm-visibility-pill team">
                    <UsersIcon size={13} />
                    <span>Team</span>
                  </span>
                ) : (
                  <span className="ndm-visibility-pill private">
                    <LockIcon size={13} />
                    <span>Private</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Top Right Action Icons Bar */}
          <div className="ndm-header-actions-row">
            {/* Pin Button */}
            <button
              type="button"
              className={`ndm-action-icon-btn ${currentNote.pinned ? 'active-pin' : ''}`}
              title={currentNote.pinned ? 'Unpin note' : 'Pin note'}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(currentNote);
                setCurrentNote((prev) => (prev ? { ...prev, pinned: !prev.pinned } : null));
              }}
            >
              <PinIcon size={16} />
            </button>

            {/* Edit Button */}
            <button
              type="button"
              className="ndm-action-icon-btn"
              title="Edit Note"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(currentNote);
              }}
            >
              <EditIcon size={16} />
            </button>

            {/* Delete Button */}
            {isOwnerOrAdmin && (
              <button
                type="button"
                className="ndm-action-icon-btn delete-btn"
                title="Delete Note"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(currentNote);
                }}
              >
                <TrashIcon size={16} />
              </button>
            )}

            {/* 3 Dots Options Menu */}
            <div className="ndm-options-wrapper" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="ndm-action-icon-btn"
                title="More Options"
                onClick={() => setShowOptionsMenu((prev) => !prev)}
              >
                <MoreVerticalIcon size={16} />
              </button>

              {showOptionsMenu && (
                <div className="ndm-options-dropdown">
                  <button type="button" className="ndm-option-item" onClick={handleCopyNoteLink}>
                    <PaperclipIcon size={14} />
                    <span>{copiedLink ? 'Link Copied!' : 'Copy Note Link'}</span>
                  </button>
                  <button
                    type="button"
                    className="ndm-option-item"
                    onClick={() => {
                      setShowOptionsMenu(false);
                      onEdit(currentNote);
                    }}
                  >
                    <EditIcon size={14} />
                    <span>Edit Note</span>
                  </button>
                  <button
                    type="button"
                    className="ndm-option-item"
                    onClick={() => {
                      setShowOptionsMenu(false);
                      onTogglePin(currentNote);
                      setCurrentNote((prev) => (prev ? { ...prev, pinned: !prev.pinned } : null));
                    }}
                  >
                    <PinIcon size={14} />
                    <span>{currentNote.pinned ? 'Unpin Note' : 'Pin to Top'}</span>
                  </button>
                  {isOwnerOrAdmin && (
                    <button
                      type="button"
                      className="ndm-option-item danger"
                      onClick={() => {
                        setShowOptionsMenu(false);
                        onDelete(currentNote);
                      }}
                    >
                      <TrashIcon size={14} />
                      <span>Delete Note</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              type="button"
              className="ndm-action-icon-btn close-btn"
              title="Close"
              onClick={onClose}
              aria-label="Close"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        {/* =========================================================================
           MODAL BODY: 2 Columns Layout
           ========================================================================= */}
        <div className="ndm-modal-body">
          {/* ----------------- LEFT COLUMN: Content, Attachments, Comments ----------------- */}
          <div className="ndm-main-column">
            {/* 1. Note Content Card (Light Yellow / Cream) */}
            <div className="ndm-content-card">
              <button
                type="button"
                className="ndm-edit-inside-btn"
                onClick={() => onEdit(currentNote)}
              >
                <EditIcon size={13} />
                <span>Edit</span>
              </button>

              <div className="ndm-content-card-body">
                {renderNoteContent(currentNote.content)}
              </div>
            </div>

            {/* 2. Attachments Section */}
            <div className="ndm-attachments-card">
              <div className="ndm-attachments-header">
                <div className="ndm-att-header-left">
                  <PaperclipIcon size={17} className="ndm-att-paperclip" />
                  <span className="ndm-att-title">
                    Attachments ({attachments.length})
                  </span>
                </div>

                <button
                  type="button"
                  className="ndm-add-att-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAttachment}
                >
                  <PlusIcon size={14} />
                  <span>{uploadingAttachment ? 'Uploading...' : 'Add Attachment'}</span>
                </button>
              </div>

              {/* Attachments List */}
              {loadingAttachments ? (
                <div className="ndm-att-loading">
                  <div className="btn-spinner" />
                  <span>Loading files...</span>
                </div>
              ) : attachments.length > 0 ? (
                <div className="ndm-attachments-list">
                  {attachments.map((att) => {
                    const info = getFileCategoryInfo(att);
                    const isFileMenuOpen = activeFileMenuId === att.id;

                    return (
                      <div key={att.id} className="ndm-attachment-row-card">
                        <div
                          className="ndm-att-left-info"
                          onClick={() => setSelectedFileForViewer(att)}
                          title="Click to preview file"
                        >
                          <div className={`ndm-att-icon-badge ${info.badgeClass}`}>
                            {info.icon}
                          </div>
                          <div className="ndm-att-text-block">
                            <span className="ndm-att-filename" title={att.originalName}>
                              {att.originalName}
                            </span>
                            <span className="ndm-att-metaline">
                              {formatFileSize(att.sizeBytes)} · {info.extLabel}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons: Preview, Download, 3 Dots */}
                        <div className="ndm-att-actions-bar" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="ndm-file-btn"
                            title="Preview file"
                            onClick={() => setSelectedFileForViewer(att)}
                          >
                            <EyeIcon size={15} />
                          </button>

                          <a
                            href={filesApi.getFileDownloadUrl(currentNote.projectId, att.id)}
                            download={att.originalName}
                            className="ndm-file-btn"
                            title="Download file"
                          >
                            <DownloadIcon size={15} />
                          </a>

                          <div className="ndm-file-menu-wrapper">
                            <button
                              type="button"
                              className="ndm-file-btn"
                              title="Options"
                              onClick={() => setActiveFileMenuId(isFileMenuOpen ? null : att.id)}
                            >
                              <MoreVerticalIcon size={15} />
                            </button>

                            {isFileMenuOpen && (
                              <div className="ndm-file-dropdown">
                                <button
                                  type="button"
                                  className="ndm-dropdown-item"
                                  onClick={() => {
                                    setActiveFileMenuId(null);
                                    setSelectedFileForViewer(att);
                                  }}
                                >
                                  <EyeIcon size={13} />
                                  <span>Preview</span>
                                </button>
                                <a
                                  href={filesApi.getFileDownloadUrl(currentNote.projectId, att.id)}
                                  download={att.originalName}
                                  className="ndm-dropdown-item"
                                  onClick={() => setActiveFileMenuId(null)}
                                >
                                  <DownloadIcon size={13} />
                                  <span>Download</span>
                                </a>
                                {(isOwnerOrAdmin || att.uploadedById === user?.id) && (
                                  <button
                                    type="button"
                                    className="ndm-dropdown-item danger"
                                    onClick={() => {
                                      setActiveFileMenuId(null);
                                      handleDeleteAttachment(att.id);
                                    }}
                                  >
                                    <TrashIcon size={13} />
                                    <span>Delete Attachment</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="ndm-att-empty-state">
                  <p>No files attached yet. Click "+ Add Attachment" to add files.</p>
                </div>
              )}
            </div>

            {/* Optional Comments list */}
            {localComments.length > 0 && (
              <div className="ndm-comments-stream">
                {localComments.map((comm) => (
                  <div key={comm.id} className="ndm-comment-row">
                    <div className="ndm-comment-avatar">
                      {comm.avatarUrl ? (
                        <img src={comm.avatarUrl} alt={comm.user} />
                      ) : (
                        <span>{comm.user.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="ndm-comment-bubble">
                      <div className="ndm-comment-meta">
                        <strong>{comm.user}</strong>
                        <span>{comm.time}</span>
                      </div>
                      <p>{comm.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. Pinned Bottom Comment Input Bar */}
            <form onSubmit={handlePostComment} className="ndm-comment-input-form">
              <div className="ndm-user-avatar-circle">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.username} />
                ) : (
                  <span>{userInitial}</span>
                )}
              </div>

              <div className="ndm-input-box-wrapper">
                <input
                  type="text"
                  className="ndm-comment-inline-input"
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />

                <div className="ndm-input-actions-right">
                  <button
                    type="button"
                    className="ndm-input-icon-action"
                    title="Attach File"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <PaperclipIcon size={17} />
                  </button>

                  <button
                    type="button"
                    className="ndm-input-icon-action"
                    title="Mention Member"
                    onClick={() => setCommentText((prev) => prev + '@')}
                  >
                    <AtSignIcon size={17} />
                  </button>

                  <button
                    type="submit"
                    className="ndm-submit-comment-circle-btn"
                    disabled={!commentText.trim()}
                    title="Send"
                  >
                    <SendIcon size={14} />
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* ----------------- RIGHT SIDEBAR COLUMN ----------------- */}
          <div className="ndm-sidebar-column">
            {/* 1. Project Field */}
            <div className="ndm-sidebar-field">
              <div className="ndm-sidebar-label">
                <FolderIcon size={15} />
                <span>Project</span>
              </div>
              <div className="ndm-project-select-display">
                <div className="ndm-project-avatar-circle">
                  <span>{currentProjectName.charAt(0).toUpperCase()}</span>
                </div>
                <span className="ndm-project-name-text">{currentProjectName}</span>
                <span className="ndm-project-dropdown-arrow">⌄</span>
              </div>
            </div>

            {/* 2. Created By Field */}
            <div className="ndm-sidebar-field">
              <div className="ndm-sidebar-label">
                <UserIcon size={15} />
                <span>Created by</span>
              </div>
              <div className="ndm-creator-info-row">
                <div className="ndm-creator-avatar">
                  {currentNote.createdBy?.avatarUrl ? (
                    <img src={currentNote.createdBy.avatarUrl} alt={creatorName} />
                  ) : (
                    <span>{creatorInitial}</span>
                  )}
                </div>
                <span className="ndm-creator-name">{creatorName}</span>
              </div>
            </div>

            {/* 3. Created On Field */}
            <div className="ndm-sidebar-field">
              <div className="ndm-sidebar-label">
                <CalendarIcon size={15} />
                <span>Created on</span>
              </div>
              <div className="ndm-date-box-display">
                <CalendarIcon size={15} className="ndm-date-box-icon" />
                <span>{createdDateStr}, {createdTimeStr}</span>
              </div>
            </div>

            {/* 4. Last Updated Field */}
            <div className="ndm-sidebar-field">
              <div className="ndm-sidebar-label">
                <ClockIcon size={15} />
                <span>Last updated</span>
              </div>
              <div className="ndm-sidebar-text-val">{updatedDateStr}</div>
            </div>

            {/* 5. Tags Field (Interactive Add / Remove) */}
            <div className="ndm-sidebar-field">
              <div className="ndm-sidebar-label">
                <TagIcon size={15} />
                <span>Tags</span>
              </div>

              {/* Tag Chips List */}
              <div className="ndm-tags-wrap">
                {currentNote.tags && currentNote.tags.length > 0 ? (
                  currentNote.tags.map((tag) => (
                    <div key={tag} className="ndm-tag-chip">
                      <span>#{tag}</span>
                      <button
                        type="button"
                        className="ndm-tag-remove-btn"
                        onClick={(e) => handleRemoveTag(tag, e)}
                        title="Remove tag"
                      >
                        <CloseIcon size={10} />
                      </button>
                    </div>
                  ))
                ) : null}

                {/* Add Tag Button or Inline Input */}
                {isAddingTag ? (
                  <form onSubmit={handleAddTagSubmit} className="ndm-add-tag-form">
                    <input
                      type="text"
                      className="ndm-add-tag-input"
                      placeholder="tag name..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="ndm-add-tag-save-btn"
                      disabled={savingTag}
                      title="Add"
                    >
                      <CheckIcon size={12} />
                    </button>
                    <button
                      type="button"
                      className="ndm-add-tag-cancel-btn"
                      onClick={() => {
                        setIsAddingTag(false);
                        setNewTagInput('');
                      }}
                      title="Cancel"
                    >
                      <CloseIcon size={12} />
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="ndm-add-tag-dotted-btn"
                    onClick={() => setIsAddingTag(true)}
                  >
                    <PlusIcon size={13} />
                    <span>Add a tag</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* File Viewer Modal for Attachments */}
      {selectedFileForViewer && (
        <FileViewerModal
          file={selectedFileForViewer}
          onClose={() => setSelectedFileForViewer(null)}
          onFileUpdated={() => loadNoteAttachments(currentNote)}
          onFileDeleted={() => {
            setSelectedFileForViewer(null);
            loadNoteAttachments(currentNote);
          }}
          canEdit={isOwnerOrAdmin || selectedFileForViewer.uploadedById === user?.id}
          canDelete={isOwnerOrAdmin || selectedFileForViewer.uploadedById === user?.id}
        />
      )}
    </div>
  );
};
