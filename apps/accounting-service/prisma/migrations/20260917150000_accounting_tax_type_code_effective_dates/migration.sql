-- Corrective migration: the original 20260915100000_accounting_transaction_type_rules
-- migration was edited in place (across commits 965b6eb7 -> d8ffa374 -> bf831156) to
-- change TaxType's shape from {name, description} to {code, effectiveFrom, effectiveTo}.
-- Any database that already applied that migration under its old shape never picked up
-- the change, since Prisma tracks migrations as applied by filename, not content. This
-- migration brings such a database's TaxType table in line with the current schema
-- without touching the historical migration file again.

-- 1. Add the new columns as nullable first, so existing rows can be backfilled.
ALTER TABLE "accounting"."TaxType" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "accounting"."TaxType" ADD COLUMN IF NOT EXISTS "effectiveFrom" TIMESTAMP(3);
ALTER TABLE "accounting"."TaxType" ADD COLUMN IF NOT EXISTS "effectiveTo" TIMESTAMP(3);

-- 2. Backfill from the old columns for any row created under the old shape.
--    code: derived from name (uppercased, non-alphanumeric stripped, truncated to the
--    30-char limit CreateTaxTypeDto enforces going forward).
UPDATE "accounting"."TaxType"
SET "code" = upper(left(regexp_replace(coalesce("name", 'TAX'), '[^a-zA-Z0-9]+', '', 'g'), 30))
WHERE "code" IS NULL;

-- Disambiguate any duplicate codes within the same tenant that the derivation above
-- could produce (e.g. two tax types whose names strip down to the same code).
WITH ranked AS (
  SELECT "id",
         row_number() OVER (PARTITION BY "tenantId", "code" ORDER BY "createdAt") AS rn
  FROM "accounting"."TaxType"
)
UPDATE "accounting"."TaxType" t
SET "code" = left(t."code", 27) || '_' || ranked.rn
FROM ranked
WHERE t."id" = ranked."id" AND ranked.rn > 1;

--    effectiveFrom: no prior concept of an effective date existed, so treat the row's
--    original creation date as when it became effective.
UPDATE "accounting"."TaxType"
SET "effectiveFrom" = "createdAt"
WHERE "effectiveFrom" IS NULL;

-- 3. Require the new columns going forward (effectiveTo stays open-ended/nullable).
ALTER TABLE "accounting"."TaxType" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "accounting"."TaxType" ALTER COLUMN "effectiveFrom" SET NOT NULL;

-- 4. Drop the retired column and its unique index, replacing it with the code-based one.
DROP INDEX IF EXISTS "accounting"."TaxType_tenantId_name_key";
ALTER TABLE "accounting"."TaxType" DROP COLUMN IF EXISTS "description";

CREATE UNIQUE INDEX IF NOT EXISTS "TaxType_tenantId_code_key" ON "accounting"."TaxType"("tenantId", "code");
