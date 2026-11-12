-- Units that arrived damaged are recorded on the order line: they are not stocked or counted as received.
ALTER TABLE "inventory"."PurchaseOrderLine" ADD COLUMN "damagedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0;
