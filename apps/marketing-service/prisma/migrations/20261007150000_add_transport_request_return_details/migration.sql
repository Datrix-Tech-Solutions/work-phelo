ALTER TABLE "marketing"."MarketingTransportRequest"
  ADD COLUMN "endingMileage" INTEGER,
  ADD COLUMN "endingCondition" "marketing"."MarketingVehicleCondition",
  ADD COLUMN "completionNotes" TEXT;
