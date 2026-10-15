-- Fix 3 correction: Restore intended WORKSPACE visibility for team projects
-- created after migration 20261013140000_add_project_visibility_model was applied.
-- The previous backfill used a hardcoded cutoff ('2026-10-13 14:00:00+00') which
-- incorrectly captured projects created during the 82.5-minute gap between
-- actual migration started_at (2026-10-13 12:37:29.797 UTC) and 14:00:00 UTC.

UPDATE "Project" p
SET "visibility" = 'WORKSPACE'
FROM "Workspace" w
WHERE p."workspaceId" = w."id"
  AND w."isPersonal" = false
  AND p."createdAt" >= (
    SELECT COALESCE(
      (SELECT started_at FROM "_prisma_migrations" WHERE migration_name = '20261013140000_add_project_visibility_model' LIMIT 1),
      '2026-10-13 12:37:29.797+00'::timestamptz
    )
  )
  AND p."createdAt" < '2026-10-13 14:00:00+00';
