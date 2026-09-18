-- AlterTable
ALTER TABLE "User" ADD COLUMN "fullName" TEXT,
ADD COLUMN "termsAccepted" BOOLEAN NOT NULL DEFAULT true;
