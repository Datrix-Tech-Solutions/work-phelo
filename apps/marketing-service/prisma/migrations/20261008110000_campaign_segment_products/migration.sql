-- A segment can be limited to people who have any of some products or services.
ALTER TABLE "marketing"."MarketingCampaignSegment"
  ADD COLUMN "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
