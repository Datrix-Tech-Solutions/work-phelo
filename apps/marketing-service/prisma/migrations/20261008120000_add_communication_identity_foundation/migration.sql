-- CreateEnum
CREATE TYPE "marketing"."MarketingOwnershipStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "marketing"."MarketingInternalReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "marketing"."MarketingProviderVerificationStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "marketing"."MarketingSmsSenderIdentity"
  ADD COLUMN "tenantDomainId" TEXT,
  ADD COLUMN "purpose" TEXT,
  ADD COLUMN "ownershipStatus" "marketing"."MarketingOwnershipStatus" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "internalReviewStatus" "marketing"."MarketingInternalReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "providerStatus" "marketing"."MarketingProviderVerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  ADD COLUMN "providerReferenceId" TEXT,
  ADD COLUMN "providerSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "providerLastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "providerStatusReason" TEXT,
  ADD COLUMN "providerPayload" JSONB;

-- Backfill existing local sender state without inferring external provider approval.
UPDATE "marketing"."MarketingSmsSenderIdentity"
SET
  "internalReviewStatus" = CASE
    WHEN "status" = 'PENDING_PROVIDER_APPROVAL' THEN 'PENDING'::"marketing"."MarketingInternalReviewStatus"
    WHEN "status" = 'APPROVED' THEN 'APPROVED'::"marketing"."MarketingInternalReviewStatus"
    WHEN "status" = 'REJECTED' THEN 'REJECTED'::"marketing"."MarketingInternalReviewStatus"
    ELSE 'NOT_REQUIRED'::"marketing"."MarketingInternalReviewStatus"
  END,
  "providerStatus" = CASE
    WHEN "status" = 'APPROVED' THEN 'UNKNOWN'::"marketing"."MarketingProviderVerificationStatus"
    WHEN "status" = 'SUSPENDED' THEN 'SUSPENDED'::"marketing"."MarketingProviderVerificationStatus"
    ELSE 'NOT_SUBMITTED'::"marketing"."MarketingProviderVerificationStatus"
  END;

-- CreateTable
CREATE TABLE "marketing"."TenantDomain" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "normalizedDomain" TEXT NOT NULL,
  "ownershipStatus" "marketing"."MarketingOwnershipStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "verificationToken" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantDomain_normalizedDomain_key" ON "marketing"."TenantDomain"("normalizedDomain");

-- CreateIndex
CREATE INDEX "TenantDomain_tenantId_ownershipStatus_idx" ON "marketing"."TenantDomain"("tenantId", "ownershipStatus");

-- CreateIndex
CREATE INDEX "TenantDomain_tenantId_createdAt_idx" ON "marketing"."TenantDomain"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingSmsSenderIdentity_tenantId_ownershipStatus_idx" ON "marketing"."MarketingSmsSenderIdentity"("tenantId", "ownershipStatus");

-- CreateIndex
CREATE INDEX "MarketingSmsSenderIdentity_tenantId_internalReviewStatus_idx" ON "marketing"."MarketingSmsSenderIdentity"("tenantId", "internalReviewStatus");

-- CreateIndex
CREATE INDEX "MarketingSmsSenderIdentity_tenantId_providerStatus_idx" ON "marketing"."MarketingSmsSenderIdentity"("tenantId", "providerStatus");

-- CreateIndex
CREATE INDEX "MarketingSmsSenderIdentity_tenantId_tenantDomainId_idx" ON "marketing"."MarketingSmsSenderIdentity"("tenantId", "tenantDomainId");

-- AddForeignKey
ALTER TABLE "marketing"."MarketingSmsSenderIdentity" ADD CONSTRAINT "MarketingSmsSenderIdentity_tenantDomainId_fkey" FOREIGN KEY ("tenantDomainId") REFERENCES "marketing"."TenantDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
