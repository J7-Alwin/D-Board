import { z } from 'zod';

export const calendarEventTypeEnum = z.enum([
  'MEETING',
  'MILESTONE',
  'RELEASE',
  'DEADLINE',
  'OTHER',
]);

export const createCalendarEventSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Event title is required')
      .max(200, 'Title cannot exceed 200 characters')
      .transform((val) => val.trim()),
    description: z
      .string()
      .max(5000, 'Description cannot exceed 5000 characters')
      .optional()
      .nullable(),
    type: calendarEventTypeEnum.optional().default('MEETING'),
    startAt: z.string().datetime({ message: 'Valid start date/time is required' }),
    endAt: z.string().datetime({ message: 'Valid end date/time is required' }),
    allDay: z.boolean().optional().default(false),
    location: z
      .string()
      .max(200, 'Location cannot exceed 200 characters')
      .optional()
      .nullable(),
    relatedWorkItemId: z.string().uuid().optional().nullable(),
    attendeeIds: z.array(z.string().uuid()).optional().default([]),
  })
  .refine(
    (data) => {
      const start = new Date(data.startAt).getTime();
      const end = new Date(data.endAt).getTime();
      return end >= start;
    },
    {
      message: 'End date/time cannot be before start date/time',
      path: ['endAt'],
    }
  );

export const updateCalendarEventSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Event title cannot be empty')
      .max(200, 'Title cannot exceed 200 characters')
      .transform((val) => val.trim())
      .optional(),
    description: z
      .string()
      .max(5000, 'Description cannot exceed 5000 characters')
      .optional()
      .nullable(),
    type: calendarEventTypeEnum.optional(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    allDay: z.boolean().optional(),
    location: z.string().max(200).optional().nullable(),
    relatedWorkItemId: z.string().uuid().optional().nullable(),
    attendeeIds: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        const start = new Date(data.startAt).getTime();
        const end = new Date(data.endAt).getTime();
        return end >= start;
      }
      return true;
    },
    {
      message: 'End date/time cannot be before start date/time',
      path: ['endAt'],
    }
  );

export const calendarQuerySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  projectId: z.string().uuid().optional(),
  type: z
    .enum([
      'ALL',
      'WORK',
      'EVENT',
      'MEETING',
      'MILESTONE',
      'RELEASE',
      'DEADLINE',
      'OTHER',
    ])
    .optional()
    .default('ALL'),
  search: z.string().optional(),
});

export interface CreateCalendarEventInput {
  title: string;
  description?: string | null;
  type?: 'MEETING' | 'MILESTONE' | 'RELEASE' | 'DEADLINE' | 'OTHER';
  startAt: string;
  endAt: string;
  allDay?: boolean;
  location?: string | null;
  relatedWorkItemId?: string | null;
  attendeeIds?: string[];
}

export interface UpdateCalendarEventInput {
  title?: string;
  description?: string | null;
  type?: 'MEETING' | 'MILESTONE' | 'RELEASE' | 'DEADLINE' | 'OTHER';
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  location?: string | null;
  relatedWorkItemId?: string | null;
  attendeeIds?: string[];
}

export interface CalendarQueryParams {
  start?: string;
  end?: string;
  projectId?: string;
  type?:
    | 'ALL'
    | 'WORK'
    | 'EVENT'
    | 'MEETING'
    | 'MILESTONE'
    | 'RELEASE'
    | 'DEADLINE'
    | 'OTHER';
  search?: string;
}
