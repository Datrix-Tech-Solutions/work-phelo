CREATE TYPE "marketing"."MarketingVehicleCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR');

ALTER TABLE "marketing"."MarketingTransportRequest"
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "startedByUserId" TEXT,
  ADD COLUMN "startedByName" TEXT,
  ADD COLUMN "actualDepartureTime" TEXT,
  ADD COLUMN "startingMileage" INTEGER,
  ADD COLUMN "startingCondition" "marketing"."MarketingVehicleCondition",
  ADD COLUMN "startNotes" TEXT;

-- Trips that were already running by the clock keep running: mark them started at their departure.
UPDATE "marketing"."MarketingTransportRequest"
SET "startedAt" = ("travelDate"::timestamp + "departureTime"::time),
    "actualDepartureTime" = "departureTime"
WHERE "status" = 'APPROVED'
  AND ("travelDate" < CURRENT_DATE
    OR ("travelDate" = CURRENT_DATE AND "departureTime"::time <= LOCALTIME));
