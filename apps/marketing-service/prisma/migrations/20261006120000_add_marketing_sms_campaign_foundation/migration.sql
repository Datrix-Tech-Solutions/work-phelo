-- CreateEnum
CREATE TYPE "marketing"."MarketingSmsSenderIdentityStatus" AS ENUM ('DRAFT', 'PENDING_PROVIDER_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "marketing"."MarketingSmsCreditLedgerEntryType" AS ENUM ('INITIAL_ALLOCATION', 'PLAN_ALLOCATION', 'PURCHASE', 'ADMIN_GRANT', 'PROMOTIONAL', 'CAMPAIGN_RESERVATION', 'CAMPAIGN_CONSUMPTION', 'CAMPAIGN_RELEASE', 'CAMPAIGN_REFUND', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "marketing"."MarketingSmsCreditReservationStatus" AS ENUM ('ACTIVE', 'PARTIALLY_CONSUMED', 'CONSUMED', 'RELEASED', 'EXPIRED');

-- AlterTable
ALTER TABLE "marketing"."MarketingCampaign"
  ADD COLUMN "senderIdentityId" TEXT,
  ADD COLUMN "senderIdSnapshot" TEXT,
  ADD COLUMN "estimatedCredits" INTEGER,
  ADD COLUMN "reservedCredits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "consumedCredits" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "marketing"."MarketingCampaignRecipient"
  ADD COLUMN "segmentCount" INTEGER,
  ADD COLUMN "estimatedCredits" INTEGER,
  ADD COLUMN "senderIdSnapshot" TEXT,
  ADD COLUMN "senderIdentityId" TEXT;

-- CreateTable
CREATE TABLE "marketing"."MarketingSmsSenderIdentity" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "normalizedSenderId" TEXT NOT NULL,
  "displayName" TEXT,
  "provider" TEXT,
  "providerReference" TEXT,
  "status" "marketing"."MarketingSmsSenderIdentityStatus" NOT NULL DEFAULT 'DRAFT',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "requestedBy" TEXT,
  "requestedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedBy" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingSmsSenderIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing"."MarketingSmsWallet" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "availableCredits" INTEGER NOT NULL DEFAULT 0,
  "reservedCredits" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingSmsWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing"."MarketingSmsCreditLedgerEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "type" "marketing"."MarketingSmsCreditLedgerEntryType" NOT NULL,
  "credits" INTEGER NOT NULL,
  "availableBefore" INTEGER NOT NULL,
  "availableAfter" INTEGER NOT NULL,
  "reservedBefore" INTEGER NOT NULL,
  "reservedAfter" INTEGER NOT NULL,
  "campaignId" TEXT,
  "recipientId" TEXT,
  "reservationId" TEXT,
  "idempotencyKey" TEXT,
  "reason" TEXT,
  "metadata" JSONB,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MarketingSmsCreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing"."MarketingSmsCreditReservation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "campaignId" TEXT,
  "status" "marketing"."MarketingSmsCreditReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "reservedCredits" INTEGER NOT NULL,
  "consumedCredits" INTEGER NOT NULL DEFAULT 0,
  "releasedCredits" INTEGER NOT NULL DEFAULT 0,
  "idempotencyKey" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingSmsCreditReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSmsSenderIdentity_tenantId_normalizedSenderId_key" ON "marketing"."MarketingSmsSenderIdentity"("tenantId", "normalizedSenderId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSmsSenderIdentity_tenant_default_approved_key" ON "marketing"."MarketingSmsSenderIdentity"("tenantId") WHERE "isDefault" = true AND "status" = 'APPROVED';

-- CreateIndex
CREATE INDEX "MarketingSmsSenderIdentity_tenantId_status_idx" ON "marketing"."MarketingSmsSenderIdentity"("tenantId", "status");

-- CreateIndex
CREATE INDEX "MarketingSmsSenderIdentity_tenantId_isDefault_idx" ON "marketing"."MarketingSmsSenderIdentity"("tenantId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSmsWallet_tenantId_key" ON "marketing"."MarketingSmsWallet"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSmsCreditLedgerEntry_tenantId_idempotencyKey_key" ON "marketing"."MarketingSmsCreditLedgerEntry"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MarketingSmsCreditLedgerEntry_tenantId_walletId_createdAt_idx" ON "marketing"."MarketingSmsCreditLedgerEntry"("tenantId", "walletId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingSmsCreditLedgerEntry_tenantId_campaignId_idx" ON "marketing"."MarketingSmsCreditLedgerEntry"("tenantId", "campaignId");

-- CreateIndex
CREATE INDEX "MarketingSmsCreditLedgerEntry_tenantId_reservationId_idx" ON "marketing"."MarketingSmsCreditLedgerEntry"("tenantId", "reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSmsCreditReservation_tenantId_idempotencyKey_key" ON "marketing"."MarketingSmsCreditReservation"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MarketingSmsCreditReservation_tenantId_walletId_status_idx" ON "marketing"."MarketingSmsCreditReservation"("tenantId", "walletId", "status");

-- CreateIndex
CREATE INDEX "MarketingSmsCreditReservation_tenantId_campaignId_idx" ON "marketing"."MarketingSmsCreditReservation"("tenantId", "campaignId");

-- CreateIndex
CREATE INDEX "MarketingCampaign_tenantId_senderIdentityId_idx" ON "marketing"."MarketingCampaign"("tenantId", "senderIdentityId");

-- CreateIndex
CREATE INDEX "MarketingCampaignRecipient_tenantId_senderIdentityId_idx" ON "marketing"."MarketingCampaignRecipient"("tenantId", "senderIdentityId");

-- AddForeignKey
ALTER TABLE "marketing"."MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_senderIdentityId_fkey" FOREIGN KEY ("senderIdentityId") REFERENCES "marketing"."MarketingSmsSenderIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing"."MarketingCampaignRecipient" ADD CONSTRAINT "MarketingCampaignRecipient_senderIdentityId_fkey" FOREIGN KEY ("senderIdentityId") REFERENCES "marketing"."MarketingSmsSenderIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing"."MarketingSmsCreditLedgerEntry" ADD CONSTRAINT "MarketingSmsCreditLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "marketing"."MarketingSmsWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing"."MarketingSmsCreditReservation" ADD CONSTRAINT "MarketingSmsCreditReservation_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "marketing"."MarketingSmsWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
