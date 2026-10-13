ALTER TYPE "marketing"."MarketingTransportRequestStatus" ADD VALUE 'COMPLETED';

ALTER TABLE "marketing"."MarketingTransportRequest"
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "completedByUserId" TEXT,
  ADD COLUMN "completedByName" TEXT,
  ADD COLUMN "actualReturnTime" TEXT,
  ADD COLUMN "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rescheduledAt" TIMESTAMP(3),
  ADD COLUMN "rescheduledByName" TEXT,
  ADD COLUMN "previousTravelDate" DATE,
  ADD COLUMN "previousDepartureTime" TEXT,
  ADD COLUMN "previousReturnTime" TEXT;
