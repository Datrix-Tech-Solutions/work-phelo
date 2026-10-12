-- What the requester asked for (vehicle, driver or self-drive), kept as a starting point for the approver.
ALTER TABLE "marketing"."MarketingTransportRequest"
  ADD COLUMN "preferredVehicleAssetId" TEXT,
  ADD COLUMN "preferredVehicleName" TEXT,
  ADD COLUMN "preferredDriverEmployeeId" TEXT,
  ADD COLUMN "preferredDriverName" TEXT,
  ADD COLUMN "preferredSelfDriven" BOOLEAN NOT NULL DEFAULT false;
