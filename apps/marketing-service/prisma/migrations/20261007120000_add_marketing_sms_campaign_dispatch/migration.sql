-- AlterEnum
ALTER TYPE "marketing"."MarketingCampaignStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "marketing"."MarketingCampaignStatus" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "marketing"."MarketingCampaignStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_COMPLETED';

-- AlterEnum
ALTER TYPE "marketing"."MarketingCampaignRecipientStatus" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "marketing"."MarketingCampaignRecipientStatus" ADD VALUE IF NOT EXISTS 'SENDING';
ALTER TYPE "marketing"."MarketingCampaignRecipientStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "marketing"."MarketingCampaignRecipientStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "marketing"."MarketingCampaignRecipientStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterTable
ALTER TABLE "marketing"."MarketingCampaign"
  ADD COLUMN "smsReservationId" TEXT,
  ADD COLUMN "dispatchedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "marketing"."MarketingCampaignRecipient"
  ADD COLUMN "smsReservationId" TEXT,
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "providerMessageId" TEXT,
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "acceptedAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3),
  ADD COLUMN "failureCode" TEXT,
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "creditConsumedAt" TIMESTAMP(3),
  ADD COLUMN "creditReleasedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MarketingCampaign_tenantId_smsReservationId_idx" ON "marketing"."MarketingCampaign"("tenantId", "smsReservationId");

-- CreateIndex
CREATE INDEX "MarketingCampaignRecipient_tenantId_campaignId_channel_status_idx" ON "marketing"."MarketingCampaignRecipient"("tenantId", "campaignId", "channel", "status");

-- CreateIndex
CREATE INDEX "MarketingCampaignRecipient_tenantId_providerMessageId_idx" ON "marketing"."MarketingCampaignRecipient"("tenantId", "providerMessageId");
