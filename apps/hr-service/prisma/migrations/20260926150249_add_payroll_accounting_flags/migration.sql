-- Payroll <-> Accounting integration setup: whether payroll runs post accrual
-- journal entries to the accounting module, and whether that journal posts
-- straight to the ledger on approval instead of as a draft awaiting review.

ALTER TABLE "hr"."TenantConfig" ADD COLUMN "linkedToAccounting" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "hr"."TenantConfig" ADD COLUMN "autoPostOnApproval" BOOLEAN NOT NULL DEFAULT false;
