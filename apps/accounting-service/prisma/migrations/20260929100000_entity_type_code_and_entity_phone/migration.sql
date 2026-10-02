-- Entity Type gets a short ID/prefix used to build Entity Codes (e.g. SUP-0001). Nullable so
-- existing types (and the auto-created Employee type) keep working until one is set.
ALTER TABLE "accounting"."EntityType" ADD COLUMN "code" TEXT;

-- Default prefixes for the two seeded system types.
UPDATE "accounting"."EntityType" SET "code" = 'CUS' WHERE "isSystem" = true AND UPPER("name") = 'CUSTOMER';
UPDATE "accounting"."EntityType" SET "code" = 'VEN' WHERE "isSystem" = true AND UPPER("name") = 'VENDOR';

CREATE UNIQUE INDEX "EntityType_tenantId_code_key" ON "accounting"."EntityType"("tenantId", "code");

-- Entity contact phone number (Contact Person stays in contactName).
ALTER TABLE "accounting"."SubledgerAccount" ADD COLUMN "phone" TEXT;
