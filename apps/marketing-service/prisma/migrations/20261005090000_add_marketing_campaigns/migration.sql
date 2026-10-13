CREATE TYPE "marketing"."MarketingCampaignChannel" AS ENUM ('SMS', 'EMAIL');
CREATE TYPE "marketing"."MarketingCampaignDispatchMode" AS ENUM ('INSTANT', 'SCHEDULED');
CREATE TYPE "marketing"."MarketingCampaignStatus" AS ENUM ('PENDING_DISPATCH', 'SCHEDULED', 'SENDING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "marketing"."MarketingCampaignRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "marketing"."MarketingCampaign" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "channels" "marketing"."MarketingCampaignChannel"[],
  "businessTypeId" TEXT NOT NULL,
  "businessTypeName" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "dispatchMode" "marketing"."MarketingCampaignDispatchMode" NOT NULL,
  "scheduledDate" DATE,
  "status" "marketing"."MarketingCampaignStatus" NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  "cancelledByUserId" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing"."MarketingCampaignRecipient" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "channel" "marketing"."MarketingCampaignChannel" NOT NULL,
  "address" TEXT,
  "status" "marketing"."MarketingCampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
  "providerDetail" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingCampaignRecipient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingCampaign_tenantId_createdAt_idx"
  ON "marketing"."MarketingCampaign"("tenantId", "createdAt");
CREATE INDEX "MarketingCampaign_tenantId_status_idx"
  ON "marketing"."MarketingCampaign"("tenantId", "status");
CREATE UNIQUE INDEX "MarketingCampaignRecipient_campaignId_contactId_channel_key"
  ON "marketing"."MarketingCampaignRecipient"("campaignId", "contactId", "channel");
CREATE INDEX "MarketingCampaignRecipient_tenantId_campaignId_status_idx"
  ON "marketing"."MarketingCampaignRecipient"("tenantId", "campaignId", "status");

ALTER TABLE "marketing"."MarketingCampaignRecipient"
  ADD CONSTRAINT "MarketingCampaignRecipient_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "marketing"."MarketingCampaign"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
