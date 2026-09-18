import { cacheService } from './redis/cache.service.js';
import { prisma } from './prisma.js';

async function runCacheSecurityTests() {
  console.log('=== RUNNING CACHE MULTI-TENANT ISOLATION & SECURITY TESTS ===');

  try {
    // 1. Setup mock or real tenant data
    const userA = 'user-tenant-a-1111';
    const userB = 'user-tenant-b-2222';
    const projectA = 'proj-tenant-a-3333';
    const projectB = 'proj-tenant-b-4444';

    // 2. Test User Dashboard Cache Key Isolation
    const keyUserA = cacheService.keys.userDashboard(userA);
    const keyUserB = cacheService.keys.userDashboard(userB);

    if (keyUserA === keyUserB) {
      throw new Error(`Cache key collision detected between users: ${keyUserA}`);
    }

    const dataA = { secretDashboard: 'CONFIDENTIAL_A_DATA', projectsCount: 5 };
    const dataB = { secretDashboard: 'CONFIDENTIAL_B_DATA', projectsCount: 12 };

    await cacheService.set(keyUserA, dataA, 60);
    await cacheService.set(keyUserB, dataB, 60);

    const fetchedA = await cacheService.get(keyUserA);
    const fetchedB = await cacheService.get(keyUserB);

    if ((fetchedA as any)?.secretDashboard !== 'CONFIDENTIAL_A_DATA') {
      throw new Error('User A cache corrupted');
    }
    if ((fetchedB as any)?.secretDashboard !== 'CONFIDENTIAL_B_DATA') {
      throw new Error('User B cache corrupted');
    }

    // Verify User A cannot read User B's cache key if queried directly
    const crossFetch = await cacheService.get(keyUserB);
    if ((crossFetch as any)?.secretDashboard === 'CONFIDENTIAL_A_DATA') {
      throw new Error('SECURITY VIOLATION: User A data leaked into User B key');
    }

    console.log('✓ PASS: User Dashboard multi-tenant cache isolation verified.');

    // 3. Test Project Summary Cache Invalidation Scope
    const keyProjA = cacheService.keys.projectSummary(projectA);
    const keyProjB = cacheService.keys.projectSummary(projectB);

    await cacheService.set(keyProjA, { projectName: 'Secret Project Alpha' }, 60);
    await cacheService.set(keyProjB, { projectName: 'Secret Project Beta' }, 60);

    // Invalidate project A
    await cacheService.invalidateProject(projectA);

    const afterInvalidationProjA = await cacheService.get(keyProjA);
    const afterInvalidationProjB = await cacheService.get(keyProjB);

    if (afterInvalidationProjA !== null) {
      throw new Error('Project A cache was not invalidated properly');
    }
    if (afterInvalidationProjB === null || (afterInvalidationProjB as any)?.projectName !== 'Secret Project Beta') {
      throw new Error('SECURITY/ISOLATION VIOLATION: Project B cache was wrongly invalidated when Project A changed');
    }

    console.log('✓ PASS: Project cache invalidation is strictly isolated per project.');

    // 4. Test Invalidation of User-specific Notification/MyWork Cache
    const keyUnreadA = cacheService.keys.userUnreadNotifications(userA);
    const keyMyWorkA = cacheService.keys.userMyWork(userA);
    const keyUnreadB = cacheService.keys.userUnreadNotifications(userB);

    await cacheService.set(keyUnreadA, { unreadCount: 7 }, 60);
    await cacheService.set(keyMyWorkA, { tasks: ['Task 1', 'Task 2'] }, 60);
    await cacheService.set(keyUnreadB, { unreadCount: 99 }, 60);

    await cacheService.invalidateUser(userA);

    const checkUnreadA = await cacheService.get(keyUnreadA);
    const checkMyWorkA = await cacheService.get(keyMyWorkA);
    const checkUnreadB = await cacheService.get(keyUnreadB);

    if (checkUnreadA !== null || checkMyWorkA !== null) {
      throw new Error('User A cache was not fully wiped on invalidateUser');
    }
    if (checkUnreadB === null || (checkUnreadB as any)?.unreadCount !== 99) {
      throw new Error('SECURITY/ISOLATION VIOLATION: User B cache was invalidated when User A was invalidated');
    }

    console.log('✓ PASS: User cache invalidation operates strictly within user scope.');

    console.log('=== ALL CACHE SECURITY & MULTI-TENANT ISOLATION TESTS PASSED ===');
  } catch (err) {
    console.error('Cache Security Test Failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runCacheSecurityTests();
