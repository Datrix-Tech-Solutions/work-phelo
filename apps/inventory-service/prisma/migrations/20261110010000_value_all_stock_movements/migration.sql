-- Stock out, transfers and adjustments now carry a unit and total cost like stock in, so their
-- Value is no longer zero. Stock out is valued at the item's selling price, the others at its
-- cost price. The receipt_values check still guarantees totalCost = quantity * unitCost.
ALTER TABLE "inventory"."StockMovement" DROP CONSTRAINT "StockMovement_no_issue_transfer_value";

-- Rows saved before this change have no value. Give them the item's current price: an estimate,
-- since the price at the time was never recorded. Rows already valued are left alone.
UPDATE "inventory"."StockMovement" m
SET "unitCost" = i."sellingPrice", "totalCost" = m."quantity" * i."sellingPrice"
FROM "inventory"."InventoryItem" i
WHERE i."tenantId" = m."tenantId" AND i."id" = m."itemId"
  AND m."type"::text = 'STOCK_OUT' AND m."unitCost" IS NULL AND i."sellingPrice" IS NOT NULL;

UPDATE "inventory"."StockMovement" m
SET "unitCost" = i."costPrice", "totalCost" = m."quantity" * i."costPrice"
FROM "inventory"."InventoryItem" i
WHERE i."tenantId" = m."tenantId" AND i."id" = m."itemId"
  AND m."type"::text IN ('TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT_INCREASE', 'ADJUSTMENT_DECREASE')
  AND m."unitCost" IS NULL AND i."costPrice" IS NOT NULL;
