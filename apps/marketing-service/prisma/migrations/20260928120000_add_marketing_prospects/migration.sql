CREATE TABLE "marketing"."MarketingProspect" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "normalizedCompanyName" TEXT NOT NULL,
  "businessTypeId" TEXT,
  "sourceTypeId" TEXT,
  "pipelineStageId" TEXT NOT NULL,
  "assignedUserId" TEXT NOT NULL,
  "locationLabel" TEXT NOT NULL,
  "latitude" DECIMAL(9, 6) NOT NULL,
  "longitude" DECIMAL(9, 6) NOT NULL,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingProspect_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing"."MarketingProspectContact" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "decisionMakerTypeId" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingProspectContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing"."MarketingProspectProduct" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "expectedValue" DECIMAL(18, 2) NOT NULL,
  "achievedValue" DECIMAL(18, 2),
  "commissionRate" DECIMAL(7, 4),
  "commissionAmount" DECIMAL(18, 2),
  "expectedCloseDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingProspectProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing"."MarketingProspectInteraction" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "interactionMediumId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MarketingProspectInteraction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingProspect_tenantId_normalizedCompanyName_idx"
  ON "marketing"."MarketingProspect"("tenantId", "normalizedCompanyName");

CREATE INDEX "MarketingProspect_tenantId_assignedUserId_idx"
  ON "marketing"."MarketingProspect"("tenantId", "assignedUserId");

CREATE INDEX "MarketingProspect_tenantId_pipelineStageId_idx"
  ON "marketing"."MarketingProspect"("tenantId", "pipelineStageId");

CREATE INDEX "MarketingProspect_tenantId_createdAt_idx"
  ON "marketing"."MarketingProspect"("tenantId", "createdAt");

CREATE INDEX "MarketingProspectContact_tenantId_prospectId_idx"
  ON "marketing"."MarketingProspectContact"("tenantId", "prospectId");

CREATE INDEX "MarketingProspectContact_tenantId_decisionMakerTypeId_idx"
  ON "marketing"."MarketingProspectContact"("tenantId", "decisionMakerTypeId");

CREATE UNIQUE INDEX "MarketingProspectContact_primary_contact_key"
  ON "marketing"."MarketingProspectContact"("tenantId", "prospectId")
  WHERE "isPrimary" = true;

CREATE INDEX "MarketingProspectProduct_tenantId_prospectId_idx"
  ON "marketing"."MarketingProspectProduct"("tenantId", "prospectId");

CREATE INDEX "MarketingProspectProduct_tenantId_productId_idx"
  ON "marketing"."MarketingProspectProduct"("tenantId", "productId");

CREATE INDEX "MarketingProspectProduct_tenantId_expectedCloseDate_idx"
  ON "marketing"."MarketingProspectProduct"("tenantId", "expectedCloseDate");

CREATE INDEX "MarketingProspectInteraction_tenantId_prospectId_occurredAt_idx"
  ON "marketing"."MarketingProspectInteraction"("tenantId", "prospectId", "occurredAt");

CREATE INDEX "MarketingProspectInteraction_tenantId_interactionMediumId_idx"
  ON "marketing"."MarketingProspectInteraction"("tenantId", "interactionMediumId");

ALTER TABLE "marketing"."MarketingProspectContact"
  ADD CONSTRAINT "MarketingProspectContact_prospectId_fkey"
  FOREIGN KEY ("prospectId")
  REFERENCES "marketing"."MarketingProspect"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "marketing"."MarketingProspectProduct"
  ADD CONSTRAINT "MarketingProspectProduct_prospectId_fkey"
  FOREIGN KEY ("prospectId")
  REFERENCES "marketing"."MarketingProspect"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "marketing"."MarketingProspectInteraction"
  ADD CONSTRAINT "MarketingProspectInteraction_prospectId_fkey"
  FOREIGN KEY ("prospectId")
  REFERENCES "marketing"."MarketingProspect"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
