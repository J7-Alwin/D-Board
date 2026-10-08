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

export interface FileUploadResponse {
  success: boolean;
  message?: string;
  data: {
    files: AttachmentDTO[];
  };
}

export interface UploadFilesOptions {
  workItemId?: string | null;
  noteId?: string | null;
  folderId?: string | null;
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
    options?: UploadFilesOptions | string | null,
    onProgress?: (percent: number) => void
  ): Promise<FileUploadResponse> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));

    const workItemId = typeof options === 'string' ? options : options?.workItemId || null;
    const noteId = typeof options === 'object' ? options?.noteId || null : null;
    const folderId = typeof options === 'object' ? options?.folderId || null : null;

    if (workItemId) formData.append('workItemId', workItemId);
    if (noteId) formData.append('noteId', noteId);
    if (folderId) formData.append('folderId', folderId);

    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const uploadUrl = `${base}/projects/${encodeURIComponent(projectId)}/files`;

    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      xhr.open('POST', uploadUrl);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        const isSuccess = xhr.status >= 200 && xhr.status < 300;
        const responseText = xhr.responseText ? xhr.responseText.trim() : '';

        // 1. Distinguish empty response body
        if (!responseText) {
          if (isSuccess) {
            reject(new Error('Server returned an empty response for file upload'));
          } else {
            reject(new Error(`Upload failed with HTTP status ${xhr.status}`));
          }
          return;
        }

        // 2. Parse JSON response
        let parsed: any = null;
        let isJson = false;
        try {
          parsed = JSON.parse(responseText);
          isJson = typeof parsed === 'object' && parsed !== null;
        } catch {
          isJson = false;
        }

        // 3. Handle non-JSON responses (e.g. HTML from SPA redirect/proxy or plain text error)
        if (!isJson) {
          if (import.meta.env.DEV) {
            console.warn('[FileUpload] Expected JSON response but received non-JSON:', {
              status: xhr.status,
              statusText: xhr.statusText,
              preview: responseText.slice(0, 150),
            });
          }

          if (isSuccess) {
            const isHtml = responseText.startsWith('<') || (xhr.getResponseHeader('content-type') || '').includes('text/html');
            if (isHtml) {
              reject(
                new Error(
                  `Upload endpoint returned HTML instead of JSON (HTTP ${xhr.status}). Check VITE_API_URL / API routing.`
                )
              );
            } else {
              reject(new Error(`Server returned invalid response format (HTTP ${xhr.status})`));
            }
          } else {
            if (xhr.status === 413) {
              reject(new Error('Total upload size exceeds maximum allowed limit (HTTP 413)'));
            } else if (xhr.status === 429) {
              reject(new Error('Too many requests. Please wait a moment before trying again (HTTP 429)'));
            } else if (xhr.status >= 500) {
              reject(new Error(`Server error occurred during upload (HTTP ${xhr.status})`));
            } else {
              reject(new Error(`Upload failed (HTTP ${xhr.status}: ${xhr.statusText || 'Error'})`));
            }
          }
          return;
        }

        // 4. Handle JSON error responses (non-2xx HTTP status or success === false)
        if (!isSuccess || parsed.success === false) {
          const apiMessage = parsed.message || parsed.error || `Upload failed with status ${xhr.status}`;
          reject(new Error(apiMessage));
          return;
        }

        // 5. Handle successful JSON response (HTTP 200/201)
        // Normalize response shape to standard { success: boolean, message?: string, data: { files: AttachmentDTO[] } }
        let filesList: AttachmentDTO[] = [];
        if (Array.isArray(parsed.data?.files)) {
          filesList = parsed.data.files;
        } else if (Array.isArray(parsed.data)) {
          filesList = parsed.data;
        } else if (Array.isArray(parsed.files)) {
          filesList = parsed.files;
        } else if (parsed.data?.file && typeof parsed.data.file === 'object') {
          filesList = [parsed.data.file];
        } else if (parsed.file && typeof parsed.file === 'object') {
          filesList = [parsed.file];
        }

        const normalized: FileUploadResponse = {
          success: typeof parsed.success === 'boolean' ? parsed.success : true,
          message: parsed.message,
          data: {
            files: filesList,
          },
        };

        resolve(normalized);
      };

      xhr.onerror = () => reject(new Error('Network error during file upload'));
      xhr.onabort = () => reject(new Error('File upload was aborted'));
      xhr.ontimeout = () => reject(new Error('File upload request timed out'));

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
