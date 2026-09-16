-- Retire the separate AccountingCustomer/AccountingVendor master-data tables and repoint
-- every receivable/payable relation directly at SubledgerAccount, so Entities (SubledgerAccount
-- + EntityType) is the single system for parties in the app — Customer/Vendor become just the
-- two default Entity Types, not a special-cased mechanism.

-- 1. Drop the old FKs to AccountingCustomer/AccountingVendor.
ALTER TABLE "accounting"."AccountingReceivableDocument"
  DROP CONSTRAINT "AccountingReceivableDocument_customerId_tenantId_fkey";
ALTER TABLE "accounting"."AccountingReceivableReceipt"
  DROP CONSTRAINT "AccountingReceivableReceipt_customerId_tenantId_fkey";
ALTER TABLE "accounting"."AccountingReceivableAllocation"
  DROP CONSTRAINT "AccountingReceivableAllocation_customerId_tenantId_fkey";
ALTER TABLE "accounting"."AccountingPayableDocument"
  DROP CONSTRAINT "AccountingPayableDocument_vendorId_tenantId_fkey";
ALTER TABLE "accounting"."AccountingPayablePayment"
  DROP CONSTRAINT "AccountingPayablePayment_vendorId_tenantId_fkey";
ALTER TABLE "accounting"."AccountingPayableAllocation"
  DROP CONSTRAINT "AccountingPayableAllocation_vendorId_tenantId_fkey";

-- 2. Repoint existing rows' customerId/vendorId at the underlying SubledgerAccount id (each
--    AccountingCustomer/AccountingVendor row wraps exactly one SubledgerAccount).
UPDATE "accounting"."AccountingReceivableDocument" d
SET "customerId" = c."subledgerAccountId"
FROM "accounting"."AccountingCustomer" c
WHERE d."customerId" = c."id" AND d."tenantId" = c."tenantId";

UPDATE "accounting"."AccountingReceivableReceipt" r
SET "customerId" = c."subledgerAccountId"
FROM "accounting"."AccountingCustomer" c
WHERE r."customerId" = c."id" AND r."tenantId" = c."tenantId";

UPDATE "accounting"."AccountingReceivableAllocation" a
SET "customerId" = c."subledgerAccountId"
FROM "accounting"."AccountingCustomer" c
WHERE a."customerId" = c."id" AND a."tenantId" = c."tenantId";

UPDATE "accounting"."AccountingPayableDocument" d
SET "vendorId" = v."subledgerAccountId"
FROM "accounting"."AccountingVendor" v
WHERE d."vendorId" = v."id" AND d."tenantId" = v."tenantId";

UPDATE "accounting"."AccountingPayablePayment" p
SET "vendorId" = v."subledgerAccountId"
FROM "accounting"."AccountingVendor" v
WHERE p."vendorId" = v."id" AND p."tenantId" = v."tenantId";

UPDATE "accounting"."AccountingPayableAllocation" a
SET "vendorId" = v."subledgerAccountId"
FROM "accounting"."AccountingVendor" v
WHERE a."vendorId" = v."id" AND a."tenantId" = v."tenantId";

-- 3. New FKs onto SubledgerAccount directly.
ALTER TABLE "accounting"."AccountingReceivableDocument"
  ADD CONSTRAINT "AccountingReceivableDocument_customerId_tenantId_fkey"
  FOREIGN KEY ("customerId", "tenantId")
  REFERENCES "accounting"."SubledgerAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingReceivableReceipt"
  ADD CONSTRAINT "AccountingReceivableReceipt_customerId_tenantId_fkey"
  FOREIGN KEY ("customerId", "tenantId")
  REFERENCES "accounting"."SubledgerAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingReceivableAllocation"
  ADD CONSTRAINT "AccountingReceivableAllocation_customerId_tenantId_fkey"
  FOREIGN KEY ("customerId", "tenantId")
  REFERENCES "accounting"."SubledgerAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayableDocument"
  ADD CONSTRAINT "AccountingPayableDocument_vendorId_tenantId_fkey"
  FOREIGN KEY ("vendorId", "tenantId")
  REFERENCES "accounting"."SubledgerAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayablePayment"
  ADD CONSTRAINT "AccountingPayablePayment_vendorId_tenantId_fkey"
  FOREIGN KEY ("vendorId", "tenantId")
  REFERENCES "accounting"."SubledgerAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting"."AccountingPayableAllocation"
  ADD CONSTRAINT "AccountingPayableAllocation_vendorId_tenantId_fkey"
  FOREIGN KEY ("vendorId", "tenantId")
  REFERENCES "accounting"."SubledgerAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Drop the now-empty-of-purpose master-data tables (each table's own FKs to
--    SubledgerAccount/GLAccount/tenant are dropped automatically with it).
DROP TABLE "accounting"."AccountingVendor";
DROP TABLE "accounting"."AccountingCustomer";
