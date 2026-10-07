ALTER TABLE "marketing"."MarketingTransportRequest" ADD COLUMN "appointmentId" TEXT;

CREATE INDEX "MarketingTransportRequest_tenantId_appointmentId_idx"
  ON "marketing"."MarketingTransportRequest"("tenantId", "appointmentId");
