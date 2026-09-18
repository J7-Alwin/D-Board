import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from '../../router/Router';
import { useAuth } from '../../context/AuthContext';
import { notesApi, type Note } from '../../api/notes.api';
import { projectsApi, type Project } from '../../api/projects.api';
import { membersApi, type ProjectMemberDetail } from '../../api/members.api';
import { filesApi, type AttachmentDTO } from '../../api/files.api';
import { ProjectWorkspaceHeader } from '../../components/workspace/ProjectWorkspaceHeader';
import { NoteVisibilityBadge } from '../../components/notes/NoteVisibilityBadge';
import { MentionComposer } from '../../components/notes/MentionComposer';
import { NoteDetailsModal } from '../../components/notes/NoteDetailsModal';
import { FileViewerModal } from '../../components/files/FileViewerModal';
import {
  FileTextIcon,
  SearchIcon,
  PlusIcon,
  PinIcon,
  TrashIcon,
  EditIcon,
  CheckIcon,
  AlertCircleIcon,
  FolderIcon,
  PaperclipIcon,
  CloseIcon,
  UploadCloudIcon,
  GridIcon,
  ListIcon,
  MoreHorizontalIcon,
  UsersIcon,
  LockIcon,
  LinkIcon,
  HeartIcon,
  HashIcon,
  TagIcon,
} from '../../components/ui/Icons';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { ProjectAvatar } from '../../components/ui/ProjectAvatar';
import { NotesHeaderAtmosphere } from '../../components/common/HeaderAtmosphereArt';

export interface NotesPageProps {
  projectId?: string;
  project?: Project | null;
  hideHeader?: boolean;
}

const COLOR_PALETTES = [
  { id: 'yellow', label: 'Yellow', bg: '#FEF9C3', border: '#FDE047', dot: '#FACC15', text: '#854D0E', tagBg: '#FEF08A' },
  { id: 'blue', label: 'Blue', bg: '#E0F2FE', border: '#BAE6FD', dot: '#38BDF8', text: '#0369A1', tagBg: '#BAE6FD' },
  { id: 'green', label: 'Green', bg: '#DCFCE7', border: '#BBF7D0', dot: '#4ADE80', text: '#15803D', tagBg: '#BBF7D0' },
  { id: 'pink', label: 'Pink', bg: '#FCE7F3', border: '#FBCFE8', dot: '#F472B6', text: '#BE185D', tagBg: '#FBCFE8' },
  { id: 'purple', label: 'Purple', bg: '#EDE9FE', border: '#DDD6FE', dot: '#A78BFA', text: '#6D28D9', tagBg: '#DDD6FE' },
  { id: 'gray', label: 'Gray', bg: '#F3F4F6', border: '#E5E7EB', dot: '#9CA3AF', text: '#374151', tagBg: '#E5E7EB' },
];

