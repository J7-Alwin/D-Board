-- Correct legacy project-derived workspace memberships that were defaulted to DIRECT.
-- Rationale:
-- 1. Workspace owners (where userId = workspace.ownerId OR role = 'OWNER') are DIRECT.
-- 2. Workspace administrators (role = 'WORKSPACE_ADMIN') are explicitly designated and are DIRECT.
-- 3. In personal workspaces (Workspace.isPersonal = true), non-owner members (role = 'WORKSPACE_MEMBER')
--    exist solely because they were collaborators on a personal project. They must be PROJECT_DERIVED.
-- 4. In any workspace, if a WORKSPACE_MEMBER belongs only to legacy migrated projects and has no explicit
--    workspace-level invitation or admin role, classify them as PROJECT_DERIVED.

UPDATE "WorkspaceMember" wm
SET "origin" = 'PROJECT_DERIVED'
FROM "Workspace" w
WHERE wm."workspaceId" = w."id"
  AND wm."role" = 'WORKSPACE_MEMBER'
  AND wm."userId" != w."ownerId"
  AND (
    w."isPersonal" = true
    OR
    EXISTS (
      SELECT 1 FROM "ProjectMember" pm
      JOIN "Project" p ON p."id" = pm."projectId"
      WHERE p."workspaceId" = wm."workspaceId"
        AND pm."userId" = wm."userId"
    )
  )
  AND wm."origin" = 'DIRECT';
