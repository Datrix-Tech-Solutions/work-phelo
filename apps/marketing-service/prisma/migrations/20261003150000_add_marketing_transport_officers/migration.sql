CREATE TABLE "marketing"."MarketingTransportOfficer" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deactivatedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingTransportOfficer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingTransportOfficer_tenantId_employeeId_key"
  ON "marketing"."MarketingTransportOfficer"("tenantId", "employeeId");
CREATE INDEX "MarketingTransportOfficer_tenantId_isActive_idx"
  ON "marketing"."MarketingTransportOfficer"("tenantId", "isActive");
