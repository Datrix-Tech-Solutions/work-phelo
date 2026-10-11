-- The HR report builder gets its own permission resource, so opening it does not ride on
-- hr.dashboard or on the employees resource that every employee holds.

INSERT INTO "w_auth"."Resource" ("id", "name", "module", "description", "isActive", "createdAt")
VALUES
  (
    gen_random_uuid()::text,
    'hr.reports',
    'HR',
    'HR report builder and saved reports',
    true,
    now()
  )
ON CONFLICT ("name") DO NOTHING;

-- Keep access for roles that already see the organisation-wide HR dashboard.
INSERT INTO "w_auth"."PermissionSetResource" ("id", "permissionSetId", "resourceId", "action")
SELECT gen_random_uuid()::text, holders."permissionSetId", rep."id", 'VIEW'::"w_auth"."PermissionAction"
FROM (
  SELECT DISTINCT psr."permissionSetId"
  FROM "w_auth"."PermissionSetResource" psr
  JOIN "w_auth"."Resource" r ON r."id" = psr."resourceId"
  WHERE r."name" = 'hr.dashboard'
    AND psr."action" = 'VIEW'
) holders
CROSS JOIN (
  SELECT "id" FROM "w_auth"."Resource" WHERE "name" = 'hr.reports'
) rep
ON CONFLICT ("permissionSetId", "resourceId", "action") DO NOTHING;
