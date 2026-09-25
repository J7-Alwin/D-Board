import { apiClient, API_BASE_URL, type ApiResponse } from './client';

export interface User {
  id: string;
  fullName?: string | null;
  username: string;
  email: string;
  avatarUrl?: string | null;
  isEmailVerified: boolean;
  termsAccepted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterInput {
  fullName?: string;
  username: string;
  email: string;
  password: string;
  termsAccepted?: boolean;
  avatarUrl?: string | null;
}

export interface LoginInput {
  identifier: string; // username or email
  password: string;
  rememberMe?: boolean;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface VerifyOtpInput {
  email: string;
  otp: string;
}

export interface ResetPasswordInput {
  email?: string;
  otp?: string;
  token?: string;
  newPassword: string;
}

export interface AuthResponseData {
  user: User;
  token?: string;
}

export const authApi = {
  async register(input: RegisterInput): Promise<ApiResponse<AuthResponseData>> {
    return apiClient<ApiResponse<AuthResponseData>>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async login(input: LoginInput): Promise<ApiResponse<AuthResponseData>> {
    return apiClient<ApiResponse<AuthResponseData>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getMe(): Promise<ApiResponse<{ user: User }>> {
    return apiClient<ApiResponse<{ user: User }>>('/auth/me', {
      method: 'GET',
    });
  },

  async logout(): Promise<ApiResponse> {
    return apiClient<ApiResponse>('/auth/logout', {
      method: 'POST',
    });
  },

  async forgotPassword(input: ForgotPasswordInput): Promise<ApiResponse> {
    return apiClient<ApiResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async verifyOtp(input: VerifyOtpInput): Promise<ApiResponse> {
    return apiClient<ApiResponse>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async resetPassword(input: ResetPasswordInput): Promise<ApiResponse> {
    return apiClient<ApiResponse>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateUsername(username: string): Promise<ApiResponse<AuthResponseData>> {
    return apiClient<ApiResponse<AuthResponseData>>('/auth/username', {
      method: 'PATCH',
      body: JSON.stringify({ username }),
    });
  },

  getGoogleAuthUrl(): string {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    return `${base}/auth/google`;
  },
};
