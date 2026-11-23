-- The unit cost is entered when goods are received rather than when the order is placed. A line
-- keeps the latest cost entered, and receivedValue totals what is owed across its receipts.
ALTER TABLE "inventory"."PurchaseOrderLine" ALTER COLUMN "unitCost" DROP NOT NULL;
ALTER TABLE "inventory"."PurchaseOrderLine" ADD COLUMN "receivedValue" DECIMAL(18,4) NOT NULL DEFAULT 0;
UPDATE "inventory"."PurchaseOrderLine" SET "receivedValue" = "receivedQuantity" * "unitCost" WHERE "unitCost" IS NOT NULL;
