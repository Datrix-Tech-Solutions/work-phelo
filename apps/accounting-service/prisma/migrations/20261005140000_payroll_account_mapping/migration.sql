-- Payroll's accounts are chosen by the accountant in Accounting (one GL account per payroll
-- function) instead of being looked up by name. Open items also remember which function they
-- belong to, so remapping an account later never changes items that were already raised.

-- CreateTable
CREATE TABLE "accounting"."PayrollAccountMapping" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "glAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollAccountMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."PayrollAccountingSetting" (
    "tenantId" TEXT NOT NULL,
    "autoPostOnApproval" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollAccountingSetting_pkey" PRIMARY KEY ("tenantId")
);

-- AlterTable
ALTER TABLE "accounting"."SourceLedgerEntry" ADD COLUMN "sourceRole" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PayrollAccountMapping_tenantId_role_key" ON "accounting"."PayrollAccountMapping"("tenantId", "role");

-- CreateIndex
CREATE INDEX "PayrollAccountMapping_tenantId_glAccountId_idx" ON "accounting"."PayrollAccountMapping"("tenantId", "glAccountId");

-- AddForeignKey
ALTER TABLE "accounting"."PayrollAccountMapping" ADD CONSTRAINT "PayrollAccountMapping_glAccountId_tenantId_fkey" FOREIGN KEY ("glAccountId", "tenantId") REFERENCES "accounting"."GLAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tenants that already seeded the standard payroll accounts keep working: map each role to the
-- account payroll was finding by name.
INSERT INTO "accounting"."PayrollAccountMapping" ("tenantId", "role", "glAccountId", "updatedAt")
SELECT a."tenantId", m."role", a."id", CURRENT_TIMESTAMP
FROM "accounting"."GLAccount" a
JOIN "accounting"."AccountGroup" g
  ON g."id" = a."accountGroupId" AND g."tenantId" = a."tenantId"
JOIN (VALUES
  ('salariesWagesExpense', 'Payroll Expense', 'salaries and wages expense'),
  ('employerSocialSecurityExpense', 'Payroll Expense', 'employer social security contribution expense'),
  ('netPayPayable', 'Payroll Liabilities', 'net pay payable'),
  ('incomeTaxPayable', 'Payroll Liabilities', 'income tax payable'),
  ('socialSecurityPayable', 'Payroll Liabilities', 'social security payable'),
  ('statutoryPensionPayable', 'Payroll Liabilities', 'statutory pension payable'),
  ('otherDeductionsPayable', 'Payroll Liabilities', 'other deductions payable')
) AS m("role", "groupName", "accountName")
  ON g."name" = m."groupName" AND lower(trim(a."name")) = m."accountName"
ON CONFLICT ("tenantId", "role") DO NOTHING;

-- Label the payroll open items that already exist with the function they belong to.
UPDATE "accounting"."SourceLedgerEntry" e
SET "sourceRole" = m."role"
FROM "accounting"."PayrollAccountMapping" m, "accounting"."SourceType" st
WHERE e."tenantId" = m."tenantId"
  AND e."glAccountId" = m."glAccountId"
  AND e."sourceTypeId" = st."id"
  AND st."module" = 'HR'
  AND e."sourceRole" IS NULL
  AND m."role" IN ('netPayPayable', 'incomeTaxPayable', 'socialSecurityPayable', 'statutoryPensionPayable', 'otherDeductionsPayable');
