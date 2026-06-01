-- Migration: rename BusinessClass → RiskClass, add RiskType, rename BusinessClassField → RiskTypeField
-- Data-safe for empty tables; see migration guide if rows exist before applying.

-- ── Step 1: Create new enum types ──────────────────────────────────────────

CREATE TYPE reinsurance."RiskTypeFieldSection" AS ENUM ('BUSINESS_DETAILS', 'OFFER_DETAILS');
CREATE TYPE reinsurance."RiskTypeFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX', 'TEXTAREA');

-- ── Step 2: Rename business_class → risk_class, drop code column ───────────

ALTER TABLE reinsurance."business_class" RENAME TO "risk_class";

-- Drop uniqueness constraint on code (name now carries uniqueness)
ALTER TABLE reinsurance."risk_class" DROP CONSTRAINT IF EXISTS "business_class_tenantId_code_key";

-- Drop code column
ALTER TABLE reinsurance."risk_class" DROP COLUMN IF EXISTS "code";

-- Add uniqueness constraint on name
ALTER TABLE reinsurance."risk_class" ADD CONSTRAINT "risk_class_tenantId_name_key" UNIQUE ("tenantId", "name");

-- Rename index names for clarity (not strictly required but keeps things clean)
ALTER INDEX IF EXISTS "business_class_tenantId_isActive_displayOrder_idx" RENAME TO "risk_class_tenantId_isActive_displayOrder_idx";
ALTER INDEX IF EXISTS "business_class_tenantId_archivedAt_createdAt_idx" RENAME TO "risk_class_tenantId_archivedAt_createdAt_idx";
ALTER INDEX IF EXISTS "business_class_id_tenantId_key" RENAME TO "risk_class_id_tenantId_key";

-- ── Step 3: Create risk_type table ─────────────────────────────────────────

CREATE TABLE reinsurance."risk_type" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "riskClassId"     TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "displayOrder"    INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "archivedAt"      TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_type_pkey" PRIMARY KEY ("id")
);

