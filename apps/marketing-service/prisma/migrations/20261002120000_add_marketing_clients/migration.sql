CREATE TYPE "marketing"."MarketingClientProductStatus" AS ENUM (
  'PENDING',
  'PURCHASED',
  'UNINTERESTED'
);

CREATE TABLE "marketing"."MarketingClient" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "normalizedCompanyName" TEXT NOT NULL,
  "businessTypeId" TEXT,
  "sourceTypeId" TEXT,
  "assignedUserId" TEXT NOT NULL,
  "locationLabel" TEXT NOT NULL,
  "latitude" DECIMAL(9, 6) NOT NULL,
  "longitude" DECIMAL(9, 6) NOT NULL,
  "isBillable" BOOLEAN NOT NULL DEFAULT false,
  "convertedFromProspectId" TEXT,
  "convertedAt" TIMESTAMP(3),
  "convertedByUserId" TEXT,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing"."MarketingClientContact" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "decisionMakerTypeId" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingClientContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing"."MarketingClientProduct" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "status" "marketing"."MarketingClientProductStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingClientProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingClient_convertedFromProspectId_key"
  ON "marketing"."MarketingClient"("convertedFromProspectId");

CREATE INDEX "MarketingClient_tenantId_normalizedCompanyName_idx"
  ON "marketing"."MarketingClient"("tenantId", "normalizedCompanyName");

CREATE INDEX "MarketingClient_tenantId_assignedUserId_idx"
  ON "marketing"."MarketingClient"("tenantId", "assignedUserId");

CREATE INDEX "MarketingClient_tenantId_createdAt_idx"
  ON "marketing"."MarketingClient"("tenantId", "createdAt");

CREATE INDEX "MarketingClientContact_tenantId_clientId_idx"
  ON "marketing"."MarketingClientContact"("tenantId", "clientId");

CREATE INDEX "MarketingClientContact_tenantId_decisionMakerTypeId_idx"
  ON "marketing"."MarketingClientContact"("tenantId", "decisionMakerTypeId");

CREATE UNIQUE INDEX "MarketingClientProduct_clientId_productId_key"
  ON "marketing"."MarketingClientProduct"("clientId", "productId");

CREATE INDEX "MarketingClientProduct_tenantId_clientId_idx"
  ON "marketing"."MarketingClientProduct"("tenantId", "clientId");

CREATE INDEX "MarketingClientProduct_tenantId_productId_idx"
  ON "marketing"."MarketingClientProduct"("tenantId", "productId");

CREATE INDEX "MarketingClientProduct_tenantId_status_idx"
  ON "marketing"."MarketingClientProduct"("tenantId", "status");

ALTER TABLE "marketing"."MarketingClient"
  ADD CONSTRAINT "MarketingClient_convertedFromProspectId_fkey"
  FOREIGN KEY ("convertedFromProspectId")
  REFERENCES "marketing"."MarketingProspect"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "marketing"."MarketingClientContact"
  ADD CONSTRAINT "MarketingClientContact_clientId_fkey"
  FOREIGN KEY ("clientId")
  REFERENCES "marketing"."MarketingClient"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "marketing"."MarketingClientProduct"
  ADD CONSTRAINT "MarketingClientProduct_clientId_fkey"
  FOREIGN KEY ("clientId")
  REFERENCES "marketing"."MarketingClient"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Interactions and follow-ups belong to a prospect, a client, or both
-- (rows made while prospecting keep their prospectId after conversion).
ALTER TABLE "marketing"."MarketingProspectInteraction"
  ALTER COLUMN "prospectId" DROP NOT NULL,
  ADD COLUMN "clientId" TEXT;

ALTER TABLE "marketing"."MarketingProspectFollowUp"
  ALTER COLUMN "prospectId" DROP NOT NULL,
  ADD COLUMN "clientId" TEXT;

CREATE INDEX "MarketingProspectInteraction_tenantId_clientId_occurredAt_idx"
  ON "marketing"."MarketingProspectInteraction"("tenantId", "clientId", "occurredAt");

CREATE INDEX "MarketingProspectFollowUp_tenantId_clientId_idx"
  ON "marketing"."MarketingProspectFollowUp"("tenantId", "clientId");

CREATE INDEX "MarketingProspectFollowUp_tenantId_clientId_status_idx"
  ON "marketing"."MarketingProspectFollowUp"("tenantId", "clientId", "status");

CREATE UNIQUE INDEX "MarketingProspectFollowUp_one_pending_per_client_key"
  ON "marketing"."MarketingProspectFollowUp"("tenantId", "clientId")
  WHERE "status" = 'PENDING';

ALTER TABLE "marketing"."MarketingProspectInteraction"
  ADD CONSTRAINT "MarketingProspectInteraction_clientId_fkey"
  FOREIGN KEY ("clientId")
  REFERENCES "marketing"."MarketingClient"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "marketing"."MarketingProspectFollowUp"
  ADD CONSTRAINT "MarketingProspectFollowUp_clientId_fkey"
  FOREIGN KEY ("clientId")
  REFERENCES "marketing"."MarketingClient"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "marketing"."MarketingProspectInteraction"
  ADD CONSTRAINT "MarketingProspectInteraction_owner_check"
  CHECK ("prospectId" IS NOT NULL OR "clientId" IS NOT NULL);

ALTER TABLE "marketing"."MarketingProspectFollowUp"
  ADD CONSTRAINT "MarketingProspectFollowUp_owner_check"
  CHECK ("prospectId" IS NOT NULL OR "clientId" IS NOT NULL);
