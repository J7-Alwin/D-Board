import { prisma } from './prisma.js';
import { authService } from './services/auth.service.js';

/**
 * Helper for test suites to ensure an eligible test user has an active workspace.
 */
export async function ensureTestWorkspace(userId: string): Promise<string> {
  const ws = await authService.ensurePersonalWorkspace(userId);
  return ws.id;
}
