-- CreateEnum
CREATE TYPE "ProjectVisibility" AS ENUM ('WORKSPACE', 'RESTRICTED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "visibility" "ProjectVisibility" NOT NULL DEFAULT 'WORKSPACE';

-- CreateIndex
CREATE INDEX "Project_workspaceId_visibility_idx" ON "Project"("workspaceId", "visibility");
