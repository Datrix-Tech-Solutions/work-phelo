ALTER TYPE "inventory"."StockMovementType" ADD VALUE 'ADJUSTMENT_INCREASE';
ALTER TYPE "inventory"."StockMovementType" ADD VALUE 'ADJUSTMENT_DECREASE';

CREATE TYPE "inventory"."StockAdjustmentReason" AS ENUM
  ('DAMAGE', 'LOSS', 'THEFT', 'PHYSICAL_COUNT_DIFFERENCE', 'DATA_CORRECTION', 'EXPIRED_GOODS', 'OTHER');

ALTER TABLE "inventory"."StockMovement"
  ADD COLUMN "adjustmentReason" "inventory"."StockAdjustmentReason";

-- Text comparisons allow new enum labels before their transaction commits.
-- The existing non-receipt cost constraint also covers adjustments.
ALTER TABLE "inventory"."StockMovement"
  ADD CONSTRAINT "StockMovement_adjustment_reason" CHECK
    ("type"::text NOT IN ('ADJUSTMENT_INCREASE', 'ADJUSTMENT_DECREASE') OR "adjustmentReason" IS NOT NULL);
