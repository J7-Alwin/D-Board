import { apiClient } from './client';
import type { AttachmentDTO } from './files.api';

export type NoteVisibility = 'TEAM' | 'USERS';

export interface NoteMentionUser {
  id: string;
  fullName: string | null;
  username: string;
  avatarUrl: string | null;
}

export interface NoteAuthor {
  id: string;
  fullName: string | null;
  username: string;
  avatarUrl: string | null;
}

export interface NoteProject {
  id: string;
  name: string;
  key: string | null;
  avatarUrl: string | null;
}

export interface Note {
  id: string;
  projectId: string;
  title: string;
  content: string;
  color?: string;
  tags?: string[];
  visibility: NoteVisibility;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: NoteAuthor;
  updatedBy: NoteAuthor | null;
  project?: NoteProject;
  mentions: NoteMentionUser[];
  attachments?: AttachmentDTO[];
}

export interface NotesFilterParams {
  search?: string;
  visibility?: 'ALL' | 'TEAM' | 'USERS';
  tag?: string;
  color?: string;
  pinned?: boolean;
  authorId?: string;
  sort?: 'recentUpdated' | 'recentCreated' | 'title';
  limit?: number;
  offset?: number;
  projectId?: string;
}

export interface NotesResponse {
  notes: Note[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateNotePayload {
  title: string;
  content: string;
  color?: string;
  tags?: string[];
  pinned?: boolean;
  attachmentIds?: string[];
}

export interface UpdateNotePayload {
  title?: string;
  content?: string;
  color?: string;
  tags?: string[];
  pinned?: boolean;
  attachmentIds?: string[];
}

export const notesApi = {
  getProjectNotes: async (
    projectId: string,
    params?: NotesFilterParams
  ): Promise<{ success: boolean; data: NotesResponse }> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.visibility && params.visibility !== 'ALL') query.append('visibility', params.visibility);
    if (params?.tag && params.tag !== 'ALL') query.append('tag', params.tag);
    if (params?.color) query.append('color', params.color);
    if (params?.pinned !== undefined) query.append('pinned', String(params.pinned));
    if (params?.authorId) query.append('authorId', params.authorId);
    if (params?.sort) query.append('sort', params.sort);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));

    const qs = query.toString();
    return apiClient<{ success: boolean; data: NotesResponse }>(`/projects/${projectId}/notes${qs ? `?${qs}` : ''}`);
  },

  getGlobalNotes: async (
    params?: NotesFilterParams,
    workspaceId?: string
  ): Promise<{ success: boolean; data: NotesResponse }> => {
    const query = new URLSearchParams();
    if (params?.projectId) query.append('projectId', params.projectId);
    if (params?.search) query.append('search', params.search);
    if (params?.visibility && params.visibility !== 'ALL') query.append('visibility', params.visibility);
    if (params?.tag && params.tag !== 'ALL') query.append('tag', params.tag);
    if (params?.color) query.append('color', params.color);
    if (params?.pinned !== undefined) query.append('pinned', String(params.pinned));
    if (params?.authorId) query.append('authorId', params.authorId);
    if (params?.sort) query.append('sort', params.sort);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));

    const qs = query.toString();
    const headers: Record<string, string> = {};
    if (workspaceId) headers['X-Workspace-Id'] = workspaceId;
    return apiClient<{ success: boolean; data: NotesResponse }>(`/notes${qs ? `?${qs}` : ''}`, { headers });
  },

  getNoteById: async (
    projectId: string,
    noteId: string
  ): Promise<{ success: boolean; data: { note: Note } }> => {
    return apiClient<{ success: boolean; data: { note: Note } }>(`/projects/${projectId}/notes/${noteId}`);
  },

  createNote: async (
    projectId: string,
    payload: CreateNotePayload
  ): Promise<{ success: boolean; message: string; data: { note: Note } }> => {
    return apiClient<{ success: boolean; message: string; data: { note: Note } }>(`/projects/${projectId}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateNote: async (
    projectId: string,
    noteId: string,
    payload: UpdateNotePayload
  ): Promise<{ success: boolean; message: string; data: { note: Note } }> => {
    return apiClient<{ success: boolean; message: string; data: { note: Note } }>(`/projects/${projectId}/notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteNote: async (
    projectId: string,
    noteId: string
  ): Promise<{ success: boolean; message: string }> => {
    return apiClient<{ success: boolean; message: string }>(`/projects/${projectId}/notes/${noteId}`, {
      method: 'DELETE',
    });
  },
};
