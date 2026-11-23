-- CreateEnum
CREATE TYPE "marketing"."MarketingSmsCreditRequestStatus" AS ENUM ('PENDING', 'FULFILLED', 'REJECTED');

-- CreateTable
CREATE TABLE "marketing"."MarketingSmsCreditRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedCredits" INTEGER NOT NULL,
    "note" TEXT,
    "status" "marketing"."MarketingSmsCreditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedCredits" INTEGER,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "ledgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingSmsCreditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingSmsCreditRequest_tenantId_status_idx" ON "marketing"."MarketingSmsCreditRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "MarketingSmsCreditRequest_tenantId_requestedAt_idx" ON "marketing"."MarketingSmsCreditRequest"("tenantId", "requestedAt");

-- At most one open request per tenant
CREATE UNIQUE INDEX "MarketingSmsCreditRequest_one_pending_per_tenant" ON "marketing"."MarketingSmsCreditRequest"("tenantId") WHERE "status" = 'PENDING';
