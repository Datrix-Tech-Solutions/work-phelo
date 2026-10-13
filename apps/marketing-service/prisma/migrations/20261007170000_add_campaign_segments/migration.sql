CREATE TYPE "marketing"."MarketingSegmentRecipientType" AS ENUM ('PROSPECT');

CREATE TABLE "marketing"."MarketingCampaignSegment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "recipientType" "marketing"."MarketingSegmentRecipientType" NOT NULL DEFAULT 'PROSPECT',
  "businessTypeIds" TEXT[],
  "pipelineStageIds" TEXT[],
  "includeProspectIds" TEXT[],
  "excludeProspectIds" TEXT[],
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingCampaignSegment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingCampaignSegment_tenantId_normalizedName_key"
  ON "marketing"."MarketingCampaignSegment"("tenantId", "normalizedName");
CREATE INDEX "MarketingCampaignSegment_tenantId_createdAt_idx"
  ON "marketing"."MarketingCampaignSegment"("tenantId", "createdAt");

ALTER TABLE "marketing"."MarketingCampaign"
  ADD COLUMN "segmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "segmentNames" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Campaigns made before saved segments used business types: they read as built-in segments.
UPDATE "marketing"."MarketingCampaign"
SET "segmentIds" = ARRAY(SELECT 'business-type:' || id FROM unnest("businessTypeIds") AS id),
    "segmentNames" = "businessTypeNames";

ALTER TABLE "marketing"."MarketingCampaign"
  ALTER COLUMN "segmentIds" SET NOT NULL,
  ALTER COLUMN "segmentNames" SET NOT NULL;
