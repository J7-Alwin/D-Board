import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth.api';

describe('AuthContext Registration & Error Propagation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authApi, 'getMe').mockResolvedValue({
      success: true,
      data: { user: null as any },
    });
  });

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  it('should set user and succeed when authApi.register succeeds', async () => {
    const mockUser = {
      id: 'usr_1',
      username: 'testuser',
      email: 'test@example.com',
      isEmailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.spyOn(authApi, 'register').mockResolvedValueOnce({
      success: true,
      message: 'Account created',
      data: { user: mockUser },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!Secure',
      });
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should throw genuine error when authApi.register returns success: false', async () => {
    vi.spyOn(authApi, 'register').mockResolvedValueOnce({
      success: false,
      message: 'Registration rejected by server policy',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => {
        await result.current.register({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Password123!Secure',
        });
      })
    ).rejects.toThrow('Registration rejected by server policy');

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should propagate API client rejected errors (e.g. 409 Conflict, 400 Bad Request)', async () => {
    const apiError = Object.assign(new Error('Email address is already registered'), {
      status: 409,
      data: {
        errors: { email: ['This email address is already registered'] },
      },
    });

    vi.spyOn(authApi, 'register').mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => {
        await result.current.register({
          username: 'testuser',
          email: 'dup@example.com',
          password: 'Password123!Secure',
        });
      })
    ).rejects.toThrow('Email address is already registered');

    expect(result.current.user).toBeNull();
  });
});
