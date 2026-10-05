-- Each payroll run remembers whether it was approved while linked to Accounting, so linking or
-- unlinking later never changes how an existing run is settled.

ALTER TABLE "hr"."PayrollRun" ADD COLUMN "postedToAccounting" BOOLEAN NOT NULL DEFAULT false;

-- Runs already approved by a tenant that was linked at the time keep being settled in Accounting.
UPDATE "hr"."PayrollRun" r
SET "postedToAccounting" = true
FROM "hr"."TenantConfig" c
WHERE c."tenantId" = r."tenantId"
  AND c."linkedToAccounting" = true
  AND r."status" IN ('APPROVED', 'PAID');
