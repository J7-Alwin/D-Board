import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Project } from '../../api/projects.api';
import {
  workApi,
  type WorkItem,
  type WorkItemActivity,
  type WorkItemStatus,
  type WorkItemPriority,
  type WorkItemType,
} from '../../api/work.api';
import { commentsApi } from '../../api/comments.api';
import { filesApi, type AttachmentDTO } from '../../api/files.api';
import { useAuth } from '../../context/AuthContext';
import { useProjectSocket } from '../../context/SocketContext';
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
  CheckIcon,
  MoreVerticalIcon,
  PaperclipIcon,
  RotateCcwIcon,
  AtSignIcon,
  ChatBubblesIcon,
  CircleDotIcon,
  ChevronUpIcon,
  BanIcon,
  EyeIcon,
  ImageIcon,
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
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [selectedFileForViewer, setSelectedFileForViewer] = useState<AttachmentDTO | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Options menu state (3 dots)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingWorkItem, setIsDeletingWorkItem] = useState(false);

  const assignableUsers = useMemo(() => {
    const list: {
      id: string;
      name: string;
      role: 'Owner' | 'Admin' | 'Member';
      badgeType: 'owner' | 'admin' | 'member';
      avatarUrl?: string | null;
      initials?: string;
    }[] = [];
    if (project.createdBy) {
      list.push({
        id: project.createdById,
        name: `${project.createdBy.fullName || project.createdBy.username} (Owner)`,
        role: 'Owner',
        badgeType: 'owner',
        avatarUrl: project.createdBy.avatarUrl,
        initials: (project.createdBy.fullName || project.createdBy.username).charAt(0).toUpperCase(),
      });
    }
    if (project.members) {
      project.members.forEach((m) => {
        if (m.userId !== project.createdById) {
          list.push({
            id: m.userId,
            name: m.user.fullName || m.user.username,
            role: m.role === 'PROJECT_ADMIN' ? 'Admin' : 'Member',
            badgeType: m.role === 'PROJECT_ADMIN' ? 'admin' : 'member',
            avatarUrl: m.user.avatarUrl,
            initials: (m.user.fullName || m.user.username).charAt(0).toUpperCase(),
          });
        }
      });
    }
    return list;
  }, [project]);

  // Load attachments helper
  const loadAttachments = useCallback(async () => {
    if (!workItemId) return;
    setLoadingAttachments(true);
    try {
      const res = await filesApi.getProjectFiles(project.id, { workItemId });
      if (res.success) {
        setAttachments(res.data.files);
      }
    } catch {}
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
      await filesApi.uploadFiles(project.id, fileArray, { workItemId });
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
          ? 'Blocked'
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

    socket.on('COMMENT_CREATED', handleCommentEvent);
    socket.on('COMMENT_UPDATED', handleCommentEvent);
    socket.on('COMMENT_DELETED', handleCommentEvent);
    socket.on('FILE_UPLOADED', handleFileEvent);
    socket.on('FILE_RENAMED', handleFileEvent);
    socket.on('FILE_DELETED', handleFileEvent);

    return () => {
      socket.off('COMMENT_CREATED', handleCommentEvent);
      socket.off('COMMENT_UPDATED', handleCommentEvent);
      socket.off('COMMENT_DELETED', handleCommentEvent);
      socket.off('FILE_UPLOADED', handleFileEvent);
      socket.off('FILE_RENAMED', handleFileEvent);
      socket.off('FILE_DELETED', handleFileEvent);
    };
  }, [socket, isConnected, workItemId, loadWorkItemData, loadAttachments]);

  if (!workItemId) return null;

  const isProjectAdmin = project.userRole === 'PROJECT_ADMIN' || project.createdById === user?.id;
  const isCreator = workItem?.createdById === user?.id;
  const canDelete = isProjectAdmin || isCreator;

  // Status transition handler
  const handleStatusChange = async (newStatus: WorkItemStatus) => {
    if (!workItem || workItem.status === newStatus) return;
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

  // Assignee change handler
  const handleAssigneeChange = async (newAssigneeId: string) => {
    if (!workItem) return;
    try {
      const res = await workApi.updateWorkItem(project.id, workItem.id, {
        assignedToId: newAssigneeId || null,
      });
      if (res.success && res.data.workItem) {
        setWorkItem({
          ...workItem,
          assignedToId: res.data.workItem.assignedToId,
          assignedTo: res.data.workItem.assignedTo,
        });
        onUpdated(res.data.workItem);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update assignee');
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
            <span>Blocked</span>
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
            <div className="widm-modal-top-header">
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
            <div className="widm-modal-body">
              {/* Left Column: Status Pills, Tabs, Comments/Attachments/Activity */}
              <div className="widm-main-column">
                {/* Status Segmented Row */}
                <div className="widm-status-section">
                  <span className="widm-status-heading">Status</span>
                  <div className="widm-move-pills-list">
                    <button
                      type="button"
                      className={`widm-move-pill ${workItem.status === 'TODO' ? 'active' : ''}`}
                      onClick={() => handleStatusChange('TODO')}
                    >
                      <CircleDotIcon size={13} />
                      <span>To Do</span>
                    </button>

                    <button
                      type="button"
                      className={`widm-move-pill ${workItem.status === 'IN_PROGRESS' ? 'active' : ''}`}
                      onClick={() => handleStatusChange('IN_PROGRESS')}
                    >
                      <PlayIcon size={12} />
                      <span>In Progress</span>
                    </button>

                    <button
                      type="button"
                      className={`widm-move-pill ${workItem.status === 'BLOCKED' ? 'active' : ''}`}
                      onClick={() => handleStatusChange('BLOCKED')}
                    >
                      <ClockIcon size={13} />
                      <span>Blocked</span>
                    </button>

                    <button
                      type="button"
                      className={`widm-move-pill ${workItem.status === 'IN_REVIEW' ? 'active' : ''}`}
                      onClick={() => handleStatusChange('IN_REVIEW')}
                    >
                      <UserIcon size={13} />
                      <span>In Review</span>
                    </button>

                    <button
                      type="button"
                      className={`widm-move-pill ${workItem.status === 'COMPLETED' ? 'active' : ''}`}
                      onClick={() => handleStatusChange('COMPLETED')}
                    >
                      <CheckIcon size={13} />
                      <span>Completed</span>
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
                              const canDeleteFile = isProjectAdmin || att.uploadedById === user?.id;

                              return (
                                <div key={att.id} className="widm-attachment-row-card">
                                  <div
                                    className="widm-attachment-main-meta"
                                    onClick={() => setSelectedFileForViewer(att)}
                                    title="Click to preview"
                                  >
                                    {getFileIconBadge(att)}
                                    <div className="widm-attachment-text-details">
                                      <span className="widm-attachment-filename" title={att.originalName}>
                                        {att.originalName}
                                      </span>
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
                {/* ASSIGNEE */}
                <div className="widm-sidebar-field">
                  <div className="widm-sidebar-label">
                    <UserIcon size={15} />
                    <span>Assignee</span>
                  </div>
                  <CustomSelect
                    value={workItem.assignedToId || ''}
                    onChange={(val) => handleAssigneeChange(val)}
                    placeholder="Unassigned"
                    options={[
                      {
                        value: '',
                        label: 'Unassigned',
                        icon: <UserIcon size={15} />,
                        iconBg: '#F3F4F6',
                        iconColor: '#4B5563',
                      },
                      ...assignableUsers.map((u) => ({
                        value: u.id,
                        label: u.name,
                        badge: u.role,
                        badgeType: u.badgeType,
                        avatarUrl: u.avatarUrl,
                        initials: u.initials,
                      })),
                    ]}
                  />
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
