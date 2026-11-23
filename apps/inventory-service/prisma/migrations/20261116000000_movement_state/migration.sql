-- Whether a movement was later reversed, cancelled or deleted is kept here so every user sees it.
CREATE TYPE "inventory"."StockMovementState" AS ENUM ('ACTIVE', 'REVERSED', 'CANCELLED', 'DELETED', 'OFFSET');

ALTER TABLE "inventory"."StockMovement"
  ADD COLUMN "state" "inventory"."StockMovementState" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "stateChangedBy" TEXT,
  ADD COLUMN "stateChangedAt" TIMESTAMP(3);
