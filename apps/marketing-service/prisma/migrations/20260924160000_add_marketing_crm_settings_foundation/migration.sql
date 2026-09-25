CREATE SCHEMA IF NOT EXISTS "marketing";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "marketing"."MarketingCrmSettingCategory" AS ENUM (
  'PRODUCT',
  'DECISION_MAKER',
  'SOURCE_TYPE',
  'INTERACTION_MEDIUM',
  'PROSPECT_BUSINESS_TYPE'
);

CREATE TABLE "marketing"."MarketingCrmSettingOption" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "category" "marketing"."MarketingCrmSettingCategory" NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "description" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingCrmSettingOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing"."MarketingPipelineStage" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "probability" INTEGER NOT NULL,
  "description" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingPipelineStage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketingPipelineStage_probability_check"
    CHECK ("probability" >= 0 AND "probability" <= 100)
);

CREATE INDEX "MarketingCrmSettingOption_tenantId_category_isActive_idx"
  ON "marketing"."MarketingCrmSettingOption"("tenantId", "category", "isActive");

CREATE INDEX "MarketingCrmSettingOption_tenantId_category_displayOrder_idx"
  ON "marketing"."MarketingCrmSettingOption"("tenantId", "category", "displayOrder");

CREATE INDEX "MarketingCrmSettingOption_tenantId_category_archivedAt_idx"
  ON "marketing"."MarketingCrmSettingOption"("tenantId", "category", "archivedAt");

CREATE INDEX "MarketingCrmSettingOption_tenantId_category_normalizedName_idx"
  ON "marketing"."MarketingCrmSettingOption"("tenantId", "category", "normalizedName");

CREATE UNIQUE INDEX "MarketingCrmSettingOption_active_normalized_name_key"
  ON "marketing"."MarketingCrmSettingOption"("tenantId", "category", "normalizedName")
  WHERE "archivedAt" IS NULL;

CREATE INDEX "MarketingPipelineStage_tenantId_isActive_idx"
  ON "marketing"."MarketingPipelineStage"("tenantId", "isActive");

CREATE INDEX "MarketingPipelineStage_tenantId_displayOrder_idx"
  ON "marketing"."MarketingPipelineStage"("tenantId", "displayOrder");

CREATE INDEX "MarketingPipelineStage_tenantId_archivedAt_idx"
  ON "marketing"."MarketingPipelineStage"("tenantId", "archivedAt");

CREATE INDEX "MarketingPipelineStage_tenantId_normalizedName_idx"
  ON "marketing"."MarketingPipelineStage"("tenantId", "normalizedName");

CREATE UNIQUE INDEX "MarketingPipelineStage_active_normalized_name_key"
  ON "marketing"."MarketingPipelineStage"("tenantId", "normalizedName")
  WHERE "archivedAt" IS NULL;
