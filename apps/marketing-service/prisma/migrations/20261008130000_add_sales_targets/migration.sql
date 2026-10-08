-- A sales rep's revenue target for a period, in total or for one product.
CREATE TABLE "marketing"."MarketingSalesTarget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingSalesTarget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingSalesTarget_tenantId_userId_startDate_idx" ON "marketing"."MarketingSalesTarget"("tenantId", "userId", "startDate");
CREATE INDEX "MarketingSalesTarget_tenantId_startDate_endDate_idx" ON "marketing"."MarketingSalesTarget"("tenantId", "startDate", "endDate");
CREATE INDEX "MarketingSalesTarget_tenantId_productId_idx" ON "marketing"."MarketingSalesTarget"("tenantId", "productId");
