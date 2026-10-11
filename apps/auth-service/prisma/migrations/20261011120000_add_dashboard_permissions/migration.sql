-- Organisation dashboards get their own permission resources, so seeing them no longer rides
-- on employees:VIEW (which every employee holds) or on the marketing module being enabled.

INSERT INTO "w_auth"."Resource" ("id", "name", "module", "description", "isActive", "createdAt")
VALUES
  (
    gen_random_uuid()::text,
    'hr.dashboard',
    'HR',
    'Organisation-wide HR dashboard (headcount, attendance, leave, pending actions)',
    true,
    now()
  ),
  (
    gen_random_uuid()::text,
    'marketing.dashboard',
    'MARKETING',
    'General (organisation-wide) Marketing dashboard',
    true,
    now()
  )
ON CONFLICT ("name") DO NOTHING;

-- Keep access for roles that already operate on the whole organisation.
-- HR dashboard: permission sets that can create, edit or delete employees.
INSERT INTO "w_auth"."PermissionSetResource" ("id", "permissionSetId", "resourceId", "action")
SELECT gen_random_uuid()::text, holders."permissionSetId", dash."id", 'VIEW'::"w_auth"."PermissionAction"
FROM (
  SELECT DISTINCT psr."permissionSetId"
  FROM "w_auth"."PermissionSetResource" psr
  JOIN "w_auth"."Resource" r ON r."id" = psr."resourceId"
  WHERE r."name" = 'employees'
    AND psr."action" IN ('CREATE', 'EDIT', 'DELETE')
) holders
CROSS JOIN (
  SELECT "id" FROM "w_auth"."Resource" WHERE "name" = 'hr.dashboard'
) dash
ON CONFLICT ("permissionSetId", "resourceId", "action") DO NOTHING;

-- Marketing dashboard: permission sets that already view every rep's prospects, clients or targets.
INSERT INTO "w_auth"."PermissionSetResource" ("id", "permissionSetId", "resourceId", "action")
SELECT gen_random_uuid()::text, holders."permissionSetId", dash."id", 'VIEW'::"w_auth"."PermissionAction"
FROM (
  SELECT DISTINCT psr."permissionSetId"
  FROM "w_auth"."PermissionSetResource" psr
  JOIN "w_auth"."Resource" r ON r."id" = psr."resourceId"
  WHERE r."name" IN ('marketing.prospects.all', 'marketing.clients.all', 'marketing.targets.all')
    AND psr."action" = 'VIEW'
) holders
CROSS JOIN (
  SELECT "id" FROM "w_auth"."Resource" WHERE "name" = 'marketing.dashboard'
) dash
ON CONFLICT ("permissionSetId", "resourceId", "action") DO NOTHING;
