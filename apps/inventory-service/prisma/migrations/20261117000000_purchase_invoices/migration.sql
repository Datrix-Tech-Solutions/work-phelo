-- Orders are invoiced before they are received: the invoice sets the price and what is owed.
ALTER TYPE "inventory"."PurchaseOrderStatus" ADD VALUE 'INVOICED';
CREATE TYPE "inventory"."PurchaseInvoiceStatus" AS ENUM ('ACTIVE', 'VOID');

ALTER TABLE "inventory"."PurchaseOrderLine"
  ADD COLUMN "invoicedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "invoicedValue" DECIMAL(18,4) NOT NULL DEFAULT 0;

CREATE TABLE "inventory"."PurchaseInvoice" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "invoiceDate" DATE NOT NULL,
  "dueDate" DATE,
  "notes" TEXT,
  "status" "inventory"."PurchaseInvoiceStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory"."PurchaseInvoiceLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "purchaseOrderLineId" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "unitCost" DECIMAL(18,4) NOT NULL,
  CONSTRAINT "PurchaseInvoiceLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseInvoiceLine_quantity_positive" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "PurchaseInvoice_tenantId_id_key" ON "inventory"."PurchaseInvoice"("tenantId", "id");
CREATE UNIQUE INDEX "PurchaseInvoice_tenantId_purchaseOrderId_number_key" ON "inventory"."PurchaseInvoice"("tenantId", "purchaseOrderId", "number");
CREATE INDEX "PurchaseInvoice_tenantId_purchaseOrderId_idx" ON "inventory"."PurchaseInvoice"("tenantId", "purchaseOrderId");
CREATE UNIQUE INDEX "PurchaseInvoiceLine_tenantId_id_key" ON "inventory"."PurchaseInvoiceLine"("tenantId", "id");
CREATE INDEX "PurchaseInvoiceLine_tenantId_invoiceId_idx" ON "inventory"."PurchaseInvoiceLine"("tenantId", "invoiceId");
CREATE INDEX "PurchaseInvoiceLine_tenantId_purchaseOrderLineId_idx" ON "inventory"."PurchaseInvoiceLine"("tenantId", "purchaseOrderLineId");

ALTER TABLE "inventory"."PurchaseInvoice"
  ADD CONSTRAINT "PurchaseInvoice_purchaseOrder_fkey" FOREIGN KEY ("tenantId", "purchaseOrderId")
  REFERENCES "inventory"."PurchaseOrder"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory"."PurchaseInvoiceLine"
  ADD CONSTRAINT "PurchaseInvoiceLine_invoice_fkey" FOREIGN KEY ("tenantId", "invoiceId")
  REFERENCES "inventory"."PurchaseInvoice"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PurchaseInvoiceLine_purchaseOrderLine_fkey" FOREIGN KEY ("tenantId", "purchaseOrderLineId")
  REFERENCES "inventory"."PurchaseOrderLine"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Orders already received (priced at receiving) get an invoice for what they received, so what
-- is owed on them stays the same.
INSERT INTO "inventory"."PurchaseInvoice" ("id", "tenantId", "purchaseOrderId", "number", "invoiceDate", "createdBy")
SELECT gen_random_uuid()::text, po."tenantId", po."id", 'INV-' || po."reference", po."orderDate", po."createdBy"
FROM "inventory"."PurchaseOrder" po
WHERE EXISTS (
  SELECT 1 FROM "inventory"."PurchaseOrderLine" l
  WHERE l."tenantId" = po."tenantId" AND l."purchaseOrderId" = po."id"
    AND l."receivedQuantity" > 0 AND l."unitCost" IS NOT NULL
);

INSERT INTO "inventory"."PurchaseInvoiceLine" ("id", "tenantId", "invoiceId", "purchaseOrderLineId", "quantity", "unitCost")
SELECT gen_random_uuid()::text, l."tenantId", i."id", l."id", l."receivedQuantity", l."unitCost"
FROM "inventory"."PurchaseOrderLine" l
JOIN "inventory"."PurchaseInvoice" i
  ON i."tenantId" = l."tenantId" AND i."purchaseOrderId" = l."purchaseOrderId"
WHERE l."receivedQuantity" > 0 AND l."unitCost" IS NOT NULL;

UPDATE "inventory"."PurchaseOrderLine"
SET "invoicedQuantity" = "receivedQuantity", "invoicedValue" = "receivedValue"
WHERE "receivedQuantity" > 0 AND "unitCost" IS NOT NULL;
