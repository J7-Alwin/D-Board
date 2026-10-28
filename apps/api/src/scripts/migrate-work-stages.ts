import { prisma } from '../prisma.js';

async function main() {
  console.log('Running safe schema migrations for WorkItem stage due dates & timer tracking...');

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "WorkItem" 
    ADD COLUMN IF NOT EXISTS "todoDueDate" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "inProgressDueDate" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "inReviewDueDate" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "completedDueDate" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
    ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "rejectedById" TEXT,
    ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
  `);

  console.log('WorkItem table columns updated successfully.');

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "WorkItemAssignee"
    ADD COLUMN IF NOT EXISTS "hasStarted" BOOLEAN DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "hasCompleted" BOOLEAN DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "totalDurationSeconds" INTEGER DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS "lastSessionStartedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "isPaused" BOOLEAN DEFAULT true NOT NULL,
    ADD COLUMN IF NOT EXISTS "lastCheckInCycle" INTEGER DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS "lastCheckInAt" TIMESTAMP(3);
  `);

  console.log('WorkItemAssignee table columns updated successfully.');
  console.log('All migrations completed safely.');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
