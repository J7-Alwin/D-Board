-- AlterTable
DROP INDEX IF EXISTS "Attachment_storageKey_key";

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "folderId" TEXT,
ADD COLUMN IF NOT EXISTS "noteId" TEXT,
ADD COLUMN IF NOT EXISTS "storedObjectId" TEXT;

-- AlterTable
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "color" TEXT DEFAULT 'yellow',
ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bio" TEXT,
ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "emailVerificationExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "emailVerificationTokenHash" TEXT,
ADD COLUMN IF NOT EXISTS "headline" TEXT,
ADD COLUMN IF NOT EXISTS "isDeactivated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "notificationPreferences" JSONB,
ADD COLUMN IF NOT EXISTS "passwordResetAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'UTC';

-- CreateTable
CREATE TABLE IF NOT EXISTS "CalendarEventAttendee" (
    "id" TEXT NOT NULL,
    "calendarEventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarEventAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StoredObject" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FileFolder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CalendarFeedToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarFeedToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CalendarEventAttendee_userId_calendarEventId_idx" ON "CalendarEventAttendee"("userId", "calendarEventId");
CREATE INDEX IF NOT EXISTS "CalendarEventAttendee_calendarEventId_idx" ON "CalendarEventAttendee"("calendarEventId");
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarEventAttendee_calendarEventId_userId_key" ON "CalendarEventAttendee"("calendarEventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StoredObject_storageKey_key" ON "StoredObject"("storageKey");
CREATE INDEX IF NOT EXISTS "StoredObject_projectId_contentHash_idx" ON "StoredObject"("projectId", "contentHash");
CREATE UNIQUE INDEX IF NOT EXISTS "StoredObject_projectId_contentHash_key" ON "StoredObject"("projectId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionTokenHash_key" ON "Session"("sessionTokenHash");
CREATE INDEX IF NOT EXISTS "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FileFolder_projectId_parentId_idx" ON "FileFolder"("projectId", "parentId");
CREATE INDEX IF NOT EXISTS "FileFolder_projectId_idx" ON "FileFolder"("projectId");
CREATE INDEX IF NOT EXISTS "FileFolder_createdById_idx" ON "FileFolder"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarFeedToken_tokenHash_key" ON "CalendarFeedToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "CalendarFeedToken_tokenHash_idx" ON "CalendarFeedToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "CalendarFeedToken_userId_projectId_idx" ON "CalendarFeedToken"("userId", "projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attachment_noteId_idx" ON "Attachment"("noteId");
CREATE INDEX IF NOT EXISTS "Attachment_folderId_idx" ON "Attachment"("folderId");
CREATE INDEX IF NOT EXISTS "Attachment_storedObjectId_idx" ON "Attachment"("storedObjectId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CalendarEventAttendee" ADD CONSTRAINT "CalendarEventAttendee_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CalendarEventAttendee" ADD CONSTRAINT "CalendarEventAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "StoredObject" ADD CONSTRAINT "StoredObject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_storedObjectId_fkey" FOREIGN KEY ("storedObjectId") REFERENCES "StoredObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "FileFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "FileFolder" ADD CONSTRAINT "FileFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "FileFolder" ADD CONSTRAINT "FileFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FileFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "FileFolder" ADD CONSTRAINT "FileFolder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CalendarFeedToken" ADD CONSTRAINT "CalendarFeedToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CalendarFeedToken" ADD CONSTRAINT "CalendarFeedToken_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
