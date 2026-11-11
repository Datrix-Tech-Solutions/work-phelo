CREATE TYPE "inventory"."PurchaseOrderStatus" AS ENUM ('ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

CREATE TABLE "inventory"."PurchaseOrder" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "orderDate" DATE NOT NULL,
  "expectedDate" DATE,
  "supplierId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "paymentTerms" TEXT,
  "notes" TEXT,
  "status" "inventory"."PurchaseOrderStatus" NOT NULL DEFAULT 'ORDERED',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory"."PurchaseOrderLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "variantName" TEXT,
  "orderedQuantity" DECIMAL(18,4) NOT NULL,
  "unitCost" DECIMAL(18,4) NOT NULL,
  "receivedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "extraQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrderLine_quantities_valid" CHECK (
    "orderedQuantity" > 0 AND "unitCost" >= 0 AND "extraQuantity" >= 0
    AND "receivedQuantity" >= 0 AND "receivedQuantity" <= "orderedQuantity"
  )
);

CREATE UNIQUE INDEX "PurchaseOrder_tenantId_id_key" ON "inventory"."PurchaseOrder"("tenantId", "id");
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_reference_key" ON "inventory"."PurchaseOrder"("tenantId", "reference");
CREATE INDEX "PurchaseOrder_tenantId_createdAt_id_idx" ON "inventory"."PurchaseOrder"("tenantId", "createdAt", "id");
CREATE INDEX "PurchaseOrder_tenantId_supplierId_idx" ON "inventory"."PurchaseOrder"("tenantId", "supplierId");
CREATE INDEX "PurchaseOrder_tenantId_locationId_idx" ON "inventory"."PurchaseOrder"("tenantId", "locationId");
CREATE UNIQUE INDEX "PurchaseOrderLine_tenantId_id_key" ON "inventory"."PurchaseOrderLine"("tenantId", "id");
CREATE INDEX "PurchaseOrderLine_tenantId_purchaseOrderId_idx" ON "inventory"."PurchaseOrderLine"("tenantId", "purchaseOrderId");
CREATE INDEX "PurchaseOrderLine_tenantId_itemId_idx" ON "inventory"."PurchaseOrderLine"("tenantId", "itemId");

ALTER TABLE "inventory"."PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_supplier_fkey" FOREIGN KEY ("tenantId", "supplierId")
    REFERENCES "inventory"."InventoryParty"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PurchaseOrder_location_fkey" FOREIGN KEY ("tenantId", "locationId")
    REFERENCES "inventory"."StockLocation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory"."PurchaseOrderLine"
  ADD CONSTRAINT "PurchaseOrderLine_order_fkey" FOREIGN KEY ("tenantId", "purchaseOrderId")
    REFERENCES "inventory"."PurchaseOrder"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PurchaseOrderLine_item_fkey" FOREIGN KEY ("tenantId", "itemId")
    REFERENCES "inventory"."InventoryItem"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The order line a stock in row was received against.
ALTER TABLE "inventory"."StockMovement" ADD COLUMN "purchaseOrderLineId" TEXT;
CREATE INDEX "StockMovement_tenantId_purchaseOrderLineId_idx" ON "inventory"."StockMovement"("tenantId", "purchaseOrderLineId");
ALTER TABLE "inventory"."StockMovement"
  ADD CONSTRAINT "StockMovement_purchaseOrderLine_fkey" FOREIGN KEY ("tenantId", "purchaseOrderLineId")
    REFERENCES "inventory"."PurchaseOrderLine"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
