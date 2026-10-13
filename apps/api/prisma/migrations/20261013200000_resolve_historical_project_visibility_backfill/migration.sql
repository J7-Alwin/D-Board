-- Fix 3: Safely resolve historical project visibility and migration backfill
-- Any project created prior to the visibility model introduction (2026-10-13 14:00:00 UTC)
-- was created under explicit-membership authorization. Backfill them to 'RESTRICTED' to
-- strictly preserve historical security boundaries and prevent unauthorized access.
UPDATE "Project"
SET "visibility" = 'RESTRICTED'
WHERE "createdAt" < '2026-10-13 14:00:00+00';

-- Projects belonging to personal workspaces must be 'RESTRICTED'
-- to ensure invited collaborators cannot access unrelated personal projects.
UPDATE "Project" p
SET "visibility" = 'RESTRICTED'
FROM "Workspace" w
WHERE p."workspaceId" = w."id"
  AND w."isPersonal" = true;
