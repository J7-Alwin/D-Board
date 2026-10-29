import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Project } from '../../api/projects.api';
import {
  workApi,
  type WorkItem,
  type WorkItemActivity,
  type WorkItemStatus,
  type WorkItemPriority,
  type WorkItemType,
  type WorkItemAssignee,
} from '../../api/work.api';
import { commentsApi } from '../../api/comments.api';
import { filesApi, type AttachmentDTO } from '../../api/files.api';
import { membersApi, type ProjectMemberDetail } from '../../api/members.api';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useProjectSocket } from '../../context/SocketContext';
import { useActiveTimer } from '../../context/ActiveTimerContext';
import {
  CloseIcon,
  TrashIcon,
  MessageSquareIcon,
  ActivityIcon,
  ClockIcon,
  UserIcon,
  CalendarIcon,
  SendIcon,
  FolderIcon,
  UploadCloudIcon,
  DownloadIcon,
  ArrowDownIcon,
  BarChartIcon,
  DoubleArrowUpIcon,
  AlertCircleIcon,
  BugIcon,
  CodeIcon,
  TrendingUpIcon,
  FileTextIcon,
  CheckSquareIcon,
  PlayIcon,
  PauseIcon,
  CheckIcon,
  MoreVerticalIcon,
  PaperclipIcon,
  RotateCcwIcon,
  AtSignIcon,
  ChatBubblesIcon,
  CircleDotIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PlusIcon,
  BanIcon,
  EyeIcon,
  ImageIcon,
  LockIcon,
  GlobeIcon,
  SearchIcon,
} from '../ui/Icons';
import { Button } from '../ui/Button';
import { CustomSelect } from '../ui/CustomSelect';
import { FileViewerModal } from '../files/FileViewerModal';
import { FileUploadModal } from '../files/FileUploadModal';
import { DeleteWorkItemModal } from './DeleteWorkItemModal';

interface WorkItemDetailsModalProps {
  project: Project;
  workItemId: string | null;
  initialWorkItem?: WorkItem | null;
  onClose: () => void;
  onUpdated: (updatedItem: WorkItem) => void;
  onDeleted: (deletedItemId: string) => void;
}

