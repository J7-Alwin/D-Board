-- Revert any non-personal (team) workspace members back to DIRECT to prevent false-positive eviction.
-- Only personal workspaces have unambiguous PROJECT_DERIVED non-owner collaborators.
UPDATE "WorkspaceMember" wm
SET "origin" = 'DIRECT'
FROM "Workspace" w
WHERE wm."workspaceId" = w."id"
  AND w."isPersonal" = false
  AND wm."role" = 'WORKSPACE_MEMBER'
  AND wm."origin" = 'PROJECT_DERIVED';
