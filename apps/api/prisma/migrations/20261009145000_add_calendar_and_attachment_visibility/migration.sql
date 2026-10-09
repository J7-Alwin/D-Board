-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CalendarEvent_projectId_isPrivate_idx" ON "CalendarEvent"("projectId", "isPrivate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attachment_projectId_isPrivate_idx" ON "Attachment"("projectId", "isPrivate");
