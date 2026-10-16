-- Tenant-wide CRM preferences, starting with how many days after a prospect's last interaction the
-- automatic follow-up falls due.
CREATE TABLE "marketing"."MarketingCrmPreference" (
  "tenantId" TEXT NOT NULL,
  "followUpDelayDays" INTEGER NOT NULL DEFAULT 7,
  "updatedByUserId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingCrmPreference_pkey" PRIMARY KEY ("tenantId")
);
