import prisma from '../src/prisma.js';

export interface BackfillSummary {
  usersProcessed: number;
  personalWorkspacesCreated: number;
  personalWorkspacesExisting: number;
  projectsMapped: number;
  workspaceMembershipsCreated: number;
  orphanedProjectsReported: number;
}

export async function runWorkspacesBackfill(): Promise<BackfillSummary> {
  console.log('[Backfill] Starting idempotent workspace backfill with concurrency protection...');

  const summary: BackfillSummary = {
    usersProcessed: 0,
    personalWorkspacesCreated: 0,
    personalWorkspacesExisting: 0,
    projectsMapped: 0,
    workspaceMembershipsCreated: 0,
    orphanedProjectsReported: 0,
  };

  // 1. Process all existing users to ensure each has a Personal Workspace
  const users = await prisma.user.findMany({
    select: { id: true, username: true, fullName: true, email: true },
  });
  summary.usersProcessed = users.length;

  for (const user of users) {
    const existingPersonalWorkspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id, isPersonal: true },
    });

    let personalWorkspaceId: string;

    if (!existingPersonalWorkspace) {
      const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'user';
      const slug = `${cleanUsername}-personal-${user.id.slice(0, 8)}`;
      const name = user.fullName?.trim()
        ? `${user.fullName.trim()}'s Workspace`
        : `${user.username}'s Workspace`;

      try {
        const created = await prisma.$transaction(async (tx) => {
          const ws = await tx.workspace.create({
            data: {
              name,
              slug,
              ownerId: user.id,
              isPersonal: true,
              adminPermissions: {
                canInviteMembers: false,
                canRemoveMembers: false,
                canCreateProjects: false,
                canManageRoles: false,
              },
            },
          });

          await tx.workspaceMember.create({
            data: {
              workspaceId: ws.id,
              userId: user.id,
              role: 'OWNER',
              origin: 'DIRECT',
            },
          });

          return ws;
        });

        personalWorkspaceId = created.id;
        summary.personalWorkspacesCreated++;
        console.log(`[Backfill] Created personal workspace for user ${user.username} (${user.id}): ${created.id}`);
      } catch (err: any) {
        if (err.code === 'P2002' || err.message?.includes('Unique constraint')) {
          // Concurrency recovery: Personal workspace was provisioned concurrently
          const fallback = await prisma.workspace.findFirst({
            where: { ownerId: user.id, isPersonal: true },
          });

          if (fallback) {
            personalWorkspaceId = fallback.id;
            summary.personalWorkspacesExisting++;
            console.log(`[Backfill] Recovered existing personal workspace on concurrency conflict for ${user.username}: ${fallback.id}`);

            // Ensure owner membership exists
            const ownerMember = await prisma.workspaceMember.findUnique({
              where: {
                workspaceId_userId: {
                  workspaceId: fallback.id,
                  userId: user.id,
                },
              },
            });

            if (!ownerMember) {
              await prisma.workspaceMember.create({
                data: {
                  workspaceId: fallback.id,
                  userId: user.id,
                  role: 'OWNER',
                  origin: 'DIRECT',
                },
              }).catch(() => {});
              summary.workspaceMembershipsCreated++;
            }
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
    } else {
      personalWorkspaceId = existingPersonalWorkspace.id;
      summary.personalWorkspacesExisting++;

      // Ensure owner has an OWNER row in WorkspaceMember
      const existingOwnerMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: personalWorkspaceId,
            userId: user.id,
          },
        },
      });

      if (!existingOwnerMember) {
        await prisma.workspaceMember.create({
          data: {
            workspaceId: personalWorkspaceId,
            userId: user.id,
            role: 'OWNER',
            origin: 'DIRECT',
          },
        });
        summary.workspaceMembershipsCreated++;
      }
    }
  }

  // 2. Map all unassociated projects to their creator's personal workspace
  // Use raw query to safely detect NULL workspaceId even after schema enforcement
  const unmappedRaw: Array<{ id: string; createdById: string }> = await prisma.$queryRawUnsafe(
    'SELECT id, "createdById" FROM "Project" WHERE "workspaceId" IS NULL'
  );

  for (const unmapped of unmappedRaw) {
    // Find creator's personal workspace
    let creatorPersonalWorkspace = await prisma.workspace.findFirst({
      where: { ownerId: unmapped.createdById, isPersonal: true },
    });

    if (!creatorPersonalWorkspace) {
      const creator = await prisma.user.findUnique({
        where: { id: unmapped.createdById },
        select: { id: true, username: true, fullName: true },
      });

      if (creator) {
        const cleanUsername = creator.username.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'user';
        const slug = `${cleanUsername}-personal-${creator.id.slice(0, 8)}`;
        const name = creator.fullName?.trim()
          ? `${creator.fullName.trim()}'s Workspace`
          : `${creator.username}'s Workspace`;

        try {
          creatorPersonalWorkspace = await prisma.$transaction(async (tx) => {
            const ws = await tx.workspace.create({
              data: { name, slug, ownerId: creator.id, isPersonal: true },
            });
            await tx.workspaceMember.create({
              data: { workspaceId: ws.id, userId: creator.id, role: 'OWNER', origin: 'DIRECT' },
            });
            return ws;
          });
          summary.personalWorkspacesCreated++;
        } catch (err: any) {
          if (err.code === 'P2002' || err.message?.includes('Unique constraint')) {
            creatorPersonalWorkspace = await prisma.workspace.findFirst({
              where: { ownerId: creator.id, isPersonal: true },
            });
          } else {
            throw err;
          }
        }
      } else {
        // Report orphaned project without assigning arbitrarily
        console.warn(`[Backfill Warning] Orphaned project detected: Project "${unmapped.id}" has missing creator "${unmapped.createdById}". Skipping arbitrary assignment.`);
        summary.orphanedProjectsReported++;
        continue;
      }
    }

    if (!creatorPersonalWorkspace) {
      summary.orphanedProjectsReported++;
      continue;
    }

    // Map project to workspace
    await prisma.project.update({
      where: { id: unmapped.id },
      data: { workspaceId: creatorPersonalWorkspace.id },
    });
    summary.projectsMapped++;

    // Fetch members of this newly mapped project
    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId: unmapped.id },
      select: { userId: true },
    });

    // Ensure all existing project members are marked as members of the workspace
    // (legacy project-derived members get origin: 'PROJECT_DERIVED')
    for (const member of projectMembers) {
      const existingWsMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: creatorPersonalWorkspace.id,
            userId: member.userId,
          },
        },
      });

      if (!existingWsMember) {
        const isOwner = member.userId === creatorPersonalWorkspace.ownerId;
        // In personal workspaces, non-owner project collaborators are PROJECT_DERIVED.
        // In non-personal (team) workspaces, never infer PROJECT_DERIVED from project membership alone; default to DIRECT.
        const origin = isOwner ? 'DIRECT' : (creatorPersonalWorkspace.isPersonal ? 'PROJECT_DERIVED' : 'DIRECT');
        await prisma.workspaceMember.create({
          data: {
            workspaceId: creatorPersonalWorkspace.id,
            userId: member.userId,
            role: isOwner ? 'OWNER' : 'WORKSPACE_MEMBER',
            origin,
          },
        });
        summary.workspaceMembershipsCreated++;
      } else if (
        creatorPersonalWorkspace.isPersonal &&
        existingWsMember.userId !== creatorPersonalWorkspace.ownerId &&
        existingWsMember.role === 'WORKSPACE_MEMBER' &&
        existingWsMember.origin !== 'PROJECT_DERIVED'
      ) {
        // In personal workspaces only, correct legacy memberships that were defaulted to DIRECT
        await prisma.workspaceMember.update({
          where: { id: existingWsMember.id },
          data: { origin: 'PROJECT_DERIVED' },
        });
      }
    }
  }

  console.log('[Backfill] Backfill completed successfully:', summary);
  return summary;
}

if (process.argv[1] && process.argv[1].includes('backfill-workspaces')) {
  runWorkspacesBackfill()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Backfill] Fatal error during backfill:', err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
