CREATE TYPE "marketing"."MarketingProspectFollowUpStatus" AS ENUM (
  'PENDING',
  'COMPLETED',
  'CANCELLED'
);

CREATE TABLE "marketing"."MarketingProspectFollowUp" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "status" "marketing"."MarketingProspectFollowUpStatus" NOT NULL DEFAULT 'PENDING',
  "createdByUserId" TEXT,
  "completedByUserId" TEXT,
  "completedAt" TIMESTAMP(3),
  "completedInteractionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingProspectFollowUp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingProspectFollowUp_tenantId_status_dueAt_idx"
  ON "marketing"."MarketingProspectFollowUp"("tenantId", "status", "dueAt");

CREATE INDEX "MarketingProspectFollowUp_tenantId_prospectId_idx"
  ON "marketing"."MarketingProspectFollowUp"("tenantId", "prospectId");

CREATE INDEX "MarketingProspectFollowUp_tenantId_prospectId_status_idx"
  ON "marketing"."MarketingProspectFollowUp"("tenantId", "prospectId", "status");

CREATE UNIQUE INDEX "MarketingProspectFollowUp_one_pending_per_prospect_key"
  ON "marketing"."MarketingProspectFollowUp"("tenantId", "prospectId")
  WHERE "status" = 'PENDING';

ALTER TABLE "marketing"."MarketingProspectFollowUp"
  ADD CONSTRAINT "MarketingProspectFollowUp_prospectId_fkey"
  FOREIGN KEY ("prospectId")
  REFERENCES "marketing"."MarketingProspect"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
