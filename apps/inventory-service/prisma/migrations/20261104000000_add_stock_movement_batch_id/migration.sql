-- Movements saved together (several items on one stock in/out, transfer or adjustment) share a
-- batchId so they read back as one movement. Null for movements saved one at a time.
ALTER TABLE "inventory"."StockMovement" ADD COLUMN "batchId" TEXT;

CREATE INDEX "StockMovement_tenantId_batchId_idx" ON "inventory"."StockMovement"("tenantId", "batchId");
