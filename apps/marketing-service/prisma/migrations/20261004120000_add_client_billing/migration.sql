CREATE TYPE "marketing"."MarketingClientBillingState" AS ENUM (
  'SUBMITTED',
  'POSTED',
  'REVERSED',
  'REJECTED'
);

ALTER TABLE "marketing"."MarketingClient"
  ADD COLUMN "accountingEntityId" TEXT,
  ADD COLUMN "accountingEntityTypeId" TEXT;

CREATE TABLE "marketing"."MarketingClientBilling" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "productId" TEXT,
  "accountingTransactionId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "state" "marketing"."MarketingClientBillingState" NOT NULL DEFAULT 'SUBMITTED',
  "amount" DECIMAL(20, 2) NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingClientBilling_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingClientBilling_tenantId_accountingTransactionId_key"
  ON "marketing"."MarketingClientBilling"("tenantId", "accountingTransactionId");

CREATE UNIQUE INDEX "MarketingClientBilling_tenantId_idempotencyKey_key"
  ON "marketing"."MarketingClientBilling"("tenantId", "idempotencyKey");

CREATE INDEX "MarketingClientBilling_tenantId_clientId_idx"
  ON "marketing"."MarketingClientBilling"("tenantId", "clientId");

CREATE INDEX "MarketingClientBilling_tenantId_clientId_productId_state_idx"
  ON "marketing"."MarketingClientBilling"("tenantId", "clientId", "productId", "state");

ALTER TABLE "marketing"."MarketingClientBilling"
  ADD CONSTRAINT "MarketingClientBilling_clientId_fkey"
  FOREIGN KEY ("clientId")
  REFERENCES "marketing"."MarketingClient"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
