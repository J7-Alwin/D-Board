import { apiClient, API_BASE_URL } from './client';

export type FileCategory =
  | 'IMAGE'
  | 'PDF'
  | 'DOCUMENT'
  | 'SPREADSHEET'
  | 'PRESENTATION'
  | 'TEXT'
  | 'CODE'
  | 'DATA'
  | 'ARCHIVE'
  | 'OTHER';

export interface AttachmentDTO {
  id: string;
  projectId: string;
  uploadedById: string;
  workItemId: string | null;
  noteId?: string | null;
  folderId?: string | null;
  folder?: {
    id: string;
    name: string;
  } | null;
  originalName: string;
  storageKey?: string;
  mimeType: string;
  sizeBytes: number;
  extension: string;
  category: FileCategory;
  checksum: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: {
    id: string;
    fullName: string | null;
    username: string;
    avatarUrl: string | null;
  };
  project?: {
    id: string;
    name: string;
    key: string | null;
    avatarUrl?: string | null;
  };
  workItem?: {
    id: string;
    title: string;
    type: string;
    status: string;
  } | null;
  note?: {
    id: string;
    title: string;
    visibility: string;
    createdById: string;
  } | null;
}

export interface FolderDTO {
  id: string;
  projectId: string;
  name: string;
  parentId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    fullName: string | null;
    username: string;
    avatarUrl: string | null;
  };
  _count?: {
    attachments: number;
  };
}

export interface FileQueryParams {
  projectId?: string;
  category?: string;
  search?: string;
  workItemId?: string;
  noteId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'originalName' | 'sizeBytes';
  sortOrder?: 'asc' | 'desc';
}

