import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../../prisma.js';
import {
  DEFAULT_ADMIN_PERMISSIONS,
  PERSONAL_WORKSPACE_ADMIN_PERMISSIONS,
  resolveAdminPermissions,
  workspaceAdminPermissionsSchema,
  updateWorkspaceAdminPermissionsSchema,
  createWorkspaceInvitationSchema,
} from '../../schemas/workspace.schema.js';

describe('Slice 3.1: Workspace Schema, Permissions & WorkspaceInvitation DB Tests', () => {
  const ts = Date.now();
  const testEmailPrefix = `ws_schema_${ts}`;
  let ownerUserId: string;
  let invitedUserId: string;
  let teamWorkspaceId: string;
  let personalWorkspaceId: string;

  beforeAll(async () => {
    // 1. Create Owner User
    const owner = await prisma.user.create({
      data: {
        username: `owner_${testEmailPrefix}`,
        email: `owner_${testEmailPrefix}@example.com`,
        passwordHash: 'hashed_pw_test_123',
        fullName: 'Schema Test Owner',
        isEmailVerified: true,
      },
    });
    ownerUserId = owner.id;

    // 2. Create Invited User
    const invited = await prisma.user.create({
      data: {
        username: `invitee_${testEmailPrefix}`,
        email: `invitee_${testEmailPrefix}@example.com`,
        passwordHash: 'hashed_pw_test_123',
        fullName: 'Schema Test Invitee',
        isEmailVerified: true,
      },
    });
    invitedUserId = invited.id;

    // 3. Create Personal Workspace
    const pWs = await prisma.workspace.create({
      data: {
        name: `Personal WS ${ts}`,
        slug: `personal-ws-${ts}`,
        ownerId: ownerUserId,
        isPersonal: true,
        adminPermissions: {
          canInviteMembers: false,
          canRemoveMembers: false,
          canCreateProjects: false,
          canManageRoles: false,
        },
      },
    });
    personalWorkspaceId = pWs.id;

    // 4. Create Team Workspace
    const tWs = await prisma.workspace.create({
      data: {
        name: `Team WS ${ts}`,
        slug: `team-ws-${ts}`,
        ownerId: ownerUserId,
        isPersonal: false,
      },
    });
    teamWorkspaceId = tWs.id;
  });

  afterAll(async () => {
    // Clean up test data safely
    if (teamWorkspaceId) {
      await prisma.workspaceInvitation.deleteMany({ where: { workspaceId: teamWorkspaceId } }).catch(() => {});
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: teamWorkspaceId } }).catch(() => {});
      await prisma.workspace.delete({ where: { id: teamWorkspaceId } }).catch(() => {});
    }
    if (personalWorkspaceId) {
      await prisma.workspaceInvitation.deleteMany({ where: { workspaceId: personalWorkspaceId } }).catch(() => {});
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: personalWorkspaceId } }).catch(() => {});
      await prisma.workspace.delete({ where: { id: personalWorkspaceId } }).catch(() => {});
    }
    if (ownerUserId || invitedUserId) {
      await prisma.user.deleteMany({ where: { id: { in: [ownerUserId, invitedUserId] } } }).catch(() => {});
    }
  });

  describe('1. Admin Permissions Schema & Invariants', () => {
    it('provides correct typed defaults for team workspaces', () => {
      expect(DEFAULT_ADMIN_PERMISSIONS).toEqual({
        canInviteMembers: true,
        canRemoveMembers: false,
        canCreateProjects: true,
        canManageRoles: false,
      });
    });

    it('ensures personal workspaces ALWAYS resolve to all-false permissions', () => {
      // Even if personal workspace record had true flags, resolveAdminPermissions must strictly return all-false
      const resolved = resolveAdminPermissions({
        isPersonal: true,
        adminPermissions: {
          canInviteMembers: true,
          canRemoveMembers: true,
          canCreateProjects: true,
          canManageRoles: true,
        },
      });
      expect(resolved).toEqual(PERSONAL_WORKSPACE_ADMIN_PERMISSIONS);
      expect(resolved.canInviteMembers).toBe(false);
      expect(resolved.canRemoveMembers).toBe(false);
      expect(resolved.canCreateProjects).toBe(false);
      expect(resolved.canManageRoles).toBe(false);
    });

    it('resolves defaults when adminPermissions is null on team workspace', () => {
      const resolved = resolveAdminPermissions({
        isPersonal: false,
        adminPermissions: null,
      });
      expect(resolved).toEqual(DEFAULT_ADMIN_PERMISSIONS);
    });

    it('correctly validates and parses partial permission updates', () => {
      const parsed = updateWorkspaceAdminPermissionsSchema.parse({
        canInviteMembers: false,
        canRemoveMembers: true,
      });
      expect(parsed.canInviteMembers).toBe(false);
      expect(parsed.canRemoveMembers).toBe(true);

      // Rejects empty update objects
      expect(() => updateWorkspaceAdminPermissionsSchema.parse({})).toThrow();
    });

    it('validates workspace invitation schema and normalizes email', () => {
      const valid = createWorkspaceInvitationSchema.parse({
        email: '  TEST.USER@Example.COM  ',
        role: 'WORKSPACE_ADMIN',
        message: 'Join our team workspace',
      });
      expect(valid.email).toBe('test.user@example.com');
      expect(valid.role).toBe('WORKSPACE_ADMIN');
      expect(valid.message).toBe('Join our team workspace');

      // Rejects OWNER role for invitations
      expect(() =>
        createWorkspaceInvitationSchema.parse({
          email: 'test@example.com',
          role: 'OWNER',
        })
      ).toThrow();
    });
  });

  describe('2. WorkspaceInvitation Database Integrity & Foreign Key Safety', () => {
    let invitationId: string;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    it('creates WorkspaceInvitation with hashed high-entropy token and PENDING status', async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const invite = await prisma.workspaceInvitation.create({
        data: {
          workspaceId: teamWorkspaceId,
          invitedEmail: `invitee_${testEmailPrefix}@example.com`,
          invitedUserId: invitedUserId,
          invitedById: ownerUserId,
          role: 'WORKSPACE_MEMBER',
          status: 'PENDING',
          tokenHash,
          expiresAt,
          message: 'Welcome to the team workspace',
        },
      });

      expect(invite.id).toBeDefined();
      expect(invite.tokenHash).toBe(tokenHash);
      expect(invite.status).toBe('PENDING');
      expect(invite.role).toBe('WORKSPACE_MEMBER');
      expect(invite.invitedUserId).toBe(invitedUserId);
      expect(invite.invitedById).toBe(ownerUserId);
      invitationId = invite.id;
    });

    it('enforces uniqueness on tokenHash (anti-collision protection)', async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await expect(
        prisma.workspaceInvitation.create({
          data: {
            workspaceId: teamWorkspaceId,
            invitedEmail: 'another@example.com',
            invitedById: ownerUserId,
            role: 'WORKSPACE_MEMBER',
            tokenHash, // Duplicate tokenHash
            expiresAt,
          },
        })
      ).rejects.toThrow();
    });

    it('allows status transition to REVOKED with revokedAt timestamp', async () => {
      const revokedAt = new Date();
      const updated = await prisma.workspaceInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'REVOKED',
          revokedAt,
        },
      });

      expect(updated.status).toBe('REVOKED');
      expect(updated.revokedAt).toEqual(revokedAt);
    });

    it('preserves invitation when invited user is removed (SetNull onDelete)', async () => {
      // Create a temporary user to invite and then delete
      const tempUser = await prisma.user.create({
        data: {
          username: `temp_${Date.now()}`,
          email: `temp_${Date.now()}@example.com`,
          passwordHash: 'hashed_pw',
        },
      });

      const tempTokenHash = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
      const tempInvite = await prisma.workspaceInvitation.create({
        data: {
          workspaceId: teamWorkspaceId,
          invitedEmail: tempUser.email,
          invitedUserId: tempUser.id,
          invitedById: ownerUserId,
          role: 'WORKSPACE_MEMBER',
          tokenHash: tempTokenHash,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      // Delete the temporary invited user
      await prisma.user.delete({ where: { id: tempUser.id } });

      // Invitation record must still exist with invitedUserId set to null
      const checkInvite = await prisma.workspaceInvitation.findUnique({
        where: { id: tempInvite.id },
      });
      expect(checkInvite).not.toBeNull();
      expect(checkInvite?.invitedUserId).toBeNull();
      expect(checkInvite?.invitedEmail).toBe(tempUser.email);

      // Clean up temp invitation
      await prisma.workspaceInvitation.delete({ where: { id: tempInvite.id } });
    });

    it('strictly prevents deletion of inviter to preserve audit records (Restrict onDelete)', async () => {
      // Attempting to delete ownerUserId while they have active sentWorkspaceInvitations must be blocked
      await expect(prisma.user.delete({ where: { id: ownerUserId } })).rejects.toThrow();
    });

    it('cascades deletion of invitations when the workspace is deleted', async () => {
      const tempWs = await prisma.workspace.create({
        data: {
          name: `Ephemeral WS ${Date.now()}`,
          slug: `ephemeral-ws-${Date.now()}`,
          ownerId: ownerUserId,
          isPersonal: false,
        },
      });

      const ephemeralTokenHash = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
      const ephemeralInvite = await prisma.workspaceInvitation.create({
        data: {
          workspaceId: tempWs.id,
          invitedEmail: 'ephemeral@example.com',
          invitedById: ownerUserId,
          role: 'WORKSPACE_MEMBER',
          tokenHash: ephemeralTokenHash,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      // Delete workspace
      await prisma.workspace.delete({ where: { id: tempWs.id } });

      // Invitation should be cleanly cascaded
      const checkInvite = await prisma.workspaceInvitation.findUnique({
        where: { id: ephemeralInvite.id },
      });
      expect(checkInvite).toBeNull();
    });
  });

  describe('3. Database adminPermissions Column & Migration Consistency', () => {
    it('verified personal workspaces in database have all-false admin permissions', async () => {
      const personalInDb = await prisma.workspace.findUnique({
        where: { id: personalWorkspaceId },
        select: { isPersonal: true, adminPermissions: true },
      });

      expect(personalInDb?.isPersonal).toBe(true);
      const permissions = resolveAdminPermissions(personalInDb as any);
      expect(permissions.canInviteMembers).toBe(false);
      expect(permissions.canRemoveMembers).toBe(false);
      expect(permissions.canCreateProjects).toBe(false);
      expect(permissions.canManageRoles).toBe(false);
    });

    it('allows team workspace to store custom admin permissions', async () => {
      const customPermissions = {
        canInviteMembers: true,
        canRemoveMembers: true,
        canCreateProjects: false,
        canManageRoles: true,
      };

      await prisma.workspace.update({
        where: { id: teamWorkspaceId },
        data: { adminPermissions: customPermissions },
      });

      const teamInDb = await prisma.workspace.findUnique({
        where: { id: teamWorkspaceId },
        select: { isPersonal: false, adminPermissions: true },
      });

      const resolved = resolveAdminPermissions(teamInDb as any);
      expect(resolved).toEqual(customPermissions);
    });
  });
});
