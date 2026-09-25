import { API_BASE_URL, safeParseJson } from './client';

export interface UserProfile {
  id: string;
  fullName: string | null;
  username: string;
  email: string;
  isEmailVerified: boolean;
  avatarUrl: string | null;
  googleId: string | null;
  hasPassword: boolean;
  bio: string | null;
  headline: string | null;
  timezone: string;
  notificationPreferences: {
    emailWorkAssigned: boolean;
    emailMentions: boolean;
    emailInvitations: boolean;
    emailDueSoon: boolean;
    weeklyDigest: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileInput {
  fullName?: string | null;
  username?: string;
  headline?: string | null;
  bio?: string | null;
  timezone?: string;
  avatarUrl?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface NotificationPreferences {
  emailWorkAssigned: boolean;
  emailMentions: boolean;
  emailInvitations: boolean;
  emailDueSoon: boolean;
  weeklyDigest: boolean;
}

export const userApi = {
  async getProfile(): Promise<{ success: boolean; data: UserProfile }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/user/profile`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    return safeParseJson<{ success: boolean; data: UserProfile }>(res, 'Failed to fetch user profile');
  },

  async updateProfile(
    input: UpdateProfileInput
  ): Promise<{ success: boolean; message: string; data: UserProfile }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/user/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    return safeParseJson<{ success: boolean; message: string; data: UserProfile }>(
      res,
      'Failed to update user profile'
    );
  },

  async changePassword(
    input: ChangePasswordInput
  ): Promise<{ success: boolean; message: string }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/user/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    return safeParseJson<{ success: boolean; message: string }>(res, 'Failed to update password');
  },

  async updateNotificationPreferences(
    input: NotificationPreferences
  ): Promise<{ success: boolean; message: string; data: NotificationPreferences }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/user/notifications`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    return safeParseJson<{ success: boolean; message: string; data: NotificationPreferences }>(
      res,
      'Failed to update notification preferences'
    );
  },

  async exportData(): Promise<Record<string, any>> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/user/export-data`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    const parsed = await safeParseJson<{ success: boolean; data: Record<string, any> }>(
      res,
      'Failed to export personal data'
    );
    return parsed.data;
  },

  async deleteAccount(
    confirmationPhrase: string
  ): Promise<{ success: boolean; message: string }> {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const res = await fetch(`${base}/user/account`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ confirmationPhrase }),
    });

    return safeParseJson<{ success: boolean; message: string }>(res, 'Failed to delete account');
  },
};
