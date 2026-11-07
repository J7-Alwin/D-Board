-- AlterTable
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "originalProjectId" TEXT;

-- AlterTable
ALTER TABLE "ProjectTransfer" ADD COLUMN IF NOT EXISTS "recipientEmail" TEXT;
ALTER TABLE "ProjectTransfer" ADD COLUMN IF NOT EXISTS "destinationWorkspaceName" TEXT;

