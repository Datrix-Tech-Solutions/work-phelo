-- Rule-driven control accounts: which GL account a Receivable/Payable document affects is
-- now decided entirely by the Transaction Type Rule used to create it, resolved once at
-- creation and stored on the document — never re-derived from a tenant-wide setting. This
-- retires the fixed Accounting Configuration AR/AP control accounts and the requirement
-- that every entity carry its own control account.

-- 1. Add the new resolved-account columns as nullable first, so existing rows can be
--    backfilled before the NOT NULL constraint is applied.
ALTER TABLE "accounting"."AccountingReceivableDocument" ADD COLUMN "arAccountId" TEXT;
ALTER TABLE "accounting"."AccountingReceivableReceipt" ADD COLUMN "arAccountId" TEXT;
ALTER TABLE "accounting"."AccountingPayableDocument" ADD COLUMN "apAccountId" TEXT;
ALTER TABLE "accounting"."AccountingPayablePayment" ADD COLUMN "apAccountId" TEXT;

-- 2. Backfill existing rows from the tenant-wide control account they were actually posted
--    through under the old model (the same value every one of them used).
UPDATE "accounting"."AccountingReceivableDocument" d
SET "arAccountId" = c."accountsReceivableControlAccountId"
FROM "accounting"."AccountingTenantConfig" c
WHERE d."tenantId" = c."tenantId" AND c."accountsReceivableControlAccountId" IS NOT NULL;

UPDATE "accounting"."AccountingReceivableReceipt" r
SET "arAccountId" = c."accountsReceivableControlAccountId"
FROM "accounting"."AccountingTenantConfig" c
WHERE r."tenantId" = c."tenantId" AND c."accountsReceivableControlAccountId" IS NOT NULL;

UPDATE "accounting"."AccountingPayableDocument" d
SET "apAccountId" = c."accountsPayableControlAccountId"
FROM "accounting"."AccountingTenantConfig" c
WHERE d."tenantId" = c."tenantId" AND c."accountsPayableControlAccountId" IS NOT NULL;

UPDATE "accounting"."AccountingPayablePayment" p
SET "apAccountId" = c."accountsPayableControlAccountId"
FROM "accounting"."AccountingTenantConfig" c
WHERE p."tenantId" = c."tenantId" AND c."accountsPayableControlAccountId" IS NOT NULL;

-- 3. Require the new columns going forward and add their FKs.
ALTER TABLE "accounting"."AccountingReceivableDocument" ALTER COLUMN "arAccountId" SET NOT NULL;
ALTER TABLE "accounting"."AccountingReceivableReceipt" ALTER COLUMN "arAccountId" SET NOT NULL;
ALTER TABLE "accounting"."AccountingPayableDocument" ALTER COLUMN "apAccountId" SET NOT NULL;
ALTER TABLE "accounting"."AccountingPayablePayment" ALTER COLUMN "apAccountId" SET NOT NULL;

ALTER TABLE "accounting"."AccountingReceivableDocument"
  ADD CONSTRAINT "AccountingReceivableDocument_arAccountId_tenantId_fkey"
  FOREIGN KEY ("arAccountId", "tenantId")
  REFERENCES "accounting"."GLAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingReceivableReceipt"
  ADD CONSTRAINT "AccountingReceivableReceipt_arAccountId_tenantId_fkey"
  FOREIGN KEY ("arAccountId", "tenantId")
  REFERENCES "accounting"."GLAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayableDocument"
  ADD CONSTRAINT "AccountingPayableDocument_apAccountId_tenantId_fkey"
  FOREIGN KEY ("apAccountId", "tenantId")
  REFERENCES "accounting"."GLAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayablePayment"
  ADD CONSTRAINT "AccountingPayablePayment_apAccountId_tenantId_fkey"
  FOREIGN KEY ("apAccountId", "tenantId")
  REFERENCES "accounting"."GLAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Entities no longer require a control account.
ALTER TABLE "accounting"."SubledgerAccount" DROP CONSTRAINT "SubledgerAccount_controlAccountId_tenantId_fkey";
ALTER TABLE "accounting"."SubledgerAccount" ALTER COLUMN "controlAccountId" DROP NOT NULL;
ALTER TABLE "accounting"."SubledgerAccount"
  ADD CONSTRAINT "SubledgerAccount_controlAccountId_tenantId_fkey"
  FOREIGN KEY ("controlAccountId", "tenantId")
  REFERENCES "accounting"."GLAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "accounting"."SubledgerAccount_tenantId_type_externalRef_controlAccountId_key";
CREATE UNIQUE INDEX "SubledgerAccount_tenantId_type_externalRef_key"
  ON "accounting"."SubledgerAccount"("tenantId", "type", "externalRef");

-- 5. Accounting Configuration drops its fixed AR/AP control accounts.
ALTER TABLE "accounting"."AccountingTenantConfig"
  DROP CONSTRAINT "AccountingTenantConfig_accountsReceivableControlAccountId_tenantId_fkey";
ALTER TABLE "accounting"."AccountingTenantConfig"
  DROP CONSTRAINT "AccountingTenantConfig_accountsPayableControlAccountId_tenantId_fkey";
ALTER TABLE "accounting"."AccountingTenantConfig" DROP COLUMN "accountsReceivableControlAccountId";
ALTER TABLE "accounting"."AccountingTenantConfig" DROP COLUMN "accountsPayableControlAccountId";

-- 6. Entity Types no longer carry an accounting relation — Receivable/Payable is now a
--    Transaction Type property, not an entity property.
ALTER TABLE "accounting"."EntityType" DROP COLUMN "accountingRelation";
DROP TYPE "accounting"."EntityAccountingRelation";