export const WorkItemDetailsModal: React.FC<WorkItemDetailsModalProps> = ({
  project,
  workItemId,
  initialWorkItem,
  onClose,
  onUpdated,
  onDeleted,
}) => {
  const { user } = useAuth();
  const { requestStartTask, requestResumeTask, pauseActiveTask, checkInActiveTask } = useActiveTimer();
  const { socket, isConnected } = useProjectSocket(project.id);
  const [workItem, setWorkItem] = useState<WorkItem | null>(initialWorkItem || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comments & Attachments state
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'attachments' | 'activity'>('comments');

  const [attachments, setAttachments] = useState<AttachmentDTO[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [attachmentSort, setAttachmentSort] = useState<'newest' | 'oldest' | 'name' | 'size'>('newest');
  const [uploadIsPrivate, setUploadIsPrivate] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const modalBodyRef = React.useRef<HTMLDivElement>(null);

  const [selectedFileForViewer, setSelectedFileForViewer] = useState<AttachmentDTO | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Options menu state (3 dots)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingWorkItem, setIsDeletingWorkItem] = useState(false);
  const [loadedMembers, setLoadedMembers] = useState<ProjectMemberDetail[]>([]);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');

  // Always load live project members so assignable options are never missing
  useEffect(() => {
    if (!project?.id) return;
    let isMounted = true;
    membersApi
      .getProjectMembers(project.id)
      .then((res) => {
        if (isMounted && res.success && res.data?.members) {
          setLoadedMembers(res.data.members);
        }
      })
      .catch(() => { });
    return () => {
      isMounted = false;
    };
  }, [project?.id]);

  const assignableUsers = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        username?: string;
        role: 'Owner' | 'Admin' | 'Member';
        badgeType: 'owner' | 'admin' | 'member';
        avatarUrl?: string | null;
        initials?: string;
      }
    >();

    // 1. Owner from prop project
    if (project.createdBy) {
      map.set(project.createdById, {
        id: project.createdById,
        name: `${project.createdBy.fullName || project.createdBy.username} (Owner)`,
        username: project.createdBy.username,
        role: 'Owner',
        badgeType: 'owner',
        avatarUrl: project.createdBy.avatarUrl,
        initials: (project.createdBy.fullName || project.createdBy.username).charAt(0).toUpperCase(),
      });
    }

    // 2. Members from prop project
    if (project.members) {
      project.members.forEach((m) => {
        if (!map.has(m.userId)) {
          map.set(m.userId, {
            id: m.userId,
            name: m.user.fullName || m.user.username,
            username: m.user.username,
            role: m.role === 'PROJECT_ADMIN' ? 'Admin' : 'Member',
            badgeType: m.role === 'PROJECT_ADMIN' ? 'admin' : 'member',
            avatarUrl: m.user.avatarUrl,
            initials: (m.user.fullName || m.user.username).charAt(0).toUpperCase(),
          });
        }
      });
    }

    // 3. Members loaded live from members API
    loadedMembers.forEach((m) => {
      if (!map.has(m.userId)) {
        map.set(m.userId, {
          id: m.userId,
          name: m.isCreator
            ? `${m.user.fullName || m.user.username} (Owner)`
            : m.user.fullName || m.user.username,
          username: m.user.username,
          role: m.isCreator ? 'Owner' : m.role === 'PROJECT_ADMIN' ? 'Admin' : 'Member',
          badgeType: m.isCreator ? 'owner' : m.role === 'PROJECT_ADMIN' ? 'admin' : 'member',
          avatarUrl: m.user.avatarUrl,
          initials: (m.user.fullName || m.user.username).charAt(0).toUpperCase(),
        });
      }
    });

    // 4. Guarantee current workItem.assignedTo is always present
    if (workItem?.assignedTo && workItem.assignedToId && !map.has(workItem.assignedToId)) {
      map.set(workItem.assignedToId, {
        id: workItem.assignedToId,
        name: workItem.assignedTo.fullName || workItem.assignedTo.username,
        role: 'Member',
        badgeType: 'member',
        avatarUrl: workItem.assignedTo.avatarUrl,
        initials: (workItem.assignedTo.fullName || workItem.assignedTo.username).charAt(0).toUpperCase(),
      });
    }

    return Array.from(map.values());
  }, [project, loadedMembers, workItem?.assignedTo, workItem?.assignedToId]);

  // Load attachments helper
  const loadAttachments = useCallback(async () => {
    if (!workItemId) return;
    setLoadingAttachments(true);
    try {
      const res = await filesApi.getProjectFiles(project.id, { workItemId });
      if (res.success) {
        setAttachments(res.data.files);
      }
    } catch { }
    finally {
      setLoadingAttachments(false);
    }
  }, [project.id, workItemId]);

  const handleDirectUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0 || !workItemId) return;
    setUploadingFiles(true);
    setError(null);
    try {
      const fileArray = Array.from(files);
      await filesApi.uploadFiles(project.id, fileArray, { workItemId, isPrivate: uploadIsPrivate });
      await loadAttachments();
    } catch (err: any) {
      setError(err.message || 'Failed to upload attachments');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDeleteAttachment = async (fileId: string) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) return;
    try {
      await filesApi.deleteFile(project.id, fileId);
      await loadAttachments();
    } catch (err: any) {
      setError(err.message || 'Failed to delete attachment');
    }
  };

  const handleToggleFilePrivacy = async (att: AttachmentDTO) => {
    try {
      const nextPrivacy = !att.isPrivate;
      await filesApi.updateFileVisibility(project.id, att.id, nextPrivacy);
      await loadAttachments();
    } catch (err: any) {
      setError(err.message || 'Failed to update file privacy');
    }
  };

  const sortedAttachments = useMemo(() => {
    const list = [...attachments];
    if (attachmentSort === 'newest') {
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (attachmentSort === 'oldest') {
      return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (attachmentSort === 'name') {
      return list.sort((a, b) => a.originalName.localeCompare(b.originalName));
    } else if (attachmentSort === 'size') {
      return list.sort((a, b) => b.sizeBytes - a.sizeBytes);
    }
    return list;
  }, [attachments, attachmentSort]);

  const getFileIconBadge = (att: AttachmentDTO) => {
    const ext = att.extension ? att.extension.toLowerCase().replace('.', '') : '';
    const isImg = att.category === 'IMAGE' || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
    const isDoc =
      att.category === 'DOCUMENT' ||
      att.category === 'PDF' ||
      att.category === 'TEXT' ||
      ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'csv', 'xlsx'].includes(ext);
    const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext);

    if (isImg) {
      return (
        <div className="widm-file-type-badge image">
          <ImageIcon size={18} />
        </div>
      );
    }
    if (isDoc) {
      return (
        <div className="widm-file-type-badge doc">
          <FileTextIcon size={18} />
        </div>
      );
    }
    if (isVideo) {
      return (
        <div className="widm-file-type-badge video">
          <PlayIcon size={16} />
        </div>
      );
    }
    return (
      <div className="widm-file-type-badge other">
        <FolderIcon size={18} />
      </div>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const allActivities = useMemo(() => {
    const list: WorkItemActivity[] = workItem?.activities ? [...workItem.activities] : [];
    if (list.length === 0 && workItem) {
      const creatorSummary = workItem.createdBy || {
        id: workItem.createdById,
        fullName: 'Alwin James',
        username: 'alwin',
        avatarUrl: null,
      };

      list.push({
        id: 'init-created',
        projectId: project.id,
        actorId: workItem.createdById,
        actor: creatorSummary,
        type: 'WORK_ITEM_CREATED',
        createdAt: workItem.createdAt,
      });

      if (workItem.assignedTo) {
        list.push({
          id: 'init-assigned',
          projectId: project.id,
          actorId: workItem.createdById,
          actor: creatorSummary,
          type: 'ASSIGNED',
          metadata: { assignedToName: workItem.assignedTo.fullName || workItem.assignedTo.username },
          createdAt: workItem.updatedAt || workItem.createdAt,
        });
      }
    }
    return list;
  }, [workItem, project.id]);

  const groupedActivities = useMemo(() => {
    if (allActivities.length === 0) return [];

    const sorted = [...allActivities].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const groups: { dateLabel: string; items: WorkItemActivity[] }[] = [];
    sorted.forEach((act) => {
      const d = new Date(act.createdAt);
      const dateLabel = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      let group = groups.find((g) => g.dateLabel === dateLabel);
      if (!group) {
        group = { dateLabel, items: [] };
        groups.push(group);
      }
      group.items.push(act);
    });
    return groups;
  }, [allActivities]);

  const renderActivityItem = (act: WorkItemActivity) => {
    const actorName = act.actor?.fullName || act.actor?.username || 'Alwin James';
    const typeUpper = act.type.toUpperCase();
    const timeFormatted =
      new Date(act.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) +
      ', ' +
      new Date(act.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

    // 1. Status Changed
    if (typeUpper.includes('STATUS')) {
      const statusVal =
        act.metadata?.newStatus ||
        act.metadata?.status ||
        act.metadata?.to ||
        act.type.replace(/STATUS_/i, '').replace(/_/g, ' ');
      const formattedStatus =
        statusVal === 'TODO'
          ? 'To Do'
          : statusVal === 'IN_PROGRESS'
            ? 'In Progress'
            : statusVal === 'BLOCKED'
              ? 'Canceled'
              : statusVal === 'IN_REVIEW'
                ? 'In Review'
                : statusVal === 'COMPLETED'
                  ? 'Completed'
                  : statusVal;

      return (
        <div key={act.id} className="widm-activity-timeline-item">
          <div className="widm-activity-node-col">
            <span className="widm-activity-node-dot" />
          </div>
          <div className="widm-activity-card">
            <div className="widm-activity-icon-badge pink">
              <ChevronUpIcon size={16} />
            </div>
            <div className="widm-activity-main-info">
              <span className="widm-activity-title">
                Status changed to <strong>{formattedStatus}</strong>
              </span>
              <span className="widm-activity-actor">by {actorName}</span>
            </div>
            <span className="widm-activity-timestamp">{timeFormatted}</span>
          </div>
        </div>
      );
    }

    // 2. Priority Changed
    if (typeUpper.includes('PRIORITY')) {
      const prioVal =
        act.metadata?.newPriority ||
        act.metadata?.priority ||
        act.metadata?.to ||
        'Medium';
      const formattedPrio =
        prioVal === 'LOW'
          ? 'Low'
          : prioVal === 'MEDIUM'
            ? 'Medium'
            : prioVal === 'HIGH'
              ? 'High'
              : prioVal === 'URGENT'
                ? 'Urgent'
                : prioVal;

      return (
        <div key={act.id} className="widm-activity-timeline-item">
          <div className="widm-activity-node-col">
            <span className="widm-activity-node-dot" />
          </div>
          <div className="widm-activity-card">
            <div className="widm-activity-icon-badge amber">
              <BarChartIcon size={16} />
            </div>
            <div className="widm-activity-main-info">
              <span className="widm-activity-title">
                Priority changed to <strong>{formattedPrio}</strong>
              </span>
              <span className="widm-activity-actor">by {actorName}</span>
            </div>
            <span className="widm-activity-timestamp">{timeFormatted}</span>
          </div>
        </div>
      );
    }

    // 3. Assigned to
    if (typeUpper.includes('ASSIGN')) {
      const assignedName =
        act.metadata?.assignedToName ||
        act.metadata?.assignedTo?.fullName ||
        act.metadata?.assignedTo?.username ||
        act.metadata?.assignedTo ||
        'alwin';

      return (
        <div key={act.id} className="widm-activity-timeline-item">
          <div className="widm-activity-node-col">
            <span className="widm-activity-node-dot" />
          </div>
          <div className="widm-activity-card">
            <div className="widm-activity-icon-badge blue">
              <UserIcon size={16} />
            </div>
            <div className="widm-activity-main-info">
              <span className="widm-activity-title">
                Assigned to <strong>{assignedName}</strong>
              </span>
              <span className="widm-activity-actor">by {actorName}</span>
            </div>
            <span className="widm-activity-timestamp">{timeFormatted}</span>
          </div>
        </div>
      );
    }

    // 4. Attachment / File
    if (typeUpper.includes('FILE') || typeUpper.includes('ATTACHMENT')) {
      const fileName =
        act.metadata?.fileName ||
        act.metadata?.originalName ||
        act.metadata?.name ||
        'error_screenshot.png';

      return (
        <div key={act.id} className="widm-activity-timeline-item">
          <div className="widm-activity-node-col">
            <span className="widm-activity-node-dot" />
          </div>
          <div className="widm-activity-card">
            <div className="widm-activity-icon-badge emerald">
              <PaperclipIcon size={16} />
            </div>
            <div className="widm-activity-main-info">
              <div className="widm-activity-title-with-chip">
                <span>Added attachment</span>
                <span className="widm-activity-file-chip">{fileName}</span>
              </div>
              <span className="widm-activity-actor">by {actorName}</span>
            </div>
            <span className="widm-activity-timestamp">{timeFormatted}</span>
          </div>
        </div>
      );
    }

    // 5. Work Item Created / Created
    if (typeUpper.includes('CREATE') || typeUpper.includes('INIT')) {
      return (
        <div key={act.id} className="widm-activity-timeline-item">
          <div className="widm-activity-node-col">
            <span className="widm-activity-node-dot" />
          </div>
          <div className="widm-activity-card">
            <div className="widm-activity-icon-badge gray">
              <FileTextIcon size={16} />
            </div>
            <div className="widm-activity-main-info">
              <span className="widm-activity-title">Work item created</span>
              <span className="widm-activity-actor">by {actorName}</span>
            </div>
            <span className="widm-activity-timestamp">{timeFormatted}</span>
          </div>
        </div>
      );
    }

    // Generic Activity
    return (
      <div key={act.id} className="widm-activity-timeline-item">
        <div className="widm-activity-node-col">
          <span className="widm-activity-node-dot" />
        </div>
        <div className="widm-activity-card">
          <div className="widm-activity-icon-badge purple">
            <ActivityIcon size={16} />
          </div>
          <div className="widm-activity-main-info">
            <span className="widm-activity-title">
              {act.type.toLowerCase().replace(/_/g, ' ')}
            </span>
            <span className="widm-activity-actor">by {actorName}</span>
          </div>
          <span className="widm-activity-timestamp">{timeFormatted}</span>
        </div>
      </div>
    );
  };

  const loadWorkItemData = useCallback(async () => {
    if (!workItemId) {
      setWorkItem(null);
      return;
    }

    try {
      const res = await workApi.getWorkItemById(project.id, workItemId);
      if (res.success && res.data.workItem) {
        setWorkItem(res.data.workItem);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load work item details');
    }
  }, [project.id, workItemId]);

  // Load work item details
  useEffect(() => {
    if (!workItemId) {
      setWorkItem(null);
      return;
    }

    let isMounted = true;
    if (initialWorkItem && initialWorkItem.id === workItemId) {
      setWorkItem(initialWorkItem);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    Promise.all([
      workApi.getWorkItemById(project.id, workItemId).then((res) => {
        if (isMounted && res.success && res.data.workItem) {
          setWorkItem(res.data.workItem);
        }
      }),
      filesApi.getProjectFiles(project.id, { workItemId }).then((res) => {
        if (isMounted && res.success) {
          setAttachments(res.data.files);
        }
      }),
    ])
      .catch((err: any) => {
        if (isMounted) setError(err.message || 'Failed to load work item details');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [workItemId, project.id]);

  // Real-time synchronization for comments & attachments
  useEffect(() => {
    if (!socket || !isConnected || !workItemId) return;

    const handleCommentEvent = (payload: any) => {
      if (payload.workItemId === workItemId) {
        loadWorkItemData();
      }
    };

    const handleFileEvent = (payload: any) => {
      if (payload.workItemId === workItemId) {
        loadAttachments();
      }
    };

    const handleWorkItemSocketUpdate = (payload: any) => {
      if (payload?.id === workItemId || payload?.workItem?.id === workItemId) {
        loadWorkItemData();
      }
    };

    socket.on('WORK_ITEM_UPDATED', handleWorkItemSocketUpdate);
    socket.on('COMMENT_CREATED', handleCommentEvent);
    socket.on('COMMENT_UPDATED', handleCommentEvent);
    socket.on('COMMENT_DELETED', handleCommentEvent);
    socket.on('FILE_UPLOADED', handleFileEvent);
    socket.on('FILE_RENAMED', handleFileEvent);
    socket.on('FILE_DELETED', handleFileEvent);

    return () => {
      socket.off('WORK_ITEM_UPDATED', handleWorkItemSocketUpdate);
      socket.off('COMMENT_CREATED', handleCommentEvent);
      socket.off('COMMENT_UPDATED', handleCommentEvent);
      socket.off('COMMENT_DELETED', handleCommentEvent);
      socket.off('FILE_UPLOADED', handleFileEvent);
      socket.off('FILE_RENAMED', handleFileEvent);
      socket.off('FILE_DELETED', handleFileEvent);
    };
  }, [socket, isConnected, workItemId, loadWorkItemData, loadAttachments]);

  // Accessibility: Escape key and body scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && workItemId) {
        onClose();
      }
    };
    if (workItemId) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [workItemId, onClose]);

  if (!workItemId) return null;

  const { activeRole, activeWorkspace } = useWorkspace();
  const isWsOwner = Boolean(
    activeRole === 'OWNER' ||
    (activeRole as string)?.toUpperCase() === 'OWNER' ||
    activeWorkspace?.isOwner ||
    (activeWorkspace?.ownerId && user?.id && activeWorkspace.ownerId === user.id)
  );
  const isWsAdmin = Boolean(
    isWsOwner ||
    activeRole === 'WORKSPACE_ADMIN' ||
    (activeRole as string)?.toUpperCase() === 'WORKSPACE_ADMIN' ||
    (activeRole as string)?.toUpperCase() === 'ADMIN' ||
    activeWorkspace?.userRole === 'WORKSPACE_ADMIN'
  );
  const isProjectAdmin = isWsAdmin || project.userRole === 'PROJECT_ADMIN' || project.createdById === user?.id;
  const isCreator = Boolean(workItem?.createdById && user?.id && workItem.createdById === user.id);
  const canManageStatus = isWsAdmin || isProjectAdmin || isCreator;
  const canDelete = isProjectAdmin || isCreator;

  // Real-time ticking state for timers
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Rejection modal & actions state
  const [showRejectPrompt, setShowRejectPrompt] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [workflowActionLoading, setWorkflowActionLoading] = useState<string | null>(null);

  // Current user assignee record
  const currentAssigneeRecord = useMemo(() => {
    if (!workItem || !user?.id) return null;
    if (workItem.assignees && workItem.assignees.length > 0) {
      return workItem.assignees.find((a) => a.userId === user.id) || null;
    }
    if (workItem.assignedToId === user.id) {
      return {
        id: 'legacy-assignee',
        workItemId: workItem.id,
        userId: user.id,
        user: {
          id: user.id,
          fullName: user.fullName || null,
          username: user.username,
          avatarUrl: user.avatarUrl || null,
        },
        hasStarted: false,
        hasCompleted: false,
        totalDurationSeconds: 0,
        isPaused: false,
        lastSessionStartedAt: null,
        startedAt: null,
        completedAt: null,
        lastCheckInCycle: 0,
        lastCheckInAt: null,
        assignedAt: workItem.createdAt,
      } as WorkItemAssignee;
    }
    return null;
  }, [workItem, user?.id]);

  const isUserAssigned = Boolean(currentAssigneeRecord);

  // Current continuous session elapsed in seconds
  const currentSessionElapsed = useMemo(() => {
    if (
      workItem?.status === 'IN_PROGRESS' &&
      currentAssigneeRecord?.hasStarted &&
      !currentAssigneeRecord?.hasCompleted &&
      !currentAssigneeRecord?.isPaused &&
      currentAssigneeRecord?.lastSessionStartedAt
    ) {
      return Math.max(0, Math.floor((currentTime - new Date(currentAssigneeRecord.lastSessionStartedAt).getTime()) / 1000));
    }
    return 0;
  }, [currentTime, workItem?.status, currentAssigneeRecord]);

  // If session exceeded 1800s (30 mins) without check-in, timer auto-pauses
  const isMissedCheckInPaused =
    workItem?.status === 'IN_PROGRESS' &&
    Boolean(currentAssigneeRecord?.hasStarted) &&
    !currentAssigneeRecord?.hasCompleted &&
    !currentAssigneeRecord?.isPaused &&
    currentSessionElapsed >= 1800;

  const isCurrentTimerPaused = Boolean(currentAssigneeRecord?.isPaused) || isMissedCheckInPaused;

  // Calculate live cumulative duration for an assignee (stacks without resetting)
  const getAssigneeTotalSeconds = useCallback(
    (assignee: WorkItemAssignee | null) => {
      if (!assignee) return 0;
      let total = assignee.totalDurationSeconds || 0;
      if (
        workItem?.status === 'IN_PROGRESS' &&
        assignee.hasStarted &&
        !assignee.hasCompleted &&
        !assignee.isPaused &&
        assignee.lastSessionStartedAt
      ) {
        const rawElapsed = Math.floor((currentTime - new Date(assignee.lastSessionStartedAt).getTime()) / 1000);
        // Capped at 1800s (30 mins) per session
        const sessionSec = Math.min(Math.max(0, rawElapsed), 1800);
        total += sessionSec;
      }
      return total;
    },
    [currentTime, workItem?.status]
  );

  const currentLiveSeconds = getAssigneeTotalSeconds(currentAssigneeRecord);

  // 25 to 30 min window (1500s to 1800s of current continuous session)
  const isCheckInWindowActive =
    workItem?.status === 'IN_PROGRESS' &&
    Boolean(currentAssigneeRecord?.hasStarted) &&
    !currentAssigneeRecord?.hasCompleted &&
    !currentAssigneeRecord?.isPaused &&
    currentSessionElapsed >= 1500 &&
    currentSessionElapsed < 1800;

  const formatDurationDisplay = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Workflow Action Handlers
  const handleStartTask = async () => {
    if (!workItem) return;
    setWorkflowActionLoading('start');
    setError(null);
    try {
        await requestStartTask(project.id, workItem, (updated) => {
          setWorkItem(updated);
          onUpdated(updated);
        });
      } catch (err: any) {
        setError(err.message || 'Failed to start task');
      } finally {
        setWorkflowActionLoading(null);
      }
    };

    const handlePauseTimer = async () => {
      if (!workItem) return;
      setWorkflowActionLoading('pause');
      setError(null);
      try {
        await pauseActiveTask(workItem.id, project.id);
        const res = await workApi.getWorkItemById(project.id, workItem.id);
        if (res.success && res.data?.workItem) {
          setWorkItem(res.data.workItem);
          onUpdated(res.data.workItem);
        }
    } catch (err: any) {
      setError(err.message || 'Failed to pause timer');
    } finally {
      setWorkflowActionLoading(null);
    }
  };

      const handleCheckInTimer = async () => {
        if (!workItem) return;
        setWorkflowActionLoading('checkin');
        setError(null);
        try {
          await checkInActiveTask();
          const res = await workApi.getWorkItemById(project.id, workItem.id);
          if (res.success && res.data?.workItem) {
            setWorkItem(res.data.workItem);
            onUpdated(res.data.workItem);
          }
      } catch (err: any) {
        setError(err.message || 'Failed to check in timer');
      } finally {
        setWorkflowActionLoading(null);
      }
    };

      const handleResumeTimer = async () => {
        if (!workItem) return;
        setWorkflowActionLoading('resume');
        setError(null);
        try {
          await requestResumeTask(project.id, workItem, (updated) => {
            setWorkItem(updated);
            onUpdated(updated);
          });
        } catch (err: any) {
          setError(err.message || 'Failed to resume timer');
        } finally {
          setWorkflowActionLoading(null);
        }
      };

      const handleCompleteWork = async () => {
        if (!workItem) return;
        setWorkflowActionLoading('complete');
        setError(null);
        try {
          const res = await workApi.completeWork(project.id, workItem.id);
          if (res.success && res.data.workItem) {
            setWorkItem(res.data.workItem);
            onUpdated(res.data.workItem);
          }
        } catch (err: any) {
          setError(err.message || 'Failed to complete work');
        } finally {
          setWorkflowActionLoading(null);
        }
      };

      const handleReview = async (action: 'APPROVE' | 'REJECT') => {
        if (!workItem) return;
        if (action === 'REJECT' && !rejectionReasonInput.trim()) {
          setError('Please provide a reason for rejecting the task');
          return;
        }
        setWorkflowActionLoading(action.toLowerCase());
        setError(null);
        try {
          const res = await workApi.reviewTask(project.id, workItem.id, {
            action,
            reason: action === 'REJECT' ? rejectionReasonInput.trim() : undefined,
          });
          if (res.success && res.data.workItem) {
            setWorkItem(res.data.workItem);
            onUpdated(res.data.workItem);
            setShowRejectPrompt(false);
            setRejectionReasonInput('');
          }
        } catch (err: any) {
          setError(err.message || `Failed to ${action.toLowerCase()} task`);
        } finally {
          setWorkflowActionLoading(null);
        }
      };

      const handleStageDueDateChange = async (
        stage: 'todoDueDate' | 'inProgressDueDate' | 'inReviewDueDate' | 'completedDueDate',
        newDate: string | null
      ) => {
        if (!workItem) return;
        if (newDate) {
          const todayStr = new Date().toISOString().split('T')[0];
          if (newDate < todayStr) {
            setError('Stage due date cannot be in the past');
            return;
          }
          const candidateDates = {
            todoDueDate: stage === 'todoDueDate' ? newDate : (workItem.todoDueDate?.split('T')[0] || null),
            inProgressDueDate: stage === 'inProgressDueDate' ? newDate : (workItem.inProgressDueDate?.split('T')[0] || null),
            inReviewDueDate: stage === 'inReviewDueDate' ? newDate : (workItem.inReviewDueDate?.split('T')[0] || null),
            completedDueDate: stage === 'completedDueDate' ? newDate : (workItem.completedDueDate?.split('T')[0] || null),
          };
          if (candidateDates.todoDueDate && candidateDates.inProgressDueDate && candidateDates.todoDueDate > candidateDates.inProgressDueDate) {
            setError('To Do due date cannot be after In Progress due date');
            return;
          }
          if (candidateDates.inProgressDueDate && candidateDates.inReviewDueDate && candidateDates.inProgressDueDate > candidateDates.inReviewDueDate) {
            setError('In Progress due date cannot be after In Review due date');
            return;
          }
          if (candidateDates.inReviewDueDate && candidateDates.completedDueDate && candidateDates.inReviewDueDate > candidateDates.completedDueDate) {
            setError('In Review due date cannot be after Completed due date');
            return;
          }
        }
        setError(null);
        try {
          const res = await workApi.updateWorkItem(project.id, workItem.id, {
            [stage]: newDate ? new Date(newDate).toISOString() : null,
          });
          if (res.success && res.data.workItem) {
            setWorkItem(res.data.workItem);
            onUpdated(res.data.workItem);
          }
        } catch (err: any) {
          setError(err.message || 'Failed to update stage due date');
        }
      };

      // Status transition handler
      const handleStatusChange = async (newStatus: WorkItemStatus) => {
        if (!workItem || workItem.status === newStatus) return;
        if (!canManageStatus) {
          setError('Only project administrators and the task creator can manually change status');
          return;
        }
        try {
          const res = await workApi.updateWorkItem(project.id, workItem.id, { status: newStatus });
          if (res.success && res.data.workItem) {
            setWorkItem({
              ...workItem,
              status: res.data.workItem.status,
              completedAt: res.data.workItem.completedAt,
            });
            onUpdated(res.data.workItem);
          }
        } catch (err: any) {
          setError(err.message || 'Failed to update status');
        }
      };

      // Priority transition handler
      const handlePriorityChange = async (newPriority: WorkItemPriority) => {
        if (!workItem || workItem.priority === newPriority) return;
        try {
          const res = await workApi.updateWorkItem(project.id, workItem.id, { priority: newPriority });
          if (res.success && res.data.workItem) {
            setWorkItem({ ...workItem, priority: res.data.workItem.priority });
            onUpdated(res.data.workItem);
          }
        } catch (err: any) {
          setError(err.message || 'Failed to update priority');
        }
      };

      // Toggle multi-assignee handler
      const handleToggleAssignee = async (userId: string) => {
        if (!workItem) return;
        try {
          const currentIds =
            workItem.assignees && workItem.assignees.length > 0
              ? workItem.assignees.map((a) => a.userId)
              : workItem.assignedToId
                ? [workItem.assignedToId]
                : [];

          const newIds = currentIds.includes(userId)
            ? currentIds.filter((id) => id !== userId)
            : [...currentIds, userId];

          const res = await workApi.updateWorkItem(project.id, workItem.id, {
            assigneeIds: newIds,
            assignedToId: newIds[0] || null,
          });
          if (res.success && res.data.workItem) {
            setWorkItem({
              ...workItem,
              assignedToId: res.data.workItem.assignedToId,
              assignedTo: res.data.workItem.assignedTo,
              assignees: res.data.workItem.assignees,
            });
            onUpdated(res.data.workItem);
          }
        } catch (err: any) {
          setError(err.message || 'Failed to update assignees');
        }
      };

      // Due date change handler
      const handleDueDateChange = async (newDueDate: string | null) => {
        if (!workItem) return;
        try {
          const res = await workApi.updateWorkItem(project.id, workItem.id, {
            dueDate: newDueDate || null,
          });
          if (res.success && res.data.workItem) {
            setWorkItem({
              ...workItem,
              dueDate: res.data.workItem.dueDate,
            });
            onUpdated(res.data.workItem);
          }
        } catch (err: any) {
          setError(err.message || 'Failed to update due date');
        }
      };

      // Post comment handler
      const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!workItem || !commentText.trim()) return;

        setPostingComment(true);
        try {
          const res = await commentsApi.createComment(project.id, workItem.id, commentText.trim());
          if (res.success && res.data.comment) {
            setWorkItem({
              ...workItem,
              comments: [...(workItem.comments || []), res.data.comment],
              _count: { comments: (workItem._count?.comments || 0) + 1 },
            });
            setCommentText('');
          }
        } catch (err: any) {
          setError(err.message || 'Failed to post comment');
        } finally {
          setPostingComment(false);
        }
      };

      // Delete comment handler
      const handleDeleteComment = async (commentId: string) => {
        if (!workItem) return;
        try {
          await commentsApi.deleteComment(project.id, workItem.id, commentId);
          setWorkItem({
            ...workItem,
            comments: (workItem.comments || []).filter((c) => c.id !== commentId),
            _count: { comments: Math.max(0, (workItem._count?.comments || 1) - 1) },
          });
        } catch (err: any) {
          setError(err.message || 'Failed to delete comment');
        }
      };

      // Delete work item handler
      const handleDeleteWorkItem = () => {
        if (!workItem) return;
        setShowDeleteModal(true);
      };

      const handleConfirmDeleteWorkItem = async () => {
        if (!workItem) return;
        setIsDeletingWorkItem(true);
        try {
          await workApi.deleteWorkItem(project.id, workItem.id);
          setShowDeleteModal(false);
          onDeleted(workItem.id);
          onClose();
        } catch (err: any) {
          setError(err.message || 'Failed to delete work item');
        } finally {
          setIsDeletingWorkItem(false);
        }
      };

      // Helper for Top Tag Badges
      const renderTypeTag = (type: WorkItemType) => {
        switch (type) {
          case 'BUG':
            return (
              <span className="widm-header-badge badge-bug">
                <BugIcon size={14} />
                <span>Bug</span>
              </span>
            );
          case 'FEATURE':
            return (
              <span className="widm-header-badge badge-feature">
                <CodeIcon size={14} />
                <span>Feature</span>
              </span>
            );
          case 'IMPROVEMENT':
            return (
              <span className="widm-header-badge badge-improvement">
                <TrendingUpIcon size={14} />
                <span>Improvement</span>
              </span>
            );
          case 'RESEARCH':
            return (
              <span className="widm-header-badge badge-research">
                <FileTextIcon size={14} />
                <span>Research</span>
              </span>
            );
          case 'DOCUMENTATION':
            return (
              <span className="widm-header-badge badge-doc">
                <FileTextIcon size={14} />
                <span>Documentation</span>
              </span>
            );
          default:
            return (
              <span className="widm-header-badge badge-task">
                <CheckSquareIcon size={14} />
                <span>Task</span>
              </span>
            );
        }
      };

      const renderPriorityTag = (priority: WorkItemPriority) => {
        switch (priority) {
          case 'URGENT':
            return (
              <span className="widm-header-badge badge-urgent">
                <AlertCircleIcon size={13} />
                <span>Urgent</span>
              </span>
            );
          case 'HIGH':
            return (
              <span className="widm-header-badge badge-high">
                <ChevronUpIcon size={13} />
                <span>High</span>
              </span>
            );
          case 'MEDIUM':
            return (
              <span className="widm-header-badge badge-medium">
                <BarChartIcon size={13} />
                <span>Medium</span>
              </span>
            );
          case 'LOW':
          default:
            return (
              <span className="widm-header-badge badge-low">
                <ArrowDownIcon size={13} />
                <span>Low</span>
              </span>
            );
        }
      };

      const renderStatusTag = (status: WorkItemStatus) => {
        switch (status) {
          case 'TODO':
            return (
              <span className="widm-header-badge badge-status-todo">
                <CircleDotIcon size={13} />
                <span>To Do</span>
              </span>
            );
          case 'IN_PROGRESS':
            return (
              <span className="widm-header-badge badge-status-inprogress">
                <PlayIcon size={13} />
                <span>In Progress</span>
              </span>
            );
          case 'BLOCKED':
            return (
              <span className="widm-header-badge badge-status-blocked">
                <BanIcon size={13} />
                <span>Canceled</span>
              </span>
            );
          case 'IN_REVIEW':
            return (
              <span className="widm-header-badge badge-status-inreview">
                <UserIcon size={13} />
                <span>In Review</span>
              </span>
            );
          case 'COMPLETED':
          default:
            return (
              <span className="widm-header-badge badge-status-completed">
                <CheckIcon size={13} />
                <span>Completed</span>
              </span>
            );
        }
      };

      const userInitial = user?.fullName
        ? user.fullName.charAt(0).toUpperCase()
        : user?.username?.charAt(0).toUpperCase() || 'U';

      const formattedDueDate = workItem?.dueDate
        ? new Date(workItem.dueDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        : '';

      const creatorName = workItem?.createdBy?.fullName || workItem?.createdBy?.username || 'Team Member';
      const createdDateStr = workItem?.createdAt
        ? `${new Date(workItem.createdAt).toLocaleDateString('en-US')} by ${creatorName}`
        : 'Unknown';

      const updatedDateStr = workItem?.updatedAt
        ? `${new Date(workItem.updatedAt).toLocaleDateString('en-US')} by ${creatorName}`
        : createdDateStr;

      return (
        <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
          <div
            className="modal-container work-details-modal-luxury"
            onClick={(e) => {
              e.stopPropagation();
              setShowOptionsMenu(false);
            }}
          >
            {loading && !workItem ? (
              <div className="widm-skeleton-shell">
                {/* Header Skeleton */}
                <div className="widm-modal-top-header">
                  <div className="widm-header-main-info">
                    <div className="widm-squircle-icon-box" style={{ background: '#F8FAFC', borderColor: '#E2E8F0' }}>
                      <div className="widm-squircle-inner-circle" style={{ borderColor: '#CBD5E1' }} />
                    </div>
                    <div className="widm-header-text-block" style={{ width: '60%' }}>
                      <div className="widm-shimmer-line" style={{ width: '65%', height: '22px', borderRadius: '6px', marginBottom: '8px' }} />
                      <div className="widm-shimmer-line" style={{ width: '85%', height: '14px', borderRadius: '4px', marginBottom: '12px' }} />
                      <div className="widm-header-badges-row">
                        <div className="widm-shimmer-line" style={{ width: '64px', height: '22px', borderRadius: '9999px' }} />
                        <div className="widm-shimmer-line" style={{ width: '64px', height: '22px', borderRadius: '9999px' }} />
                        <div className="widm-shimmer-line" style={{ width: '72px', height: '22px', borderRadius: '9999px' }} />
                      </div>
                    </div>
                  </div>
                  <button type="button" className="widm-action-circle-btn" onClick={onClose} title="Close">
                    <CloseIcon size={18} />
                  </button>
                </div>

                {/* Content Skeleton maintaining full modal dimensions */}
                <div className="widm-modal-main-content">
                  <div className="widm-content-left-pane">
                    <div className="widm-shimmer-line" style={{ width: '220px', height: '34px', borderRadius: '8px', marginBottom: '1.25rem' }} />
                    <div className="widm-shimmer-line" style={{ width: '100%', height: '120px', borderRadius: '12px', marginBottom: '1rem' }} />
                    <div className="widm-shimmer-line" style={{ width: '100%', height: '100px', borderRadius: '12px' }} />
                  </div>
                  <div className="widm-sidebar-right-pane">
                    <div className="widm-shimmer-line" style={{ width: '100%', height: '44px', borderRadius: '8px', marginBottom: '1rem' }} />
                    <div className="widm-shimmer-line" style={{ width: '100%', height: '44px', borderRadius: '8px', marginBottom: '1rem' }} />
                    <div className="widm-shimmer-line" style={{ width: '100%', height: '44px', borderRadius: '8px', marginBottom: '1rem' }} />
                  </div>
                </div>
              </div>
            ) : workItem ? (
              <>
                {/* Header with Squircle Icon, Title, Subtitle, Badges & Actions */}
                <div
                  className="widm-modal-top-header"
                  onWheel={(e) => {
                    if (modalBodyRef.current) {
                      modalBodyRef.current.scrollTop += e.deltaY;
                    }
                  }}
                >
                  <div className="widm-header-main-info">
                    <div className="widm-squircle-icon-box">
                      <div className="widm-squircle-inner-circle">
                        <CheckIcon size={15} />
                      </div>
                    </div>

                    <div className="widm-header-text-block">
                      <h1 className="widm-title">{workItem.title}</h1>
                      <p className="widm-description">
                        {workItem.description || 'No description provided for this work item.'}
                      </p>
                      <div className="widm-header-badges-row">
                        {renderTypeTag(workItem.type)}
                        {renderPriorityTag(workItem.priority)}
                        {renderStatusTag(workItem.status)}
                      </div>
                    </div>
                  </div>

                  <div className="widm-header-actions-row">
                    {canDelete && (
                      <button
                        type="button"
                        className="widm-icon-btn widm-delete-btn"
                        onClick={handleDeleteWorkItem}
                        title="Delete Work Item"
                      >
                        <TrashIcon size={16} />
                      </button>
                    )}

                    {/* 3 dots menu */}
                    <div className="widm-options-wrapper" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="widm-icon-btn"
                        onClick={() => setShowOptionsMenu((prev) => !prev)}
                        title="Options"
                      >
                        <MoreVerticalIcon size={18} />
                      </button>

                      {showOptionsMenu && (
                        <div className="widm-options-dropdown">
                          {canDelete && (
                            <button
                              type="button"
                              className="widm-option-item danger"
                              onClick={() => {
                                setShowOptionsMenu(false);
                                handleDeleteWorkItem();
                              }}
                            >
                              <TrashIcon size={14} />
                              <span>Delete Work Item</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Close Button */}
                    <button
                      type="button"
                      className="widm-icon-btn widm-close-btn"
                      onClick={onClose}
                      aria-label="Close"
                    >
                      <CloseIcon size={20} />
                    </button>
                  </div>
                </div>

                {error && <div className="widm-error-banner">{error}</div>}

                {/* Modal Body: 2 Columns */}
                <div className="widm-modal-body" ref={modalBodyRef}>
                  {/* Left Column: Status Pills, Tabs, Comments/Attachments/Activity */}
                  <div className="widm-main-column">
                    {/* REJECTION REASON ALERT (If previously rejected) */}
                    {workItem.rejectionReason && (
                      <div className="widm-rejection-banner">
                        <div className="widm-rejection-title">
                          <AlertCircleIcon size={15} />
                          <span>Task Revision Requested</span>
                        </div>
                        <div style={{ marginTop: '2px' }}>{workItem.rejectionReason}</div>
                      </div>
                    )}

                    {/* 4 STAGES TIMELINE BAR */}
                    <div className="widm-stages-timeline">
                      <div className="widm-stage-line" />
                      {[
                        { key: 'TODO', label: 'To Do', date: workItem.todoDueDate },
                        { key: 'IN_PROGRESS', label: 'In Progress', date: workItem.inProgressDueDate },
                        { key: 'IN_REVIEW', label: 'In Review', date: workItem.inReviewDueDate },
                        { key: 'COMPLETED', label: 'Completed', date: workItem.completedDueDate },
                      ].map((step, idx) => {
                        const order = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED'];
                        const currentIdx = order.indexOf(workItem.status);
                        const stepIdx = order.indexOf(step.key);
                        const state = stepIdx < currentIdx ? 'completed' : stepIdx === currentIdx ? 'active' : 'upcoming';
                        const formattedDate = step.date
                          ? new Date(step.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : 'No date';

                        return (
                          <div key={step.key} className={`widm-stage-step ${state}`}>
                            <div className="widm-stage-node">
                              {state === 'completed' ? <CheckIcon size={14} /> : idx + 1}
                            </div>
                            <span className="widm-stage-title">{step.label}</span>
                            <span className="widm-stage-date">{formattedDate}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* DYNAMIC WORKFLOW ACTION CARD */}
                    <div className={`widm-workflow-card ${workItem.status.toLowerCase().replace('_', '-')}`}>
                      <div className="widm-workflow-card-header">
                        <div className="widm-workflow-card-title">
                          {workItem.status === 'TODO' && (
                            <>
                              <CircleDotIcon size={18} style={{ color: '#3B82F6' }} />
                              <span>Stage: To Do</span>
                            </>
                          )}
                          {workItem.status === 'IN_PROGRESS' && (
                            <>
                              <PlayIcon size={18} style={{ color: '#F59E0B' }} />
                              <span>Stage: In Progress</span>
                            </>
                          )}
                          {workItem.status === 'IN_REVIEW' && (
                            <>
                              <UserIcon size={18} style={{ color: '#8B5CF6' }} />
                              <span>Stage: In Review</span>
                            </>
                          )}
                          {workItem.status === 'COMPLETED' && (
                            <>
                              <CheckIcon size={18} style={{ color: '#10B981' }} />
                              <span>Stage: Completed</span>
                            </>
                          )}
                          {workItem.status === 'BLOCKED' && (
                            <>
                              <BanIcon size={18} style={{ color: '#EF4444' }} />
                              <span>Stage: Canceled</span>
                            </>
                          )}
                        </div>

                        <div className="widm-workflow-actions-group">
                          {/* Cancel Task Button (Available in any active stage for Creator/Admins) */}
                          {canManageStatus && workItem.status !== 'BLOCKED' && workItem.status !== 'COMPLETED' && (
                            <button
                              type="button"
                              className="widm-move-pill"
                              style={{ borderColor: '#FECACA', color: '#DC2626' }}
                              onClick={() => handleStatusChange('BLOCKED')}
                              title="Cancel Task"
                            >
                              <BanIcon size={13} />
                              <span>Cancel Task</span>
                            </button>
                          )}
                          {canManageStatus && workItem.status === 'BLOCKED' && (
                            <button
                              type="button"
                              className="widm-move-pill"
                              style={{ background: '#0F172A', color: '#FFF' }}
                              onClick={() => handleStatusChange('TODO')}
                              title="Restore Task"
                            >
                              <RotateCcwIcon size={13} />
                              <span>Restore Task</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* STAGE: TODO BODY */}
                      {workItem.status === 'TODO' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                          {/* User Start Task Action */}
                          {isUserAssigned && (
                            <div
                              style={{
                                background: '#F1F5F9',
                                borderRadius: '10px',
                                padding: '0.85rem 1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '0.75rem',
                              }}
                            >
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>
                                  {!currentAssigneeRecord?.hasStarted
                                    ? 'You are assigned to this task'
                                    : 'You have started working on this task'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                                  {!currentAssigneeRecord?.hasStarted
                                    ? 'Click start when you begin. The task automatically moves to In Progress once all assignees start.'
                                    : 'Timer is active. Waiting for all other assignees to start.'}
                                </div>
                              </div>

                              {!currentAssigneeRecord?.hasStarted ? (
                                <button
                                  type="button"
                                  onClick={handleStartTask}
                                  disabled={workflowActionLoading !== null}
                                  style={{
                                    background: '#0F172A',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.55rem 1.15rem',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                                  }}
                                >
                                  <PlayIcon size={14} />
                                  <span>{workflowActionLoading === 'start' ? 'Starting...' : 'Start Task'}</span>
                                </button>
                              ) : (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '0.4rem 0.8rem',
                                    background: '#ECFDF5',
                                    color: '#059669',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    fontSize: '0.8125rem',
                                  }}
                                >
                                  <CheckIcon size={14} />
                                  <span>Started</span>
                                </span>
                              )}
                            </div>
                          )}

                          {/* Assignee Progress Tracker */}
                          {workItem.assignees && workItem.assignees.length > 0 && (
                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '6px' }}>
                                ASSIGNEE STATUS ({workItem.assignees.filter((a) => a.hasStarted).length} of {workItem.assignees.length} STARTED)
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {workItem.assignees.map((a) => (
                                  <div
                                    key={a.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '6px 10px',
                                      background: '#F8FAFC',
                                      border: '1px solid #E2E8F0',
                                      borderRadius: '8px',
                                      fontSize: '0.8125rem',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {a.user.avatarUrl ? (
                                        <img src={a.user.avatarUrl} alt="" style={{ width: '22px', height: '22px', borderRadius: '50%' }} />
                                      ) : (
                                        <div
                                          style={{
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '50%',
                                            background: '#CBD5E1',
                                            color: '#334155',
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                          }}
                                        >
                                          {(a.user.fullName || a.user.username)[0].toUpperCase()}
                                        </div>
                                      )}
                                      <span style={{ fontWeight: 600, color: '#1E293B' }}>
                                        {a.user.fullName || a.user.username}
                                      </span>
                                    </div>
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        background: a.hasStarted ? '#ECFDF5' : '#F1F5F9',
                                        color: a.hasStarted ? '#059669' : '#64748B',
                                      }}
                                    >
                                      {a.hasStarted ? '✓ Started' : 'Not started'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Manual Override for Admins & Creator */}
                          {canManageStatus && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
                              <button
                                type="button"
                                className="widm-move-pill"
                                style={{ background: '#0F172A', color: '#FFFFFF', borderColor: '#0F172A' }}
                                onClick={() => handleStatusChange('IN_PROGRESS')}
                              >
                                <PlayIcon size={12} />
                                <span>Advance to In Progress (Manual Override)</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* STAGE: IN_PROGRESS BODY */}
                      {workItem.status === 'IN_PROGRESS' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                          {/* Active Assignee Live Stacking Timer & Check-in */}
                          {isUserAssigned && (
                            <div
                              style={{
                                background: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                borderRadius: '10px',
                                padding: '0.9rem 1.1rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <div>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                                    Your Stacked Work Timer
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                    <div className={`widm-timer-badge ${isCurrentTimerPaused ? 'paused' : ''}`}>
                                      <ClockIcon size={16} />
                                      <span>{formatDurationDisplay(currentLiveSeconds)}</span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                                      {isCurrentTimerPaused
                                        ? 'Paused at cycle mark'
                                        : currentAssigneeRecord?.hasCompleted
                                          ? 'Completed & frozen'
                                          : 'Stacking cumulatively'}
                                    </span>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {isCurrentTimerPaused && (
                                    <button
                                      type="button"
                                      onClick={handleResumeTimer}
                                      disabled={workflowActionLoading !== null}
                                      style={{
                                        background: '#3B82F6',
                                        color: '#FFFFFF',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '0.45rem 0.9rem',
                                        fontWeight: 700,
                                        fontSize: '0.8125rem',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                      }}
                                    >
                                      <PlayIcon size={13} />
                                      <span>{workflowActionLoading === 'resume' ? 'Resuming...' : 'Resume Timer'}</span>
                                    </button>
                                  )}

                                  {!isCurrentTimerPaused && !currentAssigneeRecord?.hasCompleted && (
                                    <button
                                      type="button"
                                      onClick={handlePauseTimer}
                                      disabled={workflowActionLoading !== null}
                                      style={{
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        color: '#EF4444',
                                        border: '1px solid rgba(239, 68, 68, 0.25)',
                                        borderRadius: '8px',
                                        padding: '0.45rem 0.9rem',
                                        fontWeight: 700,
                                        fontSize: '0.8125rem',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                      }}
                                    >
                                      <PauseIcon size={13} />
                                      <span>{workflowActionLoading === 'pause' ? 'Pausing...' : 'Pause Timer'}</span>
                                    </button>
                                  )}

                                  {!currentAssigneeRecord?.hasCompleted ? (
                                    <button
                                      type="button"
                                      onClick={handleCompleteWork}
                                      disabled={workflowActionLoading !== null}
                                      style={{
                                        background: '#10B981',
                                        color: '#FFFFFF',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '0.5rem 1rem',
                                        fontWeight: 700,
                                        fontSize: '0.8125rem',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                      }}
                                    >
                                      <CheckIcon size={14} />
                                      <span>{workflowActionLoading === 'complete' ? 'Saving...' : 'Mark as Done'}</span>
                                    </button>
                                  ) : (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '0.4rem 0.8rem',
                                        background: '#ECFDF5',
                                        color: '#059669',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '0.8125rem',
                                      }}
                                    >
                                      <CheckIcon size={14} />
                                      <span>Work Completed</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 25-30 Minute Cycle Check-In Alert Box */}
                              {isCheckInWindowActive && (
                                <div className="widm-checkin-alert-box">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <AlertCircleIcon size={18} style={{ color: '#D97706', flexShrink: 0 }} />
                                    <span className="widm-checkin-alert-text">
                                      <strong>25-30 Minute Cycle Check-In:</strong> Confirm you are still working to prevent auto-pause at the 30-minute mark.
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    className="widm-checkin-btn"
                                    onClick={handleCheckInTimer}
                                    disabled={workflowActionLoading !== null}
                                  >
                                    {workflowActionLoading === 'checkin' ? 'Saving...' : 'Continue Timer'}
                                  </button>
                                </div>
                              )}

                              {/* Missed Check-in / Paused Alert Box */}
                              {isCurrentTimerPaused && (
                                <div
                                  style={{
                                    background: '#FEF2F2',
                                    border: '1px solid #FECACA',
                                    borderRadius: '10px',
                                    padding: '0.75rem 1rem',
                                    marginTop: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '8px',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <AlertCircleIcon size={18} style={{ color: '#DC2626', flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.8125rem', color: '#991B1B' }}>
                                      <strong>Timer Paused:</strong> Check-in was missed at the 30-minute mark. Click Resume to continue stacking your time.
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleResumeTimer}
                                    disabled={workflowActionLoading !== null}
                                    style={{
                                      background: '#DC2626',
                                      color: '#FFFFFF',
                                      border: 'none',
                                      borderRadius: '6px',
                                      padding: '0.4rem 0.8rem',
                                      fontWeight: 700,
                                      fontSize: '0.75rem',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Resume Timer
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Team Assignees Progress & Live Durations */}
                          {workItem.assignees && workItem.assignees.length > 0 && (
                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '6px' }}>
                                TEAM PROGRESS ({workItem.assignees.filter((a) => a.hasCompleted).length} of {workItem.assignees.length} COMPLETED)
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {workItem.assignees.map((a) => {
                                  const sec = getAssigneeTotalSeconds(a);
                                  return (
                                    <div
                                      key={a.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '6px 10px',
                                        background: '#F8FAFC',
                                        border: '1px solid #E2E8F0',
                                        borderRadius: '8px',
                                        fontSize: '0.8125rem',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {a.user.avatarUrl ? (
                                          <img src={a.user.avatarUrl} alt="" style={{ width: '22px', height: '22px', borderRadius: '50%' }} />
                                        ) : (
                                          <div
                                            style={{
                                              width: '22px',
                                              height: '22px',
                                              borderRadius: '50%',
                                              background: '#CBD5E1',
                                              color: '#334155',
                                              fontSize: '0.65rem',
                                              fontWeight: 700,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                            }}
                                          >
                                            {(a.user.fullName || a.user.username)[0].toUpperCase()}
                                          </div>
                                        )}
                                        <span style={{ fontWeight: 600, color: '#1E293B' }}>
                                          {a.user.fullName || a.user.username}
                                        </span>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>
                                          {formatDurationDisplay(sec)}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            background: a.hasCompleted ? '#ECFDF5' : a.isPaused ? '#FEF2F2' : '#EFF6FF',
                                            color: a.hasCompleted ? '#059669' : a.isPaused ? '#DC2626' : '#2563EB',
                                          }}
                                        >
                                          {a.hasCompleted ? '✓ Done' : a.isPaused ? 'Paused' : 'In Progress'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Manual Move to In Review for Admins & Creator */}
                          {canManageStatus && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
                              <button
                                type="button"
                                className="widm-move-pill"
                                style={{ background: '#8B5CF6', color: '#FFFFFF', borderColor: '#8B5CF6' }}
                                onClick={() => handleStatusChange('IN_REVIEW')}
                              >
                                <UserIcon size={12} />
                                <span>Move to In Review</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* STAGE: IN_REVIEW BODY */}
                      {workItem.status === 'IN_REVIEW' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                          {canManageStatus ? (
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                                Review Required
                              </div>
                              <p style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '12px' }}>
                                Assignees have completed their work. You can approve this task to mark it Completed, or reject it with notes to return it to In Progress (timers will continue from where they were).
                              </p>

                              {!showRejectPrompt ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleReview('APPROVE')}
                                    disabled={workflowActionLoading !== null}
                                    style={{
                                      background: '#10B981',
                                      color: '#FFFFFF',
                                      border: 'none',
                                      borderRadius: '8px',
                                      padding: '0.55rem 1.25rem',
                                      fontWeight: 700,
                                      fontSize: '0.85rem',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                    }}
                                  >
                                    <CheckIcon size={15} />
                                    <span>{workflowActionLoading === 'approve' ? 'Approving...' : 'Approve Task'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setShowRejectPrompt(true)}
                                    disabled={workflowActionLoading !== null}
                                    style={{
                                      background: '#FFFFFF',
                                      color: '#DC2626',
                                      border: '1px solid #FECACA',
                                      borderRadius: '8px',
                                      padding: '0.55rem 1.25rem',
                                      fontWeight: 700,
                                      fontSize: '0.85rem',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                    }}
                                  >
                                    <CloseIcon size={15} />
                                    <span>Reject & Request Changes</span>
                                  </button>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    background: '#FEF2F2',
                                    border: '1px solid #FECACA',
                                    borderRadius: '10px',
                                    padding: '0.9rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                  }}
                                >
                                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#991B1B' }}>
                                    Reason for Rejection / Revision Notes (Required):
                                  </label>
                                  <textarea
                                    value={rejectionReasonInput}
                                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                                    placeholder="Explain what changes or updates are needed..."
                                    rows={3}
                                    style={{
                                      width: '100%',
                                      padding: '8px 10px',
                                      borderRadius: '6px',
                                      border: '1px solid #FCA5A5',
                                      fontSize: '0.8125rem',
                                      outline: 'none',
                                    }}
                                  />
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowRejectPrompt(false);
                                        setRejectionReasonInput('');
                                      }}
                                      style={{
                                        background: 'transparent',
                                        border: '1px solid #CBD5E1',
                                        borderRadius: '6px',
                                        padding: '0.4rem 0.8rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        color: '#475569',
                                      }}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleReview('REJECT')}
                                      disabled={!rejectionReasonInput.trim() || workflowActionLoading !== null}
                                      style={{
                                        background: '#DC2626',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '0.4rem 0.9rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        color: '#FFFFFF',
                                        opacity: !rejectionReasonInput.trim() ? 0.6 : 1,
                                      }}
                                    >
                                      {workflowActionLoading === 'reject' ? 'Submitting...' : 'Confirm Rejection'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.8125rem', color: '#64748B' }}>
                              This task has been submitted for review. An administrator or the task creator will review and approve or request revisions.
                            </div>
                          )}
                        </div>
                      )}

                      {/* STAGE: COMPLETED BODY */}
                      {workItem.status === 'COMPLETED' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '0.8125rem' }}>
                          <CheckIcon size={16} />
                          <span>This task has been completed and approved.</span>
                        </div>
                      )}

                      {/* STAGE: BLOCKED BODY */}
                      {workItem.status === 'BLOCKED' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontSize: '0.8125rem' }}>
                          <BanIcon size={16} />
                          <span>This task is currently marked as Canceled.</span>
                        </div>
                      )}
                    </div>

                    {/* Status Segmented Row (Permission-guarded) */}
                    <div className="widm-status-section">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="widm-status-heading">Stage Status</span>
                        {!canManageStatus && (
                          <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontStyle: 'italic' }}>
                            Read only for regular members
                          </span>
                        )}
                      </div>
                      <div className="widm-move-pills-list">
                        <button
                          type="button"
                          className={`widm-move-pill ${workItem.status === 'TODO' ? 'active' : ''}`}
                          onClick={() => handleStatusChange('TODO')}
                          disabled={!canManageStatus}
                          style={{ cursor: canManageStatus ? 'pointer' : 'default', opacity: canManageStatus || workItem.status === 'TODO' ? 1 : 0.5 }}
                        >
                          <CircleDotIcon size={13} />
                          <span>To Do</span>
                        </button>

                        <button
                          type="button"
                          className={`widm-move-pill ${workItem.status === 'IN_PROGRESS' ? 'active' : ''}`}
                          onClick={() => handleStatusChange('IN_PROGRESS')}
                          disabled={!canManageStatus}
                          style={{ cursor: canManageStatus ? 'pointer' : 'default', opacity: canManageStatus || workItem.status === 'IN_PROGRESS' ? 1 : 0.5 }}
                        >
                          <PlayIcon size={12} />
                          <span>In Progress</span>
                        </button>

                        <button
                          type="button"
                          className={`widm-move-pill ${workItem.status === 'IN_REVIEW' ? 'active' : ''}`}
                          onClick={() => handleStatusChange('IN_REVIEW')}
                          disabled={!canManageStatus}
                          style={{ cursor: canManageStatus ? 'pointer' : 'default', opacity: canManageStatus || workItem.status === 'IN_REVIEW' ? 1 : 0.5 }}
                        >
                          <UserIcon size={13} />
                          <span>In Review</span>
                        </button>

                        <button
                          type="button"
                          className={`widm-move-pill ${workItem.status === 'COMPLETED' ? 'active' : ''}`}
                          onClick={() => handleStatusChange('COMPLETED')}
                          disabled={!canManageStatus}
                          style={{ cursor: canManageStatus ? 'pointer' : 'default', opacity: canManageStatus || workItem.status === 'COMPLETED' ? 1 : 0.5 }}
                        >
                          <CheckIcon size={13} />
                          <span>Completed</span>
                        </button>

                        <button
                          type="button"
                          className={`widm-move-pill ${workItem.status === 'BLOCKED' ? 'active' : ''}`}
                          onClick={() => handleStatusChange('BLOCKED')}
                          disabled={!canManageStatus}
                          style={{ cursor: canManageStatus ? 'pointer' : 'default', opacity: canManageStatus || workItem.status === 'BLOCKED' ? 1 : 0.5 }}
                        >
                          <BanIcon size={13} />
                          <span>Canceled</span>
                        </button>
                      </div>
                    </div>

                    {/* Subtabs Bar */}
                    <div className="widm-subtabs-bar">
                      <button
                        type="button"
                        className={`widm-subtab-btn ${activeTab === 'comments' ? 'active' : ''}`}
                        onClick={() => setActiveTab('comments')}
                      >
                        <MessageSquareIcon size={16} />
                        <span>Comments ({workItem.comments?.length || 0})</span>
                      </button>

                      <button
                        type="button"
                        className={`widm-subtab-btn ${activeTab === 'attachments' ? 'active' : ''}`}
                        onClick={() => {
                          setActiveTab('attachments');
                          loadAttachments();
                        }}
                      >
                        <PaperclipIcon size={16} />
                        <span>Attachments ({attachments.length})</span>
                      </button>

                      <button
                        type="button"
                        className={`widm-subtab-btn ${activeTab === 'activity' ? 'active' : ''}`}
                        onClick={() => setActiveTab('activity')}
                      >
                        <ActivityIcon size={16} />
                        <span>Activity</span>
                      </button>
                    </div>

                    {/* Subtab Contents */}
                    <div className="widm-tab-content-area">
                      {/* TAB 1: Comments */}
                      {activeTab === 'comments' && (
                        <div className="widm-comments-pane">
                          {workItem.comments && workItem.comments.length > 0 ? (
                            <div className="widm-comments-list">
                              {workItem.comments.map((comment) => {
                                const isCommentAuthor = comment.authorId === user?.id;
                                const canDeleteComment = isCommentAuthor || isProjectAdmin;
                                const authorInitial = comment.author.fullName
                                  ? comment.author.fullName.charAt(0).toUpperCase()
                                  : comment.author.username.charAt(0).toUpperCase();

                                return (
                                  <div key={comment.id} className="widm-comment-item">
                                    <div className="widm-comment-avatar">
                                      {comment.author.avatarUrl ? (
                                        <img src={comment.author.avatarUrl} alt={comment.author.username} />
                                      ) : (
                                        <span>{authorInitial}</span>
                                      )}
                                    </div>
                                    <div className="widm-comment-bubble">
                                      <div className="widm-comment-header">
                                        <span className="widm-comment-author">
                                          {comment.author.fullName || comment.author.username}
                                        </span>
                                        <div className="widm-comment-meta-actions">
                                          <span className="widm-comment-time">
                                            {new Date(comment.createdAt).toLocaleTimeString([], {
                                              month: 'short',
                                              day: 'numeric',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}
                                          </span>
                                          {canDeleteComment && (
                                            <button
                                              type="button"
                                              className="widm-comment-del-btn"
                                              onClick={() => handleDeleteComment(comment.id)}
                                              title="Delete Comment"
                                            >
                                              <MoreVerticalIcon size={14} />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      <p className="widm-comment-text">{comment.body}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="widm-empty-state">
                              <div className="widm-empty-icon-wrap">
                                <ChatBubblesIcon size={36} />
                              </div>
                              <h4 className="widm-empty-title">No comments yet</h4>
                              <p className="widm-empty-subtitle">
                                Start the conversation by adding a comment.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* TAB 2: Attachments */}
                      {activeTab === 'attachments' && (
                        <div className="widm-attachments-pane">
                          {/* Privacy toggle for upcoming uploads */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '0.75rem',
                              padding: '0.5rem 0.75rem',
                              background: 'rgba(255,255,255,0.03)',
                              borderRadius: '8px',
                              border: '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>
                                Upload privacy:
                              </span>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {uploadIsPrivate ? 'Only task creator, assignee & uploader' : 'All project members'}
                              </span>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                gap: '4px',
                                background: 'rgba(0,0,0,0.25)',
                                padding: '3px',
                                borderRadius: '6px',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setUploadIsPrivate(false)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                  border: 'none',
                                  cursor: 'pointer',
                                  background: !uploadIsPrivate ? '#2563eb' : 'transparent',
                                  color: !uploadIsPrivate ? '#fff' : '#94a3b8',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <GlobeIcon size={12} />
                                Public
                              </button>
                              <button
                                type="button"
                                onClick={() => setUploadIsPrivate(true)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                  border: 'none',
                                  cursor: 'pointer',
                                  background: uploadIsPrivate ? '#dc2626' : 'transparent',
                                  color: uploadIsPrivate ? '#fff' : '#94a3b8',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <LockIcon size={12} />
                                Private
                              </button>
                            </div>
                          </div>

                          {/* Drag and Drop Zone */}
                          <div
                            className={`widm-dropzone-box ${isDraggingOver ? 'drag-over' : ''}`}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDraggingOver(true);
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault();
                              setIsDraggingOver(false);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDraggingOver(false);
                              if (e.dataTransfer.files) {
                                handleDirectUpload(e.dataTransfer.files);
                              }
                            }}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <input
                              type="file"
                              ref={fileInputRef}
                              multiple
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                if (e.target.files) {
                                  handleDirectUpload(e.target.files);
                                }
                              }}
                            />
                            <div className="widm-dropzone-icon-circle">
                              <UploadCloudIcon size={24} />
                            </div>
                            <div className="widm-dropzone-title">
                              <span>Drag and drop files here, or </span>
                              <span
                                className="widm-browse-link"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fileInputRef.current?.click();
                                }}
                              >
                                browse
                              </span>
                            </div>
                            <span className="widm-dropzone-subtitle">
                              Supports images, documents, videos, and more (max 10 MB each)
                            </span>
                            {uploadingFiles && (
                              <div className="widm-uploading-indicator">
                                <div className="btn-spinner" />
                                <span>Uploading files...</span>
                              </div>
                            )}
                          </div>

                          {/* Attachments List Section */}
                          <div className="widm-attachments-list-section">
                            <div className="widm-attachments-header-row">
                              <span className="widm-attachments-count-title">
                                Attachments ({attachments.length})
                              </span>

                              <div className="widm-attachments-sort-wrap">
                                <span className="widm-sort-label">Sort by:</span>
                                <select
                                  className="widm-sort-select"
                                  value={attachmentSort}
                                  onChange={(e) => setAttachmentSort(e.target.value as any)}
                                >
                                  <option value="newest">Newest</option>
                                  <option value="oldest">Oldest</option>
                                  <option value="name">Name</option>
                                  <option value="size">Size</option>
                                </select>
                              </div>
                            </div>

                            {loadingAttachments ? (
                              <div className="workspace-loading-state" style={{ padding: '1.5rem' }}>
                                <div className="btn-spinner" />
                                <p>Loading files...</p>
                              </div>
                            ) : sortedAttachments.length > 0 ? (
                              <div className="widm-attachments-new-list">
                                {sortedAttachments.map((att) => {
                                  const uploaderName = att.uploadedBy?.fullName || att.uploadedBy?.username || creatorName;
                                  const uploaderFirstName = uploaderName.split(' ')[0];
                                  const createdDate = new Date(att.createdAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  });
                                  const createdTime = new Date(att.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  });
                                  const canDeleteFile = att.isPrivate
                                    ? att.uploadedById === user?.id
                                    : isProjectAdmin || att.uploadedById === user?.id;
                                  const canTogglePrivacy = att.isPrivate
                                    ? att.uploadedById === user?.id
                                    : isProjectAdmin || att.uploadedById === user?.id;

                                  return (
                                    <div key={att.id} className="widm-attachment-row-card">
                                      <div
                                        className="widm-attachment-main-meta"
                                        onClick={() => setSelectedFileForViewer(att)}
                                        title="Click to preview"
                                      >
                                        {getFileIconBadge(att)}
                                        <div className="widm-attachment-text-details">
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span className="widm-attachment-filename" title={att.originalName}>
                                              {att.originalName}
                                            </span>
                                            {att.isPrivate && (
                                              <span
                                                title="Private file (only task creator, assignee, and uploader can view)"
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '3px',
                                                  padding: '1px 5px',
                                                  borderRadius: '4px',
                                                  fontSize: '0.65rem',
                                                  fontWeight: 600,
                                                  backgroundColor: 'rgba(220, 38, 38, 0.12)',
                                                  color: '#ef4444',
                                                }}
                                              >
                                                <LockIcon size={10} />
                                                Private
                                              </span>
                                            )}
                                          </div>
                                          <span className="widm-attachment-metaline">
                                            {formatFileSize(att.sizeBytes)} • Added by {uploaderFirstName} • {createdDate}, {createdTime}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="widm-attachment-actions-group" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          type="button"
                                          className="widm-file-icon-btn"
                                          title="Preview"
                                          onClick={() => setSelectedFileForViewer(att)}
                                        >
                                          <EyeIcon size={15} />
                                        </button>

                                        <a
                                          href={filesApi.getFileDownloadUrl(att.projectId, att.id)}
                                          download={att.originalName}
                                          className="widm-file-icon-btn"
                                          title="Download"
                                        >
                                          <DownloadIcon size={15} />
                                        </a>

                                        {canTogglePrivacy && (
                                          <button
                                            type="button"
                                            className="widm-file-icon-btn"
                                            title={att.isPrivate ? 'Make Public' : 'Make Private'}
                                            onClick={() => handleToggleFilePrivacy(att)}
                                          >
                                            {att.isPrivate ? <GlobeIcon size={15} /> : <LockIcon size={15} />}
                                          </button>
                                        )}

                                        {canDeleteFile && (
                                          <button
                                            type="button"
                                            className="widm-file-icon-btn delete"
                                            title="Delete"
                                            onClick={() => handleDeleteAttachment(att.id)}
                                          >
                                            <TrashIcon size={15} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="widm-empty-state" style={{ padding: '1.5rem 1rem' }}>
                                <p className="widm-empty-subtitle">No files attached to this work item yet.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* TAB 3: Activity */}
                      {activeTab === 'activity' && (
                        <div className="widm-activity-pane">
                          {groupedActivities.length > 0 ? (
                            <div className="widm-timeline-container">
                              {groupedActivities.map((group) => (
                                <div key={group.dateLabel} className="widm-timeline-date-section">
                                  <div className="widm-timeline-date-header">
                                    <span className="widm-timeline-header-dot" />
                                    <span className="widm-timeline-date-label">{group.dateLabel}</span>
                                  </div>

                                  <div className="widm-timeline-items-group">
                                    {group.items.map((act) => renderActivityItem(act))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="widm-empty-state">
                              <div className="widm-empty-icon-wrap">
                                <ActivityIcon size={36} />
                              </div>
                              <h4 className="widm-empty-title">No activity yet</h4>
                              <p className="widm-empty-subtitle">Activity history will appear as changes are made.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Comment Input Bar (Always Pinned) */}
                    <form onSubmit={handlePostComment} className="widm-comment-input-form">
                      <div className="widm-user-avatar-circle">
                        {user?.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.username} />
                        ) : (
                          <span>{userInitial}</span>
                        )}
                      </div>

                      <div className="widm-input-box-wrapper">
                        <input
                          type="text"
                          className="widm-comment-inline-input"
                          placeholder="Write a comment or note..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                        />

                        <div className="widm-input-actions-right">
                          <button
                            type="button"
                            className="widm-input-icon-action"
                            title="Attach File"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <PaperclipIcon size={17} />
                          </button>

                          <button
                            type="button"
                            className="widm-input-icon-action"
                            title="Mention Member"
                            onClick={() => setCommentText((prev) => prev + '@')}
                          >
                            <AtSignIcon size={17} />
                          </button>

                          <button
                            type="submit"
                            className="widm-submit-comment-circle-btn"
                            disabled={!commentText.trim() || postingComment}
                            title="Send"
                          >
                            <SendIcon size={14} />
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Right Sidebar Column */}
                  <div className="widm-sidebar-column">
                    {/* ASSIGNEES (Multi-assignee support) */}
                    <div className="widm-sidebar-field" style={{ position: 'relative' }}>
                      <div className="widm-sidebar-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <UserIcon size={15} />
                          <span>Assignees</span>
                        </div>
                        {((workItem.assignees && workItem.assignees.length > 0)
                          ? workItem.assignees.length
                          : workItem.assignedTo
                            ? 1
                            : 0) > 0 && (
                            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                              {workItem.assignees && workItem.assignees.length > 0
                                ? workItem.assignees.length
                                : 1}
                            </span>
                          )}
                      </div>

                      {/* Assigned members chip list */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                        {((workItem.assignees && workItem.assignees.length > 0)
                          ? workItem.assignees.map((a) => a.user)
                          : workItem.assignedTo
                            ? [workItem.assignedTo]
                            : []
                        ).length === 0 ? (
                          <div style={{ fontSize: '0.8125rem', color: '#94A3B8', fontStyle: 'italic', padding: '4px 0' }}>
                            No assignees
                          </div>
                        ) : (
                          ((workItem.assignees && workItem.assignees.length > 0)
                            ? workItem.assignees.map((a) => a.user)
                            : workItem.assignedTo
                              ? [workItem.assignedTo]
                              : []
                          ).map((assignee) => (
                            <div
                              key={assignee.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '4px 8px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '8px',
                                fontSize: '0.8125rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {assignee.avatarUrl ? (
                                  <img
                                    src={assignee.avatarUrl}
                                    alt=""
                                    style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: '22px',
                                      height: '22px',
                                      borderRadius: '50%',
                                      background: '#475569',
                                      color: '#FFF',
                                      fontSize: '0.65rem',
                                      fontWeight: 700,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {(assignee.fullName || assignee.username || 'U')[0].toUpperCase()}
                                  </div>
                                )}
                                <span style={{ fontWeight: 500, color: '#E2E8F0' }}>
                                  {assignee.fullName || assignee.username}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleToggleAssignee(assignee.id)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#94A3B8',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                                title="Remove assignee"
                              >
                                <CloseIcon size={13} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Add / Toggle Assignee Dropdown */}
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px dashed rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            color: '#94A3B8',
                            fontSize: '0.8125rem',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <PlusIcon size={14} />
                            <span>Manage Assignees</span>
                          </span>
                          <ChevronDownIcon size={14} />
                        </button>

                        {assigneeDropdownOpen && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 'calc(100% + 4px)',
                              left: 0,
                              right: 0,
                              background: '#1E293B',
                              border: '1px solid #334155',
                              borderRadius: '8px',
                              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                              zIndex: 100,
                              maxHeight: '260px',
                              overflowY: 'auto',
                              padding: '4px',
                            }}
                          >
                            {/* Typeable search filter input */}
                            <div
                              style={{
                                padding: '6px 8px',
                                borderBottom: '1px solid #334155',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#0F172A',
                                borderRadius: '6px 6px 0 0',
                                marginBottom: '4px',
                                position: 'sticky',
                                top: 0,
                                zIndex: 5,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <SearchIcon size={13} style={{ color: '#94A3B8', flexShrink: 0 }} />
                              <input
                                type="text"
                                placeholder="Type name to filter..."
                                value={assigneeSearchQuery}
                                onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                                autoFocus
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  outline: 'none',
                                  color: '#F8FAFC',
                                  fontSize: '0.8rem',
                                  width: '100%',
                                }}
                              />
                              {assigneeSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setAssigneeSearchQuery('')}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#94A3B8',
                                    cursor: 'pointer',
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                >
                                  <CloseIcon size={12} />
                                </button>
                              )}
                            </div>

                            {assignableUsers
                              .filter((u) => {
                                if (!assigneeSearchQuery.trim()) return true;
                                const q = assigneeSearchQuery.toLowerCase();
                                return (
                                  u.name.toLowerCase().includes(q) ||
                                  Boolean(u.username && u.username.toLowerCase().includes(q))
                                );
                              })
                              .map((u) => {
                                const activeIds =
                                  workItem.assignees && workItem.assignees.length > 0
                                    ? workItem.assignees.map((a) => a.userId)
                                    : workItem.assignedToId
                                      ? [workItem.assignedToId]
                                      : [];
                                const isAssigned = activeIds.includes(u.id);

                                return (
                                  <div
                                    key={u.id}
                                    onClick={() => handleToggleAssignee(u.id)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '6px 8px',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      background: isAssigned ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                      color: isAssigned ? '#93C5FD' : '#E2E8F0',
                                      fontSize: '0.8125rem',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <input
                                        type="checkbox"
                                        checked={isAssigned}
                                        onChange={() => { }}
                                        style={{
                                          width: '14px',
                                          height: '14px',
                                          accentColor: '#3B82F6',
                                          cursor: 'pointer',
                                          flexShrink: 0,
                                          pointerEvents: 'none',
                                        }}
                                      />
                                      {u.avatarUrl ? (
                                        <img
                                          src={u.avatarUrl}
                                          alt=""
                                          style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                                        />
                                      ) : (
                                        <div
                                          style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            background: '#475569',
                                            color: '#FFF',
                                            fontSize: '0.625rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                          }}
                                        >
                                          {u.name[0].toUpperCase()}
                                        </div>
                                      )}
                                      <span>{u.name}</span>
                                    </div>
                                    {isAssigned && <CheckIcon size={14} />}
                                  </div>
                                );
                              })}

                            {assignableUsers.filter((u) => {
                              if (!assigneeSearchQuery.trim()) return true;
                              const q = assigneeSearchQuery.toLowerCase();
                              return (
                                u.name.toLowerCase().includes(q) ||
                                Boolean(u.username && u.username.toLowerCase().includes(q))
                              );
                            }).length === 0 && assigneeSearchQuery && (
                                <div style={{ padding: '8px', fontSize: '0.75rem', color: '#94A3B8', textAlign: 'center' }}>
                                  No members matching "{assigneeSearchQuery}"
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PRIORITY */}
                    <div className="widm-sidebar-field">
                      <div className="widm-sidebar-label">
                        <BarChartIcon size={15} />
                        <span>Priority</span>
                      </div>
                      <CustomSelect
                        value={workItem.priority}
                        onChange={(val) => handlePriorityChange(val as WorkItemPriority)}
                        options={[
                          {
                            value: 'LOW',
                            label: 'Low',
                            icon: <ArrowDownIcon size={15} />,
                            iconBg: '#DCFCE7',
                            iconColor: '#16A34A',
                          },
                          {
                            value: 'MEDIUM',
                            label: 'Medium',
                            icon: <BarChartIcon size={15} />,
                            iconBg: '#FEF3C7',
                            iconColor: '#D97706',
                          },
                          {
                            value: 'HIGH',
                            label: 'High',
                            icon: <ChevronUpIcon size={15} />,
                            iconBg: '#FEE2E2',
                            iconColor: '#DC2626',
                          },
                          {
                            value: 'URGENT',
                            label: 'Urgent',
                            icon: <DoubleArrowUpIcon size={15} />,
                            iconBg: '#FEE2E2',
                            iconColor: '#DC2626',
                          },
                        ]}
                      />
                    </div>

                    {/* DUE DATE */}
                    <div className="widm-sidebar-field">
                      <div className="widm-sidebar-label">
                        <CalendarIcon size={15} />
                        <span>Due Date</span>
                      </div>
                      <div className="widm-date-box">
                        <CalendarIcon size={15} className="widm-date-icon" />
                        <input
                          type="date"
                          className="widm-date-native-input"
                          value={workItem.dueDate ? workItem.dueDate.split('T')[0] : ''}
                          onChange={(e) => handleDueDateChange(e.target.value || null)}
                        />
                        <span className="widm-date-display">
                          {formattedDueDate || 'Set due date...'}
                        </span>
                        {workItem.dueDate && (
                          <button
                            type="button"
                            className="widm-date-clear-btn"
                            onClick={() => handleDueDateChange(null)}
                            title="Clear due date"
                          >
                            <CloseIcon size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 4 STAGE DUE DATES */}
                    <div className="widm-sidebar-field" style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <div className="widm-sidebar-label" style={{ marginBottom: '8px' }}>
                        <CalendarIcon size={15} />
                        <span>Stage Due Dates</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* To Do Due Date */}
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginBottom: '2px', fontWeight: 600 }}>
                            TO DO DUE DATE
                          </div>
                          <div className="widm-date-box" style={{ padding: '4px 8px', minHeight: '32px' }}>
                            <input
                              type="date"
                              className="widm-date-native-input"
                              value={workItem.todoDueDate ? workItem.todoDueDate.split('T')[0] : ''}
                              onChange={(e) => handleStageDueDateChange('todoDueDate', e.target.value || null)}
                              disabled={!canManageStatus}
                            />
                            <span className="widm-date-display" style={{ fontSize: '0.75rem' }}>
                              {workItem.todoDueDate
                                ? new Date(workItem.todoDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : 'Not set'}
                            </span>
                          </div>
                        </div>

                        {/* In Progress Due Date */}
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginBottom: '2px', fontWeight: 600 }}>
                            IN PROGRESS DUE DATE
                          </div>
                          <div className="widm-date-box" style={{ padding: '4px 8px', minHeight: '32px' }}>
                            <input
                              type="date"
                              className="widm-date-native-input"
                              value={workItem.inProgressDueDate ? workItem.inProgressDueDate.split('T')[0] : ''}
                              onChange={(e) => handleStageDueDateChange('inProgressDueDate', e.target.value || null)}
                              disabled={!canManageStatus}
                            />
                            <span className="widm-date-display" style={{ fontSize: '0.75rem' }}>
                              {workItem.inProgressDueDate
                                ? new Date(workItem.inProgressDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : 'Not set'}
                            </span>
                          </div>
                        </div>

                        {/* In Review Due Date */}
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginBottom: '2px', fontWeight: 600 }}>
                            IN REVIEW DUE DATE
                          </div>
                          <div className="widm-date-box" style={{ padding: '4px 8px', minHeight: '32px' }}>
                            <input
                              type="date"
                              className="widm-date-native-input"
                              value={workItem.inReviewDueDate ? workItem.inReviewDueDate.split('T')[0] : ''}
                              onChange={(e) => handleStageDueDateChange('inReviewDueDate', e.target.value || null)}
                              disabled={!canManageStatus}
                            />
                            <span className="widm-date-display" style={{ fontSize: '0.75rem' }}>
                              {workItem.inReviewDueDate
                                ? new Date(workItem.inReviewDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : 'Not set'}
                            </span>
                          </div>
                        </div>

                        {/* Completed Due Date */}
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginBottom: '2px', fontWeight: 600 }}>
                            COMPLETED DUE DATE
                          </div>
                          <div className="widm-date-box" style={{ padding: '4px 8px', minHeight: '32px' }}>
                            <input
                              type="date"
                              className="widm-date-native-input"
                              value={workItem.completedDueDate ? workItem.completedDueDate.split('T')[0] : ''}
                              onChange={(e) => handleStageDueDateChange('completedDueDate', e.target.value || null)}
                              disabled={!canManageStatus}
                            />
                            <span className="widm-date-display" style={{ fontSize: '0.75rem' }}>
                              {workItem.completedDueDate
                                ? new Date(workItem.completedDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : 'Not set'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CREATED */}
                    <div className="widm-sidebar-field">
                      <div className="widm-sidebar-label">
                        <ClockIcon size={15} />
                        <span>Created</span>
                      </div>
                      <div className="widm-sidebar-text-val">{createdDateStr}</div>
                    </div>

                    {/* LAST UPDATED */}
                    <div className="widm-sidebar-field">
                      <div className="widm-sidebar-label">
                        <RotateCcwIcon size={15} />
                        <span>Last Updated</span>
                      </div>
                      <div className="widm-sidebar-text-val">{updatedDateStr}</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="modal-error-body">
                <p>Work item not found</p>
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              </div>
            )}
          </div>

          {/* File Viewer Modal for Attachments */}
          {selectedFileForViewer && (
            <FileViewerModal
              file={selectedFileForViewer}
              onClose={() => setSelectedFileForViewer(null)}
              onFileUpdated={loadAttachments}
              onFileDeleted={() => {
                setSelectedFileForViewer(null);
                loadAttachments();
              }}
              canEdit={isProjectAdmin || selectedFileForViewer.uploadedById === user?.id}
              canDelete={isProjectAdmin || selectedFileForViewer.uploadedById === user?.id}
            />
          )}

          {/* File Upload Modal for WorkItem Attachments */}
          {workItem && (
            <FileUploadModal
              isOpen={isUploadModalOpen}
              onClose={() => setIsUploadModalOpen(false)}
              onUploadSuccess={loadAttachments}
              project={project}
              projectName={project.name}
              isProjectScope={true}
              activeProjectId={project.id}
              workItemId={workItem.id}
            />
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteModal && workItem && (
            <DeleteWorkItemModal
              isOpen={showDeleteModal}
              workItem={workItem}
              onClose={() => setShowDeleteModal(false)}
              onConfirmDelete={handleConfirmDeleteWorkItem}
              isDeleting={isDeletingWorkItem}
            />
          )}
        </div>
      );
    };
