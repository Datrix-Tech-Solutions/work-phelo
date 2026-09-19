-- Fiscal years become their own record. Existing periods are grouped into years using the
-- tenant's fiscalYearStartMonth (default 1): a period belongs to the year that started in the
-- latest start-month on or before its start date. A year's window is the span of its periods.

-- CreateTable
CREATE TABLE "accounting"."FiscalYear" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_id_tenantId_key" ON "accounting"."FiscalYear"("id", "tenantId");
CREATE UNIQUE INDEX "FiscalYear_tenantId_name_key" ON "accounting"."FiscalYear"("tenantId", "name");
CREATE INDEX "FiscalYear_tenantId_startDate_idx" ON "accounting"."FiscalYear"("tenantId", "startDate");

-- AlterTable: nullable while existing rows are backfilled
ALTER TABLE "accounting"."FiscalPeriod" ADD COLUMN "fiscalYearId" TEXT;

-- Backfill 1: one year per (tenant, fiscal-year-start-year)
INSERT INTO "accounting"."FiscalYear"
    ("id", "tenantId", "name", "startDate", "endDate", "createdByUserId", "updatedByUserId", "createdAt", "updatedAt")
SELECT
    md5(random()::text || clock_timestamp()::text || g."tenantId" || g."fy"::text)::uuid::text,
    g."tenantId",
    CASE WHEN g."sm" = 1
         THEN 'FY' || g."fy"::text
         ELSE 'FY' || g."fy"::text || '/' || right((g."fy" + 1)::text, 2)
    END,
    min(g."startDate"),
    max(g."endDate"),
    (array_agg(g."createdByUserId" ORDER BY g."startDate"))[1],
    (array_agg(g."createdByUserId" ORDER BY g."startDate"))[1],
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT
        p."tenantId",
        p."startDate",
        p."endDate",
        p."createdByUserId",
        COALESCE(c."fiscalYearStartMonth", 1) AS "sm",
        CASE WHEN EXTRACT(MONTH FROM p."startDate") >= COALESCE(c."fiscalYearStartMonth", 1)
             THEN EXTRACT(YEAR FROM p."startDate")::int
             ELSE EXTRACT(YEAR FROM p."startDate")::int - 1
        END AS "fy"
    FROM "accounting"."FiscalPeriod" p
    LEFT JOIN "accounting"."AccountingTenantConfig" c ON c."tenantId" = p."tenantId"
) g
GROUP BY g."tenantId", g."fy", g."sm";

-- Backfill 2: attach each period to the year whose window contains it (periods never overlap,
-- so the year windows built above never overlap either)
UPDATE "accounting"."FiscalPeriod" p
SET "fiscalYearId" = y."id"
FROM "accounting"."FiscalYear" y
WHERE y."tenantId" = p."tenantId"
  AND p."startDate" >= y."startDate"
  AND p."endDate" <= y."endDate";

-- Require it going forward
ALTER TABLE "accounting"."FiscalPeriod" ALTER COLUMN "fiscalYearId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "FiscalPeriod_tenantId_fiscalYearId_idx" ON "accounting"."FiscalPeriod"("tenantId", "fiscalYearId");

-- AddForeignKey
ALTER TABLE "accounting"."FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_fiscalYearId_tenantId_fkey" FOREIGN KEY ("fiscalYearId", "tenantId") REFERENCES "accounting"."FiscalYear"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
