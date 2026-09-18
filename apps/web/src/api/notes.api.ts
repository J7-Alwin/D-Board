import { API_BASE_URL, safeParseJson } from './client';
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
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/notes${qs ? `?${qs}` : ''}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; data: NotesResponse }>(res, 'Failed to fetch notes');
  },

  getGlobalNotes: async (
    params?: NotesFilterParams
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
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/notes${qs ? `?${qs}` : ''}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; data: NotesResponse }>(res, 'Failed to fetch notes');
  },

  getNoteById: async (
    projectId: string,
    noteId: string
  ): Promise<{ success: boolean; data: { note: Note } }> => {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/notes/${noteId}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; data: { note: Note } }>(res, 'Failed to fetch note');
  },

  createNote: async (
    projectId: string,
    payload: CreateNotePayload
  ): Promise<{ success: boolean; message: string; data: { note: Note } }> => {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return safeParseJson<{ success: boolean; message: string; data: { note: Note } }>(res, 'Failed to create note');
  },

  updateNote: async (
    projectId: string,
    noteId: string,
    payload: UpdateNotePayload
  ): Promise<{ success: boolean; message: string; data: { note: Note } }> => {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return safeParseJson<{ success: boolean; message: string; data: { note: Note } }>(res, 'Failed to update note');
  },

  deleteNote: async (
    projectId: string,
    noteId: string
  ): Promise<{ success: boolean; message: string }> => {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/notes/${noteId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; message: string }>(res, 'Failed to delete note');
  },
};
