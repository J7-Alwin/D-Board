-- Create partial unique index to enforce at most one PENDING transfer per project
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectTransfer_unique_pending_project_idx"
ON "ProjectTransfer"("projectId")
WHERE status = 'PENDING';
