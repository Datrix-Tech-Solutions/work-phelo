ALTER TYPE "inventory"."StockMovementType" ADD VALUE 'STOCK_OUT';
ALTER TYPE "inventory"."StockMovementType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "inventory"."StockMovementType" ADD VALUE 'TRANSFER_IN';

CREATE TYPE "inventory"."StockOutPurpose" AS ENUM
  ('INTERNAL_USE', 'SALE', 'CONSUMPTION', 'PROJECT_USE', 'EMPLOYEE_ISSUE', 'DAMAGE', 'OTHER');

ALTER TABLE "inventory"."StockMovement"
  ADD COLUMN "recipient" TEXT,
  ADD COLUMN "purpose" "inventory"."StockOutPurpose",
  ADD COLUMN "transferId" TEXT;

CREATE INDEX "StockMovement_tenantId_transferId_idx" ON "inventory"."StockMovement"("tenantId", "transferId");

-- Text comparisons avoid using newly-added enum values before their transaction commits.
-- Existing STOCK_IN rows and receipt-value checks remain unchanged.
ALTER TABLE "inventory"."StockMovement"
  ADD CONSTRAINT "StockMovement_issue_purpose" CHECK
    ("type"::text <> 'STOCK_OUT' OR "purpose" IS NOT NULL),
  ADD CONSTRAINT "StockMovement_transfer_link" CHECK
    ("type"::text NOT IN ('TRANSFER_OUT', 'TRANSFER_IN') OR "transferId" IS NOT NULL),
  ADD CONSTRAINT "StockMovement_no_issue_transfer_value" CHECK
    ("type"::text = 'STOCK_IN' OR ("unitCost" IS NULL AND "totalCost" IS NULL));
