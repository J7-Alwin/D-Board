export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function resolveApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api';
  const trimmed = envUrl.trim().replace(/\/+$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  return trimmed;
}

export const API_BASE_URL = resolveApiBaseUrl();

export async function safeParseJson<T = any>(response: Response, fallbackMessage = 'Request failed'): Promise<T> {
  const contentType = response.headers.get('content-type');
  let data: any = null;

  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text ? { message: text } : null;
      }
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      (typeof data === 'string' && data.length < 200 && data) ||
      `${fallbackMessage} (Status ${response.status})`;
    throw new ApiError(errorMessage, response.status, data);
  }

  return data as T;
}

export async function apiClient<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Include credentials for session cookies
  options.credentials = 'include';

  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const response = await fetch(`${base}${path}`, {
    ...options,
    headers,
  });

  return safeParseJson<T>(response);
}
