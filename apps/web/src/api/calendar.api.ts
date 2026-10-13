import { apiClient } from './client';

export type CalendarEventType = 'MEETING' | 'MILESTONE' | 'RELEASE' | 'DEADLINE' | 'OTHER';

export interface CalendarItemWorkItem {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  assignedTo?: {
    id: string;
    fullName: string | null;
    username: string;
    avatarUrl: string | null;
  } | null;
  dueDate: string;
}

export interface CalendarItemUser {
  id: string;
  fullName: string | null;
  username: string;
  avatarUrl: string | null;
}

export interface CalendarItemProject {
  id: string;
  name: string;
  key: string | null;
  avatarUrl: string | null;
}

export interface CalendarItem {
  id: string;
  kind: 'EVENT' | 'WORK_ITEM';
  type: CalendarEventType;
  title: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location?: string | null;
  projectId: string;
  project?: CalendarItemProject;
  createdBy?: CalendarItemUser;
  updatedBy?: CalendarItemUser | null;
  relatedWorkItemId?: string | null;
  relatedWorkItem?: {
    id: string;
    title: string;
    type: string;
    status: string;
    priority: string;
  } | null;
  isOverdue?: boolean;
  isPrivate?: boolean;
  workItem?: CalendarItemWorkItem;
  attendees?: CalendarItemUser[];
  createdAt: string;
  updatedAt: string;
}

export interface CalendarQueryParams {
  start?: string;
  end?: string;
  projectId?: string;
  type?: string;
  search?: string;
}

export interface CalendarResponse {
  items: CalendarItem[];
  range: {
    start: string;
    end: string;
  };
  counts: {
    total: number;
    events: number;
    workDeadlines: number;
  };
}

export interface CreateCalendarEventPayload {
  title: string;
  description?: string | null;
  type?: CalendarEventType;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  location?: string | null;
  relatedWorkItemId?: string | null;
  attendeeIds?: string[];
  isPrivate?: boolean;
}

export interface UpdateCalendarEventPayload {
  title?: string;
  description?: string | null;
  type?: CalendarEventType;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  location?: string | null;
  relatedWorkItemId?: string | null;
  attendeeIds?: string[];
  isPrivate?: boolean;
}

export const calendarApi = {
  getCalendarItems: async (
    params?: CalendarQueryParams,
    workspaceId?: string
  ): Promise<{ success: boolean; data: CalendarResponse }> => {
    const query = new URLSearchParams();
    if (params?.start) query.append('start', params.start);
    if (params?.end) query.append('end', params.end);
    if (params?.projectId) query.append('projectId', params.projectId);
    if (params?.type && params.type !== 'ALL') query.append('type', params.type);
    if (params?.search) query.append('search', params.search);

    const qs = query.toString();
    const headers: Record<string, string> = {};
    if (workspaceId) headers['X-Workspace-Id'] = workspaceId;
    return apiClient<{ success: boolean; data: CalendarResponse }>(`/calendar/events${qs ? `?${qs}` : ''}`, { headers });
  },

  getProjectCalendarItems: async (
    projectId: string,
    params?: CalendarQueryParams
  ): Promise<{ success: boolean; data: CalendarResponse }> => {
    const query = new URLSearchParams();
    if (params?.start) query.append('start', params.start);
    if (params?.end) query.append('end', params.end);
    if (params?.type && params.type !== 'ALL') query.append('type', params.type);
    if (params?.search) query.append('search', params.search);

    const qs = query.toString();
    return apiClient<{ success: boolean; data: CalendarResponse }>(`/projects/${projectId}/calendar/events${qs ? `?${qs}` : ''}`);
  },

  createCalendarEvent: async (
    projectId: string,
    payload: CreateCalendarEventPayload
  ): Promise<{ success: boolean; message: string; data: { event: any } }> => {
    return apiClient<{ success: boolean; message: string; data: { event: any } }>(`/projects/${projectId}/calendar/events`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateCalendarEvent: async (
    projectId: string,
    eventId: string,
    payload: UpdateCalendarEventPayload
  ): Promise<{ success: boolean; message: string; data: { event: any } }> => {
    return apiClient<{ success: boolean; message: string; data: { event: any } }>(`/projects/${projectId}/calendar/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteCalendarEvent: async (
    projectId: string,
    eventId: string
  ): Promise<{ success: boolean; message: string }> => {
    return apiClient<{ success: boolean; message: string }>(`/projects/${projectId}/calendar/events/${eventId}`, {
      method: 'DELETE',
    });
  },

  createFeedToken: async (
    projectId?: string
  ): Promise<{ success: boolean; data: { token: string; feedUrl: string }; message: string }> => {
    const endpoint = projectId
      ? `/projects/${projectId}/calendar/feed/token`
      : `/calendar/feed/token`;
    return apiClient<{ success: boolean; data: { token: string; feedUrl: string }; message: string }>(endpoint, {
      method: 'POST',
    });
  },

  revokeFeedToken: async (
    projectId?: string
  ): Promise<{ success: boolean; message: string }> => {
    const endpoint = projectId
      ? `/projects/${projectId}/calendar/feed/token`
      : `/calendar/feed/token`;
    return apiClient<{ success: boolean; message: string }>(endpoint, {
      method: 'DELETE',
    });
  },
};
