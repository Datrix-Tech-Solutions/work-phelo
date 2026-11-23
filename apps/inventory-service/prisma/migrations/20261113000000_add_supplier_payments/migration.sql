CREATE TYPE "inventory"."SupplierPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE', 'OTHER');

CREATE TABLE "inventory"."SupplierPayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "reference" TEXT,
  "paymentDate" DATE NOT NULL,
  "method" "inventory"."SupplierPaymentMethod" NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  "notes" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierPayment_amount_positive" CHECK ("amount" > 0)
);

CREATE TABLE "inventory"."PurchaseOrderPayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  CONSTRAINT "PurchaseOrderPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrderPayment_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "SupplierPayment_tenantId_id_key" ON "inventory"."SupplierPayment"("tenantId", "id");
CREATE INDEX "SupplierPayment_tenantId_supplierId_idx" ON "inventory"."SupplierPayment"("tenantId", "supplierId");
CREATE UNIQUE INDEX "PurchaseOrderPayment_tenantId_id_key" ON "inventory"."PurchaseOrderPayment"("tenantId", "id");
CREATE UNIQUE INDEX "PurchaseOrderPayment_tenantId_paymentId_purchaseOrderId_key" ON "inventory"."PurchaseOrderPayment"("tenantId", "paymentId", "purchaseOrderId");
CREATE INDEX "PurchaseOrderPayment_tenantId_purchaseOrderId_idx" ON "inventory"."PurchaseOrderPayment"("tenantId", "purchaseOrderId");

ALTER TABLE "inventory"."SupplierPayment"
  ADD CONSTRAINT "SupplierPayment_supplier_fkey" FOREIGN KEY ("tenantId", "supplierId")
    REFERENCES "inventory"."InventoryParty"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory"."PurchaseOrderPayment"
  ADD CONSTRAINT "PurchaseOrderPayment_payment_fkey" FOREIGN KEY ("tenantId", "paymentId")
    REFERENCES "inventory"."SupplierPayment"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PurchaseOrderPayment_order_fkey" FOREIGN KEY ("tenantId", "purchaseOrderId")
    REFERENCES "inventory"."PurchaseOrder"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
