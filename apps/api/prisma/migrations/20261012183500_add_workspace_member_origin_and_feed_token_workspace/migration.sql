-- CreateEnum
CREATE TYPE "WorkspaceMemberOrigin" AS ENUM ('DIRECT', 'PROJECT_DERIVED');

-- AlterTable
ALTER TABLE "WorkspaceMember" ADD COLUMN "origin" "WorkspaceMemberOrigin" NOT NULL DEFAULT 'DIRECT';

-- AlterTable
ALTER TABLE "CalendarFeedToken" ADD COLUMN "workspaceId" TEXT;

-- CreateIndex
CREATE INDEX "CalendarFeedToken_workspaceId_idx" ON "CalendarFeedToken"("workspaceId");

-- AddForeignKey
ALTER TABLE "CalendarFeedToken" ADD CONSTRAINT "CalendarFeedToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
