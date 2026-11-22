-- A supplier payment can be linked to Accounting. Accounting may reject it, and a rejected payment no longer counts as paid.
CREATE TYPE "inventory"."SupplierPaymentStatus" AS ENUM ('RECORDED', 'REJECTED');

ALTER TABLE "inventory"."SupplierPayment"
  ADD COLUMN "status" "inventory"."SupplierPaymentStatus" NOT NULL DEFAULT 'RECORDED',
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "accountingTransactionId" TEXT;

CREATE INDEX "SupplierPayment_tenantId_accountingTransactionId_idx"
  ON "inventory"."SupplierPayment"("tenantId", "accountingTransactionId");

-- The supplier's entity in Accounting, created by the first linked payment.
ALTER TABLE "inventory"."InventoryParty"
  ADD COLUMN "accountingEntityId" TEXT,
  ADD COLUMN "accountingEntityTypeId" TEXT;
