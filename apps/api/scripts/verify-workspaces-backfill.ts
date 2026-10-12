import prisma from '../src/prisma.js';

export async function verifyWorkspacesBackfill(): Promise<{
  passed: boolean;
  unmappedProjectsCount: number;
  invalidMembersCount: number;
  duplicatePersonalWorkspacesCount: number;
}> {
  console.log('[Verification] Validating workspace backfill integrity...');

  // 1. Assert: No project has null workspaceId
  const unmappedRaw: any = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*)::int as count FROM "Project" WHERE "workspaceId" IS NULL'
  );
  const unmappedProjectsCount = Number(unmappedRaw[0]?.count || 0);

  if (unmappedProjectsCount > 0) {
    console.error(`[Verification Failed] Found ${unmappedProjectsCount} projects with null workspaceId.`);
  } else {
    console.log('[Verification Passed] 100% of projects are mapped to a workspace.');
  }

  // 2. Assert: Every ProjectMember belongs to the WorkspaceMember of that project's workspace
  const projects = await prisma.project.findMany({
    include: {
      members: { select: { userId: true } },
    },
  });

  let invalidMembersCount = 0;
  for (const project of projects) {
    if (!project.workspaceId) {
      invalidMembersCount += project.members.length;
      continue;
    }
    const wsMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: project.workspaceId,
        userId: { in: project.members.map((m) => m.userId) },
      },
      select: { userId: true },
    });
    const wsMemberSet = new Set(wsMembers.map((m) => m.userId));
    for (const m of project.members) {
      if (!wsMemberSet.has(m.userId)) {
        console.error(`[Verification Error] Project member ${m.userId} is not in workspace ${project.workspaceId}`);
        invalidMembersCount++;
      }
    }
  }

  if (invalidMembersCount > 0) {
    console.error(`[Verification Failed] Found ${invalidMembersCount} project members without workspace membership.`);
  } else {
    console.log('[Verification Passed] All project members have valid workspace membership.');
  }

  // 3. Assert: Every user has at most one personal workspace
  const users = await prisma.user.findMany({
    select: { id: true, username: true },
  });

  let duplicatePersonalWorkspacesCount = 0;
  for (const user of users) {
    const personalCount = await prisma.workspace.count({
      where: { ownerId: user.id, isPersonal: true },
    });
    if (personalCount > 1) {
      console.error(`[Verification Error] User ${user.username} has ${personalCount} personal workspaces.`);
      duplicatePersonalWorkspacesCount++;
    }
  }

  if (duplicatePersonalWorkspacesCount > 0) {
    console.error(`[Verification Failed] ${duplicatePersonalWorkspacesCount} users have duplicate personal workspaces.`);
  } else {
    console.log('[Verification Passed] Single personal workspace per user invariant confirmed.');
  }

  const passed =
    unmappedProjectsCount === 0 &&
    invalidMembersCount === 0 &&
    duplicatePersonalWorkspacesCount === 0;

  console.log(`[Verification] Overall status: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);

  return {
    passed,
    unmappedProjectsCount,
    invalidMembersCount,
    duplicatePersonalWorkspacesCount,
  };
}

if (process.argv[1] && process.argv[1].includes('verify-workspaces-backfill')) {
  verifyWorkspacesBackfill()
    .then(async (result) => {
      await prisma.$disconnect();
      if (!result.passed) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Verification] Fatal error:', err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
