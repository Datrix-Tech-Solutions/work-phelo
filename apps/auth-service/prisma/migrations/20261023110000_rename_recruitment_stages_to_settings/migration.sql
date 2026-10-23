-- The hiring pipeline stages resource becomes "Manage hiring settings". Permission rows point at the
-- resource by id, so renaming it keeps every role's existing access.
UPDATE "w_auth"."Resource"
SET "name" = 'recruitment.settings',
    "description" = 'Manage hiring settings (pipeline stages)'
WHERE "name" = 'recruitment.stages'
  AND NOT EXISTS (SELECT 1 FROM "w_auth"."Resource" WHERE "name" = 'recruitment.settings');
