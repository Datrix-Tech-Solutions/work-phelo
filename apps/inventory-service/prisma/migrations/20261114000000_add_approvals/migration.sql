-- Purchase orders and stock movements are approved before they take effect. Existing orders keep
-- their status (ORDERED and later mean approved) and have no recorded approver.
ALTER TYPE "inventory"."PurchaseOrderStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "inventory"."PurchaseOrderStatus" ADD VALUE 'REJECTED';

ALTER TABLE "inventory"."PurchaseOrder"
  ADD COLUMN "approvedBy" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedBy" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT;

ALTER TABLE "inventory"."StockMovement" ADD COLUMN "approvedBy" TEXT;

CREATE TYPE "inventory"."StockMovementRequestKind" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'TRANSFER', 'ADJUSTMENT');
CREATE TYPE "inventory"."StockMovementRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "inventory"."StockMovementRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "kind" "inventory"."StockMovementRequestKind" NOT NULL,
  "reference" TEXT,
  "payload" JSONB NOT NULL,
  "status" "inventory"."StockMovementRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedBy" TEXT,
  "decidedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "batchId" TEXT,
  CONSTRAINT "StockMovementRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockMovementRequest_tenantId_id_key" ON "inventory"."StockMovementRequest"("tenantId", "id");
CREATE INDEX "StockMovementRequest_tenantId_status_createdAt_idx" ON "inventory"."StockMovementRequest"("tenantId", "status", "createdAt");
