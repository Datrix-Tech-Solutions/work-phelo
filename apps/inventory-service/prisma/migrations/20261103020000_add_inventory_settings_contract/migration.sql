CREATE TYPE "inventory"."InventoryConfigurationStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "inventory"."InventoryCategory"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "icon" TEXT,
  ADD COLUMN "status" "inventory"."InventoryConfigurationStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "inventory"."UnitOfMeasure"
  ADD COLUMN "symbol" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "status" "inventory"."InventoryConfigurationStatus" NOT NULL DEFAULT 'ACTIVE';

-- Identifier-derived legacy placeholders; names and existing relations stay unchanged.
UPDATE "inventory"."UnitOfMeasure" SET "symbol" = LEFT("id", 10);
ALTER TABLE "inventory"."UnitOfMeasure" ALTER COLUMN "symbol" SET NOT NULL;

ALTER TABLE "inventory"."StockLocation"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "status" "inventory"."InventoryConfigurationStatus" NOT NULL DEFAULT 'ACTIVE';

-- Deterministic per-tenant sequence avoids collisions or assumptions about old ID formats.
WITH legacy_codes AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "id") AS ordinal
  FROM "inventory"."StockLocation"
)
UPDATE "inventory"."StockLocation" AS location
SET "code" = 'LEGACY-' || legacy_codes.ordinal
FROM legacy_codes WHERE location."id" = legacy_codes."id";
ALTER TABLE "inventory"."StockLocation" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "StockLocation_tenantId_code_key" ON "inventory"."StockLocation"("tenantId", "code");
