-- A batch/lot received by a stock in line that names a batch number or an expiry date. Stock in
-- sets remainingQuantity to the quantity received; stock out draws it down.
CREATE TABLE "inventory"."StockLot" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "variantId" TEXT,
  "lotNumber" TEXT,
  "manufactureDate" DATE,
  "expiryDate" DATE,
  "receivedQuantity" DECIMAL(18,4) NOT NULL,
  "remainingQuantity" DECIMAL(18,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockLot_remaining_within_received"
    CHECK ("remainingQuantity" >= 0 AND "remainingQuantity" <= "receivedQuantity")
);

CREATE UNIQUE INDEX "StockLot_tenantId_id_key" ON "inventory"."StockLot"("tenantId", "id");
CREATE INDEX "StockLot_tenantId_itemId_locationId_idx" ON "inventory"."StockLot"("tenantId", "itemId", "locationId");
CREATE INDEX "StockLot_tenantId_locationId_idx" ON "inventory"."StockLot"("tenantId", "locationId");
CREATE INDEX "StockLot_tenantId_variantId_idx" ON "inventory"."StockLot"("tenantId", "variantId");

ALTER TABLE "inventory"."StockLot"
  ADD CONSTRAINT "StockLot_item_fkey" FOREIGN KEY ("tenantId", "itemId")
    REFERENCES "inventory"."InventoryItem"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "StockLot_location_fkey" FOREIGN KEY ("tenantId", "locationId")
    REFERENCES "inventory"."StockLocation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "StockLot_variant_fkey" FOREIGN KEY ("tenantId", "variantId")
    REFERENCES "inventory"."ItemVariant"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The lot a movement concerns: set on the stock in that created it and on stock out that drew on it.
ALTER TABLE "inventory"."StockMovement" ADD COLUMN "lotId" TEXT;
CREATE INDEX "StockMovement_tenantId_lotId_idx" ON "inventory"."StockMovement"("tenantId", "lotId");

-- Lots already recorded on stock in rows become StockLot rows (same id as the movement), still
-- holding everything received since nothing could be issued from them before.
INSERT INTO "inventory"."StockLot"
  ("id", "tenantId", "itemId", "locationId", "variantId", "lotNumber", "manufactureDate", "expiryDate",
   "receivedQuantity", "remainingQuantity", "createdAt")
SELECT "id", "tenantId", "itemId", "locationId", "variantId", "lotNumber", "manufactureDate", "expiryDate",
       "quantity", "quantity", "createdAt"
FROM "inventory"."StockMovement"
WHERE "type" = 'STOCK_IN' AND ("lotNumber" IS NOT NULL OR "expiryDate" IS NOT NULL);

UPDATE "inventory"."StockMovement" SET "lotId" = "id"
WHERE "type" = 'STOCK_IN' AND ("lotNumber" IS NOT NULL OR "expiryDate" IS NOT NULL);

ALTER TABLE "inventory"."StockMovement"
  ADD CONSTRAINT "StockMovement_lot_fkey" FOREIGN KEY ("tenantId", "lotId")
    REFERENCES "inventory"."StockLot"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