export interface FileListResponse {
  files: AttachmentDTO[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface StorageCategoryStat {
  category: FileCategory;
  usedBytes: number;
  count: number;
}

export interface StorageStatsDTO {
  usedBytes: number;
  limitBytes: number;
  usedPercentage: number;
  totalFiles: number;
  categoryBreakdown: StorageCategoryStat[];
}

export const filesApi = {
  /**
   * Get storage statistics and 200 MB quota breakdown for the current user.
   */
  async getStorageStats(): Promise<{ success: boolean; data: StorageStatsDTO }> {
    return apiClient<{ success: boolean; data: StorageStatsDTO }>('/files/storage/stats');
  },

  /**
   * List files for a specific project.
   */
  async getProjectFiles(projectId: string, params: FileQueryParams = {}): Promise<{ success: boolean; data: FileListResponse }> {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'ALL') query.append('category', params.category);
    if (params.search) query.append('search', params.search);
    if (params.workItemId) query.append('workItemId', params.workItemId);
    if (params.noteId) query.append('noteId', params.noteId);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient<{ success: boolean; data: FileListResponse }>(`/projects/${projectId}/files${qs}`);
  },

  /**
   * List files globally across all accessible projects.
   */
  async getGlobalFiles(params: FileQueryParams = {}): Promise<{ success: boolean; data: FileListResponse }> {
    const query = new URLSearchParams();
    if (params.projectId) query.append('projectId', params.projectId);
    if (params.category && params.category !== 'ALL') query.append('category', params.category);
    if (params.search) query.append('search', params.search);
    if (params.workItemId) query.append('workItemId', params.workItemId);
    if (params.noteId) query.append('noteId', params.noteId);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient<{ success: boolean; data: FileListResponse }>(`/files${qs}`);
  },

  /**
   * Get single file metadata by ID.
   */
  async getFileById(projectId: string, fileId: string): Promise<{ success: boolean; data: { file: AttachmentDTO } }> {
    return apiClient<{ success: boolean; data: { file: AttachmentDTO } }>(`/projects/${projectId}/files/${fileId}`);
  },

  /**
   * Upload multiple files with progress tracking.
   */
  async uploadFiles(
    projectId: string,
    files: File[],
    options?: { workItemId?: string | null; noteId?: string | null } | string | null,
    onProgress?: (percent: number) => void
  ): Promise<{ success: boolean; data: { files: AttachmentDTO[] } }> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));

    const workItemId = typeof options === 'string' ? options : options?.workItemId || null;
    const noteId = typeof options === 'object' ? options?.noteId || null : null;

    if (workItemId) formData.append('workItemId', workItemId);
    if (noteId) formData.append('noteId', noteId);

    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      xhr.open('POST', `/api/projects/${projectId}/files`);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(res);
          } else {
            reject(new Error(res.message || 'Upload failed'));
          }
        } catch {
          reject(new Error('Failed to parse upload response'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during file upload'));
      xhr.send(formData);
    });
  },

  /**
   * Rename file.
   */
  async renameFile(projectId: string, fileId: string, name: string): Promise<{ success: boolean; data: { file: AttachmentDTO } }> {
    return apiClient<{ success: boolean; data: { file: AttachmentDTO } }>(`/projects/${projectId}/files/${fileId}/rename`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  /**
   * Delete file.
   */
  async deleteFile(projectId: string, fileId: string): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(`/projects/${projectId}/files/${fileId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Attach/detach file from work item.
   */
  async attachToWorkItem(projectId: string, fileId: string, workItemId: string | null): Promise<{ success: boolean; data: { file: AttachmentDTO } }> {
    return apiClient<{ success: boolean; data: { file: AttachmentDTO } }>(`/projects/${projectId}/files/${fileId}/attach`, {
      method: 'POST',
      body: JSON.stringify({ workItemId }),
    });
  },

  /**
   * Direct content URL for in-platform preview streaming.
   */
  getFileContentUrl(projectId: string, fileId: string): string {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    return `${base}/projects/${projectId}/files/${fileId}/content`;
  },

  /**
   * Direct download URL.
   */
  getFileDownloadUrl(projectId: string, fileId: string): string {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    return `${base}/projects/${projectId}/files/${fileId}/download`;
  },

  getDownloadUrl(projectId: string, fileId: string): string {
    return this.getFileDownloadUrl(projectId, fileId);
  },

  /**
   * Fetch raw file ArrayBuffer for client-side parsers (SheetJS, Mammoth, JSZip).
   */
  async fetchFileArrayBuffer(projectId: string, fileId: string): Promise<ArrayBuffer> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/files/${fileId}/content`, {
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(`Failed to load file content (${res.status} ${res.statusText})`);
    }

    return await res.arrayBuffer();
  },

  /**
   * Fetch raw file text content for code/markdown/data viewers.
   */
  async fetchFileText(projectId: string, fileId: string): Promise<string> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/files/${fileId}/content`, {
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(`Failed to load file text (${res.status} ${res.statusText})`);
    }

    return await res.text();
  },

  /**
   * Fetch file Blob for image/pdf object URLs.
   */
  async fetchFileBlob(projectId: string, fileId: string): Promise<Blob> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/files/${fileId}/content`, {
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(`Failed to load file blob (${res.status} ${res.statusText})`);
    }

    return await res.blob();
  },

  /**
   * Get all folders for a project.
   */
  async getProjectFolders(projectId: string): Promise<{ success: boolean; data: { folders: FolderDTO[] } }> {
    return apiClient<{ success: boolean; data: { folders: FolderDTO[] } }>(`/projects/${projectId}/folders`);
  },

  /**
   * Create a new folder.
   */
  async createFolder(
    projectId: string,
    name: string,
    parentId?: string | null
  ): Promise<{ success: boolean; data: { folder: FolderDTO } }> {
    return apiClient<{ success: boolean; data: { folder: FolderDTO } }>(`/projects/${projectId}/folders`, {
      method: 'POST',
      body: JSON.stringify({ name, parentId }),
    });
  },

  /**
   * Rename a folder.
   */
  async renameFolder(
    projectId: string,
    folderId: string,
    name: string
  ): Promise<{ success: boolean; data: { folder: FolderDTO } }> {
    return apiClient<{ success: boolean; data: { folder: FolderDTO } }>(`/projects/${projectId}/folders/${folderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  /**
   * Delete a folder.
   */
  async deleteFolder(
    projectId: string,
    folderId: string
  ): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(`/projects/${projectId}/folders/${folderId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Move a file into a folder or to root (folderId: null).
   */
  async moveFile(
    projectId: string,
    fileId: string,
    folderId: string | null
  ): Promise<{ success: boolean; data: { file: AttachmentDTO } }> {
    return apiClient<{ success: boolean; data: { file: AttachmentDTO } }>(`/projects/${projectId}/files/${fileId}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ folderId }),
    });
  },
};
