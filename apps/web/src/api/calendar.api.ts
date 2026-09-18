import { API_BASE_URL, safeParseJson } from './client';

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
}

export const calendarApi = {
  getCalendarItems: async (
    params?: CalendarQueryParams
  ): Promise<{ success: boolean; data: CalendarResponse }> => {
    const query = new URLSearchParams();
    if (params?.start) query.append('start', params.start);
    if (params?.end) query.append('end', params.end);
    if (params?.projectId) query.append('projectId', params.projectId);
    if (params?.type && params.type !== 'ALL') query.append('type', params.type);
    if (params?.search) query.append('search', params.search);

    const qs = query.toString();
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/calendar/events${qs ? `?${qs}` : ''}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; data: CalendarResponse }>(res, 'Failed to fetch calendar items');
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
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/calendar/events${qs ? `?${qs}` : ''}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; data: CalendarResponse }>(res, 'Failed to fetch project calendar');
  },

  createCalendarEvent: async (
    projectId: string,
    payload: CreateCalendarEventPayload
  ): Promise<{ success: boolean; message: string; data: { event: any } }> => {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/calendar/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return safeParseJson<{ success: boolean; message: string; data: { event: any } }>(res, 'Failed to create calendar event');
  },

  updateCalendarEvent: async (
    projectId: string,
    eventId: string,
    payload: UpdateCalendarEventPayload
  ): Promise<{ success: boolean; message: string; data: { event: any } }> => {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/calendar/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return safeParseJson<{ success: boolean; message: string; data: { event: any } }>(res, 'Failed to update calendar event');
  },

  deleteCalendarEvent: async (
    projectId: string,
    eventId: string
  ): Promise<{ success: boolean; message: string }> => {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/projects/${projectId}/calendar/events/${eventId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return safeParseJson<{ success: boolean; message: string }>(res, 'Failed to delete calendar event');
  },
};
