-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ProjectTransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProjectTransfer" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceWorkspaceId" TEXT NOT NULL,
    "destinationWorkspaceId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "status" "ProjectTransferStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "memberSnapshot" JSONB,
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectTransfer_projectId_status_idx" ON "ProjectTransfer"("projectId", "status");
CREATE INDEX IF NOT EXISTS "ProjectTransfer_sourceWorkspaceId_idx" ON "ProjectTransfer"("sourceWorkspaceId");
CREATE INDEX IF NOT EXISTS "ProjectTransfer_destinationWorkspaceId_status_idx" ON "ProjectTransfer"("destinationWorkspaceId", "status");
CREATE INDEX IF NOT EXISTS "ProjectTransfer_initiatedById_idx" ON "ProjectTransfer"("initiatedById");
CREATE INDEX IF NOT EXISTS "ProjectTransfer_status_expiresAt_idx" ON "ProjectTransfer"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "ProjectTransfer" DROP CONSTRAINT IF EXISTS "ProjectTransfer_projectId_fkey";
ALTER TABLE "ProjectTransfer" ADD CONSTRAINT "ProjectTransfer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectTransfer" DROP CONSTRAINT IF EXISTS "ProjectTransfer_sourceWorkspaceId_fkey";
ALTER TABLE "ProjectTransfer" ADD CONSTRAINT "ProjectTransfer_sourceWorkspaceId_fkey" FOREIGN KEY ("sourceWorkspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectTransfer" DROP CONSTRAINT IF EXISTS "ProjectTransfer_destinationWorkspaceId_fkey";
ALTER TABLE "ProjectTransfer" ADD CONSTRAINT "ProjectTransfer_destinationWorkspaceId_fkey" FOREIGN KEY ("destinationWorkspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectTransfer" DROP CONSTRAINT IF EXISTS "ProjectTransfer_initiatedById_fkey";
ALTER TABLE "ProjectTransfer" ADD CONSTRAINT "ProjectTransfer_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectTransfer" DROP CONSTRAINT IF EXISTS "ProjectTransfer_reviewedById_fkey";
ALTER TABLE "ProjectTransfer" ADD CONSTRAINT "ProjectTransfer_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
