-- CreateEnum
CREATE TYPE "WorkspaceOwnershipTransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WorkspaceAuditAction" AS ENUM (
  'OWNERSHIP_TRANSFER_REQUESTED',
  'OWNERSHIP_TRANSFER_ACCEPTED',
  'OWNERSHIP_TRANSFER_CANCELLED',
  'OWNERSHIP_TRANSFER_REJECTED',
  'OWNERSHIP_TRANSFERRED',
  'ADMIN_PERMISSIONS_UPDATED',
  'WORKSPACE_DELETION_SCHEDULED',
  'WORKSPACE_RESTORED',
  'MEMBER_INVITED',
  'MEMBER_JOINED',
  'MEMBER_ROLE_UPDATED',
  'MEMBER_REMOVED',
  'WORKSPACE_UPDATED'
);

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT,
ADD COLUMN "deletionScheduledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WorkspaceOwnershipTransfer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceOwnerId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetRole" "WorkspaceRole" NOT NULL DEFAULT 'WORKSPACE_ADMIN',
    "status" "WorkspaceOwnershipTransferStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceOwnershipTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceAuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "WorkspaceAuditAction" NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workspace_deletedAt_idx" ON "Workspace"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceOwnershipTransfer_tokenHash_key" ON "WorkspaceOwnershipTransfer"("tokenHash");

-- CreateIndex: Partial Unique Index ensuring at most one PENDING ownership transfer per workspace
CREATE UNIQUE INDEX "WorkspaceOwnershipTransfer_unique_pending_workspace_idx" ON "WorkspaceOwnershipTransfer"("workspaceId") WHERE status = 'PENDING';

-- CreateIndex
CREATE INDEX "WorkspaceOwnershipTransfer_workspaceId_status_idx" ON "WorkspaceOwnershipTransfer"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "WorkspaceOwnershipTransfer_targetUserId_status_idx" ON "WorkspaceOwnershipTransfer"("targetUserId", "status");

-- CreateIndex
CREATE INDEX "WorkspaceOwnershipTransfer_sourceOwnerId_idx" ON "WorkspaceOwnershipTransfer"("sourceOwnerId");

-- CreateIndex
CREATE INDEX "WorkspaceOwnershipTransfer_tokenHash_idx" ON "WorkspaceOwnershipTransfer"("tokenHash");

-- CreateIndex
CREATE INDEX "WorkspaceOwnershipTransfer_expiresAt_idx" ON "WorkspaceOwnershipTransfer"("expiresAt");

-- CreateIndex
CREATE INDEX "WorkspaceAuditLog_workspaceId_createdAt_idx" ON "WorkspaceAuditLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceAuditLog_workspaceId_action_idx" ON "WorkspaceAuditLog"("workspaceId", "action");

-- CreateIndex
CREATE INDEX "WorkspaceAuditLog_actorId_idx" ON "WorkspaceAuditLog"("actorId");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceOwnershipTransfer" ADD CONSTRAINT "WorkspaceOwnershipTransfer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceOwnershipTransfer" ADD CONSTRAINT "WorkspaceOwnershipTransfer_sourceOwnerId_fkey" FOREIGN KEY ("sourceOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceOwnershipTransfer" ADD CONSTRAINT "WorkspaceOwnershipTransfer_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceAuditLog" ADD CONSTRAINT "WorkspaceAuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceAuditLog" ADD CONSTRAINT "WorkspaceAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
