-- Segments and campaigns can now hold clients as well as prospects.
ALTER TYPE "marketing"."MarketingSegmentRecipientType" ADD VALUE 'CLIENT';

ALTER TABLE "marketing"."MarketingCampaignSegment"
  ADD COLUMN "includeClientIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "excludeClientIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- A recipient is a prospect's or a client's primary contact: exactly one of the two is set.
ALTER TABLE "marketing"."MarketingCampaignRecipient"
  ALTER COLUMN "prospectId" DROP NOT NULL,
  ADD COLUMN "clientId" TEXT,
  ADD CONSTRAINT "MarketingCampaignRecipient_one_audience_check"
    CHECK (("prospectId" IS NULL) <> ("clientId" IS NULL));
