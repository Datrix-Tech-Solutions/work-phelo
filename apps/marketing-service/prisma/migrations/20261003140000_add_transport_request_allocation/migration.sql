ALTER TABLE "marketing"."MarketingTransportRequest"
  ADD COLUMN "vehicleAssetId" TEXT,
  ADD COLUMN "vehicleName" TEXT,
  ADD COLUMN "vehicleAssetNumber" TEXT,
  ADD COLUMN "driverEmployeeId" TEXT,
  ADD COLUMN "driverName" TEXT;

CREATE INDEX "MarketingTransportRequest_vehicle_date_idx"
  ON "marketing"."MarketingTransportRequest"("tenantId", "vehicleAssetId", "travelDate");
CREATE INDEX "MarketingTransportRequest_driver_date_idx"
  ON "marketing"."MarketingTransportRequest"("tenantId", "driverEmployeeId", "travelDate");
