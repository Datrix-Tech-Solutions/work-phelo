-- Items can be flagged perishable. Existing items default to non-perishable.
ALTER TABLE "inventory"."InventoryItem" ADD COLUMN "isPerishable" BOOLEAN NOT NULL DEFAULT false;

-- A stock in line can record the batch/lot it belongs to and, for perishable items, when it was
-- made and when it expires. Stored on the stock in movement itself; null everywhere else.
ALTER TABLE "inventory"."StockMovement"
  ADD COLUMN "lotNumber" TEXT,
  ADD COLUMN "manufactureDate" DATE,
  ADD COLUMN "expiryDate" DATE;

CREATE INDEX "StockMovement_tenantId_itemId_lotNumber_idx"
  ON "inventory"."StockMovement"("tenantId", "itemId", "lotNumber");

ALTER TABLE "inventory"."StockMovement"
  ADD CONSTRAINT "StockMovement_lot_details_stock_in_only"
    CHECK ("type" = 'STOCK_IN' OR ("lotNumber" IS NULL AND "manufactureDate" IS NULL AND "expiryDate" IS NULL)),
  ADD CONSTRAINT "StockMovement_expiry_after_manufacture"
    CHECK ("manufactureDate" IS NULL OR "expiryDate" IS NULL OR "expiryDate" >= "manufactureDate");
