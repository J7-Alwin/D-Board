import type { WorkItemComment } from './work.api';

import { API_BASE_URL, safeParseJson } from './client';

export const commentsApi = {
  async getComments(
    projectId: string,
    workItemId: string
  ): Promise<{ success: boolean; data: { comments: WorkItemComment[] } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/work/${workItemId}/comments`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; data: { comments: WorkItemComment[] } }>(res, 'Failed to fetch comments');
  },

  async createComment(
    projectId: string,
    workItemId: string,
    content: string
  ): Promise<{ success: boolean; message: string; data: { comment: WorkItemComment } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/work/${workItemId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content }),
    });
    return safeParseJson<{ success: boolean; message: string; data: { comment: WorkItemComment } }>(res, 'Failed to post comment');
  },

  async updateComment(
    projectId: string,
    workItemId: string,
    commentId: string,
    content: string
  ): Promise<{ success: boolean; message: string; data: { comment: WorkItemComment } }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(
      `${base}/projects/${projectId}/work/${workItemId}/comments/${commentId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      }
    );
    return safeParseJson<{ success: boolean; message: string; data: { comment: WorkItemComment } }>(res, 'Failed to update comment');
  },

  async deleteComment(
    projectId: string,
    workItemId: string,
    commentId: string
  ): Promise<{ success: boolean; message: string }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(
      `${base}/projects/${projectId}/work/${workItemId}/comments/${commentId}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      }
    );
    return safeParseJson<{ success: boolean; message: string }>(res, 'Failed to delete comment');
  },
};