export const NotesPage: React.FC<NotesPageProps> = ({
  projectId: propProjectId,
  project: propProject,
  hideHeader = false,
}) => {
  const { path, navigate } = useRouter();
  const { user } = useAuth();

  // Determine active project ID from prop or route
  const routeProjectIdMatch = path.match(/^\/app\/projects\/([^/]+)\/notes/);
  const activeProjectId = propProjectId || (routeProjectIdMatch ? routeProjectIdMatch[1] : null);

  // Data states
  const [project, setProject] = useState<Project | null>(propProject || null);
  const [accessibleProjects, setAccessibleProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<ProjectMemberDetail[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter & View states
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedGlobalProject, setSelectedGlobalProject] = useState<string>('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('ALL');
  const [visibilityFilter, setVisibilityFilter] = useState<'ALL' | 'FAVORITES' | 'TEAM' | 'USERS'>('ALL');
  const [sortOption, setSortOption] = useState<'recentUpdated' | 'recentCreated' | 'title'>('recentUpdated');

  // Favorites state & persistence
  const favStorageKey = `dboard_fav_notes_${user?.id || 'guest'}`;
  const [favoriteNoteIds, setFavoriteNoteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(favStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const handleToggleFavorite = (noteId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavoriteNoteIds((prev) => {
      const isFav = prev.includes(noteId);
      const next = isFav ? prev.filter((id) => id !== noteId) : [...prev, noteId];
      try {
        localStorage.setItem(favStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Active action menu
  const [activeMenuNoteId, setActiveMenuNoteId] = useState<string | null>(null);

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formColor, setFormColor] = useState('yellow');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [formPinned, setFormPinned] = useState(false);
  const [formProjectId, setFormProjectId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formatting state & textarea ref
  const [isBoldActive, setIsBoldActive] = useState(false);
  const [isItalicActive, setIsItalicActive] = useState(false);
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Toolbar Mention Dropdown State
  const [isMentionMenuOpen, setIsMentionMenuOpen] = useState(false);
  const [mentionMenuSearch, setMentionMenuSearch] = useState('');
  const mentionMenuContainerRef = useRef<HTMLDivElement | null>(null);

  // Close mention menu on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        mentionMenuContainerRef.current &&
        !mentionMenuContainerRef.current.contains(e.target as Node)
      ) {
        setIsMentionMenuOpen(false);
      }
    };
    if (isMentionMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isMentionMenuOpen]);

  // Attached files state
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<AttachmentDTO[]>([]);
  const [selectedFileForViewer, setSelectedFileForViewer] = useState<AttachmentDTO | null>(null);
  const noteFileInputRef = useRef<HTMLInputElement | null>(null);

  // View Note Detail Modal State
  const [viewingNote, setViewingNote] = useState<Note | null>(null);

  // Load user's accessible projects and active project details
  useEffect(() => {
    // 1. ALWAYS load all accessible projects for project selector
    projectsApi
      .getUserProjects()
      .then((res) => {
        if (res.success && res.data) {
          const all = [...(res.data.owned || []), ...(res.data.joined || [])];
          setAccessibleProjects(all);
          if (all.length > 0 && !formProjectId) {
            setFormProjectId(activeProjectId || all[0].id);
          }
        }
      })
      .catch(() => {});

    // 2. If inside a specific project, load project metadata & members
    if (activeProjectId) {
      projectsApi
        .getProjectById(activeProjectId)
        .then((res) => {
          if (res.success && res.data) {
            setProject(res.data.project);
            setAccessibleProjects((prev) => {
              if (prev.some((p) => p.id === activeProjectId)) return prev;
              return [res.data.project, ...prev];
            });
          }
        })
        .catch(() => {});

      membersApi
        .getProjectMembers(activeProjectId)
        .then((res) => {
          if (res.success && res.data) {
            const rawMembers = [...(res.data.members || [])];
            const creator = res.data.project?.creator;
            if (creator && !rawMembers.some((m) => m.userId === creator.id)) {
              rawMembers.unshift({
                id: `creator-${creator.id}`,
                userId: creator.id,
                role: 'PROJECT_ADMIN',
                joinedAt: new Date().toISOString(),
                user: creator,
                isCreator: true,
              });
            }
            setMembers(rawMembers);
          }
        })
        .catch(() => {});
    }
  }, [activeProjectId]);

  // Load members if global note editor project changes
  useEffect(() => {
    const targetId = activeProjectId || formProjectId;
    if (targetId) {
      membersApi
        .getProjectMembers(targetId)
        .then((res) => {
          if (res.success && res.data) {
            const rawMembers = [...(res.data.members || [])];
            const creator = res.data.project?.creator;
            if (creator && !rawMembers.some((m) => m.userId === creator.id)) {
              rawMembers.unshift({
                id: `creator-${creator.id}`,
                userId: creator.id,
                role: 'PROJECT_ADMIN',
                joinedAt: new Date().toISOString(),
                user: creator,
                isCreator: true,
              });
            }
            setMembers(rawMembers);
          }
        })
        .catch(() => {});
    }
  }, [activeProjectId, formProjectId]);

  // Close active menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuNoteId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Load notes
  const loadNotes = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      if (activeProjectId) {
        const res = await notesApi.getProjectNotes(activeProjectId, {
          search: debouncedSearch.trim() || undefined,
          sort: sortOption,
        });
        if (res.success && res.data) {
          setNotes(res.data.notes);
          setViewingNote((curr) => (curr ? res.data.notes.find((n) => n.id === curr.id) || curr : null));
        }
      } else {
        const res = await notesApi.getGlobalNotes({
          projectId: selectedGlobalProject || undefined,
          search: debouncedSearch.trim() || undefined,
          sort: sortOption,
        });
        if (res.success && res.data) {
          setNotes(res.data.notes);
          setViewingNote((curr) => (curr ? res.data.notes.find((n) => n.id === curr.id) || curr : null));
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load notes' });
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, selectedGlobalProject, debouncedSearch, sortOption]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Compute displayed notes based on visibilityFilter and tags
  const displayedNotes = useMemo(() => {
    return notes.filter((n) => {
      const isFav = favoriteNoteIds.includes(n.id);
      if (visibilityFilter === 'FAVORITES' && !isFav) return false;
      if (visibilityFilter === 'TEAM' && n.visibility !== 'TEAM') return false;
      if (visibilityFilter === 'USERS' && n.visibility !== 'USERS') return false;
      if (selectedTagFilter !== 'ALL' && (!n.tags || !n.tags.includes(selectedTagFilter))) return false;
      return true;
    });
  }, [notes, favoriteNoteIds, visibilityFilter, selectedTagFilter]);

  // Unique tags across fetched notes
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => {
      if (n.tags && Array.isArray(n.tags)) {
        n.tags.forEach((t) => tagSet.add(t));
      }
    });
    return Array.from(tagSet);
  }, [notes]);

  // Open Create Modal
  const handleOpenCreate = () => {
    const defaultProjId = activeProjectId || (accessibleProjects[0]?.id || '');
    if (accessibleProjects.length === 0) {
      projectsApi.getUserProjects().then((res) => {
        if (res.success && res.data) {
          const all = [...(res.data.owned || []), ...(res.data.joined || [])];
          setAccessibleProjects(all);
          if (all.length > 0 && !formProjectId) {
            const chosenId = activeProjectId || all[0].id;
            setFormProjectId(chosenId);
            membersApi.getProjectMembers(chosenId).then((mRes) => {
              if (mRes.success && mRes.data) {
                const rawMembers = [...(mRes.data.members || [])];
                const creator = mRes.data.project?.creator;
                if (creator && !rawMembers.some((m) => m.userId === creator.id)) {
                  rawMembers.unshift({
                    id: `creator-${creator.id}`,
                    userId: creator.id,
                    role: 'PROJECT_ADMIN',
                    joinedAt: new Date().toISOString(),
                    user: creator,
                    isCreator: true,
                  });
                }
                setMembers(rawMembers);
              }
            }).catch(() => {});
          }
        }
      }).catch(() => {});
    } else if (defaultProjId) {
      membersApi.getProjectMembers(defaultProjId).then((mRes) => {
        if (mRes.success && mRes.data) {
          const rawMembers = [...(mRes.data.members || [])];
          const creator = mRes.data.project?.creator;
          if (creator && !rawMembers.some((m) => m.userId === creator.id)) {
            rawMembers.unshift({
              id: `creator-${creator.id}`,
              userId: creator.id,
              role: 'PROJECT_ADMIN',
              joinedAt: new Date().toISOString(),
              user: creator,
              isCreator: true,
            });
          }
          setMembers(rawMembers);
        }
      }).catch(() => {});
    }
    setIsEditing(false);
    setEditingNoteId(null);
    setFormTitle('');
    setFormContent('');
    setFormColor('yellow');
    setFormTags([]);
    setTagInput('');
    setFormPinned(false);
    setIsBoldActive(false);
    setIsItalicActive(false);
    setAttachedFiles([]);
    setExistingAttachments([]);
    setFormProjectId(defaultProjId);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (note: Note, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveMenuNoteId(null);
    if (note.projectId) {
      membersApi.getProjectMembers(note.projectId).then((mRes) => {
        if (mRes.success && mRes.data) {
          const rawMembers = [...(mRes.data.members || [])];
          const creator = mRes.data.project?.creator;
          if (creator && !rawMembers.some((m) => m.userId === creator.id)) {
            rawMembers.unshift({
              id: `creator-${creator.id}`,
              userId: creator.id,
              role: 'PROJECT_ADMIN',
              joinedAt: new Date().toISOString(),
              user: creator,
              isCreator: true,
            });
          }
          setMembers(rawMembers);
        }
      }).catch(() => {});
    }
    if (accessibleProjects.length === 0) {
      projectsApi.getUserProjects().then((res) => {
        if (res.success && res.data) {
          const all = [...(res.data.owned || []), ...(res.data.joined || [])];
          setAccessibleProjects(all);
        }
      }).catch(() => {});
    }
    setIsEditing(true);
    setEditingNoteId(note.id);
    setFormTitle(note.title);
    setFormContent(note.content);
    setFormColor(note.color || 'yellow');
    setFormTags(note.tags || []);
    setTagInput('');
    setFormPinned(note.pinned);
    setIsBoldActive(false);
    setIsItalicActive(false);
    setAttachedFiles([]);
    setExistingAttachments(note.attachments || []);
    setFormProjectId(note.projectId);
    setIsModalOpen(true);
  };

  // Close Modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setEditingNoteId(null);
    setIsBoldActive(false);
    setIsItalicActive(false);
    setAttachedFiles([]);
    setExistingAttachments([]);
  };

  // Formatting actions
  const handleToggleBold = () => {
    const ta = contentTextareaRef.current;
    if (!ta) {
      setIsBoldActive((prev) => !prev);
      return;
    }

    const start = ta.selectionStart ?? formContent.length;
    const end = ta.selectionEnd ?? formContent.length;
    const selected = formContent.slice(start, end);

    if (selected.length > 0) {
      const isAlreadyBold = selected.startsWith('**') && selected.endsWith('**') && selected.length >= 4;
      let replacement = '';
      let newEnd = end;

      if (isAlreadyBold) {
        replacement = selected.slice(2, -2);
        newEnd = start + replacement.length;
        setIsBoldActive(false);
      } else {
        replacement = `**${selected}**`;
        newEnd = start + replacement.length;
        setIsBoldActive(true);
      }

      const nextContent = formContent.slice(0, start) + replacement + formContent.slice(end);
      setFormContent(nextContent);
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start, newEnd);
      }, 0);
    } else {
      const nextBold = !isBoldActive;
      setIsBoldActive(nextBold);
      if (nextBold) {
        const nextContent = formContent.slice(0, start) + '****' + formContent.slice(start);
        setFormContent(nextContent);
        setTimeout(() => {
          ta.focus();
          ta.setSelectionRange(start + 2, start + 2);
        }, 0);
      }
    }
  };

  const handleToggleItalic = () => {
    const ta = contentTextareaRef.current;
    if (!ta) {
      setIsItalicActive((prev) => !prev);
      return;
    }

    const start = ta.selectionStart ?? formContent.length;
    const end = ta.selectionEnd ?? formContent.length;
    const selected = formContent.slice(start, end);

    if (selected.length > 0) {
      const isAlreadyItalic = selected.startsWith('*') && selected.endsWith('*') && selected.length >= 2 && !selected.startsWith('**');
      let replacement = '';
      let newEnd = end;

      if (isAlreadyItalic) {
        replacement = selected.slice(1, -1);
        newEnd = start + replacement.length;
        setIsItalicActive(false);
      } else {
        replacement = `*${selected}*`;
        newEnd = start + replacement.length;
        setIsItalicActive(true);
      }

      const nextContent = formContent.slice(0, start) + replacement + formContent.slice(end);
      setFormContent(nextContent);
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start, newEnd);
      }, 0);
    } else {
      const nextItalic = !isItalicActive;
      setIsItalicActive(nextItalic);
      if (nextItalic) {
        const nextContent = formContent.slice(0, start) + '**' + formContent.slice(start);
        setFormContent(nextContent);
        setTimeout(() => {
          ta.focus();
          ta.setSelectionRange(start + 1, start + 1);
        }, 0);
      }
    }
  };

  const handleToggleUnderline = () => {
    const ta = contentTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? formContent.length;
    const end = ta.selectionEnd ?? formContent.length;
    const selected = formContent.slice(start, end);
    if (selected.length > 0) {
      const isAlreadyUnderlined = selected.startsWith('<u>') && selected.endsWith('</u>') && selected.length >= 7;
      let replacement = '';
      let newEnd = end;
      if (isAlreadyUnderlined) {
        replacement = selected.slice(3, -4);
        newEnd = start + replacement.length;
      } else {
        replacement = `<u>${selected}</u>`;
        newEnd = start + replacement.length;
      }
      const nextContent = formContent.slice(0, start) + replacement + formContent.slice(end);
      setFormContent(nextContent);
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start, newEnd);
      }, 0);
    } else {
      const nextContent = formContent.slice(0, start) + '<u></u>' + formContent.slice(start);
      setFormContent(nextContent);
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start + 3, start + 3);
      }, 0);
    }
  };

  const handleInsertBullet = () => {
    const ta = contentTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? formContent.length;
    const needsNewline = start > 0 && formContent[start - 1] !== '\n';
    const prefix = needsNewline ? '\n• ' : '• ';
    const nextContent = formContent.slice(0, start) + prefix + formContent.slice(start);
    setFormContent(nextContent);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  const handleInsertNumbered = () => {
    const ta = contentTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? formContent.length;
    const needsNewline = start > 0 && formContent[start - 1] !== '\n';
    const prefix = needsNewline ? '\n1. ' : '1. ';
    const nextContent = formContent.slice(0, start) + prefix + formContent.slice(start);
    setFormContent(nextContent);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  const handleInsertLink = () => {
    const ta = contentTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? formContent.length;
    const end = ta.selectionEnd ?? formContent.length;
    const selected = formContent.slice(start, end);

    if (selected.length > 0) {
      const replacement = `[${selected}](https://)`;
      const nextContent = formContent.slice(0, start) + replacement + formContent.slice(end);
      setFormContent(nextContent);
      setTimeout(() => {
        ta.focus();
        const urlStart = start + selected.length + 3;
        ta.setSelectionRange(urlStart, urlStart + 8);
      }, 0);
    } else {
      const replacement = `[link](https://)`;
      const nextContent = formContent.slice(0, start) + replacement + formContent.slice(start);
      setFormContent(nextContent);
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start + 1, start + 5);
      }, 0);
    }
  };

  const isHandleAlreadyMentioned = (handle: string, content: string) => {
    const clean = handle.replace(/^@/, '').toLowerCase().trim();
    if (!clean) return false;
    const regex = new RegExp(`(?:^|[\\s(>])@${clean}(?:\\b|[\\s.,!?;:]|$)`, 'i');
    return regex.test(content);
  };

  const handleInsertDirectMention = (usernameOrTeam: string) => {
    const clean = usernameOrTeam.toLowerCase() === 'team' ? 'team' : usernameOrTeam;
    if (isHandleAlreadyMentioned(clean, formContent)) {
      return;
    }

    const token = clean === 'team' ? '@team' : `@${clean}`;
    const ta = contentTextareaRef.current;

    if (ta) {
      const start = ta.selectionStart ?? formContent.length;
      const end = ta.selectionEnd ?? formContent.length;
      const before = formContent.slice(0, start);
      const after = formContent.slice(end);

      const needsLeadingSpace = start > 0 && !/[\s\n]$/.test(before);
      const insertedText = (needsLeadingSpace ? ' ' : '') + token + ' ';
      const nextContent = before + insertedText + after;
      setFormContent(nextContent);

      setTimeout(() => {
        ta.focus();
        const nextPos = start + insertedText.length;
        ta.setSelectionRange(nextPos, nextPos);
      }, 0);
    } else {
      const needsLeadingSpace = formContent.length > 0 && !/[\s\n]$/.test(formContent);
      const insertedText = (needsLeadingSpace ? ' ' : '') + token + ' ';
      setFormContent((prev) => prev + insertedText);
    }
  };

  // Tag addition
  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/^#/, '');
      if (val && !formTags.includes(val)) {
        setFormTags((prev) => [...prev, val]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // File Handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    setAttachedFiles((prev) => [...prev, ...filesArray]);
    e.target.value = '';
  };

  const handleRemoveNewFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingAttachment = (attachmentId: string) => {
    setExistingAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Save Note
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFeedback({ type: 'error', message: 'Note title is required' });
      return;
    }
    if (!formContent.trim()) {
      setFeedback({ type: 'error', message: 'Note content is required' });
      return;
    }

    const targetProjId = activeProjectId || formProjectId;
    if (!targetProjId) {
      setFeedback({ type: 'error', message: 'Please select a project for this note' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      // 1. Upload new files if any
      let uploadedIds: string[] = [];
      if (attachedFiles.length > 0) {
        const uploadRes = await filesApi.uploadFiles(targetProjId, attachedFiles);
        if (uploadRes.success && uploadRes.data?.files) {
          uploadedIds = uploadRes.data.files.map((f) => f.id);
        }
      }

      const finalAttachmentIds = [...existingAttachments.map((a) => a.id), ...uploadedIds];

      if (isEditing && editingNoteId) {
        const res = await notesApi.updateNote(targetProjId, editingNoteId, {
          title: formTitle.trim(),
          content: formContent.trim(),
          color: formColor,
          tags: formTags,
          pinned: formPinned,
          attachmentIds: finalAttachmentIds,
        });
        if (res.success && res.data.note) {
          setFeedback({ type: 'success', message: 'Note updated successfully' });
          handleCloseModal();
          loadNotes();
        }
      } else {
        const res = await notesApi.createNote(targetProjId, {
          title: formTitle.trim(),
          content: formContent.trim(),
          color: formColor,
          tags: formTags,
          pinned: formPinned,
          attachmentIds: finalAttachmentIds,
        });
        if (res.success && res.data.note) {
          setFeedback({ type: 'success', message: 'Note created successfully' });
          handleCloseModal();
          loadNotes();
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save note' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Pin
  const handleTogglePin = async (note: Note, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveMenuNoteId(null);
    try {
      await notesApi.updateNote(note.projectId, note.id, {
        pinned: !note.pinned,
      });
      loadNotes();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update pin' });
    }
  };

  // Delete Note
  const handleDeleteNote = async (note: Note, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveMenuNoteId(null);
    if (!window.confirm(`Are you sure you want to delete note "${note.title}"?`)) return;

    try {
      await notesApi.deleteNote(note.projectId, note.id);
      setFeedback({ type: 'success', message: 'Note deleted' });
      if (viewingNote?.id === note.id) {
        setViewingNote(null);
      }
      loadNotes();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete note' });
    }
  };

  // Render rich formatted content with bold, italic, links, URLs, mentions, and lists
  const renderFormattedContent = (content: string) => {
    if (!content) return null;

    const lines = content.split('\n');

    return lines.map((line, lineIdx) => {
      // Process inline formatting (bold, italic, markdown links, auto URLs, mentions)
      const renderInlineTokens = (text: string): React.ReactNode[] => {
        // Regex matches:
        // 1. Markdown link: \[([^\]]+)\]\(([^)]+)\)
        // 2. HTTP/HTTPS URL: (https?:\/\/[^\s<>()]+)
        // 3. WWW URL: (www\.[^\s<>()]+)
        // 4. Mention: (?:^|(?<=[\s(>]))(@[a-zA-Z0-9_.-]+)
        // 5. Bold: \*\*([^*]+)\*\*|__([^_]+)__
        // 6. Italic: \*([^*]+)\*|_([^_]+)_
        const regex = /(\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|(?:^|(?<=[\s(>]))@[a-zA-Z0-9_.-]+|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;

        const parts = text.split(regex);
        return parts.map((part, i) => {
          if (!part) return null;

          // 1. Markdown link [label](url)
          const mdLinkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
          if (mdLinkMatch) {
            const label = mdLinkMatch[1];
            let href = mdLinkMatch[2].trim();
            if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:')) {
              href = `https://${href}`;
            }
            return (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="note-rendered-link"
                onClick={(e) => e.stopPropagation()}
              >
                {label}
              </a>
            );
          }

          // 2. HTTP/HTTPS URL
          if (/^https?:\/\/[^\s<>()]+$/i.test(part)) {
            return (
              <a
                key={i}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="note-rendered-link"
                onClick={(e) => e.stopPropagation()}
              >
                {part}
              </a>
            );
          }

          // 3. WWW URL
          if (/^www\.[^\s<>()]+$/i.test(part)) {
            return (
              <a
                key={i}
                href={`https://${part}`}
                target="_blank"
                rel="noopener noreferrer"
                className="note-rendered-link"
                onClick={(e) => e.stopPropagation()}
              >
                {part}
              </a>
            );
          }

          // 4. Mentions (@team, @user)
          if (part.startsWith('@')) {
            const tag = part.toLowerCase();
            if (tag === '@team') {
              return (
                <span key={i} className="mention-tag mention-tag-team">
                  {part}
                </span>
              );
            }
            return (
              <span key={i} className="mention-tag mention-tag-user">
                {part}
              </span>
            );
          }

          // 5. Bold **text** or __text__
          const boldMatch = /^(?:\*\*([^*]+)\*\*|__([^_]+)__)$/.exec(part);
          if (boldMatch) {
            return (
              <strong key={i} className="note-rendered-bold">
                {boldMatch[1] || boldMatch[2]}
              </strong>
            );
          }

          // 6. Italic *text* or _text_
          const italicMatch = /^(?:\*([^*]+)\*|_([^_]+)_)$/.exec(part);
          if (italicMatch) {
            return (
              <em key={i} className="note-rendered-italic">
                {italicMatch[1] || italicMatch[2]}
              </em>
            );
          }

          return <span key={i}>{part}</span>;
        });
      };

      // Check for bullet or numbered list
      const isBullet = /^\s*[•\-\*]\s+(.*)$/.exec(line);
      if (isBullet) {
        return (
          <div key={lineIdx} className="note-list-line note-bullet-line">
            <span className="note-list-bullet">•</span>
            <span className="note-list-text">{renderInlineTokens(isBullet[1])}</span>
          </div>
        );
      }

      const isNumbered = /^\s*(\d+\.)\s+(.*)$/.exec(line);
      if (isNumbered) {
        return (
          <div key={lineIdx} className="note-list-line note-numbered-line">
            <span className="note-list-num">{isNumbered[1]}</span>
            <span className="note-list-text">{renderInlineTokens(isNumbered[2])}</span>
          </div>
        );
      }

      return (
        <div key={lineIdx} className="note-content-line">
          {line ? renderInlineTokens(line) : <br />}
        </div>
      );
    });
  };

  const getPalette = (colorName?: string) => {
    return COLOR_PALETTES.find((c) => c.id === colorName) || COLOR_PALETTES[0];
  };

  // Helper to strip leading @username / @team mentions from message display
  const cleanNoteMessage = (content?: string): string => {
    if (!content) return '';
    const cleaned = content.replace(/^(?:\s*@[a-zA-Z0-9_.-]+\s*)+/g, '').trimStart();
    return cleaned;
  };

  return (
    <div className="cal-experience-root notes-page-experience">
      {/* Workspace Header if in Project context */}
      {!hideHeader && project && (
        <ProjectWorkspaceHeader
          project={project}
          currentTab="notes"
          onOpenCreateWorkModal={() => navigate(`/app/projects/${project.id}/board`)}
        />
      )}

      {/* Top Header Row with Atmosphere Banner & Action Button */}
      <div className="cal-page-header notes-page-top-header">
          <div className="cal-header-left">
            <div className="cal-title-row">
              <span className="cal-header-icon-box notes-icon-box">
                <FileTextIcon size={24} />
              </span>
              <h1 className="cal-header-title">Notes</h1>
            </div>
            <p className="cal-header-subtitle">
              Capture ideas, keep track of important information, and collaborate with your team.
            </p>
          </div>

          {/* Atmosphere Quote & Illustration */}
          <NotesHeaderAtmosphere />

          {/* Right Header Action Button */}
          <div className="cal-header-right">
            <button
              type="button"
              className="cal-btn-new-event"
              onClick={handleOpenCreate}
            >
              <PlusIcon size={16} />
              <span>New Note</span>
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`form-feedback-banner ${
              feedback.type === 'success' ? 'feedback-success' : 'feedback-error'
            }`}
            style={{ marginBottom: '1.25rem' }}
          >
            {feedback.type === 'success' ? <CheckIcon size={16} /> : <AlertCircleIcon size={16} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Main Section Card (similar to Files & Storage) */}
        <div className="cal-card-primary notes-card-primary">
          {/* Filter Toolbar */}
          <div className="notes-toolbar-row">
          {/* Search Box */}
          <div className="notes-search-wrap">
            <SearchIcon size={16} className="notes-search-icon" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="notes-search-input"
            />
          </div>

          <div className="notes-filters-group">
            {/* Project Filter (Global mode or active project) */}
            <CustomSelect
              value={activeProjectId || selectedGlobalProject}
              onChange={(val) => {
                if (!activeProjectId) setSelectedGlobalProject(val);
              }}
              disabled={!!activeProjectId}
              compact
              fullWidth={false}
              options={[
                {
                  value: '',
                  label: 'All Projects',
                  icon: <FolderIcon size={15} />,
                  iconBg: '#F3F4F6',
                  iconColor: '#374151',
                },
                ...accessibleProjects.map((p) => ({
                  value: p.id,
                  label: p.name,
                  avatarUrl: p.avatarUrl,
                  initials: !p.avatarUrl ? p.name.trim()[0].toUpperCase() : undefined,
                  icon: !p.avatarUrl ? <FolderIcon size={15} /> : undefined,
                  iconBg: '#1F1F1F',
                  iconColor: '#FFFFFF',
                })),
              ]}
            />

            {/* Tags Filter */}
            <CustomSelect
              value={selectedTagFilter}
              onChange={(val) => setSelectedTagFilter(val)}
              compact
              fullWidth={false}
              options={[
                { value: 'ALL', label: 'All Tags' },
                ...availableTags.map((t) => ({
                  value: t,
                  label: `#${t}`,
                  icon: <HashIcon size={14} />,
                  iconBg: '#FEF3C7',
                  iconColor: '#B45309',
                })),
              ]}
            />

            {/* Scope / Visibility Filter with Favorites */}
            <CustomSelect
              value={visibilityFilter}
              onChange={(val) => setVisibilityFilter(val as any)}
              compact
              fullWidth={false}
              options={[
                {
                  value: 'ALL',
                  label: 'All Notes',
                },
                {
                  value: 'FAVORITES',
                  label: 'Favorites',
                  icon: <HeartIcon size={14} filled />,
                  iconBg: '#FEE2E2',
                  iconColor: '#EF4444',
                },
                {
                  value: 'TEAM',
                  label: 'Team Notes',
                  icon: <UsersIcon size={14} />,
                  iconBg: '#EFF6FF',
                  iconColor: '#2563EB',
                },
                {
                  value: 'USERS',
                  label: 'Private Notes',
                  icon: <LockIcon size={14} />,
                  iconBg: '#FAF5FF',
                  iconColor: '#7E22CE',
                },
              ]}
            />

            {/* Sort Options */}
            <CustomSelect
              value={sortOption}
              onChange={(val) => setSortOption(val as any)}
              compact
              fullWidth={false}
              options={[
                { value: 'recentUpdated', label: 'Last Updated' },
                { value: 'recentCreated', label: 'Recently Created' },
                { value: 'title', label: 'Title (A-Z)' },
              ]}
            />

            {/* View Mode Toggle */}
            <div className="notes-view-mode-group">
              <button
                type="button"
                className={`notes-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <GridIcon size={16} />
              </button>
              <button
                type="button"
                className={`notes-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <ListIcon size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Notes Content */}
        {loading ? (
          <div className="workspace-loading-state" style={{ padding: '4rem' }}>
            <div className="btn-spinner" />
            <p>Loading notes...</p>
          </div>
        ) : displayedNotes.length === 0 ? (
          <div className="notes-empty-card">
            <div className="notes-empty-icon-wrap">
              <FileTextIcon size={44} />
            </div>
            <h3>
              {visibilityFilter === 'FAVORITES'
                ? 'No favorite notes'
                : visibilityFilter === 'TEAM'
                ? 'No team notes'
                : visibilityFilter === 'USERS'
                ? 'No private notes'
                : 'No notes found'}
            </h3>
            <p>
              {visibilityFilter === 'FAVORITES'
                ? 'Click the heart icon on any note to add it to your favorites.'
                : searchQuery || selectedTagFilter !== 'ALL' || visibilityFilter !== 'ALL'
                ? 'No notes match your current search or filter criteria.'
                : 'Capture your first note, brainstorm ideas, or share team documentation.'}
            </p>
            <button
              type="button"
              className="notes-new-btn"
              onClick={handleOpenCreate}
            >
              <PlusIcon size={16} />
              <span>Create Note</span>
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* ==========================================================================
             STICKY NOTES GRID VIEW
             ========================================================================== */
          <div className="notes-sticky-grid">
            {displayedNotes.map((note) => {
              const pal = getPalette(note.color);
              const dateFormatted = new Date(note.updatedAt || note.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              const isFav = favoriteNoteIds.includes(note.id);

              return (
                <div
                  key={note.id}
                  className={`note-sticky-card color-${note.color || 'yellow'}`}
                  style={{ backgroundColor: pal.bg }}
                  onClick={() => setViewingNote(note)}
                >
                  {/* Card Header */}
                  <div className="note-card-header">
                    <h3 className="note-card-title" title={note.title}>
                      {note.title}
                    </h3>

                    <div className="note-card-actions" onClick={(e) => e.stopPropagation()}>
                      {/* Pin Button */}
                      <button
                        type="button"
                        className={`note-card-pin-btn ${note.pinned ? 'is-pinned' : ''}`}
                        title={note.pinned ? 'Unpin note' : 'Pin note'}
                        onClick={(e) => handleTogglePin(note, e)}
                      >
                        <PinIcon size={15} />
                      </button>

                      {/* Favorite Heart Button */}
                      <button
                        type="button"
                        className={`note-card-fav-btn ${isFav ? 'is-favorited' : ''}`}
                        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                        onClick={(e) => handleToggleFavorite(note.id, e)}
                      >
                        <HeartIcon size={15} filled={isFav} />
                      </button>

                      {/* 3 Dots Menu */}
                      <div className="note-card-menu-box">
                        <button
                          type="button"
                          className="note-card-more-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuNoteId(activeMenuNoteId === note.id ? null : note.id);
                          }}
                          aria-label="Options"
                        >
                          <MoreHorizontalIcon size={16} />
                        </button>

                        {activeMenuNoteId === note.id && (
                          <div className="note-card-dropdown" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={(e) => handleOpenEdit(note, e)}
                            >
                              <EditIcon size={14} /> Edit Note
                            </button>
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={(e) => handleTogglePin(note, e)}
                            >
                              <PinIcon size={14} /> {note.pinned ? 'Unpin Note' : 'Pin to Top'}
                            </button>
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={(e) => handleToggleFavorite(note.id, e)}
                            >
                              <HeartIcon size={14} filled={isFav} />
                              {isFav ? 'Remove Favorite' : 'Mark Favorite'}
                            </button>
                            {(note.createdBy?.id === user?.id || project?.userRole === 'PROJECT_ADMIN') && (
                              <button
                                type="button"
                                className="dropdown-item text-danger"
                                onClick={(e) => handleDeleteNote(note, e)}
                              >
                                <TrashIcon size={14} /> Delete Note
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Content Snippet (Only the message text) */}
                  <div className="note-card-body">
                    <div className="note-card-snippet">
                      {(() => {
                        const msg = cleanNoteMessage(note.content) || note.content;
                        return renderFormattedContent(msg.length > 200 ? `${msg.slice(0, 200)}...` : msg);
                      })()}
                    </div>
                  </div>

                  {/* Tags */}
                  {note.tags && note.tags.length > 0 && (
                    <div className="note-card-tags-row">
                      <div className="note-tags-list">
                        {note.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="note-tag-chip"
                            style={{ backgroundColor: pal.tagBg, color: pal.text }}
                          >
                            #{tag}
                          </span>
                        ))}
                        {note.tags.length > 3 && (
                          <span className="note-tag-more">+{note.tags.length - 3}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Card Footer */}
                  <div className="note-card-footer">
                    <div className="note-card-footer-left">
                      <span className="note-date-text">{dateFormatted}</span>
                      {note.attachments && note.attachments.length > 0 && (
                        <span className="note-att-indicator" title={`${note.attachments.length} attachment(s)`}>
                          <PaperclipIcon size={13} />
                          <span>{note.attachments.length}</span>
                        </span>
                      )}
                    </div>

                    <div className="note-card-footer-right">
                      <NoteVisibilityBadge
                        visibility={note.visibility}
                        mentions={note.mentions}
                        size="sm"
                      />
                    </div>
                  </div>

                  {/* Curled corner decoration */}
                  <div className="note-corner-curl" style={{ borderBottomColor: pal.border }} />
                </div>
              );
            })}

            {/* Quick Add Placeholder Card */}
            <div className="note-quick-add-card" onClick={handleOpenCreate}>
              <div className="quick-add-inner">
                <div className="quick-add-icon-box">
                  <PlusIcon size={24} />
                </div>
                <span className="quick-add-text">New Note</span>
              </div>
            </div>
          </div>
        ) : (
          /* ==========================================================================
             COMPACT LIST VIEW
             ========================================================================== */
          <div className="notes-list-table-container">
            <table className="notes-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>Title</th>
                  <th>Tags</th>
                  <th>Visibility</th>
                  {!activeProjectId && <th>Project</th>}
                  <th>Author</th>
                  <th>Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedNotes.map((note) => {
                  const pal = getPalette(note.color);
                  const dateFormatted = new Date(note.updatedAt || note.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const isFav = favoriteNoteIds.includes(note.id);

                  return (
                    <tr
                      key={note.id}
                      className="note-table-row"
                      onClick={() => setViewingNote(note)}
                    >
                      <td>
                        <span
                          className="note-color-dot"
                          style={{ backgroundColor: pal.dot }}
                          title={pal.label}
                        />
                      </td>
                      <td className="note-title-cell">
                        <div className="note-table-title-wrap">
                          <span className="note-table-title">{note.title}</span>
                          {note.pinned && (
                            <span className="pinned-star" title="Pinned">
                              <PinIcon size={12} />
                            </span>
                          )}
                          {isFav && (
                            <span className="pinned-star text-red-500" title="Favorite">
                              <HeartIcon size={12} filled />
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="note-tags-list">
                          {note.tags && note.tags.length > 0 ? (
                            note.tags.slice(0, 2).map((t) => (
                              <span key={t} className="note-tag-chip">
                                #{t}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <NoteVisibilityBadge
                          visibility={note.visibility}
                          mentions={note.mentions}
                          size="sm"
                        />
                      </td>
                      {!activeProjectId && (
                        <td>
                          {note.project ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                              <ProjectAvatar project={note.project} size="xs" />
                              <span className="note-project-pill">{note.project.name}</span>
                            </div>
                          ) : (
                            <span className="note-project-pill">-</span>
                          )}
                        </td>
                      )}
                      <td>
                        <span className="note-author-text">
                          {note.createdBy?.fullName || note.createdBy?.username}
                        </span>
                      </td>
                      <td className="note-date-cell">{dateFormatted}</td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="table-actions-flex">
                          <button
                            type="button"
                            className="table-action-icon-btn"
                            title="Edit note"
                            onClick={(e) => handleOpenEdit(note, e)}
                          >
                            <EditIcon size={14} />
                          </button>
                          <button
                            type="button"
                            className={`table-action-icon-btn ${note.pinned ? 'active' : ''}`}
                            title={note.pinned ? 'Unpin' : 'Pin'}
                            onClick={(e) => handleTogglePin(note, e)}
                          >
                            <PinIcon size={14} />
                          </button>
                          <button
                            type="button"
                            className={`table-action-icon-btn ${isFav ? 'active text-danger' : ''}`}
                            title={isFav ? 'Remove favorite' : 'Mark favorite'}
                            onClick={(e) => handleToggleFavorite(note.id, e)}
                          >
                            <HeartIcon size={14} filled={isFav} />
                          </button>
                          {(note.createdBy?.id === user?.id || project?.userRole === 'PROJECT_ADMIN') && (
                            <button
                              type="button"
                              className="table-action-icon-btn text-danger"
                              title="Delete"
                              onClick={(e) => handleDeleteNote(note, e)}
                            >
                              <TrashIcon size={14} />
                            </button>
                          )}
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

      {/* ==========================================================================
         CREATE / EDIT NOTE MODAL (MATCHES REFERENCE DESIGN)
         ========================================================================== */}
      {isModalOpen && (
        <div className="modal-backdrop note-modal-backdrop" onClick={handleCloseModal} role="dialog" aria-modal="true">
          <div
            className="modal-container note-editor-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header with Slogan & 3D Artwork */}
            <div className="note-modal-header">
              <div className="note-modal-header-left">
                <div className="note-modal-icon-box">
                  <FileTextIcon size={22} />
                </div>
                <div className="note-modal-header-texts">
                  <h2>{isEditing ? 'Edit Note' : 'Create Note'}</h2>
                  <p>Capture your thoughts, ideas, or important information.</p>
                </div>
              </div>

              {/* Right Slogan Quote + 3D Illustration + Close Button */}
              <div className="note-modal-header-right">
                <div className="note-header-quote">
                  <span className="note-quote-text">Ideas</span>
                  <span className="note-quote-text">today,</span>
                  <span className="note-quote-text">progress</span>
                  <span className="note-quote-text">tomorrow.</span>
                  <svg className="note-quote-arrow-svg" width="32" height="24" viewBox="0 0 32 24" fill="none">
                    <path d="M2 18 C10 8, 20 6, 28 4" stroke="#64748B" strokeWidth="1.5" strokeDasharray="3 2" strokeLinecap="round" />
                    <path d="M22 2 L29 4 L26 10" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <div className="note-header-3d-art">
                  {/* Sparkle Pill */}
                  <div className="note-sparkle-pill">✓</div>

                  {/* 3D Notepad Sheet */}
                  <div className="note-3d-sheet">
                    <div className="note-sheet-clip" />
                    <div className="note-sheet-bar bar-blue" />
                    <div className="note-sheet-bar bar-gray-1" />
                    <div className="note-sheet-bar bar-gray-2" />
                    <div className="note-sheet-bar bar-gray-3" />
                  </div>

                  {/* 3D Pencil Graphic */}
                  <svg className="note-3d-pencil" width="38" height="52" viewBox="0 0 38 52" fill="none">
                    {/* Pink Eraser */}
                    <path d="M22 4 C24 1, 28 2, 30 5 L34 11 L26 16 L22 10 Z" fill="#FB7185" />
                    {/* Silver Ferrule */}
                    <path d="M26 16 L34 11 L32 14 L24 19 Z" fill="#CBD5E1" />
                    <path d="M24 19 L32 14 L30 17 L22 22 Z" fill="#94A3B8" />
                    {/* Yellow Hexagonal Body */}
                    <path d="M22 22 L30 17 L16 38 L8 43 Z" fill="#FBBF24" />
                    <path d="M18 25 L26 20 L13 40 L6 44 Z" fill="#F59E0B" />
                    {/* Sharpened Wooden Tip */}
                    <path d="M8 43 L16 38 L2 49 Z" fill="#FDE68A" />
                    {/* Graphite Lead Tip */}
                    <path d="M4 47 L6 45 L0 52 Z" fill="#0F172A" />
                  </svg>

                  <span className="note-sparkle-ray">✦</span>
                </div>

                <button
                  type="button"
                  className="note-modal-close-btn"
                  onClick={handleCloseModal}
                  aria-label="Close"
                >
                  <CloseIcon size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body / 2-Column Grid */}
            <form onSubmit={handleSaveNote} className="note-modal-form">
              <div className="note-modal-grid-body">
                {/* Left Column: Form Fields */}
                <div className="note-form-left-col">
                  {/* Title Field with Icon */}
                  <div className="note-form-group">
                    <label htmlFor="note-modal-title" className="note-field-label">
                      Title <span className="note-star">*</span>
                    </label>
                    <div className="note-input-container">
                      <span className="note-input-leading-icon">
                        <FileTextIcon size={16} />
                      </span>
                      <input
                        id="note-modal-title"
                        type="text"
                        className="note-modal-text-input"
                        placeholder="e.g. Meeting notes, Ideas, To do..."
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Content & Toolbar */}
                  <div className="note-form-group">
                    <label className="note-field-label">
                      Content <span className="note-star">*</span>
                    </label>

                    <div className="note-editor-wrapper">
                      {/* Formatting Toolbar Strip */}
                      <div className="note-toolbar-strip">
                        <div className="note-toolbar-actions-left">
                          <button
                            type="button"
                            className={`note-tool-btn font-bold ${isBoldActive ? 'active' : ''}`}
                            title="Bold"
                            onClick={handleToggleBold}
                          >
                            <strong>B</strong>
                          </button>
                          <button
                            type="button"
                            className={`note-tool-btn font-italic ${isItalicActive ? 'active' : ''}`}
                            title="Italic"
                            onClick={handleToggleItalic}
                          >
                            <em>I</em>
                          </button>
                          <button
                            type="button"
                            className="note-tool-btn"
                            title="Underline"
                            onClick={handleToggleUnderline}
                          >
                            <u>U</u>
                          </button>
                          <button
                            type="button"
                            className="note-tool-btn"
                            title="Bullet List"
                            onClick={handleInsertBullet}
                          >
                            <ListIcon size={14} />
                          </button>
                          <button
                            type="button"
                            className="note-tool-btn"
                            title="Numbered List"
                            onClick={handleInsertNumbered}
                          >
                            <span style={{ fontSize: '11px', fontWeight: 600 }}>1.</span>
                          </button>
                          <button
                            type="button"
                            className="note-tool-btn"
                            title="Insert Link"
                            onClick={handleInsertLink}
                          >
                            <LinkIcon size={14} />
                          </button>
                        </div>

                        <div className="note-toolbar-actions-right">
                          <div className="note-mention-dropdown-wrapper" ref={mentionMenuContainerRef}>
                            <button
                              type="button"
                              className={`note-mention-pill-btn ${isMentionMenuOpen ? 'active' : ''}`}
                              onClick={() => {
                                setIsMentionMenuOpen((prev) => !prev);
                                setMentionMenuSearch('');
                              }}
                              title="Mention teammate or @team"
                            >
                              <UsersIcon size={13} />
                              <span>@ Mention</span>
                              <span className="mention-caret-arrow">▾</span>
                            </button>

                            {isMentionMenuOpen && (
                              <div className="note-mention-toolbar-menu">
                                <div className="nmtm-header">
                                  <span className="nmtm-title">Mention Team</span>
                                  <span className="nmtm-count">{(members?.length || 0) + 1} options</span>
                                </div>
                                <div className="nmtm-search-box">
                                  <SearchIcon size={13} className="nmtm-search-icon" />
                                  <input
                                    type="text"
                                    className="nmtm-search-input"
                                    placeholder="Search name or username..."
                                    value={mentionMenuSearch}
                                    onChange={(e) => setMentionMenuSearch(e.target.value)}
                                    autoFocus
                                  />
                                  {mentionMenuSearch && (
                                    <button
                                      type="button"
                                      className="nmtm-clear-btn"
                                      onClick={() => setMentionMenuSearch('')}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>

                                <div className="nmtm-list">
                                  {/* @team option */}
                                  {('team'.includes(mentionMenuSearch.toLowerCase().trim()) || mentionMenuSearch.trim() === '') && (() => {
                                    const isTeamAdded = isHandleAlreadyMentioned('team', formContent);
                                    return (
                                      <button
                                        type="button"
                                        disabled={isTeamAdded}
                                        className={`nmtm-item ${isTeamAdded ? 'already-selected disabled' : ''}`}
                                        onClick={() => !isTeamAdded && handleInsertDirectMention('team')}
                                      >
                                        <div className="nmtm-item-avatar team-icon-box">
                                          <UsersIcon size={14} />
                                        </div>
                                        <div className="nmtm-item-info">
                                          <div className="nmtm-item-title-row">
                                            <span className="nmtm-item-name">All Project Members</span>
                                            <span className="nmtm-item-chip chip-team">@team</span>
                                          </div>
                                          <span className="nmtm-item-sub">Notify and share with everyone</span>
                                        </div>
                                        {isTeamAdded ? (
                                          <span className="nmtm-check-badge">✓ Added</span>
                                        ) : (
                                          <span className="nmtm-add-plus">+ Add</span>
                                        )}
                                      </button>
                                    );
                                  })()}

                                  {/* Members list */}
                                  {(members || [])
                                    .filter((m) => {
                                      if (!m?.user?.username) return false;
                                      const q = mentionMenuSearch.toLowerCase().trim();
                                      if (!q) return true;
                                      const uname = (m.user.username || '').toLowerCase();
                                      const fname = (m.user.fullName || '').toLowerCase();
                                      return uname.includes(q) || fname.includes(q);
                                    })
                                    .map((m) => {
                                      const uname = m.user.username;
                                      const isAdded = isHandleAlreadyMentioned(uname, formContent);
                                      const displayRole = m.isCreator
                                        ? 'Owner'
                                        : m.role === 'PROJECT_ADMIN'
                                        ? 'Admin'
                                        : 'Member';

                                      return (
                                        <button
                                          type="button"
                                          key={m.userId || m.id}
                                          disabled={isAdded}
                                          className={`nmtm-item ${isAdded ? 'already-selected disabled' : ''}`}
                                          onClick={() => !isAdded && handleInsertDirectMention(uname)}
                                        >
                                          <div className="nmtm-item-avatar">
                                            {m.user.avatarUrl ? (
                                              <img src={m.user.avatarUrl} alt="" />
                                            ) : (
                                              <span>{(uname || 'U').slice(0, 2).toUpperCase()}</span>
                                            )}
                                          </div>
                                          <div className="nmtm-item-info">
                                            <div className="nmtm-item-title-row">
                                              <span className="nmtm-item-name">{m.user.fullName || uname}</span>
                                              <span className="nmtm-item-chip">@{uname}</span>
                                              <span className={`nmtm-role-pill role-${displayRole.toLowerCase()}`}>
                                                {displayRole}
                                              </span>
                                            </div>
                                            {m.user.fullName && uname !== m.user.fullName && (
                                              <span className="nmtm-item-sub">@{uname}</span>
                                            )}
                                          </div>
                                          {isAdded ? (
                                            <span className="nmtm-check-badge">✓ Added</span>
                                          ) : (
                                            <span className="nmtm-add-plus">+ Add</span>
                                          )}
                                        </button>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            className="note-tool-btn"
                            title="Expand"
                          >
                            ⤢
                          </button>
                        </div>
                      </div>

                      <MentionComposer
                        value={formContent}
                        onChange={setFormContent}
                        members={members}
                        rows={4}
                        textareaRef={contentTextareaRef}
                        placeholder="Write your note here... Use @team for team or @username for private notes."
                      />

                      <div className="note-char-counter">
                        {formContent.length}/2000
                      </div>
                    </div>
                  </div>

                  {/* 2-Column: Project + Tags */}
                  <div className="note-form-two-col">
                    {/* Project Selector */}
                    <div className="note-form-group">
                      <label className="note-field-label">Project (Optional)</label>
                      <CustomSelect
                        value={formProjectId}
                        onChange={(val) => setFormProjectId(val)}
                        placeholder="Select a project..."
                        options={accessibleProjects.map((p) => ({
                          value: p.id,
                          label: p.name,
                          avatarUrl: p.avatarUrl,
                          initials: !p.avatarUrl ? p.name.trim()[0].toUpperCase() : undefined,
                          icon: !p.avatarUrl ? <FolderIcon size={14} /> : undefined,
                          iconBg: '#1F1F1F',
                          iconColor: '#FFFFFF',
                        }))}
                      />
                    </div>

                    {/* Tags Input */}
                    <div className="note-form-group">
                      <label className="note-field-label">Tags (Optional)</label>
                      <div className="note-tags-input-wrap">
                        <span className="note-tags-hash-icon">#</span>
                        <input
                          type="text"
                          className="note-tags-input"
                          placeholder="Add tags (press Enter)..."
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={handleAddTag}
                        />
                      </div>

                      {formTags.length > 0 && (
                        <div className="note-tags-pills-list">
                          {formTags.map((tag) => (
                            <span key={tag} className="note-form-tag-pill">
                              #{tag}
                              <button
                                type="button"
                                className="tag-remove-btn"
                                onClick={() => handleRemoveTag(tag)}
                              >
                                <CloseIcon size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2-Column: Color + Pin */}
                  <div className="note-form-two-col align-center">
                    {/* Color Selector */}
                    <div className="note-form-group">
                      <label className="note-field-label">Color</label>
                      <div className="note-color-picker-row">
                        {COLOR_PALETTES.map((pal) => {
                          const isSelected = formColor === pal.id;
                          return (
                            <button
                              key={pal.id}
                              type="button"
                              className={`note-color-choice-btn ${isSelected ? 'selected' : ''}`}
                              style={{ backgroundColor: pal.dot }}
                              onClick={() => setFormColor(pal.id)}
                              title={pal.label}
                            >
                              {isSelected && <CheckIcon size={13} className="color-choice-check" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pin this note toggle */}
                    <div className="note-pin-toggle-card">
                      <div className="pin-toggle-left">
                        <span className="pin-toggle-icon">📌</span>
                        <div className="pin-toggle-text">
                          <span className="pin-toggle-title">Pin this note</span>
                          <span className="pin-toggle-sub">Keep this note at the top</span>
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={formPinned}
                        onChange={(e) => setFormPinned(e.target.checked)}
                        className="note-pin-checkbox"
                      />
                    </div>
                  </div>

                  {/* Attachments Section */}
                  <div className="note-attachments-card">
                    <div className="attachments-card-left">
                      <div className="attachments-squircle-icon">
                        <PaperclipIcon size={16} />
                      </div>
                      <div className="attachments-card-texts">
                        <span className="attachments-card-title">Attachments (Optional)</span>
                        <span className="attachments-card-sub">Add files, images, or documents (max 10 MB each)</span>
                      </div>
                    </div>

                    <input
                      type="file"
                      ref={noteFileInputRef}
                      multiple
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      className="note-attach-pill-btn"
                      onClick={() => noteFileInputRef.current?.click()}
                    >
                      <UploadCloudIcon size={14} />
                      <span>Attach Files</span>
                    </button>
                  </div>

                  {/* Chips of existing + newly attached files */}
                  {(existingAttachments.length > 0 || attachedFiles.length > 0) && (
                    <div className="note-attached-chips-grid">
                      {existingAttachments.map((att) => (
                        <div key={att.id} className="note-file-chip">
                          <PaperclipIcon size={13} />
                          <span title={att.originalName}>{att.originalName}</span>
                          <span style={{ opacity: 0.6 }}>({formatFileSize(att.sizeBytes)})</span>
                          <button
                            type="button"
                            className="note-file-chip-remove"
                            onClick={() => handleRemoveExistingAttachment(att.id)}
                            title="Remove attachment"
                          >
                            <CloseIcon size={12} />
                          </button>
                        </div>
                      ))}

                      {attachedFiles.map((file, idx) => (
                        <div key={idx} className="note-file-chip">
                          <UploadCloudIcon size={13} />
                          <span title={file.name}>{file.name}</span>
                          <span style={{ opacity: 0.6 }}>({formatFileSize(file.size)})</span>
                          <button
                            type="button"
                            className="note-file-chip-remove"
                            onClick={() => handleRemoveNewFile(idx)}
                            title="Remove file"
                          >
                            <CloseIcon size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Column: Live Sticky Note Preview */}
                <div className="note-preview-right-col">
                  <div className="note-preview-header">
                    <h3>Preview</h3>
                    <p>This is how your note will look.</p>
                  </div>

                  {/* Dynamic Sticky Note Preview Card */}
                  <div
                    className="note-live-preview-card"
                    style={{ backgroundColor: getPalette(formColor).bg }}
                  >
                    {/* Pushpin at top right */}
                    <div className="preview-pushpin-pin">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="7" r="5" fill="#EF4444" />
                        <path d="M12 12V22" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="10" cy="5.5" r="1.5" fill="#FCA5A5" />
                      </svg>
                    </div>

                    <div className="preview-card-inner">
                      <h4 className="preview-note-title">
                        {formTitle.trim() || 'Note Title'}
                      </h4>

                      <div className="preview-note-content">
                        {renderFormattedContent(
                          cleanNoteMessage(formContent).trim() ||
                            formContent.trim() ||
                            'Your note content will appear here...'
                        )}
                      </div>

                      <div className="preview-note-footer">
                        <div className="preview-footer-left">
                          <span className="preview-project-pill">
                            <FolderIcon size={12} />
                            <span>
                              {accessibleProjects.find((p) => p.id === (activeProjectId || formProjectId))?.name ||
                                project?.name ||
                                'test'}
                            </span>
                          </span>

                          <span className="preview-tag-pill">
                            <TagIcon size={12} />
                            <span>#{formTags[0] || 'tag'}</span>
                          </span>
                        </div>

                        <div className="preview-footer-right">
                          <span>
                            {new Date().toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Folded Curled Corner */}
                    <div
                      className="note-corner-curl"
                      style={{ borderBottomColor: getPalette(formColor).border }}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="note-modal-footer">
                <button
                  type="button"
                  className="note-modal-cancel-btn"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="note-modal-submit-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="cwm-btn-spinner" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <FileTextIcon size={15} />
                      <span>{isEditing ? 'Save Changes' : 'Create Note'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
         NOTE DETAILS MODAL (MATCHING REFERENCE MOCKUP SCREENSHOT)
         ========================================================================== */}
      <NoteDetailsModal
        note={viewingNote}
        isOpen={Boolean(viewingNote)}
        onClose={() => setViewingNote(null)}
        onEdit={(n) => {
          setViewingNote(null);
          handleOpenEdit(n);
        }}
        onDelete={(n) => {
          handleDeleteNote(n);
          setViewingNote(null);
        }}
        onTogglePin={(n) => {
          handleTogglePin(n);
        }}
        onUpdated={(updatedNote) => {
          setNotes((prev) => prev.map((x) => (x.id === updatedNote.id ? updatedNote : x)));
          setViewingNote(updatedNote);
        }}
        project={project}
        accessibleProjects={accessibleProjects}
      />

      {/* Universal File Viewer Modal for Note Attachments */}
      {selectedFileForViewer && (
        <FileViewerModal
          file={selectedFileForViewer}
          onClose={() => setSelectedFileForViewer(null)}
          onFileUpdated={loadNotes}
          onFileDeleted={loadNotes}
          canEdit={
            selectedFileForViewer.uploadedById === user?.id ||
            project?.userRole === 'PROJECT_ADMIN'
          }
          canDelete={
            selectedFileForViewer.uploadedById === user?.id ||
            project?.userRole === 'PROJECT_ADMIN'
          }
        />
      )}
    </div>
  );
};
