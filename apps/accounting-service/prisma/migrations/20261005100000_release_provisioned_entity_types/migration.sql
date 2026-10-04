-- Entity types belong to the tenant: nothing is provisioned for them any more. One that an earlier
-- version created for a module is handed over, so it can be renamed or removed like any other.
UPDATE "accounting"."EntityType"
SET "isSystem" = false
WHERE "createdByUserId" = 'service:accounting-provisioning';