ALTER TABLE reinsurance."risk_type"
    ADD CONSTRAINT "risk_type_riskClassId_tenantId_fkey"
    FOREIGN KEY ("riskClassId", "tenantId")
    REFERENCES reinsurance."risk_class"("id", "tenantId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "risk_type_id_tenantId_key" ON reinsurance."risk_type"("id", "tenantId");
CREATE UNIQUE INDEX "risk_type_tenantId_riskClassId_name_key" ON reinsurance."risk_type"("tenantId", "riskClassId", "name");
CREATE INDEX "risk_type_tenantId_riskClassId_isActive_displayOrder_idx" ON reinsurance."risk_type"("tenantId", "riskClassId", "isActive", "displayOrder");
CREATE INDEX "risk_type_tenantId_archivedAt_createdAt_idx" ON reinsurance."risk_type"("tenantId", "archivedAt", "createdAt");

-- ── Step 4: Rename business_class_field → risk_type_field, migrate FK ──────

ALTER TABLE reinsurance."business_class_field" RENAME TO "risk_type_field";

-- Add riskTypeId column (new parent FK)
ALTER TABLE reinsurance."risk_type_field" ADD COLUMN "riskTypeId" TEXT;

-- DATA MIGRATION (safe no-op on empty tables):
-- For each existing business_class_field row, create a default RiskType under the
-- matching RiskClass and point riskTypeId at it.
-- If the table is empty this block executes without effect.
DO $$
DECLARE
    rc RECORD;
    rt_id TEXT;
BEGIN
    FOR rc IN
        SELECT DISTINCT rc_inner.id, rc_inner."tenantId", rc_inner.name, rc_inner."createdByUserId", rc_inner."updatedByUserId"
        FROM reinsurance.risk_class rc_inner
        WHERE EXISTS (
            SELECT 1 FROM reinsurance.risk_type_field f
            WHERE f."businessClassId" = rc_inner.id
        )
    LOOP
        -- Create one default RiskType per RiskClass that still has fields
        INSERT INTO reinsurance.risk_type (
            id, "tenantId", "riskClassId", name,
            "isActive", "displayOrder",
            "createdByUserId", "updatedByUserId",
            "updatedAt"
        ) VALUES (
            gen_random_uuid()::text, rc."tenantId", rc.id, rc.name,
            true, 0,
            rc."createdByUserId", rc."updatedByUserId",
            NOW()
        )
        ON CONFLICT ("tenantId", "riskClassId", name) DO NOTHING
        RETURNING id INTO rt_id;

        IF rt_id IS NULL THEN
            SELECT id INTO rt_id
            FROM reinsurance.risk_type
            WHERE "tenantId" = rc."tenantId"
              AND "riskClassId" = rc.id
              AND name = rc.name;
        END IF;

        UPDATE reinsurance.risk_type_field
        SET "riskTypeId" = rt_id
        WHERE "businessClassId" = rc.id
          AND "tenantId" = rc."tenantId";
    END LOOP;
END $$;

-- Make riskTypeId NOT NULL now that data migration is complete
ALTER TABLE reinsurance."risk_type_field" ALTER COLUMN "riskTypeId" SET NOT NULL;

-- Drop old businessClassId FK and column
ALTER TABLE reinsurance."risk_type_field" DROP CONSTRAINT IF EXISTS "business_class_field_businessClassId_tenantId_fkey";
ALTER TABLE reinsurance."risk_type_field" DROP COLUMN IF EXISTS "businessClassId";

-- Add new riskTypeId FK
ALTER TABLE reinsurance."risk_type_field"
    ADD CONSTRAINT "risk_type_field_riskTypeId_tenantId_fkey"
    FOREIGN KEY ("riskTypeId", "tenantId")
    REFERENCES reinsurance."risk_type"("id", "tenantId")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate section enum column
ALTER TABLE reinsurance."risk_type_field"
    ALTER COLUMN "section" TYPE reinsurance."RiskTypeFieldSection"
    USING "section"::text::reinsurance."RiskTypeFieldSection";

-- Migrate fieldType enum column
ALTER TABLE reinsurance."risk_type_field"
    ALTER COLUMN "fieldType" TYPE reinsurance."RiskTypeFieldType"
    USING "fieldType"::text::reinsurance."RiskTypeFieldType";

-- Drop old enum types
DROP TYPE IF EXISTS reinsurance."BusinessClassFieldSection";
DROP TYPE IF EXISTS reinsurance."BusinessClassFieldType";

-- Rebuild unique constraint with new FK column name
ALTER TABLE reinsurance."risk_type_field"
    DROP CONSTRAINT IF EXISTS "business_class_field_tenantId_businessClassId_section_fieldKey_key";
ALTER TABLE reinsurance."risk_type_field"
    ADD CONSTRAINT "risk_type_field_tenantId_riskTypeId_section_fieldKey_key"
    UNIQUE ("tenantId", "riskTypeId", "section", "fieldKey");

-- Rebuild indexes
DROP INDEX IF EXISTS reinsurance."business_class_field_tenantId_businessClassId_section_isActive_idx";
CREATE INDEX "risk_type_field_tenantId_riskTypeId_section_isActive_idx"
    ON reinsurance."risk_type_field"("tenantId", "riskTypeId", "section", "isActive");

-- ── Step 5: Add new columns to Placement ───────────────────────────────────

ALTER TABLE reinsurance."Placement" ADD COLUMN IF NOT EXISTS "riskTypeId"           TEXT;
ALTER TABLE reinsurance."Placement" ADD COLUMN IF NOT EXISTS "rate"                 DECIMAL(7,4);
ALTER TABLE reinsurance."Placement" ADD COLUMN IF NOT EXISTS "premium"              DECIMAL(18,2);
ALTER TABLE reinsurance."Placement" ADD COLUMN IF NOT EXISTS "commission"           DECIMAL(7,4);
ALTER TABLE reinsurance."Placement" ADD COLUMN IF NOT EXISTS "facultativeOffer"     DECIMAL(7,4);
ALTER TABLE reinsurance."Placement" ADD COLUMN IF NOT EXISTS "preliminaryBrokerage" DECIMAL(7,4);

-- Index for riskTypeId filter queries
CREATE INDEX IF NOT EXISTS "Placement_tenantId_riskTypeId_archivedAt_idx"
    ON reinsurance."Placement"("tenantId", "riskTypeId", "archivedAt");
