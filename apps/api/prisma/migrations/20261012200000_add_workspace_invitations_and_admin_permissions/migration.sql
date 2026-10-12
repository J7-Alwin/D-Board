-- Add REVOKED status to InvitationStatus enum if not already present
ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'REVOKED';

-- Add adminPermissions JSONB column to Workspace with strict default
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "adminPermissions" JSONB DEFAULT '{"canInviteMembers":true,"canRemoveMembers":false,"canCreateProjects":true,"canManageRoles":false}';

-- Ensure personal workspaces cannot delegate Owner authority
UPDATE "Workspace"
SET "adminPermissions" = '{"canInviteMembers":false,"canRemoveMembers":false,"canCreateProjects":false,"canManageRoles":false}'::jsonb
WHERE "isPersonal" = true;

-- Create WorkspaceInvitation table
CREATE TABLE IF NOT EXISTS "WorkspaceInvitation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "invitedUserId" TEXT,
    "invitedById" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'WORKSPACE_MEMBER',
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "message" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);

-- Unique index for tokenHash
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvitation_tokenHash_key" ON "WorkspaceInvitation"("tokenHash");

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS "WorkspaceInvitation_invitedEmail_idx" ON "WorkspaceInvitation"("invitedEmail");
CREATE INDEX IF NOT EXISTS "WorkspaceInvitation_workspaceId_status_idx" ON "WorkspaceInvitation"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "WorkspaceInvitation_tokenHash_idx" ON "WorkspaceInvitation"("tokenHash");
CREATE INDEX IF NOT EXISTS "WorkspaceInvitation_invitedUserId_idx" ON "WorkspaceInvitation"("invitedUserId");
CREATE INDEX IF NOT EXISTS "WorkspaceInvitation_expiresAt_idx" ON "WorkspaceInvitation"("expiresAt");

-- Foreign key constraints with audit protection
ALTER TABLE "WorkspaceInvitation" DROP CONSTRAINT IF EXISTS "WorkspaceInvitation_workspaceId_fkey";
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceInvitation" DROP CONSTRAINT IF EXISTS "WorkspaceInvitation_invitedUserId_fkey";
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkspaceInvitation" DROP CONSTRAINT IF EXISTS "WorkspaceInvitation_invitedById_fkey";
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
