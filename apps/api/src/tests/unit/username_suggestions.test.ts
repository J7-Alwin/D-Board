import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from '../../services/auth.service.js';
import prisma from '../../prisma.js';

vi.mock('../../prisma.js', () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('Username Availability and Suggestion Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isUsernameAvailable', () => {
    it('should return false for username under 3 characters', async () => {
      const res = await authService.isUsernameAvailable('al');
      expect(res.available).toBe(false);
      expect(res.message).toContain('3 and 30');
    });

    it('should return false for username exceeding 30 characters', async () => {
      const res = await authService.isUsernameAvailable('a'.repeat(31));
      expect(res.available).toBe(false);
      expect(res.message).toContain('3 and 30');
    });

    it('should return false for invalid characters like spaces or symbols', async () => {
      const res = await authService.isUsernameAvailable('alwin james!');
      expect(res.available).toBe(false);
      expect(res.message).toContain('letters, numbers, underscores');
    });

    it('should return false if username already exists in database', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'user-123',
        username: 'alwinjames66',
      } as any);

      const res = await authService.isUsernameAvailable('alwinjames66');
      expect(res.available).toBe(false);
      expect(res.message).toBe('This username is already taken');
    });

    it('should query prisma with id exclusion if excludeUserId is provided', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

      const res = await authService.isUsernameAvailable('alwinjames66', 'user-me');
      expect(res.available).toBe(true);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          username: { equals: 'alwinjames66', mode: 'insensitive' },
          id: { not: 'user-me' },
        },
        select: { id: true },
      });
    });

    it('should return true if username does not exist in database', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

      const res = await authService.isUsernameAvailable('unique_coder');
      expect(res.available).toBe(true);
    });
  });

  describe('getSuggestedUsernames', () => {
    it('should filter out handles that already exist in database and return only unique available handles', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-1',
        fullName: 'Alwin James',
        username: 'alwinjames66',
        email: 'alwin.james@example.com',
      } as any);

      // Simulate that 'alwinjames' is already taken by someone else in the DB
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        { username: 'alwinjames' },
      ] as any);

      const suggestions = await authService.getSuggestedUsernames('user-1');

      // 'alwinjames' should not be present because it's taken by another user in database
      expect(suggestions).not.toContain('alwinjames');
      // Should include available alternatives (e.g. alwin.james, alwinjames66, etc.)
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.every((s) => s !== 'alwinjames')).toBe(true);
    });
  });
});
